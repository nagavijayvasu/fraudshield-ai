import { useEffect, useState, useRef } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardHeader, Badge, Spinner, ErrorState, EmptyState } from "@/components/ui";
import { fetchRelationships } from "@/lib/api";
import { maskIp, maskDevice } from "@/lib/utils";
import type { RelationshipGraph } from "@/types/index";
import { Users, Monitor, Globe, AlertTriangle } from "lucide-react";

export function RelationshipsPage() {
  const [graph, setGraph] = useState<RelationshipGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchRelationships();
        setGraph(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load relationships");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!graph || !canvasRef.current || graph.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Position nodes in a force-directed-ish layout
    const nodePositions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    graph.nodes.forEach((node, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.35;
      nodePositions.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      });
    });

    // Simple force simulation
    for (let iter = 0; iter < 100; iter++) {
      // Repulsion between nodes
      graph.nodes.forEach((nA) => {
        const posA = nodePositions.get(nA.id)!;
        graph.nodes.forEach((nB) => {
          if (nA.id === nB.id) return;
          const posB = nodePositions.get(nB.id)!;
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          posA.vx += (dx / dist) * force;
          posA.vy += (dy / dist) * force;
        });
      });

      // Attraction along edges
      graph.edges.forEach((edge) => {
        const posA = nodePositions.get(edge.source);
        const posB = nodePositions.get(edge.target);
        if (!posA || !posB) return;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 80) * 0.01;
        posA.vx += (dx / dist) * force;
        posA.vy += (dy / dist) * force;
        posB.vx -= (dx / dist) * force;
        posB.vy -= (dy / dist) * force;
      });

      // Apply velocity with damping
      nodePositions.forEach((pos) => {
        pos.x += pos.vx * 0.5;
        pos.y += pos.vy * 0.5;
        pos.vx *= 0.9;
        pos.vy *= 0.9;
        // Keep in bounds
        pos.x = Math.max(30, Math.min(width - 30, pos.x));
        pos.y = Math.max(30, Math.min(height - 30, pos.y));
      });
    }

    // Draw
    ctx.clearRect(0, 0, width, height);

    // Draw edges
    graph.edges.forEach((edge) => {
      const posA = nodePositions.get(edge.source);
      const posB = nodePositions.get(edge.target);
      if (!posA || !posB) return;
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.strokeStyle = edge.isSuspicious ? "rgba(239, 68, 68, 0.4)" : "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = edge.isSuspicious ? 2 : 1;
      ctx.stroke();
    });

    // Draw nodes
    graph.nodes.forEach((node) => {
      const pos = nodePositions.get(node.id)!;
      const color = node.type === "USER" ? "#3b82f6" : node.type === "DEVICE" ? "#f59e0b" : "#10b981";
      const radius = node.type === "USER" ? 6 : 8;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      const label = node.type === "USER" ? node.label : node.type === "DEVICE" ? maskDevice(node.label) : maskIp(node.label);
      ctx.fillText(label, pos.x, pos.y + radius + 12);
    });
  }, [graph]);

  if (loading) return <PageShell title="Abuse Ring Detection"><div className="flex h-96 items-center justify-center"><Spinner /></div></PageShell>;
  if (error) return <PageShell title="Abuse Ring Detection"><ErrorState message={error} /></PageShell>;
  if (!graph) return null;

  return (
    <PageShell title="Abuse Ring Detection" subtitle="Account, device, and IP relationship analysis">
      {/* Legend */}
      <div className="mb-4 flex items-center gap-6">
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-blue-500" /><span className="text-xs text-slate-400">User</span></div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-amber-500" /><span className="text-xs text-slate-400">Device</span></div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-emerald-500" /><span className="text-xs text-slate-400">IP Address</span></div>
        <div className="flex items-center gap-2"><div className="h-0.5 w-6 bg-red-500" /><span className="text-xs text-slate-400">Suspicious link</span></div>
      </div>

      {/* Warning banner */}
      {graph.clusters.some((c) => c.isSuspicious) && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-400">Potential coordinated account abuse detected</p>
            <p className="text-xs text-slate-400">{graph.clusters.filter((c) => c.isSuspicious).length} suspicious cluster(s) identified where multiple accounts share the same device or IP</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Graph */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Relationship Graph" subtitle={`${graph.nodes.length} nodes, ${graph.edges.length} connections`} />
            <div className="p-5">
              {graph.nodes.length > 0 ? (
                <canvas ref={canvasRef} className="w-full rounded-lg bg-slate-950" style={{ height: 400 }} />
              ) : (
                <EmptyState message="No relationship data yet. Analyze transactions to build the graph." />
              )}
            </div>
          </Card>
        </div>

        {/* Clusters */}
        <div>
          <Card>
            <CardHeader title="Suspicious Clusters" subtitle="Shared devices/IPs with multiple accounts" />
            <div className="space-y-3 p-5">
              {graph.clusters.length > 0 ? (
                graph.clusters.map((cluster) => (
                  <div key={cluster.id} className={`rounded-lg border p-4 ${cluster.isSuspicious ? "border-red-500/30 bg-red-500/5" : "border-slate-800 bg-slate-900/30"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {cluster.type === "DEVICE" ? <Monitor className="h-4 w-4 text-amber-400" /> : <Globe className="h-4 w-4 text-emerald-400" />}
                        <span className="text-sm font-medium text-slate-200">
                          {cluster.type === "DEVICE" ? maskDevice(cluster.entity) : maskIp(cluster.entity)}
                        </span>
                      </div>
                      <Badge className={cluster.isSuspicious ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}>
                        {cluster.isSuspicious ? "Suspicious" : "Watch"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Users className="h-3 w-3" />
                      {cluster.userCount} accounts: {cluster.users.join(", ")}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No suspicious clusters detected" />
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
