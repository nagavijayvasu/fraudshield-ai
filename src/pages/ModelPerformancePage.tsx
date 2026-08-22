import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardHeader, Spinner, ErrorState, Badge } from "@/components/ui";
import { fetchModelMetrics } from "@/lib/api";
import type { ModelMetrics } from "@/types/index";
import { Target, Crosshair, AlertCircle, Info, ShieldCheck, HelpCircle, TrendingUp, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

export function ModelPerformancePage() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sliderThreshold, setSliderThreshold] = useState(0.5);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchModelMetrics();
        setMetrics(data);
        if (data && data.threshold !== undefined) {
          setSliderThreshold(data.threshold);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load model metrics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading)
    return (
      <PageShell title="Model Performance">
        <div className="flex h-96 items-center justify-center">
          <Spinner />
        </div>
      </PageShell>
    );
  if (error)
    return (
      <PageShell title="Model Performance">
        <ErrorState message={error} />
      </PageShell>
    );
  if (!metrics) return null;

  const [[tn, fp], [fn, tp]] = metrics.confusion_matrix;

  // Find metrics for current slider threshold
  const currentMetric =
    metrics.financial_metrics?.find(
      (m) => Math.abs(m.threshold - sliderThreshold) < 0.005
    ) || {
      threshold: sliderThreshold,
      false_positive_cost: 0,
      false_negative_cost: 0,
      total_loss: 0,
      net_savings: 0,
      precision: metrics.precision,
      recall: metrics.recall,
      f1_score: metrics.f1_score,
    };

  // Model input scaling factor (converts internal amount units to INR)
  const MODEL_AMOUNT_SCALE = 80;

  // Format currency values for standard Rupees
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val * MODEL_AMOUNT_SCALE);
  };

  return (
    <PageShell
      title="Model Performance"
      subtitle="Financially-optimized evaluation metrics on held-out transaction datasets"
    >
      {/* Disclaimer Banner */}
      <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-slate-400 leading-normal">
        <strong>Disclaimer:</strong> All financial values, savings, and costs shown on this page are estimated values based on the project's defined cost assumptions and the evaluation dataset. They do not represent actual Razorpay system statistics, fee structures, or real savings.
      </div>

      {/* Overview Card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                {metrics.model_type} v{metrics.version}
              </h3>
              <p className="text-xs text-slate-500">
                Trained: {new Date(metrics.trained_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400">
                Financial Opt Threshold: {metrics.optimal_financial_threshold ?? metrics.threshold}
              </Badge>
              {metrics.f1_threshold && (
                <Badge className="bg-blue-500/20 text-blue-400">
                  F1-Max Threshold: {metrics.f1_threshold}
                </Badge>
              )}
            </div>
          </div>
          <div className="px-5 pb-5 text-sm text-slate-400 border-t border-slate-800/50 pt-4">
            <p>{metrics.training_notes}</p>
          </div>
        </Card>

        {/* Business Impact Card */}
        <Card className="bg-gradient-to-br from-slate-900/60 to-emerald-950/20 border-emerald-500/20">
          <CardHeader
            title="Business Impact Scorecard"
            subtitle="Financial returns modeled at optimal threshold"
          />
          <div className="p-5 pt-0 space-y-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                Baseline Financial Loss (Unprotected)
              </p>
              <p className="text-xl font-bold text-red-400 mt-1">
                {formatCurrency(metrics.baseline_loss ?? 0)}
              </p>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-800/80 pt-3">
              <div>
                <p className="text-xs text-slate-400">Optimized Net Savings</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {formatCurrency(metrics.optimal_savings ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Reduction in Loss</p>
                <p className="text-lg font-bold text-slate-200 mt-1">
                  {metrics.baseline_loss && metrics.min_business_loss
                    ? `${(
                        ((metrics.baseline_loss - metrics.min_business_loss) /
                          metrics.baseline_loss) *
                        100
                      ).toFixed(1)}%`
                    : "0%"}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* COST OPTIMIZER WORKBENCH */}
      <Card className="mt-6 border-slate-800 bg-slate-900/10">
        <CardHeader
          title="Interactive Business Cost & False Positive Optimizer"
          subtitle="Tune decision threshold mathematically to balance customer friction costs vs. chargeback losses"
        />
        <div className="p-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chart View */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Loss Curve vs. Decision Threshold
            </h4>
            <div className="h-72 w-full rounded-xl bg-slate-950/40 p-3 border border-slate-900">
              {metrics.financial_metrics && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={metrics.financial_metrics}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="threshold"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `₹${Math.round((v * MODEL_AMOUNT_SCALE) / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any, name: string) => [
                        formatCurrency(Number(value)),
                        name
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase()),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Line
                      type="monotone"
                      dataKey="false_positive_cost"
                      name="Friction Cost (FP)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="false_negative_cost"
                      name="Fraud Cost (FN)"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_loss"
                      name="Total Business Loss"
                      stroke="#a855f7"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="net_savings"
                      name="Net Savings"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={false}
                    />
                    <ReferenceLine
                      x={metrics.optimal_financial_threshold ?? metrics.threshold}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: "Financial Opt",
                        fill: "#10b981",
                        fontSize: 9,
                        position: "top",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex gap-2 justify-center text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> False Positive Cost: (Amount × 10% Margin Loss) + ₹1,600 Friction
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> False Negative Cost: Full Amount + ₹1,200 Chargeback Penalty
              </span>
            </div>
          </div>

          {/* Slider & Metrics Dashboard */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Simulation Workbench
            </h4>

            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-xs text-slate-400">Simulation Threshold</span>
                <span className="text-sm font-bold text-emerald-400">
                  {sliderThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={sliderThreshold}
                onChange={(e) => setSliderThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.05 (Block More)</span>
                <span>0.95 (Allow More)</span>
              </div>
            </div>

            {/* Simulated Return metrics */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Simulated Net Savings
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatCurrency(currentMetric.net_savings)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Total Estimated Loss</span>
                <span className="font-semibold text-purple-400">
                  {formatCurrency(currentMetric.total_loss)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Estimated Loss Reduction</span>
                <span className="font-semibold text-slate-200">
                  {metrics.baseline_loss && currentMetric.total_loss !== undefined
                    ? `${(((metrics.baseline_loss - currentMetric.total_loss) / metrics.baseline_loss) * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Friction Penalty (FP)</span>
                <span className="font-semibold text-amber-500">
                  {formatCurrency(currentMetric.false_positive_cost)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Missed Fraud Penalty (FN)</span>
                <span className="font-semibold text-red-500">
                  {formatCurrency(currentMetric.false_negative_cost)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <p className="text-[9px] text-slate-500 uppercase">Precision</p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {((currentMetric.precision ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <p className="text-[9px] text-slate-500 uppercase">Recall</p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {((currentMetric.recall ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <p className="text-[9px] text-slate-500 uppercase">F1 Score</p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {((currentMetric.f1_score ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Reset buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() =>
                  setSliderThreshold(metrics.optimal_financial_threshold ?? metrics.threshold)
                }
                className="flex-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-1.5 px-2 rounded-lg font-medium border border-emerald-500/20 transition-all"
              >
                Use Financial Opt ({metrics.optimal_financial_threshold ?? metrics.threshold})
              </button>
              {metrics.f1_threshold && (
                <button
                  onClick={() => setSliderThreshold(metrics.f1_threshold!)}
                  className="flex-1 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 py-1.5 px-2 rounded-lg font-medium border border-blue-500/20 transition-all"
                >
                  Use F1-Max ({metrics.f1_threshold})
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Confusion Matrix & Trade-off explanations */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Confusion Matrix */}
        <Card>
          <CardHeader
            title="Confusion Matrix"
            subtitle="Predictions at current model threshold settings"
          />
          <div className="p-5">
            <div className="mb-4 text-center text-xs text-slate-500">
              Test set: {metrics.test_set_size} samples ({metrics.test_fraud_count} fraud)
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-sm">
              <div></div>
              <div className="pb-2 text-xs font-medium text-slate-500">Predicted Legit</div>
              <div className="pb-2 text-xs font-medium text-slate-500">Predicted Fraud</div>

              <div className="flex items-center justify-center text-xs font-medium text-slate-500">
                Actual Legit
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-6">
                <p className="text-2xl font-bold text-emerald-400">{tn}</p>
                <p className="text-xs text-slate-500">True Negatives</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-6">
                <p className="text-2xl font-bold text-red-400">{fp}</p>
                <p className="text-xs text-slate-500">False Positives</p>
              </div>

              <div className="flex items-center justify-center text-xs font-medium text-slate-500">
                Actual Fraud
              </div>
              <div className="rounded-lg bg-red-500/10 p-6">
                <p className="text-2xl font-bold text-red-400">{fn}</p>
                <p className="text-xs text-slate-500">False Negatives</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-6">
                <p className="text-2xl font-bold text-emerald-400">{tp}</p>
                <p className="text-xs text-slate-500">True Positives</p>
              </div>
            </div>

            {/* FPR/FNR */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-slate-400">False Positive Rate</span>
                </div>
                <p className="mt-1 text-lg font-bold text-amber-400 text-sm">
                  {(metrics.false_positive_rate * 100).toFixed(2)}%
                </p>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Legit customers incorrectly blocked, inducing high purchase friction
                </p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-slate-400">False Negative Rate</span>
                </div>
                <p className="mt-1 text-lg font-bold text-red-400 text-sm">
                  {(metrics.false_negative_rate * 100).toFixed(2)}%
                </p>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Fraud transactions missed, incurring chargeback and delivery losses
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Explainers */}
        <Card>
          <CardHeader
            title="Understanding AI Risk Management Trade-offs"
            subtitle="Cost-Sensitive Decision Boundaries"
          />
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Optimal Financial Boundary
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Standard ML models tune decision thresholds to optimize math scores (like F1-Score).
                    However, because fraud losses (Fractions of rupees + chargeback fees) are much higher
                    than checkout friction losses, a financially optimized system typically triggers at
                    a different threshold, capturing maximum business value.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">Friction Penalties (False Positives)</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Every false block leads to customer frustration, support queries, and potential churn.
                    We model this as a lost transaction margin (10%) plus a fixed ₹1,600 friction penalty.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <div className="flex items-start gap-3">
                <Crosshair className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">Fraud Penalty (False Negatives)</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Allowing fraudulent cards to pass leads to chargebacks. The merchant loses the full
                    amount of the transaction and pays a chargeback fee (₹1,200).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Features Used */}
      <Card className="mt-4">
        <CardHeader title="Training Notes" subtitle="Methodology and configuration" />
        <div className="p-5">
          <p className="text-sm text-slate-400">{metrics.training_notes}</p>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
              Features Used by Decision Trees/LR
            </p>
            <div className="flex flex-wrap gap-2">
              {metrics.feature_names.map((f) => (
                <Badge key={f} className="bg-slate-800 text-slate-400">
                  {f.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
