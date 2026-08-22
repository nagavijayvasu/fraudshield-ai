import type { TransactionInput, ModelWeights } from "./types.ts";

/**
 * Model input scaling factor.
 * The model was trained using internal normalized amount units (log-dollars).
 * Frontend transaction amounts in INR (₹) are scaled to these model input units by dividing by this factor.
 */
export const MODEL_AMOUNT_SCALE = 80;

export interface EngineeredFeatures {
  values: number[];
  featureNames: string[];
  raw: Record<string, number>;
}

export function engineerFeatures(input: TransactionInput): EngineeredFeatures {
  let hour = Number(input.hour_of_day);
  if (isNaN(hour)) {
    const txTime = input.transaction_time ? new Date(input.transaction_time) : new Date();
    hour = txTime.getHours();
  }
  const isNight = hour < 6 || hour > 22 ? 1 : 0;

  const amount = Number(input.amount) || 0;
  const recentTx = Number(input.recent_transaction_count) || 0;
  const velocity = Number(input.velocity_1h) || recentTx;
  const chargebacks = Number(input.previous_chargebacks) || 0;
  const failedTx = Number(input.failed_transaction_count) || 0;
  const isNewDevice = input.is_new_device ? 1 : 0;
  const isNewIp = input.is_new_ip ? 1 : 0;
  const distance = Number(input.distance_from_home) || 0;
  const deviceAccountCount = Number(input.device_account_count) || 1;
  const ipAccountCount = Number(input.ip_account_count) || 1;

  // Amount deviation — identical calculation to training pipeline
  const avgUserAmount = input.avg_user_amount !== undefined ? Number(input.avg_user_amount) : amount;
  const amountDeviation = Math.abs(amount - avgUserAmount) / Math.max(avgUserAmount, 1);

  const featureNames = [
    "amount",
    "hour_of_day",
    "is_night",
    "recent_transaction_count",
    "velocity_1h",
    "previous_chargebacks",
    "failed_transaction_count",
    "is_new_device",
    "is_new_ip",
    "distance_from_home",
    "device_account_count",
    "ip_account_count",
    "amount_deviation",
  ];

  const values = [
    amount,
    hour,
    isNight,
    recentTx,
    velocity,
    chargebacks,
    failedTx,
    isNewDevice,
    isNewIp,
    distance,
    deviceAccountCount,
    ipAccountCount,
    amountDeviation,
  ];

  const raw: Record<string, number> = {};
  featureNames.forEach((name, i) => {
    raw[name] = values[i];
  });

  return { values, featureNames, raw };
}

export function standardize(values: number[], weights: ModelWeights): number[] {
  return values.map((v, i) => (v - weights.scaler_mean[i]) / weights.scaler_scale[i]);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function predictFraud(features: EngineeredFeatures, weights: ModelWeights): {
  probability: number;
  contributions: { feature: string; value: number; contribution: number }[];
} {
  const standardized = standardize(features.values, weights);
  let logit = weights.intercept;
  const contributions: { feature: string; value: number; contribution: number }[] = [];

  for (let i = 0; i < weights.coefficients.length; i++) {
    const contribution = weights.coefficients[i] * standardized[i];
    logit += contribution;
    contributions.push({
      feature: weights.feature_names[i],
      value: features.values[i],
      contribution,
    });
  }

  const probability = sigmoid(logit);
  return { probability, contributions };
}
