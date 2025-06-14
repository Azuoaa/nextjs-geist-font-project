/**
 * Technical Analysis Indicators
 * Implements common technical indicators used in trading
 */

export interface Pattern {
  type: 'buy' | 'sell';
  confidence: number;
  startIndex: number;
  endIndex: number;
  patternType: string;
}

/**
 * Calculates Exponential Moving Average
 */
export function exponentialMovingAverage(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Initialize EMA with SMA for first 'period' elements
  let sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  ema.push(sma);

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    const currentEma = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEma);
  }

  return ema;
}

/**
 * Calculates Relative Strength Index
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 50; // Default neutral value if not enough data
  }

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI using Wilder's smoothing method
  for (let i = period + 1; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      avgGain = (avgGain * (period - 1) + difference) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - difference) / period;
    }
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Detects common chart patterns
 */
export function detectPattern(prices: number[]): Pattern[] {
  const patterns: Pattern[] = [];
  const minPatternLength = 5;
  const maxPatternLength = 20;

  // Detect Double Bottom
  patterns.push(...detectDoubleBottom(prices));
  
  // Detect Double Top
  patterns.push(...detectDoubleTop(prices));
  
  // Detect Head and Shoulders
  patterns.push(...detectHeadAndShoulders(prices));

  return patterns;
}

/**
 * Detects Double Bottom pattern
 */
function detectDoubleBottom(prices: number[]): Pattern[] {
  const patterns: Pattern[] = [];
  const tolerance = 0.02; // 2% price difference tolerance

  for (let i = 0; i < prices.length - 20; i++) {
    for (let j = i + 5; j < prices.length - 5; j++) {
      // Check if two bottoms are within tolerance
      if (Math.abs(prices[i] - prices[j]) / prices[i] <= tolerance) {
        // Verify pattern characteristics
        const middleHigh = Math.max(...prices.slice(i, j));
        if (middleHigh > prices[i] * 1.03) { // At least 3% higher than bottoms
          patterns.push({
            type: 'buy',
            confidence: calculatePatternConfidence(prices, i, j, 'double_bottom'),
            startIndex: i,
            endIndex: j,
            patternType: 'double_bottom'
          });
        }
      }
    }
  }

  return patterns;
}

/**
 * Detects Double Top pattern
 */
function detectDoubleTop(prices: number[]): Pattern[] {
  const patterns: Pattern[] = [];
  const tolerance = 0.02; // 2% price difference tolerance

  for (let i = 0; i < prices.length - 20; i++) {
    for (let j = i + 5; j < prices.length - 5; j++) {
      // Check if two tops are within tolerance
      if (Math.abs(prices[i] - prices[j]) / prices[i] <= tolerance) {
        // Verify pattern characteristics
        const middleLow = Math.min(...prices.slice(i, j));
        if (middleLow < prices[i] * 0.97) { // At least 3% lower than tops
          patterns.push({
            type: 'sell',
            confidence: calculatePatternConfidence(prices, i, j, 'double_top'),
            startIndex: i,
            endIndex: j,
            patternType: 'double_top'
          });
        }
      }
    }
  }

  return patterns;
}

/**
 * Detects Head and Shoulders pattern
 */
function detectHeadAndShoulders(prices: number[]): Pattern[] {
  const patterns: Pattern[] = [];
  const tolerance = 0.02; // 2% price difference tolerance

  for (let i = 0; i < prices.length - 30; i++) {
    for (let j = i + 5; j < prices.length - 20; j++) {
      for (let k = j + 5; k < prices.length - 5; k++) {
        // Check if shoulders are at similar levels
        if (Math.abs(prices[i] - prices[k]) / prices[i] <= tolerance) {
          // Verify head is higher than shoulders
          const head = Math.max(...prices.slice(j - 2, j + 3));
          if (head > prices[i] * 1.02 && head > prices[k] * 1.02) {
            patterns.push({
              type: 'sell',
              confidence: calculatePatternConfidence(prices, i, k, 'head_and_shoulders'),
              startIndex: i,
              endIndex: k,
              patternType: 'head_and_shoulders'
            });
          }
        }
      }
    }
  }

  return patterns;
}

/**
 * Calculates the confidence level of a detected pattern
 */
function calculatePatternConfidence(
  prices: number[],
  startIndex: number,
  endIndex: number,
  patternType: string
): number {
  let confidence = 0.6; // Base confidence

  // Volume confirmation (if available)
  // Price action clarity
  const priceRange = Math.max(...prices.slice(startIndex, endIndex)) -
                    Math.min(...prices.slice(startIndex, endIndex));
  const avgPrice = prices[startIndex];
  confidence += (priceRange / avgPrice) * 0.2;

  // Pattern symmetry
  const patternLength = endIndex - startIndex;
  const idealLength = patternType === 'head_and_shoulders' ? 20 : 15;
  confidence += (1 - Math.abs(patternLength - idealLength) / idealLength) * 0.2;

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Bollinger Bands calculation
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = exponentialMovingAverage(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const std = calculateStandardDeviation(slice);
    upper.push(middle[i - period + 1] + stdDev * std);
    lower.push(middle[i - period + 1] - stdDev * std);
  }

  return { upper, middle, lower };
}

/**
 * Calculates Standard Deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(variance);
}
