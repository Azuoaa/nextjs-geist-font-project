// Market Data Types
export interface OrderBook {
  bids: [number, number][]; // Array of [price, volume] pairs
  asks: [number, number][]; // Array of [price, volume] pairs
  timestamp: number;
}

export interface MarketMicrostructure {
  vwap: number;
  volume: number;
  tradeCount: number;
  volatility: number;
  bidAskSpread: number;
  lastTradePrice: number;
  lastTradeSize: number;
  timestamp: number;
}

// Market and Asset Types
export interface Asset {
  symbol: string;
  price: number;
  volume: number;
  volatility: number;
}

export interface MarketData {
  price: number;
  volume: number;
  timestamp: number;
  indicators: TechnicalIndicators;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  ema: {
    short: number;
    medium: number;
    long: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}

// Trading Types
export interface Strategy {
  id: string;
  name: string;
  type: 'trend' | 'mean-reversion' | 'momentum' | 'ml-based';
  parameters: Record<string, any>;
  constraints: PortfolioConstraints;
}

export interface MarketConditions {
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: number;
  volume: number;
  sentiment: number;
  timestamp: number;
}

export interface TradingSignal {
  type: 'buy' | 'sell';
  strength: number;
  source: string;
  timestamp: number;
}

export interface Position {
  asset: string;
  size: number;
  entryPrice: number;
  leverage: number;
  timestamp: number;
}

// Risk Management Types
export interface PortfolioConstraints {
  riskTolerance: number;
  minAllocation: number;
  maxAllocation: number;
}

export interface RiskAssessment {
  overallRisk: number;
  breakdown: {
    market: number;
    volatility: number;
    liquidity: number;
    counterparty: number;
    systemic: number;
  };
  recommendations: string[];
}

// Blockchain and Analytics Types
export interface OnchainAnalytics {
  whaleMovements: {
    inflow: number;
    outflow: number;
    largeTransactions: number;
  };
  networkMetrics: {
    activeAddresses: number;
    transactionVolume: number;
    averageFee: number;
  };
  defiMetrics: {
    totalValueLocked: number;
    yield: number;
  };
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface PredictionResult {
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  timeframe: Timeframe;
  supportLevels: number[];
  resistanceLevels: number[];
}
