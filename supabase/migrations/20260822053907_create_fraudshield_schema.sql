/*
# FraudShield — Core Database Schema

Creates all tables for the fraud detection platform.

1. New Tables
- `users` — synthetic user profiles with transaction history stats
- `devices` — device fingerprints with associated user counts
- `ip_addresses` — IP addresses with mock reputation scores
- `transactions` — payment transactions with security context fields
- `risk_assessments` — full risk analysis results per transaction
- `fraud_alerts` — security/fraud alerts with severity and status
- `relationships` — entity relationships (user↔device, user↔IP) for abuse ring detection
- `model_versions` — ML model metadata and evaluation metrics

2. Security
- RLS enabled on all tables
- This is a no-auth demo application — policies use `TO anon, authenticated` with `USING (true)`
  because all data is synthetic and intentionally shared/public for demo purposes
- No real customer data is stored
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  total_transactions int DEFAULT 0,
  total_chargebacks int DEFAULT 0,
  avg_transaction_amount numeric DEFAULT 0,
  first_seen_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint text UNIQUE NOT NULL,
  first_seen_at timestamptz DEFAULT now(),
  user_count int DEFAULT 0
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_devices" ON devices;
CREATE POLICY "anon_select_devices" ON devices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_devices" ON devices;
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_devices" ON devices;
CREATE POLICY "anon_delete_devices" ON devices FOR DELETE TO anon, authenticated USING (true);

-- IP addresses table
CREATE TABLE IF NOT EXISTS ip_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  first_seen_at timestamptz DEFAULT now(),
  reputation_score int DEFAULT 80 CHECK (reputation_score >= 0 AND reputation_score <= 100),
  user_count int DEFAULT 0
);

ALTER TABLE ip_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ip_addresses" ON ip_addresses;
CREATE POLICY "anon_select_ip_addresses" ON ip_addresses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ip_addresses" ON ip_addresses;
CREATE POLICY "anon_insert_ip_addresses" ON ip_addresses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ip_addresses" ON ip_addresses;
CREATE POLICY "anon_update_ip_addresses" ON ip_addresses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ip_addresses" ON ip_addresses;
CREATE POLICY "anon_delete_ip_addresses" ON ip_addresses FOR DELETE TO anon, authenticated USING (true);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text UNIQUE NOT NULL,
  user_id text NOT NULL REFERENCES users(user_id),
  device_fingerprint text NOT NULL REFERENCES devices(device_fingerprint),
  ip_address text NOT NULL REFERENCES ip_addresses(ip_address),
  amount numeric NOT NULL CHECK (amount > 0),
  transaction_time timestamptz NOT NULL DEFAULT now(),
  location text,
  payment_method text DEFAULT 'card',
  recent_transaction_count int DEFAULT 0,
  previous_chargebacks int DEFAULT 0,
  failed_transaction_count int DEFAULT 0,
  is_new_device boolean DEFAULT false,
  is_new_ip boolean DEFAULT false,
  distance_from_home numeric DEFAULT 0,
  velocity_1h int DEFAULT 0,
  device_account_count int DEFAULT 1,
  ip_account_count int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Risk assessments table
CREATE TABLE IF NOT EXISTS risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  risk_score int NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  fraud_probability numeric NOT NULL,
  anomaly_score numeric NOT NULL,
  ml_risk numeric NOT NULL DEFAULT 0,
  behavioral_risk numeric NOT NULL DEFAULT 0,
  security_risk numeric NOT NULL DEFAULT 0,
  transaction_risk numeric NOT NULL DEFAULT 0,
  risk_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_action text NOT NULL CHECK (recommended_action IN ('ALLOW', 'MONITOR', 'STEP_UP_VERIFICATION', 'MANUAL_REVIEW')),
  model_version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_select_risk_assessments" ON risk_assessments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_insert_risk_assessments" ON risk_assessments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_update_risk_assessments" ON risk_assessments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_delete_risk_assessments" ON risk_assessments FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_transaction_id ON risk_assessments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON risk_assessments(risk_level);

-- Fraud alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id text UNIQUE NOT NULL,
  transaction_id text NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  risk_score int NOT NULL,
  detected_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_action text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_select_fraud_alerts" ON fraud_alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_insert_fraud_alerts" ON fraud_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_update_fraud_alerts" ON fraud_alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_delete_fraud_alerts" ON fraud_alerts FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created_at ON fraud_alerts(created_at DESC);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type_a text NOT NULL CHECK (entity_type_a IN ('USER', 'DEVICE', 'IP')),
  entity_id_a text NOT NULL,
  entity_type_b text NOT NULL CHECK (entity_type_b IN ('USER', 'DEVICE', 'IP')),
  entity_id_b text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('USED_DEVICE', 'USED_IP', 'SHARED_DEVICE', 'SHARED_IP')),
  is_suspicious boolean DEFAULT false,
  cluster_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_relationships" ON relationships;
CREATE POLICY "anon_select_relationships" ON relationships FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_relationships" ON relationships;
CREATE POLICY "anon_insert_relationships" ON relationships FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_relationships" ON relationships;
CREATE POLICY "anon_update_relationships" ON relationships FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_relationships" ON relationships;
CREATE POLICY "anon_delete_relationships" ON relationships FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_relationships_cluster ON relationships(cluster_id);

-- Model versions table
CREATE TABLE IF NOT EXISTS model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  model_type text NOT NULL,
  trained_at timestamptz DEFAULT now(),
  precision numeric NOT NULL,
  recall numeric NOT NULL,
  f1_score numeric NOT NULL,
  roc_auc numeric NOT NULL,
  pr_auc numeric NOT NULL,
  false_positive_rate numeric NOT NULL,
  false_negative_rate numeric NOT NULL,
  confusion_matrix jsonb NOT NULL,
  feature_names jsonb NOT NULL,
  threshold numeric NOT NULL,
  training_notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_model_versions" ON model_versions;
CREATE POLICY "anon_select_model_versions" ON model_versions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_model_versions" ON model_versions;
CREATE POLICY "anon_insert_model_versions" ON model_versions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_model_versions" ON model_versions;
CREATE POLICY "anon_update_model_versions" ON model_versions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_model_versions" ON model_versions;
CREATE POLICY "anon_delete_model_versions" ON model_versions FOR DELETE TO anon, authenticated USING (true);
