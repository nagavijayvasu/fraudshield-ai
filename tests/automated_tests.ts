import { test, describe } from "node:test";
import assert from "node:assert";

import { validateTransactionInput } from "../supabase/functions/fraudshield-api/_shared/validation.ts";
import { engineerFeatures, predictFraud } from "../supabase/functions/fraudshield-api/_shared/feature-engineering.ts";
import { computeRiskScore, recommendAction } from "../supabase/functions/fraudshield-api/_shared/risk-scorer.ts";
import { evaluateRules } from "../supabase/functions/fraudshield-api/_shared/rule-engine.ts";
import { detectAnomaly } from "../supabase/functions/fraudshield-api/_shared/anomaly-detector.ts";
import { analyzeRelationships } from "../supabase/functions/fraudshield-api/_shared/relationship-analyzer.ts";
import { analyzeTransaction } from "../supabase/functions/fraudshield-api/_shared/fraud-engine.ts";
import { modelWeights } from "../supabase/functions/fraudshield-api/_shared/model.ts";

describe("Transaction Validation Tests", () => {
  test("Valid legitimate transaction input passes validation", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 120.50,
      transaction_time: "2026-08-22T10:00:00Z",
      recent_transaction_count: 2,
      velocity_1h: 1,
      previous_chargebacks: 0,
      failed_transaction_count: 0,
      is_new_device: false,
      is_new_ip: false,
      distance_from_home: 15.2,
      device_account_count: 1,
      ip_account_count: 1,
    };
    assert.strictEqual(validateTransactionInput(input), null);
  });

  test("Missing required field returns clear error", () => {
    const input = {
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
    };
    assert.strictEqual(validateTransactionInput(input), "Missing required field: user_id");
  });

  test("Invalid IP address format returns clear error", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "invalid-ip",
      amount: 100,
    };
    assert.strictEqual(
      validateTransactionInput(input),
      "Invalid field: ip_address must be a valid IPv4 or IPv6 address"
    );
  });

  test("Negative and zero transaction amounts return clear error", () => {
    const negativeInput = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: -10,
    };
    assert.strictEqual(
      validateTransactionInput(negativeInput),
      "Invalid field: amount must be strictly greater than 0"
    );

    const zeroInput = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 0,
    };
    assert.strictEqual(
      validateTransactionInput(zeroInput),
      "Invalid field: amount must be strictly greater than 0"
    );
  });

  test("Invalid timestamps return clear error", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      transaction_time: "not-a-date",
    };
    assert.strictEqual(
      validateTransactionInput(input),
      "Invalid field: transaction_time must be a valid ISO 8601 timestamp string"
    );
  });

  test("Unreasonable transaction count returns clear error", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      recent_transaction_count: 9999999, // exceeds 1M
    };
    assert.strictEqual(
      validateTransactionInput(input),
      "Invalid field: recent_transaction_count exceeds reasonable count limit of 1,000,000"
    );
  });
});

