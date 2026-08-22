import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { engineerFeatures } from '../supabase/functions/fraudshield-api/_shared/feature-engineering.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawCsvPath = path.join(__dirname, 'data', 'synthetic_transactions_raw.csv');
const outCsvPath = path.join(__dirname, 'data', 'synthetic_transactions.csv');

if (!fs.existsSync(rawCsvPath)) {
  console.error(`Error: ${rawCsvPath} does not exist.`);
  process.exit(1);
}

const content = fs.readFileSync(rawCsvPath, 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

if (lines.length === 0) {
  console.error("Empty raw CSV file.");
  process.exit(1);
}

const header = lines[0].split(',');
console.log(`Processing dataset with header: ${header.join(', ')}`);

const outputLines = [];
const outputHeader = [
  "amount",
  "hour_of_day",
  "is_night",
  "recent_transaction_count",
  "velocity_1h",
  "previous_chargebacks",
  "failed_transaction_count",
  "is_new_device",
  "is_new_ip",
  "distance_from_home",
  "device_account_count",
  "ip_account_count",
  "amount_deviation",
  "is_fraud"
];
outputLines.push(outputHeader.join(','));

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',');
  if (values.length !== header.length) continue;

  const row = {};
  header.forEach((colName, index) => {
    row[colName] = values[index];
  });

  // Construct input for engineerFeatures
  const input = {
    user_id: "synthetic",
    device_fingerprint: "synthetic",
    ip_address: "synthetic",
    amount: parseFloat(row.amount),
    hour_of_day: parseInt(row.hour_of_day, 10),
    recent_transaction_count: parseInt(row.recent_transaction_count, 10),
    velocity_1h: parseInt(row.velocity_1h, 10),
    previous_chargebacks: parseInt(row.previous_chargebacks, 10),
    failed_transaction_count: parseInt(row.failed_transaction_count, 10),
    is_new_device: parseInt(row.is_new_device, 10) === 1,
    is_new_ip: parseInt(row.is_new_ip, 10) === 1,
    distance_from_home: parseFloat(row.distance_from_home),
    device_account_count: parseInt(row.device_account_count, 10),
    ip_account_count: parseInt(row.ip_account_count, 10),
    avg_user_amount: parseFloat(row.avg_user_amount)
  };

  const engineered = engineerFeatures(input);
  const is_fraud = parseInt(row.is_fraud, 10);

  // Construct output row values matching outputHeader ordering
  const outputRow = [
    engineered.raw.amount.toFixed(2),
    engineered.raw.hour_of_day,
    engineered.raw.is_night,
    engineered.raw.recent_transaction_count,
    engineered.raw.velocity_1h,
    engineered.raw.previous_chargebacks,
    engineered.raw.failed_transaction_count,
    engineered.raw.is_new_device,
    engineered.raw.is_new_ip,
    engineered.raw.distance_from_home.toFixed(1),
    engineered.raw.device_account_count,
    engineered.raw.ip_account_count,
    engineered.raw.amount_deviation.toFixed(3),
    is_fraud
  ];

  outputLines.push(outputRow.join(','));
}

fs.writeFileSync(outCsvPath, outputLines.join('\n') + '\n');
console.log(`Successfully engineered ${outputLines.length - 1} records and saved to ${outCsvPath}`);
