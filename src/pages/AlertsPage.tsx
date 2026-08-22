import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardHeader, Badge, Spinner, ErrorState, EmptyState } from "@/components/ui";
import { fetchAlerts, updateAlertStatus } from "@/lib/api";
import { getRiskColor, getActionColor, formatAction, formatAlertType, formatRelative } from "@/lib/utils";
import type { FraudAlert } from "@/types/index";
import { Filter, ChevronRight, X } from "lucide-react";

export function AlertsPage() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<FraudAlert | null>(null);
  const [filters, setFilters] = useState<{ severity?: string; status?: string; alert_type?: string }>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetchAlerts({ ...filters, limit: 100 });
        setAlerts(res.alerts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filters]);

  const handleStatusUpdate = async (alertId: string, status: string) => {
    try {
      await updateAlertStatus(alertId, status);
      setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? { ...a, status: status as FraudAlert["status"] } : a)));
      if (selected?.alert_id === alertId) setSelected((prev) => (prev ? { ...prev, status: status as FraudAlert["status"] } : prev));
    } catch {
      // ignore
    }
  };

  return (
    <PageShell title="Security Alerts" subtitle="SOC-style fraud and security alert monitoring">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <select value={filters.severity || ""} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value || undefined }))} className="input-field w-auto">
          <option value="">All Severities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select value={filters.status || ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))} className="input-field w-auto">
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select value={filters.alert_type || ""} onChange={(e) => setFilters((f) => ({ ...f, alert_type: e.target.value || undefined }))} className="input-field w-auto">
          <option value="">All Types</option>
          <option value="COORDINATED_ABUSE">Coordinated Abuse</option>
          <option value="VELOCITY_FRAUD">Velocity Fraud</option>
          <option value="CHARGEBACK_ABUSE">Chargeback Abuse</option>
          <option value="ACCOUNT_TAKEOVER">Account Takeover</option>
          <option value="AMOUNT_ANOMALY">Amount Anomaly</option>
          <option value="GEOGRAPHIC_ANOMALY">Geographic Anomaly</option>
        </select>
        {(filters.severity || filters.status || filters.alert_type) && (
          <button onClick={() => setFilters({})} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center"><Spinner /></div>
      ) : error ? (
        <ErrorState message={error} />
      ) : alerts.length === 0 ? (
        <Card><EmptyState message="No alerts found matching the current filters" /></Card>
      ) : (
        <Card>
          <CardHeader title={`Alerts (${alerts.length})`} subtitle="Click an alert to view details" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="px-5 py-3 text-left font-medium">Severity</th>
                  <th className="px-5 py-3 text-left font-medium">Type</th>
                  <th className="px-5 py-3 text-left font-medium">User</th>
                  <th className="px-5 py-3 text-left font-medium">Risk</th>
                  <th className="px-5 py-3 text-left font-medium">Action</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Time</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {alerts.map((alert) => {
                  const sevColors = getRiskColor(alert.severity);
                  return (
                    <tr key={alert.alert_id} className="cursor-pointer hover:bg-slate-800/30" onClick={() => setSelected(alert)}>
                      <td className="px-5 py-3"><Badge className={sevColors.badge}>{alert.severity}</Badge></td>
                      <td className="px-5 py-3 text-slate-200">{formatAlertType(alert.alert_type)}</td>
                      <td className="px-5 py-3 text-slate-400">{alert.user_id}</td>
                      <td className="px-5 py-3"><span className={`font-bold ${getRiskColor(alert.risk_score > 70 ? "HIGH" : alert.risk_score > 30 ? "MEDIUM" : "LOW").text}`}>{alert.risk_score}</span></td>
                      <td className="px-5 py-3"><Badge className={getActionColor(alert.recommended_action)}>{formatAction(alert.recommended_action)}</Badge></td>
                      <td className="px-5 py-3">
                        <select
                          value={alert.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusUpdate(alert.alert_id, e.target.value)}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300"
                        >
                          <option value="OPEN">Open</option>
                          <option value="INVESTIGATING">Investigating</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatRelative(alert.created_at)}</td>
                      <td className="px-5 py-3"><ChevronRight className="h-4 w-4 text-slate-600" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail drawer */}
      {selected && <AlertDetail alert={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

function AlertDetail({ alert, onClose }: { alert: FraudAlert; onClose: () => void }) {
  const sevColors = getRiskColor(alert.severity);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-950 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Alert Details</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Badge className={sevColors.badge}>{alert.severity}</Badge>
            <span className="text-sm text-slate-400">{formatAlertType(alert.alert_type)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Alert ID" value={alert.alert_id} />
            <Detail label="Transaction" value={alert.transaction_id} />
            <Detail label="User" value={alert.user_id} />
            <Detail label="Risk Score" value={String(alert.risk_score)} />
            <Detail label="Status" value={alert.status} />
            <Detail label="Created" value={formatRelative(alert.created_at)} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Recommended Action</p>
            <Badge className={getActionColor(alert.recommended_action)}>{formatAction(alert.recommended_action)}</Badge>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Detected Signals</p>
            <div className="space-y-2">
              {alert.detected_signals.map((sig, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <p className="text-sm font-medium text-slate-200">{sig.signal.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">{sig.description}</p>
                  <span className="text-xs text-amber-400">Weight: +{sig.weight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-200 break-all">{value}</p>
    </div>
  );
}
