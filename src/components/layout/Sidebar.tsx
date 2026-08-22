import { NavLink, useLocation } from "react-router-dom";
import { Shield, LayoutDashboard, Search, Bell, Network, BarChart3 } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analysis", label: "Transaction Analysis", icon: Search },
  { to: "/alerts", label: "Security Alerts", icon: Bell },
  { to: "/relationships", label: "Abuse Ring Detection", icon: Network },
  { to: "/model", label: "Model Performance", icon: BarChart3 },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">FraudShield AI</h1>
          <p className="text-xs text-slate-500">Risk Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Active</span>
        </div>
        <p className="mt-2 text-xs text-slate-600">Defensive fraud detection v1.0</p>
      </div>
    </aside>
  );
}