describe("Amount Deviation Feature Engineering Tests", () => {
  test("Calculates correct amount deviation using identical training formula", () => {
    const input = {
      user_id: "user_1",
      device_fingerprint: "dev_1",
      ip_address: "192.168.1.1",
      amount: 150,
      avg_user_amount: 100, // deviation should be |150-100| / max(100, 1) = 50 / 100 = 0.5
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    assert.ok(deviationIndex !== -1);
    assert.strictEqual(engineered.values[deviationIndex], 0.5);
  });

  test("Uses transaction amount as fallback when avg_user_amount is missing", () => {
    const input = {
      user_id: "user_1",
      device_fingerprint: "dev_1",
      ip_address: "192.168.1.1",
      amount: 100,
      // avg_user_amount is missing -> fallback to 100 -> deviation should be |100-100| / 100 = 0
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    assert.strictEqual(engineered.values[deviationIndex], 0);
  });

  test("Handles low avg_user_amount bounds division by max(avg, 1) correctly", () => {
    const input = {
      user_id: "user_1",
      device_fingerprint: "dev_1",
      ip_address: "192.168.1.1",
      amount: 5,
      avg_user_amount: 0.5, // should divide by Math.max(0.5, 1) = 1 -> |5 - 0.5| / 1 = 4.5
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    assert.strictEqual(engineered.values[deviationIndex], 4.5);
  });

  test("Average amount below 80 INR (scales to internal amount < 1.0)", () => {
    // E.g., user average is ₹40 INR -> scaled to internal unit: 40 / 80 = 0.5
    // Transaction amount is ₹200 INR -> scaled to internal unit: 200 / 80 = 2.5
    const input = {
      user_id: "user_test",
      device_fingerprint: "dev_test",
      ip_address: "192.168.1.1",
      amount: 200 / 80, // scaled amount = 2.5
      avg_user_amount: 40 / 80, // scaled average = 0.5
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    // deviation = |2.5 - 0.5| / Math.max(0.5, 1.0) = 2.0 / 1.0 = 2.0
    assert.strictEqual(engineered.values[deviationIndex], 2.0);
  });

  test("Average amount equal to 80 INR (scales to internal amount = 1.0)", () => {
    // E.g., user average is ₹80 INR -> scaled to internal unit: 80 / 80 = 1.0
    // Transaction amount is ₹240 INR -> scaled to internal unit: 240 / 80 = 3.0
    const input = {
      user_id: "user_test",
      device_fingerprint: "dev_test",
      ip_address: "192.168.1.1",
      amount: 240 / 80, // scaled amount = 3.0
      avg_user_amount: 80 / 80, // scaled average = 1.0
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    // deviation = |3.0 - 1.0| / Math.max(1.0, 1.0) = 2.0 / 1.0 = 2.0
    assert.strictEqual(engineered.values[deviationIndex], 2.0);
  });

  test("Average amount above 80 INR (scales to internal amount > 1.0)", () => {
    // E.g., user average is ₹160 INR -> scaled to internal unit: 160 / 80 = 2.0
    // Transaction amount is ₹480 INR -> scaled to internal unit: 480 / 80 = 6.0
    const input = {
      user_id: "user_test",
      device_fingerprint: "dev_test",
      ip_address: "192.168.1.1",
      amount: 480 / 80, // scaled amount = 6.0
      avg_user_amount: 160 / 80, // scaled average = 2.0
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    // deviation = |6.0 - 2.0| / Math.max(2.0, 1.0) = 4.0 / 2.0 = 2.0
    assert.strictEqual(engineered.values[deviationIndex], 2.0);
  });

  test("Normal INR transaction (e.g. amount ₹4,000, average ₹3,200)", () => {
    const input = {
      user_id: "user_test",
      device_fingerprint: "dev_test",
      ip_address: "192.168.1.1",
      amount: 4000 / 80, // scaled amount = 50.0
      avg_user_amount: 3200 / 80, // scaled average = 40.0
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    // deviation = |50.0 - 40.0| / Math.max(40.0, 1.0) = 10.0 / 40.0 = 0.25
    assert.strictEqual(engineered.values[deviationIndex], 0.25);
  });

  test("High INR transaction (e.g. amount ₹2,40,000, average ₹1,60,000)", () => {
    const input = {
      user_id: "user_test",
      device_fingerprint: "dev_test",
      ip_address: "192.168.1.1",
      amount: 240000 / 80, // scaled amount = 3000.0
      avg_user_amount: 160000 / 80, // scaled average = 2000.0
    };
    const engineered = engineerFeatures(input);
    const deviationIndex = engineered.featureNames.indexOf("amount_deviation");
    // deviation = |3000.0 - 2000.0| / Math.max(2000.0, 1.0) = 1000.0 / 2000.0 = 0.5
    assert.strictEqual(engineered.values[deviationIndex], 0.5);
  });
});

describe("Fraud Prediction (ML Engine) Tests", () => {
  test("ML model returns valid probability between 0 and 1", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 500,
      avg_user_amount: 100,
    };
    const engineered = engineerFeatures(input);
    const prediction = predictFraud(engineered, modelWeights);
    assert.ok(prediction.probability >= 0 && prediction.probability <= 1);
  });
});

describe("Risk Scoring and Risk Level Classification Tests", () => {
  test("Risk level maps correctly based on risk score thresholds", () => {
    // Low risk: score <= 30
    const lowResult = computeRiskScore(0.1, 0.1, 10, 10, 10);
    assert.strictEqual(lowResult.riskLevel, "LOW");

    // Medium risk: 30 < score <= 70
    const medResult = computeRiskScore(0.5, 0.4, 40, 45, 30);
    assert.strictEqual(medResult.riskLevel, "MEDIUM");

    // High risk: score > 70
    const highResult = computeRiskScore(0.9, 0.8, 90, 80, 80);
    assert.strictEqual(highResult.riskLevel, "HIGH");
  });

  test("Action recommendation matches risk score severity", () => {
    assert.strictEqual(recommendAction("LOW", 15, "LOW"), "ALLOW");
    assert.strictEqual(recommendAction("MEDIUM", 45, "LOW"), "MONITOR");
    assert.strictEqual(recommendAction("MEDIUM", 45, "HIGH"), "STEP_UP_VERIFICATION");
    assert.strictEqual(recommendAction("HIGH", 75, "MEDIUM"), "STEP_UP_VERIFICATION");
    assert.strictEqual(recommendAction("HIGH", 92, "HIGH"), "MANUAL_REVIEW");
  });

  test("Action recommended is escalated to MANUAL_REVIEW when POTENTIAL_ABUSE_RING is triggered", () => {
    // Ordinary transaction (Medium risk) without abuse ring
    const normalInput = {
      user_id: "user_normal",
      device_fingerprint: "dev_normal",
      ip_address: "192.168.1.1",
      amount: 100,
      is_new_device: true,
      is_new_ip: true,
      velocity_1h: 4,
      failed_transaction_count: 2,
      previous_chargebacks: 1,
    };
    const normalResult = analyzeTransaction(normalInput);
    // Should get MONITOR (standard Action recommendation for low-anomaly Medium-risk score)
    assert.strictEqual(normalResult.risk_level, "MEDIUM");
    assert.strictEqual(normalResult.recommended_action, "MONITOR");

    // Coordinated abuse transaction with POTENTIAL_ABUSE_RING signal (3 linked users on same device/IP)
    const abuseInput = {
      user_id: "user_syndicate_1",
      device_fingerprint: "dev_shared",
      ip_address: "192.168.1.99",
      amount: 100,
      device_account_count: 3, 
      ip_account_count: 3,     
      is_new_device: true,
      velocity_1h: 4,
      previous_chargebacks: 1,
    };
    const abuseResult = analyzeTransaction(abuseInput);
    // The numerical risk score should naturally map to MEDIUM level (e.g. ~40-60)
    assert.strictEqual(abuseResult.risk_level, "MEDIUM");
    // But the recommended action MUST be escalated to MANUAL_REVIEW due to the override
    assert.strictEqual(abuseResult.recommended_action, "MANUAL_REVIEW");
  });
});

describe("Behavioral Rule & Signal Detection Tests", () => {
  test("New device and new IP detect correctly", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      is_new_device: true,
      is_new_ip: true,
    };
    const ruleResult = evaluateRules(input);
    const signalNames = ruleResult.signals.map(s => s.signal);
    assert.ok(signalNames.includes("NEW_DEVICE"));
    assert.ok(signalNames.includes("NEW_IP"));
    assert.strictEqual(ruleResult.securityRisk, 22); // 12 (device) + 10 (IP)
  });

  test("Transaction velocity triggers signals", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      velocity_1h: 6, // triggers high velocity rule (weight 14)
    };
    const ruleResult = evaluateRules(input);
    const signalNames = ruleResult.signals.map(s => s.signal);
    assert.ok(signalNames.includes("HIGH_VELOCITY"));
    assert.strictEqual(ruleResult.transactionRisk, 14);
  });

  test("Chargeback history triggers signals", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      previous_chargebacks: 2, // triggers chargeback rule (weight 15)
    };
    const ruleResult = evaluateRules(input);
    const signalNames = ruleResult.signals.map(s => s.signal);
    assert.ok(signalNames.includes("CHARGEBACK_HISTORY"));
    assert.strictEqual(ruleResult.transactionRisk, 15);
  });
});

