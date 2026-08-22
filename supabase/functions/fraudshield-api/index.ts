import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { handleCors, jsonResponse, errorResponse } from "./_shared/cors.ts";
import { analyzeTransaction, determineAlertSeverity, generateAlertType } from "./_shared/fraud-engine.ts";
import { engineerFeatures, predictFraud } from "./_shared/feature-engineering.ts";
import { modelWeights } from "./_shared/model.ts";
import { modelMetrics } from "./_shared/model.ts";
import type { TransactionInput, FraudAnalysisResult } from "./_shared/types.ts";
import { validateTransactionInput } from "./_shared/validation.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── Rate Limiting State & Configuration ────────────────────
// NOTE ON PRODUCTION DEPLOYMENT:
// The current ipRequestHistory in-memory limiter is suitable for demo protection and single-instance deployments.
// It is not a production-grade distributed rate limiter because serverless Deno Edge Functions are ephemeral 
// and scale horizontally across multiple isolated regions/container instances, causing them to not share memory.
// For production scale, replace this in-memory map with a persistent cache layer like Redis, Upstash, or database lookups.
interface RateLimitRecord {
  timestamps: number[];
}
const ipRequestHistory = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string): { allowed: boolean; limit: number; remaining: number; resetMs: number } {
  const windowMs = Number(Deno.env.get("RATE_LIMIT_WINDOW_MS")) || 60000;
  const maxRequests = Number(Deno.env.get("RATE_LIMIT_MAX_REQUESTS")) || 100;

  const now = Date.now();
  let record = ipRequestHistory.get(ip);
  if (!record) {
    record = { timestamps: [] };
    ipRequestHistory.set(ip, record);
  }

  // Filter timestamps within the current window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = windowMs - (now - oldestTimestamp);
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - record.timestamps.length,
    resetMs: windowMs,
  };
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Route handler ──────────────────────────────────────────

Deno.serve(async (req: Request, info: { remoteAddr?: { hostname?: string } }) => {
  const origin = req.headers.get("origin") || "";
  const allowed = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";
  const headerOrigin = (origin === allowed || origin === "http://localhost:5173") ? origin : allowed;

  const corsResponse = handleCors(req);
  if (corsResponse) {
    corsResponse.headers.set("Access-Control-Allow-Origin", headerOrigin);
    return corsResponse;
  }

  let response: Response;

  if (req.method !== "OPTIONS") {
    const clientIp = info?.remoteAddr?.hostname || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      const responseErr = errorResponse("Too Many Requests", 429);
      responseErr.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
      responseErr.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      responseErr.headers.set("Retry-After", String(Math.ceil(rateLimit.resetMs / 1000)));
      responseErr.headers.set("Access-Control-Allow-Origin", headerOrigin);
      return responseErr;
    }
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/fraudshield-api", "");
  const method = req.method;

  try {
    // POST /transactions/analyze
    if (path === "/transactions/analyze" && method === "POST") {
      response = await handleAnalyzeTransaction(req);
    }
    // GET /transactions
    else if (path === "/transactions" && method === "GET") {
      response = await handleListTransactions(url);
    }
    // GET /transactions/{id}
    else if (path.startsWith("/transactions/") && method === "GET") {
      const txId = path.split("/")[2];
      response = await handleGetTransaction(txId);
    }
    // GET /alerts
    else if (path === "/alerts" && method === "GET") {
      response = await handleListAlerts(url);
    }
    // GET /alerts/{id}
    else if (path.startsWith("/alerts/") && method === "GET") {
      const alertId = path.split("/")[2];
      response = await handleGetAlert(alertId);
    }
    // PATCH /alerts/{id}
    else if (path.startsWith("/alerts/") && method === "PATCH") {
      const alertId = path.split("/")[2];
      response = await handleUpdateAlert(alertId, req);
    }
    // GET /dashboard/stats
    else if (path === "/dashboard/stats" && method === "GET") {
      response = await handleDashboardStats();
    }
    // GET /risk-distribution
    else if (path === "/risk-distribution" && method === "GET") {
      response = await handleRiskDistribution();
    }
    // POST /demo/generate-transactions
    else if (path === "/demo/generate-transactions" && method === "POST") {
      response = await handleGenerateDemo(req);
    }
    // POST /demo/setup-abuse-ring
    else if (path === "/demo/setup-abuse-ring" && method === "POST") {
      response = await handleSetupAbuseRing();
    }
    // GET /model/metrics
    else if (path === "/model/metrics" && method === "GET") {
      response = await handleModelMetrics();
    }
    // GET /relationships
    else if (path === "/relationships" && method === "GET") {
      response = await handleRelationships();
    } else {
      response = errorResponse("Not found", 404);
    }
  } catch (err) {
    console.error("API error:", err);
    response = errorResponse(err.message || "Internal server error", 500);
  }

  response.headers.set("Access-Control-Allow-Origin", headerOrigin);
  return response;
});

