import db from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin, type } = req.body; // type: 'soldiers' | 'scans'
  if (pin !== (process.env.ADMIN_PIN || '3032')) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  if (type === 'soldiers') {
    const allIds = await db.smembers('all') || [];
    const soldiers = (await Promise.all(allIds.map(id => db.hgetall(`soldier:${id}`)))).filter(Boolean);

    const headers = ['ID','Rank','Last','First','Unit','Site','Status','Entitlement','Start','End','Meals','Created'];
    const rows = soldiers.map(s => [
      s.id, s.rank, s.lastName, s.firstName, s.unit, s.site,
      s.status, s.entitlement, s.startDate, s.endDate,
      s.mealsServed, s.createdAt,
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=cak_soldiers_${new Date().toISOString().slice(0,10)}.csv`);
    return res.send(csv);
  }

  if (type === 'scans') {
    const allScanIds = await db.smembers('allscans') || [];
    const scans = (await Promise.all(allScanIds.map(id => db.hgetall(`scan:${id}`)))).filter(Boolean);
    scans.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));

    const headers = ['Date','Time','Rank','Last','First','Unit','Meal Period'];
    const rows = scans.map(s => {
      const dt = new Date(s.scannedAt);
      return [s.date, dt.toTimeString().slice(0,8), s.rank, s.lastName, s.firstName, s.unit, s.mealPeriod];
    });

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=cak_scans_${new Date().toISOString().slice(0,10)}.csv`);
    return res.send(csv);
  }

  res.status(400).json({ error: 'Invalid type' });
}
