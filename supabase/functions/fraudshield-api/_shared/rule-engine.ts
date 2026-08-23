import type { TransactionInput, RiskSignal } from "./types.ts";
import { MODEL_AMOUNT_SCALE } from "./feature-engineering.ts";

function formatINR(val: number): string {
  const x = Math.round(val).toString();
  let lastThree = x.substring(x.length - 3);
  const otherLines = x.substring(0, x.length - 3);
  if (otherLines !== "") {
    lastThree = "," + lastThree;
  }
  const res = otherLines.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `₹${res}`;
}


export interface RuleResult {
  signals: RiskSignal[];
  securityRisk: number;
  transactionRisk: number;
}

export function evaluateRules(input: TransactionInput): RuleResult {
  const signals: RiskSignal[] = [];
  let securityRisk = 0;
  let transactionRisk = 0;

  // New device
  if (input.is_new_device) {
    signals.push({
      signal: "NEW_DEVICE",
      description: "Transaction from a previously unseen device",
      weight: 12,
    });
    securityRisk += 12;
  }

  // New IP
  if (input.is_new_ip) {
    signals.push({
      signal: "NEW_IP",
      description: "Transaction from a previously unseen IP address",
      weight: 10,
    });
    securityRisk += 10;
  }

  // Multiple accounts on same device
  const deviceAccountCount = Number(input.device_account_count) || 1;
  if (deviceAccountCount >= 3) {
    signals.push({
      signal: "MULTIPLE_ACCOUNTS_DEVICE",
      description: `${deviceAccountCount} accounts associated with this device`,
      weight: 15,
    });
    securityRisk += 15;
  } else if (deviceAccountCount === 2) {
    signals.push({
      signal: "MULTIPLE_ACCOUNTS_DEVICE",
      description: `${deviceAccountCount} accounts associated with this device`,
      weight: 8,
    });
    securityRisk += 8;
  }

  // Multiple accounts on same IP
  const ipAccountCount = Number(input.ip_account_count) || 1;
  if (ipAccountCount >= 3) {
    signals.push({
      signal: "MULTIPLE_ACCOUNTS_IP",
      description: `${ipAccountCount} accounts associated with this IP address`,
      weight: 12,
    });
    securityRisk += 12;
  } else if (ipAccountCount === 2) {
    signals.push({
      signal: "MULTIPLE_ACCOUNTS_IP",
      description: `${ipAccountCount} accounts associated with this IP address`,
      weight: 6,
    });
    securityRisk += 6;
  }

  // High transaction velocity
  const velocity = Number(input.velocity_1h) || 0;
  if (velocity >= 5) {
    signals.push({
      signal: "HIGH_VELOCITY",
      description: `${velocity} transactions in the last hour`,
      weight: 14,
    });
    transactionRisk += 14;
  } else if (velocity >= 3) {
    signals.push({
      signal: "HIGH_VELOCITY",
      description: `${velocity} transactions in the last hour`,
      weight: 7,
    });
    transactionRisk += 7;
  }

  // Unusual transaction amount
  const amount = Number(input.amount) || 0;
  const inrAmount = amount * MODEL_AMOUNT_SCALE;
  if (amount > 2000) {
    signals.push({
      signal: "UNUSUAL_AMOUNT",
      description: `High transaction amount: ${formatINR(inrAmount)}`,
      weight: 10,
    });
    transactionRisk += 10;
  } else if (amount > 1000) {
    signals.push({
      signal: "UNUSUAL_AMOUNT",
      description: `Elevated transaction amount: ${formatINR(inrAmount)}`,
      weight: 5,
    });
    transactionRisk += 5;
  }

  // Unusual transaction time (night)
  const txTime = input.transaction_time ? new Date(input.transaction_time) : new Date();
  const hour = txTime.getHours();
  if (hour < 6 || hour > 22) {
    signals.push({
      signal: "UNUSUAL_TIME",
      description: `Transaction at unusual hour: ${hour}:00`,
      weight: 8,
    });
    transactionRisk += 8;
  }

  // Sudden geographic change
  const distance = Number(input.distance_from_home) || 0;
  if (distance > 500) {
    signals.push({
      signal: "GEOGRAPHIC_CHANGE",
      description: `Transaction ${distance.toFixed(0)}km from home location`,
      weight: 12,
    });
    securityRisk += 12;
  } else if (distance > 200) {
    signals.push({
      signal: "GEOGRAPHIC_CHANGE",
      description: `Transaction ${distance.toFixed(0)}km from home location`,
      weight: 6,
    });
    securityRisk += 6;
  }

  // Previous chargeback history
  const chargebacks = Number(input.previous_chargebacks) || 0;
  if (chargebacks >= 2) {
    signals.push({
      signal: "CHARGEBACK_HISTORY",
      description: `${chargebacks} previous chargebacks on account`,
      weight: 15,
    });
    transactionRisk += 15;
  } else if (chargebacks >= 1) {
    signals.push({
      signal: "CHARGEBACK_HISTORY",
      description: `${chargebacks} previous chargeback on account`,
      weight: 8,
    });
    transactionRisk += 8;
  }

  // Repeated failed transactions
  const failedTx = Number(input.failed_transaction_count) || 0;
  if (failedTx >= 4) {
    signals.push({
      signal: "FAILED_TRANSACTIONS",
      description: `${failedTx} failed transaction attempts`,
      weight: 12,
    });
    securityRisk += 12;
  } else if (failedTx >= 2) {
    signals.push({
      signal: "FAILED_TRANSACTIONS",
      description: `${failedTx} failed transaction attempts`,
      weight: 6,
    });
    securityRisk += 6;
  }

  return { signals, securityRisk, transactionRisk };
}
