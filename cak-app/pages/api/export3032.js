import db from '../../lib/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ---- Exact geometry from the official DA Form 3032 (612x792) ----
const P1_TOP = 571;            // top line of the page-1 table
const P2_TOP = 703;            // top line of the page-2 table
const ROW_H = 24;
const P1_ROWS = 22;            // per column (1-22 left, 23-44 right)
const P2_ROWS = 20;            // per column (45-64 left, 65-84 right)
const PER_FORM = (P1_ROWS + P2_ROWS) * 2;  // 84 diners per 2-page form

// column x for the two blocks (No | SIGNATURE | MEAL CARD NUMBER)
const LEFT  = { no: 33, sig: 60, id: 227, end: 303, vSig: 62, vId: 230 };
const RIGHT = { no: 306, sig: 333, id: 500, end: 579, vSig: 335, vId: 503 };

const MEAL_Y = { Breakfast: 669, Lunch: 645, Dinner: 621 };

// Service-component legend (page 2), with exact positions
const LEGEND = [
  { c: 'USA',    t: 'USA - Active Army',                         x: 40,  y: 116 },
  { c: 'USAR',   t: 'USAR - U.S. Army Reserve',                  x: 40,  y: 106 },
  { c: 'ARNG',   t: 'ARNG - Army National Guard',                x: 40,  y: 96  },
  { c: 'ROTC',   t: 'ROTC - Reserve Officer Training Corps',     x: 40,  y: 86  },
  { c: 'USN',    t: 'USN - U.S. Navy, Active',                   x: 40,  y: 76  },
  { c: 'USNR',   t: 'USNR - U.S. Navy, Reserve',                 x: 40,  y: 66  },
  { c: 'USMC',   t: 'USMC - U.S. Marine Corps, Active',          x: 40,  y: 56  },
  { c: 'USMCR',  t: 'USMCR - U.S. Marine Corps, Reserve',        x: 40,  y: 46  },
  { c: 'USAF',   t: 'USAF - U.S. Air Force, Active',             x: 187, y: 116 },
  { c: 'ANG',    t: 'ANG - Air National Guard',                  x: 187, y: 106 },
  { c: 'USAFR',  t: 'USAFR - U.S. Air Force, Reserve',           x: 187, y: 96  },
  { c: 'MAP',    t: 'MAP - Military Assistance Program',         x: 187, y: 86  },
  { c: 'LS',     t: 'LS - Labor Service Personnel',              x: 187, y: 76  },
  { c: 'KATUSA', t: 'KATUSA - Korean Augmentation to U.S. Army', x: 187, y: 66  },
  { c: 'F',      t: 'F - Foreign Military Personnel',            x: 187, y: 56  },
];

// app component -> { code for box 4, legend code to check, label for grouping order }
const COMP = {
  'U.S. Army':    { code: 'USA',    legend: 'USA' },
  'U.S. Navy':    { code: 'USN',    legend: 'USN' },
  'U.S. Marines': { code: 'USMC',   legend: 'USMC' },
  'ROK Army':     { code: 'F',      legend: 'F' },
  'KATUSA':       { code: 'KATUSA', legend: 'KATUSA' },
  'Civilian':     { code: 'CIV',    legend: null },
};

const passId = (sid) => String(sid || '').replace(/^demo-/, '').replace(/-/g, '').slice(0, 12).toUpperCase();

function fit(font, text, maxW, size) {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  while (text.length > 4 && font.widthOfTextAtSize(text, s) > maxW) text = text.slice(0, -1);
  return { text, size: s };
}

function helpers(page, F) {
  const K = rgb(0, 0, 0);
  return {
    line: (x1, y1, x2, y2, t = 0.7) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color: K }),
    rect: (x, y, w, h, t = 0.7) => page.drawRectangle({ x, y, width: w, height: h, borderColor: K, borderWidth: t }),
    txt: (s, x, y, size = 8, f = F.font) => page.drawText(String(s), { x, y, size, font: f, color: K }),
    chk: (x, y, on, sz = 7) => { page.drawRectangle({ x, y: y - 1, width: sz, height: sz, borderColor: K, borderWidth: 0.6 }); if (on) page.drawText('X', { x: x + 1, y: y - 0.5, size: sz, font: F.bold, color: K }); },
  };
}

function drawTable(H, F, top, nRows) {
  for (const b of [LEFT, RIGHT]) {
    [b.no, b.sig, b.id, b.end].forEach(x => H.line(x, top, x, top - nRows * ROW_H));
    for (let r = 0; r <= nRows; r++) H.line(b.no, top - r * ROW_H, b.end, top - r * ROW_H);
  }
}

