/**
 * Utility functions for normalizing contact identifiers.
 */

/**
 * Normalize email: trim and lowercase.
 */
export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize phone: strip formatting characters, keep leading + if present.
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7) {
    return null; // Invalid short phone number
  }

  return hasPlus ? `+${digits}` : digits;
}
