-- NEW Migration: Secure RLS Policies
-- Removes public/anonymous table access. Frontend must route all reads and writes via the Edge Function.
-- The Edge Function continues to use the service_role key to bypass RLS.

-- Drop users policies
DROP POLICY IF EXISTS "anon_select_users" ON users;
DROP POLICY IF EXISTS "anon_insert_users" ON users;
DROP POLICY IF EXISTS "anon_update_users" ON users;
DROP POLICY IF EXISTS "anon_delete_users" ON users;

-- Drop devices policies
DROP POLICY IF EXISTS "anon_select_devices" ON devices;
DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
DROP POLICY IF EXISTS "anon_update_devices" ON devices;
DROP POLICY IF EXISTS "anon_delete_devices" ON devices;

-- Drop ip_addresses policies
DROP POLICY IF EXISTS "anon_select_ip_addresses" ON ip_addresses;
DROP POLICY IF EXISTS "anon_insert_ip_addresses" ON ip_addresses;
DROP POLICY IF EXISTS "anon_update_ip_addresses" ON ip_addresses;
DROP POLICY IF EXISTS "anon_delete_ip_addresses" ON ip_addresses;

-- Drop transactions policies
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;

-- Drop risk_assessments policies
DROP POLICY IF EXISTS "anon_select_risk_assessments" ON risk_assessments;
DROP POLICY IF EXISTS "anon_insert_risk_assessments" ON risk_assessments;
DROP POLICY IF EXISTS "anon_update_risk_assessments" ON risk_assessments;
DROP POLICY IF EXISTS "anon_delete_risk_assessments" ON risk_assessments;

-- Drop fraud_alerts policies
DROP POLICY IF EXISTS "anon_select_fraud_alerts" ON fraud_alerts;
DROP POLICY IF EXISTS "anon_insert_fraud_alerts" ON fraud_alerts;
DROP POLICY IF EXISTS "anon_update_fraud_alerts" ON fraud_alerts;
DROP POLICY IF EXISTS "anon_delete_fraud_alerts" ON fraud_alerts;

-- Drop relationships policies
DROP POLICY IF EXISTS "anon_select_relationships" ON relationships;
DROP POLICY IF EXISTS "anon_insert_relationships" ON relationships;
DROP POLICY IF EXISTS "anon_update_relationships" ON relationships;
DROP POLICY IF EXISTS "anon_delete_relationships" ON relationships;

-- Drop model_versions policies
DROP POLICY IF EXISTS "anon_select_model_versions" ON model_versions;
DROP POLICY IF EXISTS "anon_insert_model_versions" ON model_versions;
DROP POLICY IF EXISTS "anon_update_model_versions" ON model_versions;
DROP POLICY IF EXISTS "anon_delete_model_versions" ON model_versions;
