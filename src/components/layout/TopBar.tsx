import { ShieldCheck, Activity } from "lucide-react";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Real-time monitoring</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5">
            <ShieldCheck className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-slate-400">Model v1.0.0</span>
          </div>
        </div>
      </div>
    </header>
  );
}
