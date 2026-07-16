import db from '../../lib/db';

// Replays scans the scanner recorded locally while offline, preserving the
// actual scan time rather than the sync time. Mirrors /api/scan's dedupe and
// counting logic. Returns one result per input item, in the same order, so
// the client can tell which entries are done and safe to drop from its queue.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { scans } = req.body;
  if (!Array.isArray(scans)) return res.status(400).json({ error: 'Invalid payload' });

  const results = [];
  for (const item of scans) {
    const { id, mealPeriod, scannedAt } = item || {};
    if (!id || !mealPeriod || !scannedAt) { results.push({ id, ok: false, error: 'Invalid item' }); continue; }

    const soldier = await db.hgetall(`soldier:${id}`);
    if (!soldier) { results.push({ id, ok: false, error: 'Soldier not found' }); continue; }
    if (soldier.status !== 'approved') { results.push({ id, ok: false, error: 'Pass not approved' }); continue; }

    const dateKey = scannedAt.slice(0, 10);
    const scanKey = `scan:${id}:${dateKey}:${mealPeriod}`;
    const existing = await db.get(scanKey);
    if (existing) { results.push({ id, ok: false, error: 'Already scanned' }); continue; }

    await db.set(scanKey, scannedAt);
    const newCount = parseInt(soldier.mealsServed || '0', 10) + 1;
    await db.hset(`soldier:${id}`, { mealsServed: String(newCount), lastScan: scannedAt });
    await db.incr(`meals:daily:${dateKey}`);

    const scanId = `${id}:${new Date(scannedAt).getTime()}`;
    await db.hset(`scan:${scanId}`, {
      soldierId: id, rank: soldier.rank, lastName: soldier.lastName, firstName: soldier.firstName,
      unit: soldier.unit, component: soldier.component || '', mealPeriod,
      scannedAt, date: dateKey, offlineSync: '1',
    });
    await db.sadd(`scans:${dateKey}`, scanId);
    await db.sadd('allscans', scanId);

    results.push({ id, ok: true, mealsServed: newCount });
  }

  res.status(200).json({ results });
}
