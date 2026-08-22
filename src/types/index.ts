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

export interface Transaction {
  transaction_id: string;
  user_id: string;
  device_fingerprint: string;
  ip_address: string;
  amount: number;
  transaction_time: string;
  location: string;
  payment_method: string;
  recent_transaction_count: number;
  previous_chargebacks: number;
  failed_transaction_count: number;
  is_new_device: boolean;
  is_new_ip: boolean;
  distance_from_home: number;
  velocity_1h: number;
  device_account_count: number;
  ip_account_count: number;
  created_at: string;
  risk_assessments: RiskAssessment[];
}

export interface RiskAssessment {
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
  created_at: string;
}

export interface FraudAlert {
  alert_id: string;
  transaction_id: string;
  user_id: string;
  alert_type: string;
  severity: AlertSeverity;
  risk_score: number;
  detected_signals: RiskSignal[];
  recommended_action: RecommendedAction;
  status: AlertStatus;
  created_at: string;
  transaction?: Transaction;
}

export interface DashboardStats {
  total_transactions: number;
  total_alerts: number;
  high_risk_transactions: number;
  medium_risk_transactions: number;
  critical_alerts: number;
  potential_abuse_rings: number;
  model_precision: number;
  model_recall: number;
  model_f1: number;
  false_positive_rate: number;
  recent_alerts: FraudAlert[];
  recent_transactions: Transaction[];
  risk_trend: { date: string; low: number; medium: number; high: number; total: number }[];
}

export interface RiskDistribution {
  distribution: { range: string; count: number; risk_level: string }[];
  total: number;
}

export interface FinancialThresholdMetric {
  threshold: number;
  false_positive_cost: number;
  false_negative_cost: number;
  total_loss: number;
  net_savings: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface ModelMetrics {
  model_type: string;
  version: string;
  trained_at: string;
  feature_names: string[];
  threshold: number;
  f1_threshold?: number;
  optimal_financial_threshold?: number;
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
  baseline_loss?: number;
  min_business_loss?: number;
  optimal_savings?: number;
  financial_metrics?: FinancialThresholdMetric[];
  training_notes: string;
}

export interface RelationshipGraph {
  nodes: { id: string; type: string; label: string }[];
  edges: { source: string; target: string; type: string; isSuspicious: boolean }[];
  clusters: {
    id: string;
    type: string;
    entity: string;
    userCount: number;
    users: string[];
    isSuspicious: boolean;
  }[];
}
