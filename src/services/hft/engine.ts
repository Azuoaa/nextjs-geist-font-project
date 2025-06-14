import { OrderBook, MarketMicrostructure, Timeframe } from '@/types/trading';
import { NeuralNetwork } from '../ai/neural/network';
import { exponentialMovingAverage, calculateRSI, detectPattern } from '../technical/indicators';

interface TradingSignal {
  type: 'buy' | 'sell';
  strength: number;
  source: string;
  timestamp: number;
}

interface HiddenOrder {
  side: 'buy' | 'sell';
  confidence: number;
  size: number;
}

interface MLPrediction {
  prediction: 'buy' | 'sell' | 'hold';
  confidence: number;
}

interface MarketImpact {
  direction: 'buy' | 'sell';
  magnitude: number;
  significant: boolean;
}

interface SpreadAnalysis {
  anomaly: boolean;
  signal: 'buy' | 'sell';
  confidence: number;
}

interface PriceLevelChanges {
  volumeChange: number;
  priceChange: number;
}

export class HFTEngine {
  private neuralNet: NeuralNetwork;
  private orderBookHistory: OrderBook[] = [];
  private readonly maxHistorySize: number;
  private readonly signalThreshold: number;
  private readonly updateInterval: number; // in milliseconds
  private lastUpdate: number;
  private volatilityWindow: number[] = [];
  
  constructor(config: {
    historySize?: number;
    signalThreshold?: number;
    updateInterval?: number;
  } = {}) {
    this.maxHistorySize = config.historySize || 1000;
    this.signalThreshold = config.signalThreshold || 0.75;
    this.updateInterval = config.updateInterval || 100; // 100ms default
    this.lastUpdate = Date.now();
    
    // Initialize neural network in constructor
    this.neuralNet = new NeuralNetwork({
      inputSize: 256,
      hiddenLayers: [128, 64, 32],
      outputSize: 3, // buy, sell, hold
      learningRate: 0.001,
      activationFunction: 'relu'
    });
  }

  async analyze(params: {
    orderBook: OrderBook;
    marketMicrostructure: MarketMicrostructure;
    timeframe: Timeframe;
  }): Promise<TradingSignal[]> {
    const { orderBook, marketMicrostructure, timeframe } = params;
    const currentTime = Date.now();
    
    // Rate limiting check
    if (currentTime - this.lastUpdate < this.updateInterval) {
      return [];
    }
    this.lastUpdate = currentTime;

    // Update order book history
    this.updateOrderBookHistory(orderBook);

    const signals: TradingSignal[] = [];

    // Parallel analysis of different factors
    const [
      obImbalance,
      hiddenOrders,
      microstructureSignals,
      technicalSignals,
      mlPrediction
    ] = await Promise.all([
      this.analyzeOrderBookImbalance(orderBook),
      this.detectHiddenOrders(orderBook),
      this.analyzeMicrostructure(marketMicrostructure),
      this.analyzeTechnicalFactors(timeframe),
      this.getPredictionFromML(orderBook, marketMicrostructure)
    ]);

    // Combine and filter signals
    signals.push(
      ...this.processOrderBookImbalance(obImbalance),
      ...this.processHiddenOrders(hiddenOrders),
      ...microstructureSignals,
      ...technicalSignals,
      ...this.processMLPrediction(mlPrediction)
    );

    // Filter out weak signals and rank by strength
    return this.filterAndRankSignals(signals);
  }

  private updateOrderBookHistory(orderBook: OrderBook): void {
    this.orderBookHistory.push(orderBook);
    if (this.orderBookHistory.length > this.maxHistorySize) {
      this.orderBookHistory.shift();
    }
  }

  private async analyzeOrderBookImbalance(orderBook: OrderBook): Promise<number> {
    const bidVolume = orderBook.bids.reduce((sum, [_, volume]) => sum + volume, 0);
    const askVolume = orderBook.asks.reduce((sum, [_, volume]) => sum + volume, 0);
    
    // Calculate weighted imbalance based on price levels
    const weightedBidVolume = orderBook.bids.reduce((sum, [price, volume], index) => {
      const weight = Math.exp(-index * 0.1); // Exponential decay for further price levels
      return sum + volume * weight;
    }, 0);

    const weightedAskVolume = orderBook.asks.reduce((sum, [price, volume], index) => {
      const weight = Math.exp(-index * 0.1);
      return sum + volume * weight;
    }, 0);

    return (weightedBidVolume - weightedAskVolume) / (weightedBidVolume + weightedAskVolume);
  }