// ─── Handlers ───────────────────────────────────────────────

async function handleAnalyzeTransaction(req: Request): Promise<Response> {
  let body: TransactionInput;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  // Validation
  const validationError = validateTransactionInput(body);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  // Query relationships to find distinct users for the device_fingerprint
  const { data: deviceRelations } = await supabase
    .from("relationships")
    .select("entity_id_a")
    .eq("entity_type_a", "USER")
    .eq("entity_type_b", "DEVICE")
    .eq("entity_id_b", body.device_fingerprint);

  const deviceUsers = new Set(deviceRelations?.map((r) => r.entity_id_a) || []);
  deviceUsers.add(body.user_id); // Include current user
  const serverDeviceAccountCount = deviceUsers.size;

  // Query relationships to find distinct users for the ip_address
  const { data: ipRelations } = await supabase
    .from("relationships")
    .select("entity_id_a")
    .eq("entity_type_a", "USER")
    .eq("entity_type_b", "IP")
    .eq("entity_id_b", body.ip_address);

  const ipUsers = new Set(ipRelations?.map((r) => r.entity_id_a) || []);
  ipUsers.add(body.user_id); // Include current user
  const serverIpAccountCount = ipUsers.size;

  // Fetch user stats from database to get historical average amount
  const { data: user } = await supabase
    .from("users")
    .select("avg_transaction_amount, total_transactions, total_chargebacks")
    .eq("user_id", body.user_id)
    .maybeSingle();

  const avgUserAmount = user && user.total_transactions > 0
    ? Number(user.avg_transaction_amount)
    : body.amount;

  const enrichedInput: TransactionInput = {
    ...body,
    device_account_count: serverDeviceAccountCount,
    ip_account_count: serverIpAccountCount,
    avg_user_amount: avgUserAmount,
  };

  // Run fraud detection
  const analysis = analyzeTransaction(enrichedInput);
  const transactionId = generateId("txn");
  analysis.transaction_id = transactionId;

  // Ensure user exists and update their stats
  if (user) {
    const newTotal = (user.total_transactions || 0) + 1;
    const newChargebacks = (user.total_chargebacks || 0) + (body.previous_chargebacks || 0);
    const oldAvg = Number(user.avg_transaction_amount) || 0;
    const newAvg = (oldAvg * (user.total_transactions || 0) + body.amount) / newTotal;

    await supabase.from("users").update({
      total_transactions: newTotal,
      total_chargebacks: newChargebacks,
      avg_transaction_amount: Math.round(newAvg * 100) / 100,
    }).eq("user_id", body.user_id);
  } else {
    await supabase.from("users").insert({
      user_id: body.user_id,
      total_transactions: 1,
      total_chargebacks: body.previous_chargebacks || 0,
      avg_transaction_amount: body.amount,
      first_seen_at: new Date().toISOString(),
    });
  }

  // Ensure device exists
  await supabase.from("devices").upsert({
    device_fingerprint: body.device_fingerprint,
    user_count: serverDeviceAccountCount || 1,
    first_seen_at: new Date().toISOString(),
  }, { onConflict: "device_fingerprint", ignoreDuplicates: true });

  // Ensure IP exists
  await supabase.from("ip_addresses").upsert({
    ip_address: body.ip_address,
    reputation_score: 80,
    user_count: serverIpAccountCount || 1,
    first_seen_at: new Date().toISOString(),
  }, { onConflict: "ip_address", ignoreDuplicates: true });

  // Insert transaction
  await supabase.from("transactions").insert({
    transaction_id: transactionId,
    user_id: body.user_id,
    device_fingerprint: body.device_fingerprint,
    ip_address: body.ip_address,
    amount: body.amount,
    transaction_time: body.transaction_time || new Date().toISOString(),
    location: body.location || "Unknown",
    payment_method: body.payment_method || "card",
    recent_transaction_count: body.recent_transaction_count || 0,
    previous_chargebacks: body.previous_chargebacks || 0,
    failed_transaction_count: body.failed_transaction_count || 0,
    is_new_device: body.is_new_device || false,
    is_new_ip: body.is_new_ip || false,
    distance_from_home: body.distance_from_home || 0,
    velocity_1h: body.velocity_1h || 0,
    device_account_count: serverDeviceAccountCount || 1,
    ip_account_count: serverIpAccountCount || 1,
  });

  // Insert risk assessment
  await supabase.from("risk_assessments").insert({
    transaction_id: transactionId,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    fraud_probability: analysis.fraud_probability,
    anomaly_score: analysis.anomaly_score,
    ml_risk: analysis.ml_risk,
    behavioral_risk: analysis.behavioral_risk,
    security_risk: analysis.security_risk,
    transaction_risk: analysis.transaction_risk,
    risk_signals: analysis.risk_signals,
    explanation: analysis.explanation,
    recommended_action: analysis.recommended_action,
    model_version: analysis.model_version,
  });

  // Generate alerts for MEDIUM+ risk
  if (analysis.risk_level !== "LOW") {
    const severity = determineAlertSeverity(analysis.risk_score, analysis.risk_level, analysis.risk_signals);
    const alertType = generateAlertType(analysis.risk_signals);
    const alertId = generateId("alert");

    await supabase.from("fraud_alerts").insert({
      alert_id: alertId,
      transaction_id: transactionId,
      user_id: body.user_id,
      alert_type: alertType,
      severity,
      risk_score: analysis.risk_score,
      detected_signals: analysis.risk_signals,
      recommended_action: analysis.recommended_action,
      status: "OPEN",
    });
  }

  // Store relationships
  await supabase.from("relationships").insert([
    {
      entity_type_a: "USER",
      entity_id_a: body.user_id,
      entity_type_b: "DEVICE",
      entity_id_b: body.device_fingerprint,
      relationship_type: "USED_DEVICE",
      is_suspicious: (serverDeviceAccountCount || 1) >= 3,
      cluster_id: body.device_fingerprint,
    },
    {
      entity_type_a: "USER",
      entity_id_a: body.user_id,
      entity_type_b: "IP",
      entity_id_b: body.ip_address,
      relationship_type: "USED_IP",
      is_suspicious: (serverIpAccountCount || 1) >= 3,
      cluster_id: body.ip_address,
    },
  ]);

  return jsonResponse(analysis);
}