function numberRows(H, F, top, nRows, startNum) {
  for (let r = 0; r < nRows; r++) {
    H.txt(`${startNum + r}.`, LEFT.no + 4, top - r * ROW_H - 16, 7);
    H.txt(`${startNum + nRows + r}.`, RIGHT.no + 4, top - r * ROW_H - 16, 7);
  }
}

function fillRows(page, F, rows, top, nRows, offset) {
  for (let i = 0; i < rows.length; i++) {
    const onLeft = i < nRows;
    const b = onLeft ? LEFT : RIGHT;
    const r = onLeft ? i : i - nRows;
    if (r >= nRows) continue;
    const y = top - (r + 1) * ROW_H + 7;
    const s = rows[i];
    const name = `${s.rank || ''} ${s.lastName || ''}, ${s.firstName || ''}`.trim();
    const nf = fit(F.font, name, b.id - b.sig - 6, 8);
    page.drawText(nf.text, { x: b.vSig, y, size: nf.size, font: F.font, color: rgb(0, 0, 0) });
    page.drawText(passId(s.soldierId), { x: b.vId, y, size: 7, font: F.font, color: rgb(0, 0, 0) });
  }
}

function page1(out, F, { org, ymd, meal, svc, chunk }) {
  const page = out.addPage([612, 792]);
  const H = helpers(page, F);
  const { txt, rect, chk } = H;

  // Title
  txt('SIGNATURE HEADCOUNT SHEET', 306 - F.bold.widthOfTextAtSize('SIGNATURE HEADCOUNT SHEET', 12) / 2, 752, 12, F.bold);
  txt('For use of this form, see DA PAM 30-22; the proponent agency is DCS, G-4.', 168, 742, 6.5);

  // Header boxes
  rect(33, 695, 382, 23); txt('1.  ORGANIZATION', 37, 710, 6.5, F.bold); txt(org, 50, 700, 9);
  rect(415, 695, 164, 23); txt('2.  DATE (YYYYMMDD)', 419, 710, 6.5, F.bold); txt(ymd, 423, 700, 10);

  rect(33, 607, 185, 88);  txt('3.  MEAL', 37, 686, 6.5, F.bold);
  ['Breakfast', 'Lunch', 'Dinner'].forEach(m => { chk(64, MEAL_Y[m], m === meal); txt(m, 76, MEAL_Y[m], 7); });
  ['Brunch', 'Supper', 'Holiday'].forEach((m, i) => { chk(133, MEAL_Y.Breakfast - i * 24, false); txt(m, 145, MEAL_Y.Breakfast - i * 24, 7); });

  rect(218, 607, 87, 88);  txt('4.  SERVICE COMP', 222, 686, 6.5, F.bold); txt('(Specify)', 240, 676, 6); txt(svc, 240, 660, 11, F.bold);
  rect(305, 607, 274, 88); txt('5.  DINER CATEGORY', 309, 686, 6.5, F.bold);
  txt('Permanent', 331, 653, 7); txt('DFAS Action', 331, 629, 7); txt('(Central Billing)', 331, 619, 6);
  txt('Common Service', 419, 669, 7); txt('Reimbursement', 419, 645, 7); txt('Other', 419, 621, 7); txt('(Specify)', 419, 611, 6);

  // Column header band + table
  rect(33, P1_TOP, 546, 36);
  for (const b of [LEFT, RIGHT]) {
    txt('No.', b.no + 3, 591, 6.5, F.bold);
    txt('6.  SIGNATURE', b.sig + 4, 591, 6.5, F.bold);
    txt('7.  MEAL CARD', b.id + 4, 596, 6.5, F.bold); txt('NUMBER', b.id + 4, 586, 6.5, F.bold);
    [b.sig, b.id, b.end].forEach(x => H.line(x, P1_TOP, x, P1_TOP + 36));
  }
  drawTable(H, F, P1_TOP, P1_ROWS);
  numberRows(H, F, P1_TOP, P1_ROWS, 1);
  fillRows(page, F, chunk.slice(0, P1_ROWS * 2), P1_TOP, P1_ROWS, 0);

  // Footer
  txt('DA FORM 3032, JUL 2002', 32, 37, 6.5); txt('Page 1 of 2', 529, 38, 6.5);
}

