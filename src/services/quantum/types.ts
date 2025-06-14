import { Asset, PortfolioConstraints } from '@/types/trading';

export interface QuantumState {
  amplitude: Complex;
  phase: number;
}

export interface Complex {
  real: number;
  imaginary: number;
}

export interface QuantumConfig {
  particles: number;
  iterations: number;
  convergenceThreshold: number;
}

export interface OptimizationResult {
  allocation: number[];
  expectedReturn: number;
  confidence: number;
  metrics: {
    sharpeRatio: number;
    volatility: number;
    maxDrawdown: number;
  };
}

export interface ParticleState {
  position: number[];
  velocity: number[];
  bestPosition: number[];
  bestFitness: number;
}

export interface QuantumCircuit {
  gates: QuantumGate[];
  qubits: number;
}

export interface QuantumGate {
  type: 'H' | 'X' | 'Y' | 'Z' | 'CNOT' | 'SWAP';
  target: number;
  control?: number;
  angle?: number;
}

export interface OptimizationConstraints extends PortfolioConstraints {
  minPositions: number;
  maxPositions: number;
  sectorDiversification: {
    [sector: string]: {
      min: number;
      max: number;
    };
  };
  riskBudget: {
    maxVolatility: number;
    maxDrawdown: number;
    minSharpeRatio: number;
  };
}

export interface MarketRegime {
  type: 'bull' | 'bear' | 'sideways' | 'volatile';
  confidence: number;
  metrics: {
    trendStrength: number;
    volatility: number;
    momentum: number;
  };
}

export interface OptimizationContext {
  assets: Asset[];
  constraints: OptimizationConstraints;
  marketRegime: MarketRegime;
  historicalData: {
    returns: number[][];
    volatility: number[];
    correlation: number[][];
  };
}
