import type { TransactionInput, RiskSignal } from "./types.ts";

export interface RelationshipResult {
  signals: RiskSignal[];
  behavioralRisk: number;
  isAbuseRing: boolean;
  clusterInfo: { deviceCount: number; ipCount: number; userCount: number } | null;
}

export function analyzeRelationships(input: TransactionInput): RelationshipResult {
  const signals: RiskSignal[] = [];
  let behavioralRisk = 0;
  let isAbuseRing = false;
  let clusterInfo: { deviceCount: number; ipCount: number; userCount: number } | null = null;

  const deviceAccountCount = Number(input.device_account_count) || 1;
  const ipAccountCount = Number(input.ip_account_count) || 1;

  // Detect potential coordinated account abuse
  if (deviceAccountCount >= 3 && ipAccountCount >= 3) {
    isAbuseRing = true;
    clusterInfo = {
      deviceCount: 1,
      ipCount: 1,
      userCount: Math.max(deviceAccountCount, ipAccountCount),
    };
    signals.push({
      signal: "POTENTIAL_ABUSE_RING",
      description: `Potential coordinated account abuse: ${Math.max(deviceAccountCount, ipAccountCount)} accounts sharing same device and IP`,
      weight: 20,
    });
    behavioralRisk += 20;
  } else if (deviceAccountCount >= 3) {
    signals.push({
      signal: "DEVICE_SHARING",
      description: `${deviceAccountCount} accounts using the same device`,
      weight: 10,
    });
    behavioralRisk += 10;
  } else if (ipAccountCount >= 3) {
    signals.push({
      signal: "IP_SHARING",
      description: `${ipAccountCount} accounts using the same IP address`,
      weight: 8,
    });
    behavioralRisk += 8;
  }

  return { signals, behavioralRisk, isAbuseRing, clusterInfo };
}
