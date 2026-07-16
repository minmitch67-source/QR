import db from '../../lib/db';

// Snapshot the scanner needs to keep working offline: who's approved, and
// who's already been served which meal today. No PIN required — this is
// the same information the scanner already reveals one soldier at a time.
export default async function handler(req, res) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const approvedIds = (await db.smembers('approved')) || [];
  const approvedRaw = await Promise.all(approvedIds.map(id => db.hgetall(`soldier:${id}`)));
  const approved = approvedRaw.filter(Boolean).map(s => ({
    id: s.id, rank: s.rank, lastName: s.lastName, firstName: s.firstName,
    unit: s.unit, component: s.component || '', mealsServed: s.mealsServed || '0',
  }));

  const todayScanIds = (await db.smembers(`scans:${today}`)) || [];
  const todayScansRaw = await Promise.all(todayScanIds.map(id => db.hgetall(`scan:${id}`)));
  const todayScans = todayScansRaw.filter(Boolean).map(s => ({ soldierId: s.soldierId, mealPeriod: s.mealPeriod }));

  res.status(200).json({ today, approved, todayScans });
}