  private async detectHiddenOrders(orderBook: OrderBook): Promise<HiddenOrder[]> {
    const hiddenOrders: HiddenOrder[] = [];
    const volumeThreshold = this.calculateDynamicVolumeThreshold();

    // Analyze sudden changes in order book depth
    for (let i = 1; i < this.orderBookHistory.length; i++) {
      const current = this.orderBookHistory[i];
      const previous = this.orderBookHistory[i - 1];

      // Detect large orders being split into smaller ones
      const bidChanges = this.analyzePriceLevelChanges(previous.bids, current.bids);
      const askChanges = this.analyzePriceLevelChanges(previous.asks, current.asks);

      if (bidChanges.volumeChange > volumeThreshold) {
        hiddenOrders.push({
          side: 'buy',
          confidence: this.calculateConfidence(bidChanges),
          size: bidChanges.volumeChange
        });
      }

      if (askChanges.volumeChange > volumeThreshold) {
        hiddenOrders.push({
          side: 'sell',
          confidence: this.calculateConfidence(askChanges),
          size: askChanges.volumeChange
        });
      }
    }

    return hiddenOrders;
  }

  private async analyzeMicrostructure(marketMicrostructure: MarketMicrostructure): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    
    // Analyze trade flow toxicity
    const toxicity = this.calculateTradeToxicity(marketMicrostructure);
    if (Math.abs(toxicity) > this.signalThreshold) {
      signals.push({
        type: toxicity > 0 ? 'sell' : 'buy',
        strength: Math.abs(toxicity),
        source: 'trade_toxicity',
        timestamp: Date.now()
      });
    }

    // Analyze market impact
    const impact = this.calculateMarketImpact(marketMicrostructure);
    if (impact.significant) {
      signals.push({
        type: impact.direction,
        strength: impact.magnitude,
        source: 'market_impact',
        timestamp: Date.now()
      });
    }

    // Analyze spread patterns
    const spreadAnalysis = this.analyzeSpreadPatterns(marketMicrostructure);
    if (spreadAnalysis.anomaly) {
      signals.push({
        type: spreadAnalysis.signal,
        strength: spreadAnalysis.confidence,
        source: 'spread_analysis',
        timestamp: Date.now()
      });
    }

