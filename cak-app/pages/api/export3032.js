import db from '../../lib/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import templateB64 from '../../lib/da3032flat';

// Overlay coordinates taken from the official DA Form 3032 (612x792).
const FRONT_LEFT_Y = [];  // rows 1..22
const FRONT_RIGHT_Y = []; // rows 23..44
for (let i = 0; i < 22; i++) { FRONT_LEFT_Y.push(559 - i * 24); FRONT_RIGHT_Y.push(559 - i * 24); }
const BACK_LEFT_Y = [];   // rows 45..64
const BACK_RIGHT_Y = [];  // rows 65..84
for (let i = 0; i < 20; i++) { BACK_LEFT_Y.push(691 - i * 24); BACK_RIGHT_Y.push(691 - i * 24); }

const COL = { lName: 106, lId: 232, rName: 382, rId: 505 };
const MEAL_Y = { Breakfast: 668, Lunch: 644, Dinner: 620 };
const FRONT_ROWS = 44, BACK_ROWS = 40, PER_FORM = FRONT_ROWS + BACK_ROWS; // 84

const LEGEND = [
  { c: 'USA', x: 40, y: 116 }, { c: 'USAR', x: 40, y: 106 }, { c: 'ARNG', x: 40, y: 96 },
  { c: 'ROTC', x: 40, y: 86 }, { c: 'USN', x: 40, y: 76 }, { c: 'USNR', x: 40, y: 66 },
  { c: 'USMC', x: 40, y: 56 }, { c: 'USMCR', x: 40, y: 46 },
  { c: 'USAF', x: 187, y: 116 }, { c: 'ANG', x: 187, y: 106 }, { c: 'USAFR', x: 187, y: 96 },
  { c: 'MAP', x: 187, y: 86 }, { c: 'LS', x: 187, y: 76 }, { c: 'KATUSA', x: 187, y: 66 },
  { c: 'F', x: 187, y: 56 },
];
const COMP = {
  'U.S. Army': { code: 'USA', legend: 'USA' }, 'U.S. Navy': { code: 'USN', legend: 'USN' },
  'U.S. Marines': { code: 'USMC', legend: 'USMC' }, 'ROK Army': { code: 'F', legend: 'F' },
  'KATUSA': { code: 'KATUSA', legend: 'KATUSA' }, 'Civilian': { code: 'CIV', legend: null },
};

const passId = (sid) => String(sid || '').replace(/^demo-/, '').replace(/-/g, '').slice(0, 12).toUpperCase();
function fit(font, text, maxW, size) {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  while (text.length > 4 && font.widthOfTextAtSize(text, s) > maxW) text = text.slice(0, -1);
  return { text, size: s };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { pin, dateFrom, dateTo } = req.body;
  if (pin !== (process.env.ADMIN_PIN || '3032')) return res.status(401).json({ error: 'Invalid PIN' });

  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today, to = dateTo || today;

  const scans = [];
  const d = new Date(from), end = new Date(to);
  while (d <= end) {
    const dk = d.toISOString().slice(0, 10);
    const ids = (await db.smembers(`scans:${dk}`)) || [];
    const recs = await Promise.all(ids.map(id => db.hgetall(`scan:${id}`)));
    recs.filter(Boolean).forEach(s => scans.push(s));
    d.setDate(d.getDate() + 1);
  }
  if (!scans.length) return res.status(400).json({ error: 'No scans in that date range' });

  const missing = [...new Set(scans.filter(s => !s.component).map(s => s.soldierId))];
  const cmap = {};
  await Promise.all(missing.map(async id => { const sol = await db.hgetall(`soldier:${id}`); cmap[id] = sol?.component || ''; }));
  scans.forEach(s => { if (!s.component) s.component = cmap[s.soldierId] || 'U.S. Army'; });

  const groups = new Map();
  for (const s of scans) {
    const key = `${s.component}|${s.date}|${s.mealPeriod || 'general'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const arr of groups.values()) arr.sort((a, b) => new Date(a.scannedAt) - new Date(b.scannedAt));

  const template = await PDFDocument.load(Buffer.from(templateB64, 'base64'), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const K = rgb(0, 0, 0);
  const T = (page, s, x, y, size = 8, f = font) => page.drawText(String(s), { x, y, size, font: f, color: K });

  for (const key of [...groups.keys()].sort()) {
    const [component, date, meal] = key.split('|');
    const list = groups.get(key);
    const ymd = (date || '').replace(/-/g, '');
    const cfg = COMP[component] || { code: (component || '').slice(0, 6).toUpperCase(), legend: null };

    for (let p = 0; p < Math.ceil(list.length / PER_FORM); p++) {
      const chunk = list.slice(p * PER_FORM, (p + 1) * PER_FORM);
      const [front, back] = await out.copyPages(template, [0, 1]);
      out.addPage(front); out.addPage(back);

      // Front header
      T(front, 'C-AK / DOGU BEACH', 50, 700, 9);
      T(front, ymd, 423, 700, 10);
      if (MEAL_Y[meal]) T(front, 'X', 65, MEAL_Y[meal], 10, bold);
      T(front, cfg.code, 235, 665, 11, bold);

      // Front rows 1..44
      chunk.slice(0, FRONT_ROWS).forEach((s, i) => {
        const left = i < 22;
        const y = (left ? FRONT_LEFT_Y[i] : FRONT_RIGHT_Y[i - 22]);
        const nx = left ? COL.lName : COL.rName, ix = left ? COL.lId : COL.rId;
        const name = `${s.rank || ''} ${s.lastName || ''}, ${s.firstName || ''}`.trim();
        const nf = fit(font, name, (ix - nx) - 4, 8);
        T(front, nf.text, nx, y, nf.size); T(front, passId(s.soldierId), ix, y, 7);
      });

      // Back rows 45..84
      chunk.slice(FRONT_ROWS).forEach((s, j) => {
        const left = j < 20;
        const y = (left ? BACK_LEFT_Y[j] : BACK_RIGHT_Y[j - 20]);
        const nx = left ? COL.lName : COL.rName, ix = left ? COL.lId : COL.rId;
        const name = `${s.rank || ''} ${s.lastName || ''}, ${s.firstName || ''}`.trim();
        const nf = fit(font, name, (ix - nx) - 4, 8);
        T(back, nf.text, nx, y, nf.size); T(back, passId(s.soldierId), ix, y, 7);
      });

      // Back: check the service-component legend item
      if (cfg.legend) {
        const it = LEGEND.find(l => l.c === cfg.legend);
        if (it) T(back, 'X', it.x - 11, it.y, 7, bold);
      }
    }
  }

  const bytes = await out.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=DA3032_${from}_to_${to}.pdf`);
  res.send(Buffer.from(bytes));
}
