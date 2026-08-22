import type { TransactionInput, FraudAnalysisResult, AlertSeverity } from "./types.ts";
import { engineerFeatures, predictFraud } from "./feature-engineering.ts";
import { evaluateRules } from "./rule-engine.ts";
import { detectAnomaly } from "./anomaly-detector.ts";
import { analyzeRelationships } from "./relationship-analyzer.ts";
import { computeRiskScore, recommendAction } from "./risk-scorer.ts";
import { explainPrediction } from "./explainability.ts";
import { modelWeights } from "./model.ts";

export function analyzeTransaction(input: TransactionInput): FraudAnalysisResult {
  // 1. Feature engineering
  const features = engineerFeatures(input);

  // 2. ML inference
  const { probability: fraudProbability, contributions } = predictFraud(features, modelWeights);

  // 3. Rule engine (deterministic signals)
  const ruleResult = evaluateRules(input);

  // 4. Anomaly detection
  const anomalyResult = detectAnomaly(input);

  // 5. Relationship analysis
  const relResult = analyzeRelationships(input);

  // Combine all signals
  const allSignals = [...ruleResult.signals, ...relResult.signals];
  const totalSecurityRisk = ruleResult.securityRisk;
  const totalTransactionRisk = ruleResult.transactionRisk;
  const totalBehavioralRisk = relResult.behavioralRisk;

  // 6. Risk scoring
  const { riskScore, riskLevel, mlRisk, behavioralRisk: behavioralScaled } = computeRiskScore(
    fraudProbability,
    anomalyResult.score,
    totalSecurityRisk,
    totalTransactionRisk,
    totalBehavioralRisk
  );

  // 7. Explainability
  const explanation = explainPrediction(contributions, allSignals);

  // 8. Recommended action
  const recommendedAction = recommendAction(riskLevel, riskScore, anomalyResult.level);

  return {
    transaction_id: "",
    risk_score: riskScore,
    risk_level: riskLevel,
    fraud_probability: Math.round(fraudProbability * 1000) / 1000,
    anomaly_score: Math.round(anomalyResult.score * 1000) / 1000,
    ml_risk: mlRisk,
    behavioral_risk: behavioralScaled,
    security_risk: totalSecurityRisk,
    transaction_risk: totalTransactionRisk,
    risk_signals: allSignals,
    explanation,
    recommended_action: recommendedAction,
    model_version: modelWeights.version,
  };
}

export function determineAlertSeverity(
  riskScore: number,
  riskLevel: string,
  signals: { signal: string; weight: number }[]
): AlertSeverity {
  const maxWeight = Math.max(...signals.map((s) => s.weight || 0), 0);
  const hasAbuseRing = signals.some((s) => s.signal === "POTENTIAL_ABUSE_RING");

  if (riskScore >= 90 || hasAbuseRing) return "CRITICAL";
  if (riskLevel === "HIGH" || maxWeight >= 15) return "HIGH";
  if (riskLevel === "MEDIUM" || maxWeight >= 8) return "MEDIUM";
  return "LOW";
}

export function generateAlertType(
  signals: { signal: string; weight: number }[]
): string {
  const signalTypes = signals.map((s) => s.signal);
  if (signalTypes.includes("POTENTIAL_ABUSE_RING")) return "COORDINATED_ABUSE";
  if (signalTypes.includes("HIGH_VELOCITY")) return "VELOCITY_FRAUD";
  if (signalTypes.includes("CHARGEBACK_HISTORY")) return "CHARGEBACK_ABUSE";
  if (signalTypes.includes("NEW_DEVICE") && signalTypes.includes("NEW_IP")) return "ACCOUNT_TAKEOVER";
  if (signalTypes.includes("UNUSUAL_AMOUNT")) return "AMOUNT_ANOMALY";
  if (signalTypes.includes("GEOGRAPHIC_CHANGE")) return "GEOGRAPHIC_ANOMALY";
  if (signalTypes.length > 0) return signalTypes[0];
  return "FRAUD_SUSPICION";
}