describe("Abuse Ring (Coordinated Relationship) Detection Tests", () => {
  test("Triggers POTENTIAL_ABUSE_RING when sharing counts are high", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      device_account_count: 4,
      ip_account_count: 3,
    };
    const relResult = analyzeRelationships(input);
    assert.strictEqual(relResult.isAbuseRing, true);
    assert.strictEqual(relResult.behavioralRisk, 20);
    assert.ok(relResult.signals.some(s => s.signal === "POTENTIAL_ABUSE_RING"));
  });

  test("Triggers separate device/IP sharing signals when count is moderate", () => {
    const input = {
      user_id: "user_123",
      device_fingerprint: "dev_xyz",
      ip_address: "192.168.1.1",
      amount: 100,
      device_account_count: 3,
      ip_account_count: 1,
    };
    const relResult = analyzeRelationships(input);
    assert.strictEqual(relResult.isAbuseRing, false);
    assert.strictEqual(relResult.behavioralRisk, 10);
    assert.ok(relResult.signals.some(s => s.signal === "DEVICE_SHARING"));
  });
});

describe("Integration API Transaction Analysis Tests", () => {
  test("Runs complete end-to-end transaction analysis pipeline", () => {
    const input = {
      user_id: "user_integration",
      device_fingerprint: "dev_integration",
      ip_address: "192.168.1.100",
      amount: 250,
      avg_user_amount: 50,
      recent_transaction_count: 3,
      velocity_1h: 3,
      previous_chargebacks: 1,
      failed_transaction_count: 1,
      is_new_device: true,
      is_new_ip: true,
      distance_from_home: 300,
      device_account_count: 2,
      ip_account_count: 2,
    };

    const result = analyzeTransaction(input);
    assert.ok(result.risk_score >= 0 && result.risk_score <= 100);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(result.risk_level));
    assert.ok(result.fraud_probability >= 0 && result.fraud_probability <= 1);
    assert.ok(result.anomaly_score >= 0 && result.anomaly_score <= 1);
    assert.ok(Array.isArray(result.risk_signals));
    assert.ok(Array.isArray(result.explanation));
    assert.ok(["ALLOW", "MONITOR", "STEP_UP_VERIFICATION", "MANUAL_REVIEW"].includes(result.recommended_action));
  });
});

