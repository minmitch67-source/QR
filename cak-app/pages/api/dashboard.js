import db from '../../lib/db';
import { unitKey, unitToken } from '../../lib/units';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin, dateFrom, dateTo } = req.body;
  if (pin !== (process.env.ADMIN_PIN || '3032')) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Pending soldiers
  const pendingIds = await db.smembers('pending') || [];
  const approvedIds = await db.smembers('approved') || [];
  const deniedIds = await db.smembers('denied') || [];

  const fetchSoldiers = async (ids) => {
    const results = await Promise.all(ids.map(id => db.hgetall(`soldier:${id}`)));
    return results.filter(Boolean);
  };

  const [pending, approved, denied] = await Promise.all([
    fetchSoldiers(pendingIds),
    fetchSoldiers(approvedIds),
    fetchSoldiers(deniedIds),
  ]);

  // Daily meals for date range
  const from = dateFrom || today;
  const to = dateTo || today;
  const dailyMeals = [];
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    const dk = d.toISOString().slice(0, 10);
    const count = await db.get(`meals:daily:${dk}`);
    dailyMeals.push({ date: dk, count: parseInt(count || '0') });
    d.setDate(d.getDate() + 1);
  }

  // Group pending by normalized unit, with a per-unit S1 link token
  const unitMap = new Map();
  for (const s of pending) {
    const key = unitKey(s.unit);
    if (!unitMap.has(key)) {
      unitMap.set(key, { unitKey: key, label: key, token: unitToken(key), soldiers: [] });
    }
    unitMap.get(key).soldiers.push(s);
  }
  const pendingByUnit = [...unitMap.values()]
    .map(g => ({ ...g, count: g.soldiers.length }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Today's scans
  const todayScanIds = await db.smembers(`scans:${today}`) || [];
  const todayScans = await Promise.all(todayScanIds.map(id => db.hgetall(`scan:${id}`)));

  res.status(200).json({
    counts: {
      pending: pendingIds.length,
      approved: approvedIds.length,
      denied: deniedIds.length,
      mealsToday: parseInt(await db.get(`meals:daily:${today}`) || '0'),
    },
    pending,
    pendingByUnit,
    approved,
    denied,
    dailyMeals,
    todayScans: todayScans.filter(Boolean),
  });
}
