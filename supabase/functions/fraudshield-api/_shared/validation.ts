export function validateTransactionInput(input: any): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "Invalid request body: must be a JSON object";
  }

  // 1. Required fields presence and type check
  if (input.user_id === undefined || input.user_id === null || input.user_id === "") {
    return "Missing required field: user_id";
  }
  if (typeof input.user_id !== "string") {
    return "Invalid field: user_id must be a string";
  }

  if (input.device_fingerprint === undefined || input.device_fingerprint === null || input.device_fingerprint === "") {
    return "Missing required field: device_fingerprint";
  }
  if (typeof input.device_fingerprint !== "string") {
    return "Invalid field: device_fingerprint must be a string";
  }

  if (input.ip_address === undefined || input.ip_address === null || input.ip_address === "") {
    return "Missing required field: ip_address";
  }
  if (typeof input.ip_address !== "string") {
    return "Invalid field: ip_address must be a string";
  }

  // IP Address format validation (IPv4 or IPv6)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$|^([0-9a-zA-F]{1,4}:){1,7}:|^::(|[0-9a-zA-F]{1,4}(:|)){1,7}$/;
  if (!ipv4Regex.test(input.ip_address) && !ipv6Regex.test(input.ip_address)) {
    return "Invalid field: ip_address must be a valid IPv4 or IPv6 address";
  }

  if (input.amount === undefined || input.amount === null) {
    return "Missing required field: amount";
  }
  if (typeof input.amount !== "number" || isNaN(input.amount) || !isFinite(input.amount)) {
    return "Invalid field: amount must be a valid number";
  }
  if (input.amount <= 0) {
    return "Invalid field: amount must be strictly greater than 0";
  }
  if (input.amount > 1000000000) {
    return "Invalid field: amount exceeds maximum reasonable limit of 1,000,000,000";
  }

  // 2. Optional timestamp check
  if (input.transaction_time !== undefined && input.transaction_time !== null) {
    if (typeof input.transaction_time !== "string") {
      return "Invalid field: transaction_time must be a string";
    }
    const parseTime = Date.parse(input.transaction_time);
    if (isNaN(parseTime)) {
      return "Invalid field: transaction_time must be a valid ISO 8601 timestamp string";
    }
  }

  // 3. Optional integer count fields
  const countFields = [
    "recent_transaction_count",
    "previous_chargebacks",
    "failed_transaction_count",
    "velocity_1h",
    "device_account_count",
    "ip_account_count",
  ];

  for (const field of countFields) {
    const val = input[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
        return `Invalid field: ${field} must be a number`;
      }
      if (val < 0) {
        return `Invalid field: ${field} cannot be negative`;
      }
      if (!Number.isInteger(val)) {
        return `Invalid field: ${field} must be an integer`;
      }
      if (val > 1000000) {
        return `Invalid field: ${field} exceeds reasonable count limit of 1,000,000`;
      }
    }
  }

  // 4. Distance check
  if (input.distance_from_home !== undefined && input.distance_from_home !== null) {
    const dist = input.distance_from_home;
    if (typeof dist !== "number" || isNaN(dist) || !isFinite(dist)) {
      return "Invalid field: distance_from_home must be a number";
    }
    if (dist < 0) {
      return "Invalid field: distance_from_home cannot be negative";
    }
    if (dist > 50000) {
      return "Invalid field: distance_from_home exceeds reasonable limit of 50,000 km";
    }
  }

  // 5. Boolean flags check
  const booleanFields = ["is_new_device", "is_new_ip"];
  for (const field of booleanFields) {
    const val = input[field];
    if (val !== undefined && val !== null) {
      if (typeof val !== "boolean") {
        return `Invalid field: ${field} must be a boolean`;
      }
    }
  }

  return null;
}