async function handleListTransactions(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const riskLevel = url.searchParams.get("risk_level");

  let query = supabase
    .from("transactions")
    .select(`
      *,
      risk_assessments(*)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by risk level via join — need to do it client-side since supabase-js doesn't support join filters easily
  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  let filtered = data || [];
  if (riskLevel) {
    filtered = filtered.filter((tx: { risk_assessments?: { risk_level?: string }[] }) =>
      tx.risk_assessments && tx.risk_assessments.length > 0 && tx.risk_assessments[0].risk_level === riskLevel
    );
  }

  return jsonResponse({ transactions: filtered, count: filtered.length });
}

async function handleGetTransaction(txId: string): Promise<Response> {
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      risk_assessments(*)
    `)
    .eq("transaction_id", txId)
    .maybeSingle();

  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("Transaction not found", 404);

  return jsonResponse(data);
}

async function handleListAlerts(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");
  const alertType = url.searchParams.get("alert_type");

  let query = supabase
    .from("fraud_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (severity) query = query.eq("severity", severity);
  if (status) query = query.eq("status", status);
  if (alertType) query = query.eq("alert_type", alertType);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ alerts: data || [], count: data?.length || 0 });
}

async function handleGetAlert(alertId: string): Promise<Response> {
  const { data, error } = await supabase
    .from("fraud_alerts")
    .select("*")
    .eq("alert_id", alertId)
    .maybeSingle();

  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("Alert not found", 404);

  // Also fetch the transaction
  const { data: txData } = await supabase
    .from("transactions")
    .select("*, risk_assessments(*)")
    .eq("transaction_id", data.transaction_id)
    .maybeSingle();

  return jsonResponse({ ...data, transaction: txData });
}