function page2(out, F, { legendCode, chunk, org, ymd, meal, sheetNo, sheetTot }) {
  const page = out.addPage([612, 792]);
  const H = helpers(page, F);
  const { txt, rect, line, chk } = H;

  // Column header band + table (rows 45-84)
  rect(33, P2_TOP, 546, 37);
  for (const b of [LEFT, RIGHT]) {
    txt('No.', b.no + 3, 729, 6.5, F.bold);
    txt('6.  SIGNATURE', b.sig + 4, 729, 6.5, F.bold);
    txt('7.  MEAL CARD', b.id + 4, 734, 6.5, F.bold); txt('NUMBER', b.id + 4, 724, 6.5, F.bold);
    [b.sig, b.id, b.end].forEach(x => line(x, P2_TOP, x, P2_TOP + 37));
  }
  drawTable(H, F, P2_TOP, P2_ROWS);
  numberRows(H, F, P2_TOP, P2_ROWS, 45);
  fillRows(page, F, chunk.slice(P1_ROWS * 2), P2_TOP, P2_ROWS, 0);

  // 8. REMARKS
  txt('8.  REMARKS:', 37, 207, 6.5, F.bold);
  rect(33, 128, 300, 80);
  txt(`${COMP_LABEL(legendCode)} · ${meal || ''} · ${ymd}` + (sheetTot > 1 ? `  (Sheet ${sheetNo} of ${sheetTot})` : ''), 38, 196, 7);

  // 9a / 9b certification blocks
  rect(345, 86, 234, 34); txt('9a.  HEADCOUNT SIGNATURE AND RANK', 349, 112, 6.5, F.bold); line(349, 92, 575, 92, 0.5);
  rect(345, 44, 234, 34); txt('9b.  FOS SIGNATURE AND RANK', 349, 70, 6.5, F.bold); line(349, 50, 575, 50, 0.5);

  // Service-component legend (check the sheet's component)
  txt('SERVICE COMPONENT CODES:', 37, 122, 6, F.bold);
  LEGEND.forEach(it => { chk(it.x - 11, it.y, it.c === legendCode, 6); txt(it.t, it.x, it.y, 6.5); });

  txt('DA FORM 3032, JUL 2002', 32, 31, 6.5); txt('Page 2 of 2', 529, 32, 6.5);
}

function COMP_LABEL(code) {
  const it = LEGEND.find(l => l.c === code);
  return it ? it.t : (code || 'UNSPECIFIED');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { pin, dateFrom, dateTo } = req.body;
  if (pin !== (process.env.ADMIN_PIN || '3032')) return res.status(401).json({ error: 'Invalid PIN' });

  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today, to = dateTo || today;

  // Gather scans
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

  // Backfill component from soldier record where missing
  const missing = [...new Set(scans.filter(s => !s.component).map(s => s.soldierId))];
  const compMap = {};
  await Promise.all(missing.map(async id => { const sol = await db.hgetall(`soldier:${id}`); compMap[id] = sol?.component || ''; }));
  scans.forEach(s => { if (!s.component) s.component = compMap[s.soldierId] || 'U.S. Army'; });

  // Group by component | date | meal
  const groups = new Map();
  for (const s of scans) {
    const key = `${s.component}|${s.date}|${s.mealPeriod || 'general'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const arr of groups.values()) arr.sort((a, b) => new Date(a.scannedAt) - new Date(b.scannedAt));

  const out = await PDFDocument.create();
  const F = { font: await out.embedFont(StandardFonts.Helvetica), bold: await out.embedFont(StandardFonts.HelveticaBold) };

  for (const key of [...groups.keys()].sort()) {
    const [component, date, meal] = key.split('|');
    const list = groups.get(key);
    const ymd = (date || '').replace(/-/g, '');
    const cfg = COMP[component] || { code: (component || '').slice(0, 6).toUpperCase(), legend: null };
    const sheetTot = Math.ceil(list.length / PER_FORM);

    for (let p = 0; p < sheetTot; p++) {
      const chunk = list.slice(p * PER_FORM, (p + 1) * PER_FORM);
      const hdr = { org: 'C-AK / DOGU BEACH', ymd, meal, svc: cfg.code };
      page1(out, F, { ...hdr, chunk });
      page2(out, F, { ...hdr, legendCode: cfg.legend, chunk, sheetNo: p + 1, sheetTot });
    }
  }

  const bytes = await out.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=DA3032_${from}_to_${to}.pdf`);
  res.send(Buffer.from(bytes));
}