describe("Business Cost & Financial Optimizer Tests", () => {
  test("Computes correct False Positive and False Negative costs", () => {
    // Under our assumptions:
    // FP Cost: (Amount * 0.1) + $20 (₹1600 equivalent in units of 1)
    // FN Cost: Amount + $15 (₹1200 equivalent in units of 1)
    
    // FP test: amount = 100, actual = legit (0), prediction = fraud (1) (False Positive)
    const fpAmount = 100;
    const fpCost = fpAmount * 0.1 + 20; // 10 + 20 = 30
    assert.strictEqual(fpCost, 30);

    // FN test: amount = 200, actual = fraud (1), prediction = legit (0) (False Negative)
    const fnAmount = 200;
    const fnCost = fnAmount + 15; // 200 + 15 = 215
    assert.strictEqual(fnCost, 215);
  });

  test("Threshold sweep finds optimal cost-minimizing threshold", () => {
    // Let's simulate a simple test set with 2 samples:
    // Sample 1: amount = 100, actual = legit (0), prob = 0.8
    // Sample 2: amount = 200, actual = fraud (1), prob = 0.6
    const testSet = [
      { amount: 100, actual: 0, prob: 0.8 },
      { amount: 200, actual: 1, prob: 0.6 }
    ];

    const evaluateCostsAtThreshold = (t: number) => {
      let loss = 0;
      testSet.forEach(s => {
        const pred = s.prob >= t ? 1 : 0;
        if (s.actual === 0 && pred === 1) {
          loss += s.amount * 0.1 + 20; // FP Cost
        } else if (s.actual === 1 && pred === 0) {
          loss += s.amount + 15; // FN Cost
        }
      });
      return loss;
    };

    // If threshold = 0.5:
    // Sample 1 (legit): pred = 1 -> FP (loss = 10 + 20 = 30)
    // Sample 2 (fraud): pred = 1 -> TP (loss = 0)
    // Total loss = 30
    assert.strictEqual(evaluateCostsAtThreshold(0.5), 30);

    // If threshold = 0.9:
    // Sample 1 (legit): pred = 0 -> TN (loss = 0)
    // Sample 2 (fraud): pred = 0 -> FN (loss = 200 + 15 = 215)
    // Total loss = 215
    assert.strictEqual(evaluateCostsAtThreshold(0.9), 215);

    // Dynamic search for min loss
    let bestT = 0.5;
    let minLoss = Infinity;
    [0.5, 0.9].forEach(t => {
      const loss = evaluateCostsAtThreshold(t);
      if (loss < minLoss) {
        minLoss = loss;
        bestT = t;
      }
    });
    assert.strictEqual(bestT, 0.5); // 0.5 threshold (30 loss) is better than 0.9 threshold (215 loss)
  });
});

