import crypto from 'crypto';

// Normalize a free-text unit string into a canonical grouping key.
// Goal: "498CSSB", "498 cssb", "498-CSSB", "498 CSSB." all -> "498 CSSB"
export function unitKey(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[._,]/g, ' ')            // punctuation -> space
    .replace(/[\/\\\-]/g, ' ')          // separators (/ \ -) -> space
    .replace(/(\d)([A-Z])/g, '$1 $2')   // 498CSSB -> 498 CSSB
    .replace(/([A-Z])(\d)/g, '$1 $2')   // HHC498 -> HHC 498
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}

const SECRET = process.env.S1_SECRET || process.env.ADMIN_PIN || '3032';

// Deterministic per-unit token so each S1 link only works for its own unit.
export function unitToken(key) {
  return crypto.createHmac('sha256', SECRET).update(key).digest('base64url').slice(0, 12);
}
