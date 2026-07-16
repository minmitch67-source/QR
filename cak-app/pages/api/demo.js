import db from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

// Realistic sample roster across several battalions + components
const SAMPLE = [
  { rank: 'SGT', lastName: 'RIVERA',   firstName: 'MARCUS', unit: 'A CO 498 CSSB',   component: 'U.S. Army',   entitlement: 'meal_card',    status: 'pending'  },
  { rank: 'SPC', lastName: 'CHEN',     firstName: 'DAVID',  unit: 'A CO 498 CSSB',   component: 'U.S. Army',   entitlement: 'travel_order', status: 'pending'  },
  { rank: 'PFC', lastName: 'OKAFOR',   firstName: 'GRACE',  unit: 'HHC 498 CSSB',    component: 'U.S. Army',   entitlement: 'bas',          status: 'pending'  },
  { rank: 'SSG', lastName: 'MARTINEZ', firstName: 'LUIS',   unit: '498 CSSB',        component: 'U.S. Army',   entitlement: 'meal_card',    status: 'approved' },
  { rank: 'SGT', lastName: 'KIM',      firstName: 'JUNHO',  unit: '25 TRANS',        component: 'U.S. Army',   entitlement: 'meal_card',    status: 'pending'  },
  { rank: 'SPC', lastName: 'NGUYEN',   firstName: 'ANNA',   unit: '25 TRANS',        component: 'U.S. Army',   entitlement: 'travel_order', status: 'pending'  },
  { rank: 'CPL', lastName: 'THOMPSON', firstName: 'RYAN',   unit: 'HHC 25 TRANS',    component: 'U.S. Army',   entitlement: 'meal_card',    status: 'approved' },
  { rank: 'CPT', lastName: 'WILSON',   firstName: 'JAMES',  unit: '6 ORD',           component: 'U.S. Army',   entitlement: 'meal_card',    status: 'pending'  },
  { rank: 'SPC', lastName: 'GARCIA',   firstName: 'MARIA',  unit: '168 MMB',         component: 'U.S. Army',   entitlement: 'bas',          status: 'approved' },
  { rank: 'PV2', lastName: 'PARK',     firstName: 'SOO',    unit: 'HHC 19 ESC',      component: 'KATUSA',      entitlement: 'meal_card',    status: 'approved' },
  { rank: 'SGT', lastName: 'LEE',      firstName: 'MINHO',  unit: 'ROK 1 MARDIV',    component: 'ROK Army',    entitlement: 'travel_order', status: 'approved' },
  { rank: 'PO2', lastName: 'BROOKS',   firstName: 'ALAN',   unit: 'NAVY BEACH GRP 1',component: 'U.S. Navy',   entitlement: 'travel_order', status: 'pending'  },
];

const dayKey = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { pin, action } = req.body;
  if (pin !== (process.env.ADMIN_PIN || '3032')) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // ---- CLEAR: remove everything this demo created ----
  if (action === 'clear') {
    const ids = (await db.smembers('demo:ids')) || [];
    for (const id of ids) {
      await db.del(`soldier:${id}`);
      await db.srem('pending', id);
      await db.srem('approved', id);
      await db.srem('denied', id);
      await db.srem('all', id);
    }
    const scanIds = (await db.smembers('demo:scans')) || [];
    for (const sid of scanIds) {
      const sc = await db.hgetall(`scan:${sid}`);
      await db.del(`scan:${sid}`);
      await db.srem('allscans', sid);
      if (sc?.date) await db.srem(`scans:${sc.date}`, sid);
    }
    const days = (await db.smembers('demo:daily')) || [];
    for (const dk of days) await db.del(`meals:daily:${dk}`);
    await db.del('demo:ids');
    await db.del('demo:scans');
    await db.del('demo:daily');
    return res.status(200).json({ ok: true, cleared: ids.length });
  }

  // ---- SEED: load sample data ----
  if (action === 'seed') {
    // Avoid double-seeding
    const existing = (await db.smembers('demo:ids')) || [];
    if (existing.length) return res.status(200).json({ ok: true, alreadySeeded: existing.length });

    const today = dayKey(0);
    const approvedDemo = [];

    for (const s of SAMPLE) {
      const id = `demo-${uuidv4()}`;
      const soldier = {
        id, ...s,
        site: 'C-AK / Recon Base',
        startDate: today, endDate: dayKey(-3),
        meals: JSON.stringify(['Breakfast', 'Lunch', 'Dinner']),
        notes: 'DEMO RECORD',
        status: s.status,
        createdAt: new Date().toISOString(),
        mealsServed: '0',
        demo: '1',
      };
      await db.hset(`soldier:${id}`, soldier);
      await db.sadd('all', id);
      await db.sadd(s.status === 'approved' ? 'approved' : s.status === 'denied' ? 'denied' : 'pending', id);
      await db.sadd('demo:ids', id);
      if (s.status === 'approved') approvedDemo.push({ id, ...s });
    }

    // A few live scans today for approved soldiers
    let todayCount = 0;
    const meals = ['Breakfast', 'Lunch'];
    for (let i = 0; i < approvedDemo.length; i++) {
      const a = approvedDemo[i];
      const sid = `demo-${uuidv4()}`;
      const scan = {
        id: sid, soldierId: a.id,
        rank: a.rank, lastName: a.lastName, firstName: a.firstName, unit: a.unit,
        component: a.component || '',
        mealPeriod: meals[i % meals.length],
        date: today,
        scannedAt: new Date(Date.now() - i * 1800000).toISOString(),
      };
      await db.hset(`scan:${sid}`, scan);
      await db.sadd(`scans:${today}`, sid);
      await db.sadd('allscans', sid);
      await db.sadd('demo:scans', sid);
      await db.hset(`soldier:${a.id}`, { mealsServed: String(i + 1) });
      todayCount++;
    }
    await db.set(`meals:daily:${today}`, String(todayCount));
    await db.sadd('demo:daily', today);

    // Prior week of report data
    const prior = [185, 212, 198, 233, 205, 224];
    for (let i = 0; i < prior.length; i++) {
      const dk = dayKey(i + 1);
      await db.set(`meals:daily:${dk}`, String(prior[i]));
      await db.sadd('demo:daily', dk);
    }

    return res.status(200).json({ ok: true, seeded: SAMPLE.length });
  }

  res.status(400).json({ error: 'Invalid action' });
}
