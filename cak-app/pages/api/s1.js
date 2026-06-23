import db from '../../lib/db';
import { unitKey, unitToken } from '../../lib/units';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { u, t, action, id } = req.body; // u = unitKey, t = token

  if (!u || !t || unitToken(u) !== t) {
    return res.status(401).json({ error: 'Invalid or expired link' });
  }

  const loadPending = async () => {
    const ids = (await db.smembers('pending')) || [];
    const all = await Promise.all(ids.map(i => db.hgetall(`soldier:${i}`)));
    return all.filter(s => s && unitKey(s.unit) === u);
  };

  // Act on a single soldier, but only if they belong to this unit (scope guard)
  const actOne = async (sid, act) => {
    const s = await db.hgetall(`soldier:${sid}`);
    if (!s || unitKey(s.unit) !== u || s.status !== 'pending') return false;
    if (act === 'approve') {
      await db.hset(`soldier:${sid}`, { status: 'approved', approvedAt: new Date().toISOString() });
      await db.srem('pending', sid);
      await db.sadd('approved', sid);
    } else {
      await db.hset(`soldier:${sid}`, { status: 'denied', deniedAt: new Date().toISOString() });
      await db.srem('pending', sid);
      await db.sadd('denied', sid);
    }
    return true;
  };

  if (action === 'approve' || action === 'deny') {
    await actOne(id, action);
  } else if (action === 'approveAll') {
    const pending = await loadPending();
    for (const s of pending) await actOne(s.id, 'approve');
  }

  // Always return the current pending list + approved count for this unit
  const pending = await loadPending();
  const apprIds = (await db.smembers('approved')) || [];
  const approved = (await Promise.all(apprIds.map(i => db.hgetall(`soldier:${i}`))))
    .filter(s => s && unitKey(s.unit) === u);

  res.status(200).json({ ok: true, unit: u, pending, approvedCount: approved.length });
}
