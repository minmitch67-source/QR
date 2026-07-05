// Resolve a soldier id from a scanned QR payload. Prefer JSON, but fall back
// to extracting the UUID directly — handheld (keyboard-wedge) scanners can
// garble JSON punctuation under different keyboard layouts, while the UUID
// (hex + hyphens) is layout-safe. Shared by the online scan API and the
// client's offline fallback so both resolve an id the same way.
export function parsePassId(qrData) {
  let id;
  try {
    const parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    id = parsed?.id;
  } catch {
    id = null;
  }
  if (!id && typeof qrData === 'string') {
    const m = qrData.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (m) id = m[0];
  }
  return id || null;
}
