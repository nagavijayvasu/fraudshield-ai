import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardHeader, Spinner, ErrorState, Badge } from "@/components/ui";
import { StatCard } from "@/components/dashboard/StatCard";
import { fetchDashboardStats, fetchRiskDistribution } from "@/lib/api";
import { getRiskColor, getScoreColor, formatAction, formatAlertType, formatRelative } from "@/lib/utils";
import type { DashboardStats, RiskDistribution } from "@/types/index";
import {
  Receipt, ShieldAlert, AlertTriangle, Users, Target,
  Crosshair, TrendingDown, Gauge,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";

/**
 * Model input scaling factor.
 * Scales raw INR user transaction amount inputs to backend model normalized/internal units.
 */
export const MODEL_AMOUNT_SCALE = 80;

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [distribution, setDistribution] = useState<RiskDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [s, d] = await Promise.all([fetchDashboardStats(), fetchRiskDistribution()]);
        setStats(s);
        setDistribution(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageShell title="Dashboard"><div className="flex h-96 items-center justify-center"><Spinner /></div></PageShell>;
  if (error) return <PageShell title="Dashboard"><ErrorState message={error} /></PageShell>;
  if (!stats) return null;

  return (
    <PageShell title="Dashboard" subtitle="Real-time fraud detection overview">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Transactions" value={stats.total_transactions} icon={Receipt} color="blue" />
        <StatCard label="Security Alerts" value={stats.total_alerts} icon={ShieldAlert} color="amber" />
        <StatCard label="High Risk" value={stats.high_risk_transactions} icon={AlertTriangle} color="red" />
        <StatCard label="Critical Alerts" value={stats.critical_alerts} icon={Crosshair} color="red" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Potential Abuse Rings" value={stats.potential_abuse_rings} icon={Users} color="purple" />
        <StatCard label="Model Precision" value={`${(stats.model_precision * 100).toFixed(1)}%`} icon={Target} color="emerald" />
        <StatCard label="Model Recall" value={`${(stats.model_recall * 100).toFixed(1)}%`} icon={Gauge} color="cyan" />
        <StatCard label="False Positive Rate" value={`${(stats.false_positive_rate * 100).toFixed(2)}%`} icon={TrendingDown} color="amber" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Risk Distribution */}
        <Card>
          <CardHeader title="Risk Score Distribution" subtitle="Distribution of analyzed transactions by risk score" />
          <div className="p-5">
            {distribution && distribution.total > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={distribution.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.risk_level === "LOW" ? "#10b981" : entry.risk_level === "MEDIUM" ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">No data yet</div>
            )}
          </div>
        </Card>

        {/* Fraud Trend */}
        <Card>
          <CardHeader title="Fraud Trend" subtitle="Transaction risk levels over time" />
          <div className="p-5">
            {stats.risk_trend && stats.risk_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.risk_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="low" stackId="1" stroke="#10b981" fill="#10b98120" name="Low" />
                  <Area type="monotone" dataKey="medium" stackId="1" stroke="#f59e0b" fill="#f59e0b20" name="Medium" />
                  <Area type="monotone" dataKey="high" stackId="1" stroke="#ef4444" fill="#ef444420" name="High" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">No trend data yet</div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Alerts + Recent Transactions */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Alerts" subtitle="Latest security alerts" />
          <div className="divide-y divide-slate-800">
            {stats.recent_alerts && stats.recent_alerts.length > 0 ? (
              stats.recent_alerts.slice(0, 6).map((alert) => {
                const colors = getRiskColor(alert.severity);
                return (
                  <div key={alert.alert_id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Badge className={colors.badge}>{alert.severity}</Badge>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{formatAlertType(alert.alert_type)}</p>
                        <p className="text-xs text-slate-500">{alert.user_id} · {formatRelative(alert.created_at)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(alert.risk_score)}`}>{alert.risk_score}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No alerts yet</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Transactions" subtitle="Latest analyzed transactions" />
          <div className="divide-y divide-slate-800">
            {stats.recent_transactions && stats.recent_transactions.length > 0 ? (
              stats.recent_transactions.slice(0, 6).map((tx) => {
                const ra = tx.risk_assessments?.[0];
                const level = ra?.risk_level || "LOW";
                const colors = getRiskColor(level);
                return (
                  <div key={tx.transaction_id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Badge className={colors.badge}>{level}</Badge>
                      <div>
                        <p className="text-sm font-medium text-slate-200">₹{(tx.amount * MODEL_AMOUNT_SCALE).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-slate-500">{tx.user_id} · {tx.location} · {formatRelative(tx.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${getScoreColor(ra?.risk_score || 0)}`}>{ra?.risk_score || 0}</span>
                      <p className="text-xs text-slate-500">{ra ? formatAction(ra.recommended_action) : ""}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No transactions yet</div>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

// Recharts Cell import workaround
import { Cell } from "recharts";