    return signals;
  }

  private async analyzeTechnicalFactors(timeframe: Timeframe): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    const prices = this.extractPricesFromOrderBook();
    
    // Calculate technical indicators
    const rsi = calculateRSI(prices, 14);
    const ema = exponentialMovingAverage(prices, 20);
    const patterns = detectPattern(prices);

    // Generate signals based on technical analysis
    if (rsi < 30 || rsi > 70) {
      signals.push({
        type: rsi < 30 ? 'buy' : 'sell',
        strength: Math.abs(rsi - 50) / 50,
        source: 'rsi',
        timestamp: Date.now()
      });
    }

    if (patterns.length > 0) {
      signals.push(...patterns.map(pattern => ({
        type: pattern.type,
        strength: pattern.confidence,
        source: 'pattern_recognition',
        timestamp: Date.now()
      })));
    }

    return signals;
  }

  private async getPredictionFromML(
    orderBook: OrderBook,
    marketMicrostructure: MarketMicrostructure
  ): Promise<MLPrediction> {
    const features = this.extractFeatures(orderBook, marketMicrostructure);
    const prediction = await this.neuralNet.predict(features);
    
    return {
      prediction: this.interpretPrediction(prediction),
      confidence: Math.max(...prediction)
    };
  }

  private processOrderBookImbalance(imbalance: number): TradingSignal[] {
    if (Math.abs(imbalance) < this.signalThreshold) {
      return [];
    }

    return [{
      type: imbalance > 0 ? 'buy' : 'sell',
      strength: Math.abs(imbalance),
      source: 'order_book_imbalance',
      timestamp: Date.now()
    }];
  }

  private processHiddenOrders(hiddenOrders: HiddenOrder[]): TradingSignal[] {
    return hiddenOrders.map(order => ({
      type: order.side,
      strength: order.confidence,
      source: 'hidden_order_detection',
      timestamp: Date.now()
    }));
  }

  private processMLPrediction(prediction: MLPrediction): TradingSignal[] {
    if (prediction.prediction === 'hold' || prediction.confidence < this.signalThreshold) {
      return [];
    }

    return [{
      type: prediction.prediction,
      strength: prediction.confidence,
      source: 'neural_network',
      timestamp: Date.now()
    }];
  }

  private calculateTradeToxicity(marketMicrostructure: MarketMicrostructure): number {
    // Calculate trade toxicity using order flow and price impact
    const { volume, tradeCount, volatility, bidAskSpread } = marketMicrostructure;
    
    // Normalize metrics
    const normalizedVolume = volume / this.getAverageVolume();
    const normalizedTradeCount = tradeCount / this.getAverageTradeCount();
    const normalizedSpread = bidAskSpread / this.getAverageSpread();
    
    // Weighted combination of factors
    return (
      normalizedVolume * 0.3 +
      normalizedTradeCount * 0.2 +
      volatility * 0.3 +
      normalizedSpread * 0.2
    );
  }

  private calculateMarketImpact(marketMicrostructure: MarketMicrostructure): MarketImpact {
    const { volume, lastTradePrice, lastTradeSize, bidAskSpread } = marketMicrostructure;
    
    // Calculate price impact relative to spread
    const impact = (lastTradeSize / volume) * (bidAskSpread / lastTradePrice);
    const direction = impact > 0 ? 'buy' : 'sell';
    const magnitude = Math.abs(impact);
    
    return {
      direction,
      magnitude,
      significant: magnitude > this.signalThreshold
    };
  }

  private analyzeSpreadPatterns(marketMicrostructure: MarketMicrostructure): SpreadAnalysis {
    const { bidAskSpread } = marketMicrostructure;
    const averageSpread = this.getAverageSpread();
    const spreadRatio = bidAskSpread / averageSpread;
    
    // Detect spread anomalies
    if (spreadRatio > 2) {
      return {
        anomaly: true,
        signal: 'sell', // Wide spread often indicates selling pressure
        confidence: Math.min(spreadRatio / 3, 1) // Cap confidence at 1
      };
    } else if (spreadRatio < 0.5) {
      return {
        anomaly: true,
        signal: 'buy', // Tight spread often indicates accumulation
        confidence: Math.min(1 / spreadRatio / 2, 1)
      };
    }
    
    return {
      anomaly: false,
      signal: 'buy',
      confidence: 0
    };
  }

  private getAverageVolume(): number {
    // Implementation would track rolling average volume
    return 1000; // Placeholder
  }

  private getAverageTradeCount(): number {
    // Implementation would track rolling average trade count
    return 100; // Placeholder
  }

  private getAverageSpread(): number {
    // Implementation would track rolling average spread
    return 0.001; // Placeholder
  }

  private filterAndRankSignals(signals: TradingSignal[]): TradingSignal[] {
    // Remove weak signals
    let filteredSignals = signals.filter(signal => 
      signal.strength >= this.signalThreshold
    );

    // Aggregate similar signals
    filteredSignals = this.aggregateSimilarSignals(filteredSignals);

    // Sort by strength
    return filteredSignals.sort((a, b) => b.strength - a.strength);
  }

  private aggregateSimilarSignals(signals: TradingSignal[]): TradingSignal[] {
    const aggregated = new Map<string, TradingSignal>();

    signals.forEach(signal => {
      const key = `${signal.type}-${signal.source}`;
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.strength = Math.max(existing.strength, signal.strength);
      } else {
        aggregated.set(key, { ...signal });
      }
    });

    return Array.from(aggregated.values());
  }

  private calculateDynamicVolumeThreshold(): number {
    const volumes = this.orderBookHistory.flatMap(ob => 
      [...ob.bids, ...ob.asks].map(([_, volume]) => volume)
    );
    
    const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const stdDev = Math.sqrt(
      volumes.reduce((sq, v) => sq + Math.pow(v - mean, 2), 0) / volumes.length
    );

    return mean + (2 * stdDev); // 2 standard deviations above mean
  }

  private analyzePriceLevelChanges(previous: [number, number][], current: [number, number][]): PriceLevelChanges {
    let volumeChange = 0;
    let priceChange = 0;

    // Calculate changes in volume and price
    for (let i = 0; i < Math.min(previous.length, current.length); i++) {
      volumeChange += Math.abs(current[i][1] - previous[i][1]);
      priceChange += Math.abs(current[i][0] - previous[i][0]);
    }

    return { volumeChange, priceChange };
  }

  private calculateConfidence(changes: PriceLevelChanges): number {
    // Normalize and combine multiple factors for confidence calculation
    const volumeFactor = Math.min(changes.volumeChange / this.calculateDynamicVolumeThreshold(), 1);
    const priceFactor = Math.min(changes.priceChange / 0.01, 1); // Assuming 1% price change as reference
    
    return (volumeFactor * 0.7 + priceFactor * 0.3); // Weighted average
  }

  private extractFeatures(orderBook: OrderBook, marketMicrostructure: MarketMicrostructure): number[] {
    // Convert order book and market microstructure data into ML features
    const features: number[] = [];
    
    // Order book features
    const bidLevels = orderBook.bids.slice(0, 10);
    const askLevels = orderBook.asks.slice(0, 10);
    
    bidLevels.forEach(([price, volume]) => {
      features.push(price, volume);
    });
    
    askLevels.forEach(([price, volume]) => {
      features.push(price, volume);
    });

    // Market microstructure features
    features.push(
      marketMicrostructure.vwap,
      marketMicrostructure.volume,
      marketMicrostructure.tradeCount,
      marketMicrostructure.volatility
    );

    return features;
  }

  private interpretPrediction(prediction: number[]): 'buy' | 'sell' | 'hold' {
    const [buy, sell, hold] = prediction;
    if (buy > sell && buy > hold && buy > this.signalThreshold) return 'buy';
    if (sell > buy && sell > hold && sell > this.signalThreshold) return 'sell';
    return 'hold';
  }

  private extractPricesFromOrderBook(): number[] {
    return this.orderBookHistory.map(ob => {
      const midPrice = (ob.bids[0][0] + ob.asks[0][0]) / 2;
      return midPrice;
    });
  }
}

export default HFTEngine;
