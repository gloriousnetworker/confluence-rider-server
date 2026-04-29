/**
 * Nigerian phone number utilities.
 * Canonical format: +234XXXXXXXXXX (13 characters total)
 */

const NIGERIAN_PHONE_REGEX = /^\+234[0-9]{10}$/;

/**
 * Normalize a Nigerian phone number to +234XXXXXXXXXX format.
 * Accepts: 0801..., 234801..., +234801..., 801...
 */
export function normalizePhone(phone: string): string {
  // Remove all whitespace, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-()]/g, "");

  // Already in +234 format
  if (cleaned.startsWith("+234") && cleaned.length === 14) {
    return cleaned;
  }

  // Starts with 234 (no +)
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return "+" + cleaned;
  }

  // Starts with 0 (local format)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return "+234" + cleaned.slice(1);
  }

  // Bare number without prefix (10 digits)
  if (/^[789][01][0-9]{8}$/.test(cleaned)) {
    return "+234" + cleaned;
  }

  // Return as-is if no pattern matches (validation will catch it)
  return cleaned;
}

/**
 * Validate a phone number is in the canonical +234XXXXXXXXXX format.
 * Call normalizePhone first.
 */
export function isValidPhone(phone: string): boolean {
  return NIGERIAN_PHONE_REGEX.test(phone);
}
