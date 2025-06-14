/**
 * TODO: Proper type definitions for TensorFlow.js
 * Currently using 'any' types as a temporary solution due to type resolution issues.
 * This should be updated once the TensorFlow.js types are properly set up.
 */

declare namespace tf {
  const sequential: () => any;
  const layers: any;
  const train: any;
  const tensor2d: (data: any) => any;
  const loadLayersModel: (path: string) => Promise<any>;
  type Tensor = any;
  type History = any;
}

// Define types for better code documentation
type LayersModel = any;

interface CallbackLogs {
  loss: number;
  acc: number;
}

interface NeuralNetworkConfig {
  inputSize: number;
  hiddenLayers: number[];
  outputSize: number;
  learningRate: number;
  activationFunction: 'relu' | 'tanh' | 'sigmoid';
}

export class NeuralNetwork {
  private model: LayersModel;
  private config: NeuralNetworkConfig;

  constructor(config: NeuralNetworkConfig) {
    this.config = config;
    this.model = this.buildModel();
  }

  private buildModel(): LayersModel {
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      units: this.config.hiddenLayers[0],
      inputShape: [this.config.inputSize],
      activation: this.config.activationFunction
    }));

    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: this.config.hiddenLayers[i],
        activation: this.config.activationFunction
      }));
    }

    // Output layer
    model.add(tf.layers.dense({
      units: this.config.outputSize,
      activation: 'softmax'
    }));

    // Compile the model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  async predict(features: number[]): Promise<number[]> {
    const tensorFeatures = tf.tensor2d([features]);
    const prediction = this.model.predict(tensorFeatures) as tf.Tensor;
    const result = await prediction.array() as number[][];
    tensorFeatures.dispose();
    prediction.dispose();
    return result[0];
  }

  async train(
    features: number[][],
    labels: number[][],
    epochs: number = 100,
    batchSize: number = 32
  ): Promise<tf.History> {
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    const history = await this.model.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch: number, logs: CallbackLogs | undefined) => {
          if (logs) {
            console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
          }
        }
      }
    });

    xs.dispose();
    ys.dispose();

    return history;
  }

  async save(path: string): Promise<void> {
    await this.model.save(`file://${path}`);
  }

  async load(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}`);
  }

  dispose(): void {
    this.model.dispose();
  }
}
