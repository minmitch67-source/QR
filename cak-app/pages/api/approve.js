import db from '../../lib/db';
import { unitGroup } from '../../lib/units';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin, id, action, unit } = req.body; // action: 'approve' | 'deny' | 'approveAllUnit'

  if (pin !== (process.env.ADMIN_PIN || '3032')) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const setStatus = async (sid, act) => {
    if (act === 'approve') {
      await db.hset(`soldier:${sid}`, { status: 'approved', approvedAt: new Date().toISOString() });
      await db.srem('pending', sid);
      await db.sadd('approved', sid);
    } else if (act === 'deny') {
      await db.hset(`soldier:${sid}`, { status: 'denied', deniedAt: new Date().toISOString() });
      await db.srem('pending', sid);
      await db.sadd('denied', sid);
    }
  };

  // Bulk-approve every pending soldier in a unit
  if (action === 'approveAllUnit') {
    const ids = (await db.smembers('pending')) || [];
    const all = await Promise.all(ids.map(i => db.hgetall(`soldier:${i}`)));
    let n = 0;
    for (const s of all) {
      if (s && unitGroup(s.unit).key === unit) { await setStatus(s.id, 'approve'); n++; }
    }
    return res.status(200).json({ ok: true, approved: n });
  }

  // Single soldier approve/deny
  const soldier = await db.hgetall(`soldier:${id}`);
  if (!soldier) return res.status(404).json({ error: 'Not found' });
  await setStatus(id, action);

  res.status(200).json({ ok: true });
}
