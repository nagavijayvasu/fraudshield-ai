import type { RiskLevel, RecommendedAction } from "./types.ts";

export interface ScoringConfig {
  mlWeight: number;
  behavioralWeight: number;
  securityWeight: number;
  transactionWeight: number;
  lowThreshold: number;
  mediumThreshold: number;
}

export const defaultConfig: ScoringConfig = {
  // Weights documented: ML probability is the strongest signal but rules and
  // anomaly detection provide orthogonal signal that catches what the model misses.
  // The weights sum to 1.0 so the final score is a weighted blend on a 0-100 scale.
  mlWeight: 0.40,
  behavioralWeight: 0.20,
  securityWeight: 0.20,
  transactionWeight: 0.20,
  lowThreshold: 30,
  mediumThreshold: 70,
};

export function computeRiskScore(
  mlProbability: number,
  anomalyScore: number,
  securityRisk: number,
  transactionRisk: number,
  behavioralRisk: number,
  config: ScoringConfig = defaultConfig
): {
  riskScore: number;
  riskLevel: RiskLevel;
  mlRisk: number;
  behavioralRisk: number;
} {
  // Scale each component to 0-100
  const mlRisk = Math.round(mlProbability * 100);
  const behavioralScaled = Math.round((anomalyScore * 100 * 0.5) + (behavioralRisk * 0.5));
  const securityScaled = Math.min(securityRisk, 100);
  const transactionScaled = Math.min(transactionRisk, 100);

  // Weighted blend
  const weightedScore =
    mlRisk * config.mlWeight +
    behavioralScaled * config.behavioralWeight +
    securityScaled * config.securityWeight +
    transactionScaled * config.transactionWeight;

  const riskScore = Math.round(Math.min(Math.max(weightedScore, 0), 100));

  let riskLevel: RiskLevel;
  if (riskScore <= config.lowThreshold) riskLevel = "LOW";
  else if (riskScore <= config.mediumThreshold) riskLevel = "MEDIUM";
  else riskLevel = "HIGH";

  return {
    riskScore,
    riskLevel,
    mlRisk,
    behavioralRisk: behavioralScaled,
  };
}

export function recommendAction(
  riskLevel: RiskLevel,
  riskScore: number,
  anomalyLevel: "LOW" | "MEDIUM" | "HIGH"
): RecommendedAction {
  if (riskLevel === "LOW") return "ALLOW";
  if (riskLevel === "MEDIUM") {
    if (anomalyLevel === "HIGH") return "STEP_UP_VERIFICATION";
    return "MONITOR";
  }
  // HIGH
  if (riskScore >= 90) return "MANUAL_REVIEW";
  return "STEP_UP_VERIFICATION";
}
