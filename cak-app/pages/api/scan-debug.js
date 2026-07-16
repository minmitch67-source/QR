import db from '../../lib/db';

// Returns the last few rejected scans (raw payload + why it was rejected —
// invalid data, soldier not found, or not approved), so a scanner
// transmission problem or a pass mismatch can be diagnosed from the admin
// dashboard instead of a photo of the kiosk screen.
export default async function handler(req, res) {
  if (req.method === 'POST' && req.body?.action === 'clear') {
    if (req.body.pin !== (process.env.ADMIN_PIN || '3032')) return res.status(401).json({ error: 'Invalid PIN' });
    await db.del('debug:scanErrors');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();
  if (req.query.pin !== (process.env.ADMIN_PIN || '3032')) return res.status(401).json({ error: 'Invalid PIN' });

  const raw = await db.lrange('debug:scanErrors', 0, 19);
  const entries = (raw || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  res.status(200).json({ entries });
}
