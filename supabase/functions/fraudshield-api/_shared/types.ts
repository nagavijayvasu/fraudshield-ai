export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RecommendedAction = "ALLOW" | "MONITOR" | "STEP_UP_VERIFICATION" | "MANUAL_REVIEW";
export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

export interface RiskSignal {
  signal: string;
  description: string;
  weight: number;
}

export interface ExplanationItem {
  feature: string;
  contribution: number;
  direction: "increases" | "decreases";
  description: string;
}

export interface TransactionInput {
  user_id: string;
  device_fingerprint: string;
  ip_address: string;
  amount: number;
  transaction_time?: string;
  location?: string;
  payment_method?: string;
  recent_transaction_count?: number;
  previous_chargebacks?: number;
  failed_transaction_count?: number;
  is_new_device?: boolean;
  is_new_ip?: boolean;
  distance_from_home?: number;
  velocity_1h?: number;
  device_account_count?: number;
  ip_account_count?: number;
  avg_user_amount?: number;
  hour_of_day?: number;
}

export interface FraudAnalysisResult {
  transaction_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  fraud_probability: number;
  anomaly_score: number;
  ml_risk: number;
  behavioral_risk: number;
  security_risk: number;
  transaction_risk: number;
  risk_signals: RiskSignal[];
  explanation: ExplanationItem[];
  recommended_action: RecommendedAction;
  model_version: string;
}

export interface ModelWeights {
  feature_names: string[];
  coefficients: number[];
  intercept: number;
  scaler_mean: number[];
  scaler_scale: number[];
  threshold: number;
  version: string;
}

export interface ModelMetrics {
  model_type: string;
  version: string;
  trained_at: string;
  feature_names: string[];
  threshold: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  pr_auc: number;
  false_positive_rate: number;
  false_negative_rate: number;
  confusion_matrix: number[][];
  test_set_size: number;
  test_fraud_count: number;
  training_notes: string;
}
