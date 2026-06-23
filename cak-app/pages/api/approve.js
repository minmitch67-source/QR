import db from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin, id, action } = req.body; // action: 'approve' | 'deny'

  if (pin !== (process.env.ADMIN_PIN || '3032')) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const soldier = await db.hgetall(`soldier:${id}`);
  if (!soldier) return res.status(404).json({ error: 'Not found' });

  if (action === 'approve') {
    await db.hset(`soldier:${id}`, { status: 'approved', approvedAt: new Date().toISOString() });
    await db.srem('pending', id);
    await db.sadd('approved', id);
  } else if (action === 'deny') {
    await db.hset(`soldier:${id}`, { status: 'denied', deniedAt: new Date().toISOString() });
    await db.srem('pending', id);
    await db.sadd('denied', id);
  }

  res.status(200).json({ ok: true });
}
