import type { TransactionInput } from "./types.ts";

export interface AnomalyResult {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  signals: string[];
}

/**
 * Isolation-Forest-style behavioral anomaly detection.
 *
 * Instead of building an actual tree ensemble (which would be heavy for edge
 * deployment), we compute an anomaly score based on how many standard
 * deviations each behavioral signal deviates from expected baselines.
 *
 * This mirrors the concept: the fewer "random splits" needed to isolate a
 * point, the more anomalous it is. We approximate this with normalized
 * deviation scoring across behavioral dimensions.
 */
export function detectAnomaly(input: TransactionInput): AnomalyResult {
  const signals: string[] = [];
  let deviationSum = 0;
  let dimensions = 0;

  // Amount deviation — log-normal distribution baseline
  const amount = Number(input.amount) || 0;
  if (amount > 0) {
    const logAmount = Math.log(amount);
    // Expected mean ~3.2 (log scale), std ~0.9
    const amountZ = Math.abs(logAmount - 3.2) / 0.9;
    deviationSum += Math.min(amountZ, 3);
    dimensions++;
    if (amountZ > 1.5) signals.push("Unusual transaction amount for this user");
  }

  // Velocity deviation — Poisson baseline (lambda ~1.5)
  const velocity = Number(input.velocity_1h) || 0;
  if (velocity > 0) {
    const velocityZ = Math.abs(velocity - 1.5) / Math.sqrt(1.5);
    deviationSum += Math.min(velocityZ, 3);
    dimensions++;
    if (velocityZ > 1.5) signals.push("Transaction frequency significantly above baseline");
  }

  // Time-of-day deviation — expected daytime (8-22), night is anomalous
  const txTime = input.transaction_time ? new Date(input.transaction_time) : new Date();
  const hour = txTime.getHours();
  if (hour < 6 || hour > 22) {
    deviationSum += 1.5;
    dimensions++;
    signals.push("Transaction at unusual time of day");
  } else {
    dimensions++;
  }

  // Geographic deviation
  const distance = Number(input.distance_from_home) || 0;
  if (distance > 0) {
    const geoZ = distance / 200;
    deviationSum += Math.min(geoZ, 3);
    dimensions++;
    if (geoZ > 1.5) signals.push("Unusual geographic location");
  }

  // Device novelty
  if (input.is_new_device) {
    deviationSum += 1.2;
    dimensions++;
    signals.push("New device not previously associated with user");
  } else {
    dimensions++;
  }

  // Failed transaction count
  const failedTx = Number(input.failed_transaction_count) || 0;
  if (failedTx > 0) {
    const failedZ = failedTx / 2;
    deviationSum += Math.min(failedZ, 3);
    dimensions++;
    if (failedZ > 1) signals.push("Elevated failed transaction attempts");
  }

  // Compute normalized anomaly score (0-1)
  const avgDeviation = dimensions > 0 ? deviationSum / dimensions : 0;
  const score = Math.min(avgDeviation / 2.5, 1.0);

  let level: "LOW" | "MEDIUM" | "HIGH";
  if (score < 0.3) level = "LOW";
  else if (score < 0.6) level = "MEDIUM";
  else level = "HIGH";

  return { score, level, signals };
}
