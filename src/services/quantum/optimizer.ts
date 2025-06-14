import { Complex, QuantumConfig, OptimizationResult, OptimizationContext, ParticleState, QuantumState } from './types';
import { Asset, PortfolioConstraints } from '@/types/trading';

export class QuantumOptimizer {
  private readonly config: QuantumConfig;
  private particles: ParticleState[];
  private quantumStates: QuantumState[][];
  private globalBestPosition: number[];
  private globalBestFitness: number;

  constructor(config: QuantumConfig) {
    this.config = {
      particles: config.particles || 100,
      iterations: config.iterations || 1000,
      convergenceThreshold: config.convergenceThreshold || 1e-6
    };
    this.particles = [];
    this.quantumStates = [];
    this.globalBestPosition = [];
    this.globalBestFitness = -Infinity;
  }

  async optimize(context: OptimizationContext): Promise<OptimizationResult> {
    this.initializeQuantumStates(context.assets.length);
    this.initializeParticles(context);

    let iteration = 0;
    let converged = false;
    let previousBestFitness = -Infinity;

    while (iteration < this.config.iterations && !converged) {
      // Quantum phase estimation
      this.evolveQuantumStates();

      // Update particle positions based on quantum states
      await this.updateParticles(context);

      // Evaluate fitness and update best positions
      await this.evaluateParticles(context);

      // Check convergence
      if (Math.abs(this.globalBestFitness - previousBestFitness) < this.config.convergenceThreshold) {
        converged = true;
      }
      previousBestFitness = this.globalBestFitness;
      iteration++;
    }

    return this.constructOptimizationResult(context);
  }

  private initializeQuantumStates(dimension: number) {
    this.quantumStates = Array(this.config.particles).fill(null).map(() =>
      Array(dimension).fill(null).map(() => ({
        amplitude: this.createComplex(Math.random(), Math.random()),
        phase: Math.random() * 2 * Math.PI
      }))
    );
  }

  private initializeParticles(context: OptimizationContext) {
    this.particles = Array(this.config.particles).fill(null).map(() => {
      const position = this.generateRandomAllocation(context.assets.length, context.constraints);
      return {
        position,
        velocity: Array(context.assets.length).fill(0),
        bestPosition: [...position],
        bestFitness: -Infinity
      };
    });
  }

  private async evolveQuantumStates() {
    this.quantumStates = this.quantumStates.map(particleStates =>
      particleStates.map(state => {
        // Apply quantum walk algorithm
        const newPhase = (state.phase + Math.random() * Math.PI) % (2 * Math.PI);
        const newAmplitude = this.createComplex(
          Math.cos(newPhase) * state.amplitude.real - Math.sin(newPhase) * state.amplitude.imaginary,
          Math.sin(newPhase) * state.amplitude.real + Math.cos(newPhase) * state.amplitude.imaginary
        );
        return { amplitude: newAmplitude, phase: newPhase };
      })
    );
  }

  private async updateParticles(context: OptimizationContext) {
    const inertiaWeight = 0.7;
    const cognitiveWeight = 1.5;
    const socialWeight = 1.5;

    this.particles = await Promise.all(this.particles.map(async (particle, i) => {
      const newVelocity = particle.velocity.map((v, j) => {
        const cognitive = cognitiveWeight * Math.random() * (particle.bestPosition[j] - particle.position[j]);
        const social = socialWeight * Math.random() * (this.globalBestPosition[j] - particle.position[j]);
        return inertiaWeight * v + cognitive + social;
      });

      const newPosition = particle.position.map((p, j) => {
        // Incorporate quantum influence
        const quantumInfluence = this.calculateQuantumInfluence(this.quantumStates[i][j]);
        return this.clamp(p + newVelocity[j] + quantumInfluence, 0, 1);
      });

      // Normalize to satisfy sum constraint
      const normalizedPosition = this.normalizeAllocation(newPosition);

      return {
        ...particle,
        position: normalizedPosition,
        velocity: newVelocity
      };
    }));
  }

  private async evaluateParticles(context: OptimizationContext) {
    await Promise.all(this.particles.map(async (particle) => {
      const fitness = await this.calculateFitness(particle.position, context);

      if (fitness > particle.bestFitness) {
        particle.bestFitness = fitness;
        particle.bestPosition = [...particle.position];

        if (fitness > this.globalBestFitness) {
          this.globalBestFitness = fitness;
          this.globalBestPosition = [...particle.position];
        }
      }
    }));
  }

