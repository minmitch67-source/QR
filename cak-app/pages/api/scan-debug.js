import db from '../../lib/db';

// Returns the last few raw QR/scanner payloads that failed to parse into a
// pass id, so a scanner transmission problem (e.g. a keyboard-layout
// mismatch swapping a character) can be diagnosed from the admin dashboard
// instead of a photo of the kiosk screen.
export default async function handler(req, res) {
  if (req.method === 'POST' && req.body?.action === 'clear') {
    if (req.body.pin !== (process.env.ADMIN_PIN || '3032')) return res.status(401).json({ error: 'Invalid PIN' });
    await db.del('debug:invalidScans');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();
  if (req.query.pin !== (process.env.ADMIN_PIN || '3032')) return res.status(401).json({ error: 'Invalid PIN' });

  const raw = await db.lrange('debug:invalidScans', 0, 19);
  const entries = (raw || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  res.status(200).json({ entries });
}