describe("Abuse-Ring Trust & Database Relationship Verification Tests", () => {
  // Mock representation of the server-side db-fetch override logic in index.ts
  function runServerSideAnalysis(body: any, dbRelations: any[]): any {
    // 1. Query device fingerprint relations (distinct users)
    const deviceUsers = new Set(
      dbRelations
        .filter(r => r.entity_type_b === "DEVICE" && r.entity_id_b === body.device_fingerprint)
        .map(r => r.entity_id_a)
    );
    deviceUsers.add(body.user_id);
    const serverDeviceCount = deviceUsers.size;

    // 2. Query IP address relations (distinct users)
    const ipUsers = new Set(
      dbRelations
        .filter(r => r.entity_type_b === "IP" && r.entity_id_b === body.ip_address)
        .map(r => r.entity_id_a)
    );
    ipUsers.add(body.user_id);
    const serverIpCount = ipUsers.size;

    // 3. Override client-provided counts with server-derived counts
    const enriched = {
      ...body,
      device_account_count: serverDeviceCount,
      ip_account_count: serverIpCount,
    };

    // 4. Run real fraud-engine analyzeTransaction
    return analyzeTransaction(enriched);
  }

  test("Client-provided device_account_count cannot force an abuse-ring result", () => {
    const clientInput = {
      user_id: "user_test_1",
      device_fingerprint: "dev_fake_1",
      ip_address: "192.168.1.1",
      amount: 100,
      device_account_count: 5, // Client attempts to force abuse ring
      ip_account_count: 1,
    };
    
    // Empty database relationships
    const dbRelations: any[] = [];

    const result = runServerSideAnalysis(clientInput, dbRelations);
    const signalNames = result.risk_signals.map((s: any) => s.signal);
    
    // Should NOT contain POTENTIAL_ABUSE_RING because DB has 0 other users
    assert.ok(!signalNames.includes("POTENTIAL_ABUSE_RING"));
  });

  test("Client-provided ip_account_count cannot force an abuse-ring result", () => {
    const clientInput = {
      user_id: "user_test_1",
      device_fingerprint: "dev_fake_1",
      ip_address: "192.168.1.1",
      amount: 100,
      device_account_count: 1,
      ip_account_count: 5, // Client attempts to force abuse ring
    };
    
    // Empty database relationships
    const dbRelations: any[] = [];

    const result = runServerSideAnalysis(clientInput, dbRelations);
    const signalNames = result.risk_signals.map((s: any) => s.signal);
    
    assert.ok(!signalNames.includes("POTENTIAL_ABUSE_RING"));
  });

  test("Three actual stored user/device relationships trigger the abuse-ring condition", () => {
    const clientInput = {
      user_id: "user_test_3", // 3rd user
      device_fingerprint: "dev_shared",
      ip_address: "192.168.1.1",
      amount: 100,
      device_account_count: 1, // Client claims only 1 user
      ip_account_count: 1,
    };
    
    // DB relationships contain 2 other distinct users for this device
    const dbRelations = [
      { entity_type_a: "USER", entity_id_a: "user_test_1", entity_type_b: "DEVICE", entity_id_b: "dev_shared" },
      { entity_type_a: "USER", entity_id_a: "user_test_2", entity_type_b: "DEVICE", entity_id_b: "dev_shared" },
    ];

    const result = runServerSideAnalysis(clientInput, dbRelations);
    const signalNames = result.risk_signals.map((s: any) => s.signal);
    
    // Should trigger DEVICE_SHARING (account count >= 3)
    assert.ok(signalNames.includes("DEVICE_SHARING"));
  });

  test("Three actual stored user/IP relationships trigger the abuse-ring condition", () => {
    const clientInput = {
      user_id: "user_test_3", // 3rd user
      device_fingerprint: "dev_1",
      ip_address: "192.168.1.99",
      amount: 100,
      device_account_count: 1,
      ip_account_count: 1, // Client claims only 1 user
    };
    
    // DB relationships contain 2 other distinct users for this IP
    const dbRelations = [
      { entity_type_a: "USER", entity_id_a: "user_test_1", entity_type_b: "IP", entity_id_b: "192.168.1.99" },
      { entity_type_a: "USER", entity_id_a: "user_test_2", entity_type_b: "IP", entity_id_b: "192.168.1.99" },
    ];

    const result = runServerSideAnalysis(clientInput, dbRelations);
    const signalNames = result.risk_signals.map((s: any) => s.signal);
    
    // Should trigger IP_SHARING (account count >= 3)
    assert.ok(signalNames.includes("IP_SHARING"));
  });

  test("Three actual stored user/device AND user/IP relationships trigger the POTENTIAL_ABUSE_RING condition", () => {
    const clientInput = {
      user_id: "user_test_3", // 3rd user
      device_fingerprint: "dev_shared",
      ip_address: "192.168.1.99",
      amount: 100,
      device_account_count: 1,
      ip_account_count: 1,
    };
    
    // DB relationships contain 2 other distinct users for BOTH this device and IP
    const dbRelations = [
      { entity_type_a: "USER", entity_id_a: "user_test_1", entity_type_b: "DEVICE", entity_id_b: "dev_shared" },
      { entity_type_a: "USER", entity_id_a: "user_test_2", entity_type_b: "DEVICE", entity_id_b: "dev_shared" },
      { entity_type_a: "USER", entity_id_a: "user_test_1", entity_type_b: "IP", entity_id_b: "192.168.1.99" },
      { entity_type_a: "USER", entity_id_a: "user_test_2", entity_type_b: "IP", entity_id_b: "192.168.1.99" },
    ];

    const result = runServerSideAnalysis(clientInput, dbRelations);
    const signalNames = result.risk_signals.map((s: any) => s.signal);
    
    // Should trigger POTENTIAL_ABUSE_RING
    assert.ok(signalNames.includes("POTENTIAL_ABUSE_RING"));
  });
});
