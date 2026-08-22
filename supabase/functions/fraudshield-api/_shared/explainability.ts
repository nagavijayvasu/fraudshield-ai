import type { ExplanationItem, RiskSignal } from "./types.ts";

const featureLabels: Record<string, string> = {
  amount: "Transaction Amount",
  hour_of_day: "Time of Day",
  is_night: "Night-time Transaction",
  recent_transaction_count: "Recent Transaction Count",
  velocity_1h: "Transaction Velocity (1h)",
  previous_chargebacks: "Previous Chargebacks",
  failed_transaction_count: "Failed Transaction Count",
  is_new_device: "New Device",
  is_new_ip: "New IP Address",
  distance_from_home: "Distance from Home",
  device_account_count: "Device Account Count",
  ip_account_count: "IP Account Count",
  amount_deviation: "Amount Deviation",
};

/**
 * Generate SHAP-style explanations for a fraud prediction.
 *
 * For logistic regression, the contribution of feature i is:
 *   coefficient[i] * standardized_value[i]
 *
 * This is a linear approximation of SHAP values — for linear models with
 * independent features, this IS the exact SHAP value. The contributions
 * sum to (logit - intercept), and the sign tells us whether the feature
 * pushes toward fraud (positive) or away from it (negative).
 */
export function explainPrediction(
  contributions: { feature: string; value: number; contribution: number }[],
  ruleSignals: RiskSignal[]
): ExplanationItem[] {
  const explanations: ExplanationItem[] = contributions.map((c) => ({
    feature: c.feature,
    contribution: c.contribution,
    direction: c.contribution >= 0 ? "increases" : "decreases",
    description: `${featureLabels[c.feature] || c.feature}: ${c.contribution >= 0 ? "increases" : "decreases"} risk`,
  }));

  // Sort by absolute contribution (most impactful first)
  explanations.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Add rule-based signals as additional explanation items
  for (const signal of ruleSignals.slice(0, 5)) {
    explanations.push({
      feature: signal.signal,
      contribution: signal.weight,
      direction: "increases",
      description: signal.description,
    });
  }

  // Return top 8
  return explanations.slice(0, 8);
}

export function getTopRiskFactors(
  contributions: { feature: string; value: number; contribution: number }[],
  ruleSignals: RiskSignal[]
): string[] {
  const topFeatures = contributions
    .filter((c) => c.contribution > 0.1)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5)
    .map((c) => featureLabels[c.feature] || c.feature);

  const topRules = ruleSignals.slice(0, 3).map((s) => s.description);

  return [...topFeatures, ...topRules].slice(0, 5);
}
