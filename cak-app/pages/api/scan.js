import db from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { qrData, mealPeriod } = req.body;

  let parsed;
  try {
    parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch {
    return res.status(400).json({ error: 'Invalid QR data' });
  }

  const { id } = parsed;
  if (!id) return res.status(400).json({ error: 'No ID in QR' });

  const soldier = await db.hgetall(`soldier:${id}`);
  if (!soldier) return res.status(404).json({ error: 'Soldier not found' });
  if (soldier.status !== 'approved') {
    return res.status(403).json({ error: 'Pass not approved', status: soldier.status });
  }

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const scanKey = `scan:${id}:${dateKey}:${mealPeriod || 'general'}`;

  // Prevent double-scan same meal same day
  const existing = await db.get(scanKey);
  if (existing) {
    return res.status(409).json({ error: 'Already scanned for this meal today' });
  }

  await db.set(scanKey, now.toISOString());

  // Increment meal counts
  const newCount = parseInt(soldier.mealsServed || '0') + 1;
  await db.hset(`soldier:${id}`, { mealsServed: String(newCount), lastScan: now.toISOString() });

  // Daily total
  await db.incr(`meals:daily:${dateKey}`);

  // Log scan event
  const scanId = `${id}:${Date.now()}`;
  await db.hset(`scan:${scanId}`, {
    soldierId: id,
    rank: soldier.rank,
    lastName: soldier.lastName,
    firstName: soldier.firstName,
    unit: soldier.unit,
    mealPeriod: mealPeriod || 'general',
    scannedAt: now.toISOString(),
    date: dateKey,
  });
  await db.sadd(`scans:${dateKey}`, scanId);
  await db.sadd('allscans', scanId);

  res.status(200).json({
    ok: true,
    soldier: {
      rank: soldier.rank,
      lastName: soldier.lastName,
      firstName: soldier.firstName,
      unit: soldier.unit,
      mealsServed: newCount,
    }
  });
}
