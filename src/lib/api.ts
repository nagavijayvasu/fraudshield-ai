import { createClient } from "@supabase/supabase-js";
import type {
  TransactionInput,
  FraudAnalysisResult,
  DashboardStats,
  RiskDistribution,
  Transaction,
  FraudAlert,
  ModelMetrics,
  RelationshipGraph,
} from "@/types/index";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/fraudshield-api`;

const anonKey = supabaseAnonKey;

async function edgeFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${EDGE_FUNCTION_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  return fetch(url, { ...options, headers });
}

export async function analyzeTransaction(input: TransactionInput): Promise<FraudAnalysisResult> {
  const res = await edgeFetch("/transactions/analyze", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await edgeFetch("/dashboard/stats");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchRiskDistribution(): Promise<RiskDistribution> {
  const res = await edgeFetch("/risk-distribution");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchTransactions(limit = 50, offset = 0, riskLevel?: string): Promise<{ transactions: Transaction[]; count: number }> {
  let path = `/transactions?limit=${limit}&offset=${offset}`;
  if (riskLevel) path += `&risk_level=${riskLevel}`;
  const res = await edgeFetch(path);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchTransaction(txId: string): Promise<Transaction> {
  const res = await edgeFetch(`/transactions/${txId}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchAlerts(filters: { severity?: string; status?: string; alert_type?: string; limit?: number } = {}): Promise<{ alerts: FraudAlert[]; count: number }> {
  const params = new URLSearchParams();
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.status) params.set("status", filters.status);
  if (filters.alert_type) params.set("alert_type", filters.alert_type);
  if (filters.limit) params.set("limit", String(filters.limit));
  const res = await edgeFetch(`/alerts?${params.toString()}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchAlert(alertId: string): Promise<FraudAlert> {
  const res = await edgeFetch(`/alerts/${alertId}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function updateAlertStatus(alertId: string, status: string): Promise<FraudAlert> {
  const res = await edgeFetch(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchModelMetrics(): Promise<ModelMetrics> {
  const res = await edgeFetch("/model/metrics");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function fetchRelationships(): Promise<RelationshipGraph> {
  const res = await edgeFetch("/relationships");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function generateDemoTransactions(count = 20): Promise<{ generated: number; results: FraudAnalysisResult[] }> {
  const res = await edgeFetch("/demo/generate-transactions", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function setupAbuseRing(): Promise<{ success: boolean; seeded: boolean }> {
  const res = await edgeFetch("/demo/setup-abuse-ring", {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