async function handleUpdateAlert(alertId: string, req: Request): Promise<Response> {
  const body = await req.json();
  const { status } = body;

  if (!["OPEN", "INVESTIGATING", "RESOLVED"].includes(status)) {
    return errorResponse("Invalid status", 400);
  }

  const { data, error } = await supabase
    .from("fraud_alerts")
    .update({ status })
    .eq("alert_id", alertId)
    .select()
    .maybeSingle();

  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("Alert not found", 404);

  return jsonResponse(data);
}

async function handleDashboardStats(): Promise<Response> {
  // Total transactions
  const { count: totalTx } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });

  // Total alerts
  const { count: totalAlerts } = await supabase
    .from("fraud_alerts")
    .select("*", { count: "exact", head: true });

  // High risk transactions
  const { count: highRisk } = await supabase
    .from("risk_assessments")
    .select("*", { count: "exact", head: true })
    .eq("risk_level", "HIGH");

  // Medium risk
  const { count: mediumRisk } = await supabase
    .from("risk_assessments")
    .select("*", { count: "exact", head: true })
    .eq("risk_level", "MEDIUM");

  // Critical alerts
  const { count: criticalAlerts } = await supabase
    .from("fraud_alerts")
    .select("*", { count: "exact", head: true })
    .eq("severity", "CRITICAL");

  // Abuse rings (suspicious relationships)
  const { count: abuseRings } = await supabase
    .from("relationships")
    .select("*", { count: "exact", head: true })
    .eq("is_suspicious", true);

  // Recent alerts for dashboard
  const { data: recentAlerts } = await supabase
    .from("fraud_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent transactions with assessments
  const { data: recentTx } = await supabase
    .from("transactions")
    .select("*, risk_assessments(*)")
    .order("created_at", { ascending: false })
    .limit(10);

  // Risk trend (last 7 days, grouped by day)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: trendData } = await supabase
    .from("risk_assessments")
    .select("risk_score, risk_level, created_at")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Build daily trend
  const dailyTrend: { date: string; low: number; medium: number; high: number; total: number }[] = [];
  const trendMap = new Map<string, { low: number; medium: number; high: number; total: number }>();
  (trendData || []).forEach((ra: { risk_level: string; created_at: string }) => {
    const date = new Date(ra.created_at).toISOString().split("T")[0];
    if (!trendMap.has(date)) trendMap.set(date, { low: 0, medium: 0, high: 0, total: 0 });
    const entry = trendMap.get(date)!;
    if (ra.risk_level === "LOW") entry.low++;
    else if (ra.risk_level === "MEDIUM") entry.medium++;
    else entry.high++;
    entry.total++;
  });
  trendMap.forEach((val, date) => dailyTrend.push({ date, ...val }));
  dailyTrend.sort((a, b) => a.date.localeCompare(b.date));

  return jsonResponse({
    total_transactions: totalTx || 0,
    total_alerts: totalAlerts || 0,
    high_risk_transactions: highRisk || 0,
    medium_risk_transactions: mediumRisk || 0,
    critical_alerts: criticalAlerts || 0,
    potential_abuse_rings: abuseRings || 0,
    model_precision: modelMetrics.precision,
    model_recall: modelMetrics.recall,
    model_f1: modelMetrics.f1_score,
    false_positive_rate: modelMetrics.false_positive_rate,
    recent_alerts: recentAlerts || [],
    recent_transactions: recentTx || [],
    risk_trend: dailyTrend,
  });
}