  private async calculateFitness(allocation: number[], context: OptimizationContext): Promise<number> {
    const { returns, volatility, correlation } = context.historicalData;
    const { maxVolatility, minSharpeRatio } = context.constraints.riskBudget;

    // Calculate expected return
    const expectedReturn = this.calculateExpectedReturn(allocation, returns);

    // Calculate portfolio volatility
    const portfolioVolatility = this.calculatePortfolioVolatility(
      allocation,
      volatility,
      correlation
    );

    // Calculate Sharpe ratio (assuming risk-free rate of 2%)
    const sharpeRatio = (expectedReturn - 0.02) / portfolioVolatility;

    // Penalize solutions that violate constraints
    let penalty = 0;
    if (portfolioVolatility > maxVolatility) {
      penalty += (portfolioVolatility - maxVolatility) * 100;
    }
    if (sharpeRatio < minSharpeRatio) {
      penalty += (minSharpeRatio - sharpeRatio) * 100;
    }

    // Final fitness score
    return sharpeRatio - penalty;
  }

  private calculateExpectedReturn(allocation: number[], returns: number[][]): number {
    return allocation.reduce((sum, weight, i) => {
      const assetReturn = returns[i].reduce((a, b) => a + b) / returns[i].length;
      return sum + weight * assetReturn;
    }, 0);
  }

  private calculatePortfolioVolatility(
    allocation: number[],
    volatility: number[],
    correlation: number[][]
  ): number {
    let portfolioVariance = 0;
    const n = allocation.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portfolioVariance +=
          allocation[i] *
          allocation[j] *
          volatility[i] *
          volatility[j] *
          correlation[i][j];
      }
    }

    return Math.sqrt(portfolioVariance);
  }

  private constructOptimizationResult(context: OptimizationContext): OptimizationResult {
    return {
      allocation: this.globalBestPosition,
      expectedReturn: this.calculateExpectedReturn(
        this.globalBestPosition,
        context.historicalData.returns
      ),
      confidence: this.calculateConfidence(),
      metrics: {
        sharpeRatio: this.globalBestFitness,
        volatility: this.calculatePortfolioVolatility(
          this.globalBestPosition,
          context.historicalData.volatility,
          context.historicalData.correlation
        ),
        maxDrawdown: this.calculateMaxDrawdown(this.globalBestPosition, context)
      }
    };
  }

  private calculateConfidence(): number {
    // Calculate confidence based on quantum state coherence
    const averageCoherence = this.quantumStates.reduce((sum, particleStates) => {
      const particleCoherence = particleStates.reduce((pSum, state) => {
        const magnitude = Math.sqrt(
          state.amplitude.real ** 2 + state.amplitude.imaginary ** 2
        );
        return pSum + magnitude;
      }, 0) / particleStates.length;
      return sum + particleCoherence;
    }, 0) / this.quantumStates.length;

    return this.clamp(averageCoherence, 0, 1);
  }

  private calculateMaxDrawdown(allocation: number[], context: OptimizationContext): number {
    // Simplified max drawdown calculation
    const returns = context.historicalData.returns;
    const portfolioReturns = returns[0].map((_, timeIndex) =>
      allocation.reduce((sum, weight, assetIndex) => 
        sum + weight * returns[assetIndex][timeIndex], 0
      )
    );

    let maxDrawdown = 0;
    let peak = -Infinity;
    
    for (const ret of portfolioReturns) {
      if (ret > peak) peak = ret;
      const drawdown = (peak - ret) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private createComplex(real: number, imaginary: number): Complex {
    return { real, imaginary };
  }

  private calculateQuantumInfluence(state: QuantumState): number {
    const magnitude = Math.sqrt(
      state.amplitude.real ** 2 + state.amplitude.imaginary ** 2
    );
    return magnitude * Math.cos(state.phase);
  }

  private generateRandomAllocation(size: number, constraints: PortfolioConstraints): number[] {
    const allocation = Array(size).fill(0).map(() => Math.random());
    return this.normalizeAllocation(allocation);
  }

  private normalizeAllocation(allocation: number[]): number[] {
    const sum = allocation.reduce((a, b) => a + b, 0);
    return allocation.map(value => value / sum);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export default QuantumOptimizer;
