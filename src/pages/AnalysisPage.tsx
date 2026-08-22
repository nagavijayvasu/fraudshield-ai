import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardHeader, Badge, Spinner } from "@/components/ui";
import { analyzeTransaction, setupAbuseRing } from "@/lib/api";
import { getRiskColor, getScoreColor, getScoreBg, getActionColor, formatAction, maskIp, maskDevice } from "@/lib/utils";
import type { FraudAnalysisResult, TransactionInput } from "@/types/index";
import { Search, AlertTriangle, CheckCircle, Loader2, Zap } from "lucide-react";

/**
 * Model input scaling factor.
 * Scales raw INR user transaction amount inputs to backend model normalized/internal units.
 */
export const MODEL_AMOUNT_SCALE = 80;

const defaultForm: TransactionInput = {
  user_id: "",
  device_fingerprint: "",
  ip_address: "",
  amount: 0,
  location: "Mumbai",
  payment_method: "card",
  recent_transaction_count: 0,
  previous_chargebacks: 0,
  failed_transaction_count: 0,
  is_new_device: false,
  is_new_ip: false,
  distance_from_home: 0,
  velocity_1h: 0,
  device_account_count: 1,
  ip_account_count: 1,
};

export function AnalysisPage() {
  const [form, setForm] = useState<TransactionInput>({ ...defaultForm, user_id: "user_legit", amount: 4000, device_fingerprint: "dev_known_123", ip_address: "103.25.12.89" });
  const [result, setResult] = useState<FraudAnalysisResult | null>(null);
  const [analyzedInput, setAnalyzedInput] = useState<TransactionInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadScenario = async (type: "A" | "B" | "C") => {
    setError("");
    setResult(null);
    setAnalyzedInput(null);
    if (type === "A") {
      setForm({
        user_id: "user_legit",
        amount: 4000,
        device_fingerprint: "dev_known_123",
        ip_address: "103.25.12.89",
        location: "Mumbai",
        payment_method: "upi",
        recent_transaction_count: 1,
        velocity_1h: 1,
        previous_chargebacks: 0,
        failed_transaction_count: 0,
        is_new_device: false,
        is_new_ip: false,
        distance_from_home: 12,
        device_account_count: 1,
        ip_account_count: 1,
      });
    } else if (type === "B") {
      setForm({
        user_id: "user_suspicious",
        amount: 240000,
        device_fingerprint: "dev_new_999",
        ip_address: "198.51.100.42",
        location: "New Delhi",
        payment_method: "card",
        recent_transaction_count: 5,
        velocity_1h: 5,
        previous_chargebacks: 2,
        failed_transaction_count: 4,
        is_new_device: true,
        is_new_ip: true,
        distance_from_home: 1250,
        device_account_count: 2,
        ip_account_count: 2,
      });
    } else {
      try {
        await setupAbuseRing();
      } catch (err) {
        console.error("Failed to seed Scenario C abuse ring relationships:", err);
      }
      setForm({
        user_id: "user_syndicate_1",
        amount: 80000,
        device_fingerprint: "dev_shared_ring",
        ip_address: "192.0.2.1",
        location: "Bangalore",
        payment_method: "upi",
        recent_transaction_count: 4,
        velocity_1h: 3,
        previous_chargebacks: 0,
        failed_transaction_count: 0,
        is_new_device: true,
        is_new_ip: true,
        distance_from_home: 45,
        device_account_count: 3,
        ip_account_count: 3,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setAnalyzedInput(null);
    try {
      const res = await analyzeTransaction({
        ...form,
        amount: Number(form.amount) / MODEL_AMOUNT_SCALE,
        recent_transaction_count: Number(form.recent_transaction_count),
        previous_chargebacks: Number(form.previous_chargebacks),
        failed_transaction_count: Number(form.failed_transaction_count),
        distance_from_home: Number(form.distance_from_home),
        velocity_1h: Number(form.velocity_1h),
        device_account_count: Number(form.device_account_count),
        ip_account_count: Number(form.ip_account_count),
      });
      setResult(res);
      setAnalyzedInput({ ...form });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: keyof TransactionInput, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <PageShell title="Transaction Analysis" subtitle="Submit a transaction for real-time fraud risk assessment">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column (Scenarios + Form) */}
        <div className="space-y-4">
          {/* Demo Scenarios */}
          <Card>
            <CardHeader title="Reproducible Demo Scenarios" subtitle="Select a scenario to load its parameters into the analysis pipeline" />
            <div className="grid grid-cols-3 gap-2 p-5 pt-0">
              <button type="button" onClick={() => loadScenario("A")} className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-800 bg-slate-900/30 hover:bg-slate-800/40 text-center transition-all">
                <span className="text-xs font-semibold text-emerald-400">Scenario A</span>
                <span className="text-[10px] text-slate-200 font-bold mt-1">Legitimate</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Known User/IP</span>
              </button>
              <button type="button" onClick={() => loadScenario("B")} className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-800 bg-slate-900/30 hover:bg-slate-800/40 text-center transition-all">
                <span className="text-xs font-semibold text-amber-400">Scenario B</span>
                <span className="text-[10px] text-slate-200 font-bold mt-1">Suspicious</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Velocity/High Amt</span>
              </button>
              <button type="button" onClick={() => loadScenario("C")} className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-800 bg-slate-900/30 hover:bg-slate-800/40 text-center transition-all">
                <span className="text-xs font-semibold text-purple-400">Scenario C</span>
                <span className="text-[10px] text-slate-200 font-bold mt-1">Abuse Ring</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Shared device/IP</span>
              </button>
            </div>
          </Card>

          {/* Form */}
          <Card>
            <CardHeader title="Transaction Details" subtitle="Enter transaction and security context information" />
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="User ID" required>
                  <input type="text" value={form.user_id} onChange={(e) => update("user_id", e.target.value)} required className="input-field" />
                </Field>
                <Field label="Amount (₹)" required>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} required className="input-field" />
                </Field>
              </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Device Fingerprint" required>
                <input type="text" value={form.device_fingerprint} onChange={(e) => update("device_fingerprint", e.target.value)} required className="input-field" />
              </Field>
              <Field label="IP Address" required>
                <input type="text" value={form.ip_address} onChange={(e) => update("ip_address", e.target.value)} required className="input-field" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Location">
                <input type="text" value={form.location} onChange={(e) => update("location", e.target.value)} className="input-field" />
              </Field>
              <Field label="Payment Method">
                <select value={form.payment_method} onChange={(e) => update("payment_method", e.target.value)} className="input-field">
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="wallet">Wallet</option>
                  <option value="netbanking">Net Banking</option>
                </select>
              </Field>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Security Context</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Recent Transactions">
                  <input type="number" min="0" value={form.recent_transaction_count} onChange={(e) => update("recent_transaction_count", e.target.value)} className="input-field" />
                </Field>
                <Field label="Velocity (1h)">
                  <input type="number" min="0" value={form.velocity_1h} onChange={(e) => update("velocity_1h", e.target.value)} className="input-field" />
                </Field>
                <Field label="Previous Chargebacks">
                  <input type="number" min="0" value={form.previous_chargebacks} onChange={(e) => update("previous_chargebacks", e.target.value)} className="input-field" />
                </Field>
                <Field label="Failed Transactions">
                  <input type="number" min="0" value={form.failed_transaction_count} onChange={(e) => update("failed_transaction_count", e.target.value)} className="input-field" />
                </Field>
                <Field label="Distance from Home (km)">
                  <input type="number" min="0" value={form.distance_from_home} onChange={(e) => update("distance_from_home", e.target.value)} className="input-field" />
                </Field>
                <Field label="Device Account Count">
                  <input type="number" min="1" value={form.device_account_count} onChange={(e) => update("device_account_count", e.target.value)} className="input-field" />
                </Field>
                <Field label="IP Account Count">
                  <input type="number" min="1" value={form.ip_account_count} onChange={(e) => update("ip_account_count", e.target.value)} className="input-field" />
                </Field>
              </div>
              <div className="mt-4 flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={form.is_new_device} onChange={(e) => update("is_new_device", e.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500" />
                  New Device
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={form.is_new_ip} onChange={(e) => update("is_new_ip", e.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-500" />
                  New IP
                </label>
              </div>
            </div>

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Analyzing..." : "Analyze Transaction"}
            </button>
          </form>
        </Card>
      </div>

      {/* Results */}
        <div>
          {error && (
            <Card className="mb-4 border-red-500/30">
              <div className="p-5 text-sm text-red-400">{error}</div>
            </Card>
          )}

          {loading && (
            <Card>
              <div className="flex h-96 items-center justify-center">
                <Spinner />
              </div>
            </Card>
          )}

          {!loading && !result && !error && (
            <Card>
              <div className="flex h-96 flex-col items-center justify-center text-center">
                <Search className="h-12 w-12 text-slate-700" />
                <p className="mt-4 text-sm text-slate-500">Submit a transaction to see the risk analysis</p>
              </div>
            </Card>
          )}

          {result && analyzedInput && <ResultPanel result={result} input={analyzedInput} />}
        </div>
      </div>
    </PageShell>
  );
}

function ResultPanel({ result, input }: { result: FraudAnalysisResult; input: TransactionInput }) {
  const colors = getRiskColor(result.risk_level);
  const Icon = result.risk_level === "LOW" ? CheckCircle : AlertTriangle;

  return (
    <div className="space-y-4">
      {/* Transaction Details Overview */}
      <Card>
        <CardHeader title="Transaction Summary" subtitle={`Assessment: ${result.risk_level} RISK`} />
        <div className="grid grid-cols-2 gap-3 p-5 pt-0 text-xs">
          <SummaryField label="Transaction ID" value={result.transaction_id || "N/A"} />
          <SummaryField label="Amount" value={`₹${Number(input.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
          <SummaryField label="Timestamp" value={input.transaction_time || new Date().toISOString()} />
          <SummaryField label="User ID" value={input.user_id} />
          <SummaryField label="Device Fingerprint" value={input.device_fingerprint} />
          <SummaryField label="IP Address" value={input.ip_address} />
        </div>
      </Card>

      {/* Main risk score */}
      <Card className={colors.border}>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg}`}>
                <Icon className={`h-6 w-6 ${colors.text}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Risk Level</p>
                <p className={`text-lg font-bold ${colors.text}`}>{result.risk_level} RISK</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Risk Score</p>
              <p className={`text-3xl font-bold ${getScoreColor(result.risk_score)}`}>{result.risk_score}<span className="text-lg text-slate-600">/100</span></p>
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full ${getScoreBg(result.risk_score)} transition-all`} style={{ width: `${result.risk_score}%` }} />
          </div>

          {/* Action */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <span className="text-sm text-slate-400">Recommended Action</span>
            <Badge className={getActionColor(result.recommended_action)}>{formatAction(result.recommended_action)}</Badge>
          </div>
        </div>
      </Card>

      {/* Risk Factors Section */}
      <Card>
        <CardHeader title="Risk Factors" subtitle="Triggered signals from the risk engine" />
        <div className="p-5 pt-0">
          {result.risk_signals.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
              {result.risk_signals.map((sig, i) => (
                <li key={i}>
                  <span className="font-semibold text-slate-200">{sig.signal.replace(/_/g, " ")}</span>
                  {sig.description && <span className="text-xs text-slate-500"> ({sig.description})</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No risk factors triggered. Normal checkout pattern detected.</p>
          )}
        </div>
      </Card>

      {/* Score breakdown */}
      <Card>
        <CardHeader title="Risk Score Breakdown" subtitle="Component contributions to the final score" />
        <div className="space-y-3 p-5">
          {[
            { label: "ML Fraud Probability", value: result.fraud_probability, max: 1, display: `${(result.fraud_probability * 100).toFixed(1)}%` },
            { label: "ML Risk Score", value: result.ml_risk, max: 100, display: `${result.ml_risk}/100` },
            { label: "Behavioral Risk", value: result.behavioral_risk, max: 100, display: `${result.behavioral_risk}/100` },
            { label: "Security Risk", value: result.security_risk, max: 100, display: `${result.security_risk}/100` },
            { label: "Transaction Risk", value: result.transaction_risk, max: 100, display: `${result.transaction_risk}/100` },
            { label: "Anomaly Score", value: result.anomaly_score, max: 1, display: `${(result.anomaly_score * 100).toFixed(1)}%` },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{item.label}</span>
                <span className="font-medium text-slate-200">{item.display}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${(item.value / item.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Explanation */}
      <Card>
        <CardHeader title="Model Explanation" subtitle="Feature contributions (SHAP-style) from the ML model" />
        <div className="space-y-2 p-5">
          {result.explanation.map((exp, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-sm text-slate-400">{exp.feature.replace(/_/g, " ")}</div>
              <div className="flex-1">
                <div className="relative h-6 rounded bg-slate-800">
                  <div
                    className={`absolute top-0 h-full rounded ${exp.direction === "increases" ? "left-1/2 bg-red-500/60" : "right-1/2 bg-emerald-500/60"}`}
                    style={{ width: `${Math.min(Math.abs(exp.contribution) * 100, 50)}%` }}
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
                </div>
              </div>
              <span className={`w-16 text-right text-xs font-medium ${exp.direction === "increases" ? "text-red-400" : "text-emerald-400"}`}>
                {exp.contribution >= 0 ? "+" : ""}{exp.contribution.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-200 mt-0.5 break-all">{value}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  );
}