async function handleRiskDistribution(): Promise<Response> {
  const { data, error } = await supabase
    .from("risk_assessments")
    .select("risk_score, risk_level");

  if (error) return errorResponse(error.message, 500);

  // Build histogram buckets: 0-10, 11-20, ..., 91-100
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10 - 1}`,
    count: 0,
    risk_level: i < 3 ? "LOW" : i < 7 ? "MEDIUM" : "HIGH",
  }));

  (data || []).forEach((ra: { risk_score: number }) => {
    const bucket = Math.min(Math.floor(ra.risk_score / 10), 9);
    buckets[bucket].count++;
  });

  return jsonResponse({ distribution: buckets, total: data?.length || 0 });
}

async function handleGenerateDemo(req: Request): Promise<Response> {
  let body: { count?: number } = {};
  try {
    body = await req.json();
  } catch {
    // default
  }
  const count = Math.min(body.count || 20, 100);

  const users = Array.from({ length: 15 }, (_, i) => `user_${String(i + 1).padStart(3, "0")}`);
  const devices = Array.from({ length: 10 }, (_, i) => `dev_${Math.random().toString(36).slice(2, 12)}`);
  const ips = Array.from({ length: 8 }, () => `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`);
  const locations = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Pune", "Hyderabad", "Jaipur"];
  const paymentMethods = ["card", "upi", "wallet", "netbanking"];

  const results: FraudAnalysisResult[] = [];

  for (let i = 0; i < count; i++) {
    const isHighRisk = Math.random() < 0.25;

    const input: TransactionInput = isHighRisk
      ? {
          user_id: users[Math.floor(Math.random() * users.length)],
          device_fingerprint: devices[Math.floor(Math.random() * devices.length)],
          ip_address: ips[Math.floor(Math.random() * ips.length)],
          amount: Math.round((Math.random() * 5000 + 500) * 100) / 100,
          transaction_time: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          location: locations[Math.floor(Math.random() * locations.length)],
          payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          recent_transaction_count: Math.floor(Math.random() * 10) + 3,
          previous_chargebacks: Math.floor(Math.random() * 3),
          failed_transaction_count: Math.floor(Math.random() * 5) + 2,
          is_new_device: Math.random() < 0.5,
          is_new_ip: Math.random() < 0.5,
          distance_from_home: Math.random() * 1500 + 200,
          velocity_1h: Math.floor(Math.random() * 8) + 3,
          device_account_count: Math.floor(Math.random() * 4) + 2,
          ip_account_count: Math.floor(Math.random() * 5) + 2,
        }
      : {
          user_id: users[Math.floor(Math.random() * users.length)],
          device_fingerprint: devices[Math.floor(Math.random() * devices.length)],
          ip_address: ips[Math.floor(Math.random() * ips.length)],
          amount: Math.round((Math.random() * 500 + 50) * 100) / 100,
          transaction_time: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          location: locations[Math.floor(Math.random() * locations.length)],
          payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          recent_transaction_count: Math.floor(Math.random() * 3),
          previous_chargebacks: Math.floor(Math.random() * 1),
          failed_transaction_count: Math.floor(Math.random() * 2),
          is_new_device: Math.random() < 0.1,
          is_new_ip: Math.random() < 0.1,
          distance_from_home: Math.random() * 100,
          velocity_1h: Math.floor(Math.random() * 2),
          device_account_count: 1,
          ip_account_count: 1,
        };

    // Process through the same pipeline
    const analysis = analyzeTransaction(input);
    const transactionId = generateId("txn");
    analysis.transaction_id = transactionId;

    // Insert to DB
    await supabase.from("users").upsert({
      user_id: input.user_id,
      first_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id", ignoreDuplicates: true });

    await supabase.from("devices").upsert({
      device_fingerprint: input.device_fingerprint,
      first_seen_at: new Date().toISOString(),
    }, { onConflict: "device_fingerprint", ignoreDuplicates: true });

    await supabase.from("ip_addresses").upsert({
      ip_address: input.ip_address,
      reputation_score: Math.floor(Math.random() * 40) + 60,
      first_seen_at: new Date().toISOString(),
    }, { onConflict: "ip_address", ignoreDuplicates: true });

    await supabase.from("transactions").insert({
      transaction_id: transactionId,
      user_id: input.user_id,
      device_fingerprint: input.device_fingerprint,
      ip_address: input.ip_address,
      amount: input.amount,
      transaction_time: input.transaction_time,
      location: input.location,
      payment_method: input.payment_method,
      recent_transaction_count: input.recent_transaction_count || 0,
      previous_chargebacks: input.previous_chargebacks || 0,
      failed_transaction_count: input.failed_transaction_count || 0,
      is_new_device: input.is_new_device || false,
      is_new_ip: input.is_new_ip || false,
      distance_from_home: input.distance_from_home || 0,
      velocity_1h: input.velocity_1h || 0,
      device_account_count: input.device_account_count || 1,
      ip_account_count: input.ip_account_count || 1,
    });

    await supabase.from("risk_assessments").insert({
      transaction_id: transactionId,
      risk_score: analysis.risk_score,
      risk_level: analysis.risk_level,
      fraud_probability: analysis.fraud_probability,
      anomaly_score: analysis.anomaly_score,
      ml_risk: analysis.ml_risk,
      behavioral_risk: analysis.behavioral_risk,
      security_risk: analysis.security_risk,
      transaction_risk: analysis.transaction_risk,
      risk_signals: analysis.risk_signals,
      explanation: analysis.explanation,
      recommended_action: analysis.recommended_action,
      model_version: analysis.model_version,
    });

    if (analysis.risk_level !== "LOW") {
      const severity = determineAlertSeverity(analysis.risk_score, analysis.risk_level, analysis.risk_signals);
      const alertType = generateAlertType(analysis.risk_signals);

      await supabase.from("fraud_alerts").insert({
        alert_id: generateId("alert"),
        transaction_id: transactionId,
        user_id: input.user_id,
        alert_type: alertType,
        severity,
        risk_score: analysis.risk_score,
        detected_signals: analysis.risk_signals,
        recommended_action: analysis.recommended_action,
        status: "OPEN",
      });
    }

    await supabase.from("relationships").insert([
      {
        entity_type_a: "USER",
        entity_id_a: input.user_id,
        entity_type_b: "DEVICE",
        entity_id_b: input.device_fingerprint,
        relationship_type: "USED_DEVICE",
        is_suspicious: (input.device_account_count || 1) >= 3,
        cluster_id: input.device_fingerprint,
      },
      {
        entity_type_a: "USER",
        entity_id_a: input.user_id,
        entity_type_b: "IP",
        entity_id_b: input.ip_address,
        relationship_type: "USED_IP",
        is_suspicious: (input.ip_account_count || 1) >= 3,
        cluster_id: input.ip_address,
      },
    ]);

    results.push(analysis);
  }

  return jsonResponse({ generated: results.length, results });
}

async function handleModelMetrics(): Promise<Response> {
  // Check if metrics exist in DB
  const { data: dbMetrics } = await supabase
    .from("model_versions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbMetrics) {
    return jsonResponse(dbMetrics);
  }

  // Fall back to hardcoded metrics from training
  return jsonResponse(modelMetrics);
}

async function handleRelationships(): Promise<Response> {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return errorResponse(error.message, 500);

  // Build graph structure
  const nodes = new Map<string, { id: string; type: string; label: string }>();
  const edges: { source: string; target: string; type: string; isSuspicious: boolean }[] = [];

  (data || []).forEach((rel: {
    entity_type_a: string;
    entity_id_a: string;
    entity_type_b: string;
    entity_id_b: string;
    relationship_type: string;
    is_suspicious: boolean;
  }) => {
    const nodeAId = `${rel.entity_type_a}:${rel.entity_id_a}`;
    const nodeBId = `${rel.entity_type_b}:${rel.entity_id_b}`;

    if (!nodes.has(nodeAId)) {
      nodes.set(nodeAId, { id: nodeAId, type: rel.entity_type_a, label: rel.entity_id_a });
    }
    if (!nodes.has(nodeBId)) {
      nodes.set(nodeBId, { id: nodeBId, type: rel.entity_type_b, label: rel.entity_id_b });
    }

    edges.push({
      source: nodeAId,
      target: nodeBId,
      type: rel.relationship_type,
      isSuspicious: rel.is_suspicious,
    });
  });

  // Find suspicious clusters (devices/IPs shared by 3+ users)
  const deviceUsers = new Map<string, Set<string>>();
  const ipUsers = new Map<string, Set<string>>();

  (data || []).forEach((rel: {
    entity_type_a: string; entity_id_a: string;
    entity_type_b: string; entity_id_b: string;
    relationship_type: string;
  }) => {
    if (rel.entity_type_a === "USER" && rel.entity_type_b === "DEVICE") {
      if (!deviceUsers.has(rel.entity_id_b)) deviceUsers.set(rel.entity_id_b, new Set());
      deviceUsers.get(rel.entity_id_b)!.add(rel.entity_id_a);
    }
    if (rel.entity_type_a === "USER" && rel.entity_type_b === "IP") {
      if (!ipUsers.has(rel.entity_id_b)) ipUsers.set(rel.entity_id_b, new Set());
      ipUsers.get(rel.entity_id_b)!.add(rel.entity_id_a);
    }
  });

  const clusters: { id: string; type: string; entity: string; userCount: number; users: string[]; isSuspicious: boolean }[] = [];
  deviceUsers.forEach((users, device) => {
    if (users.size >= 2) {
      clusters.push({
        id: `device:${device}`,
        type: "DEVICE",
        entity: device,
        userCount: users.size,
        users: Array.from(users),
        isSuspicious: users.size >= 3,
      });
    }
  });
  ipUsers.forEach((users, ip) => {
    if (users.size >= 2) {
      clusters.push({
        id: `ip:${ip}`,
        type: "IP",
        entity: ip,
        userCount: users.size,
        users: Array.from(users),
        isSuspicious: users.size >= 3,
      });
    }
  });

  return jsonResponse({
    nodes: Array.from(nodes.values()),
    edges,
    clusters: clusters.sort((a, b) => b.userCount - a.userCount),
  });
}

async function handleSetupAbuseRing(): Promise<Response> {
  const { data: existingSeed } = await supabase
    .from("relationships")
    .select("id")
    .eq("entity_id_a", "user_syndicate_2")
    .maybeSingle();

  if (!existingSeed) {
    await supabase.from("relationships").insert([
      {
        entity_type_a: "USER",
        entity_id_a: "user_syndicate_2",
        entity_type_b: "DEVICE",
        entity_id_b: "dev_shared_ring",
        relationship_type: "USED_DEVICE",
        cluster_id: "dev_shared_ring",
      },
      {
        entity_type_a: "USER",
        entity_id_a: "user_syndicate_2",
        entity_type_b: "IP",
        entity_id_b: "192.0.2.1",
        relationship_type: "USED_IP",
        cluster_id: "192.0.2.1",
      },
      {
        entity_type_a: "USER",
        entity_id_a: "user_syndicate_3",
        entity_type_b: "DEVICE",
        entity_id_b: "dev_shared_ring",
        relationship_type: "USED_DEVICE",
        cluster_id: "dev_shared_ring",
      },
      {
        entity_type_a: "USER",
        entity_id_a: "user_syndicate_3",
        entity_type_b: "IP",
        entity_id_b: "192.0.2.1",
        relationship_type: "USED_IP",
        cluster_id: "192.0.2.1",
      },
    ]);
  }

  return jsonResponse({ success: true, seeded: !existingSeed });
}
