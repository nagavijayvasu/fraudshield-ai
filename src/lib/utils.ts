export function getRiskColor(level: string): { bg: string; text: string; border: string; badge: string } {
  switch (level) {
    case "LOW":
      return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-400" };
    case "MEDIUM":
      return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", badge: "bg-amber-500/20 text-amber-400" };
    case "HIGH":
      return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", badge: "bg-red-500/20 text-red-400" };
    case "CRITICAL":
      return { bg: "bg-rose-600/10", text: "text-rose-500", border: "border-rose-600/30", badge: "bg-rose-600/20 text-rose-500" };
    default:
      return { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", badge: "bg-slate-500/20 text-slate-400" };
  }
}

export function getScoreColor(score: number): string {
  if (score <= 30) return "text-emerald-400";
  if (score <= 70) return "text-amber-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score <= 30) return "bg-emerald-500";
  if (score <= 70) return "bg-amber-500";
  return "bg-red-500";
}

export function getActionColor(action: string): string {
  switch (action) {
    case "ALLOW":
      return "bg-emerald-500/20 text-emerald-400";
    case "MONITOR":
      return "bg-blue-500/20 text-blue-400";
    case "STEP_UP_VERIFICATION":
      return "bg-amber-500/20 text-amber-400";
    case "MANUAL_REVIEW":
      return "bg-red-500/20 text-red-400";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
}

export function formatAction(action: string): string {
  switch (action) {
    case "ALLOW": return "Allow";
    case "MONITOR": return "Monitor";
    case "STEP_UP_VERIFICATION": return "Step-Up Verification";
    case "MANUAL_REVIEW": return "Manual Review";
    default: return action;
  }
}

export function formatAlertType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  return ip;
}

export function maskDevice(device: string): string {
  if (device.length <= 8) return device;
  return `${device.slice(0, 4)}...${device.slice(-4)}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
