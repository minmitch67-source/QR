import db from '../../lib/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ROWS_PER_COL = 22;          // 22 left + 22 right = 44 per sheet
const ROWS_PER_PAGE = ROWS_PER_COL * 2;
const ROW_H = 24;
const TABLE_TOP = 644;
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const MEALS2 = ['Brunch', 'Supper', 'Holiday'];

// Column geometry for the two table blocks
const BLOCK = {
  left:  { x0: 33,  noW: 24, sigW: 172, idW: 74 },
  right: { x0: 309, noW: 24, sigW: 172, idW: 74 },
};

const passId = (soldierId) =>
  String(soldierId || '').replace(/^demo-/, '').replace(/-/g, '').slice(0, 12).toUpperCase();

function fit(font, text, maxW, size) {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  while (text.length > 4 && font.widthOfTextAtSize(text, s) > maxW) text = text.slice(0, -1);
  return { text, size: s };
}

function drawSheet(page, F, { org, ymd, meal, count, sheetNo, sheetTot }) {
  const { font, bold } = F;
  const BLACK = rgb(0, 0, 0);
  const line = (x1, y1, x2, y2, t = 0.7) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color: BLACK });
  const rect = (x, y, w, h, t = 0.7) => page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: t });
  const txt = (s, x, y, size = 8, f = font) => page.drawText(String(s), { x, y, size, font: f, color: BLACK });
  const lbl = (s, x, y) => txt(s, x, y, 6.5, bold);

  // Title
  const title = 'SIGNATURE HEADCOUNT SHEET';
  txt(title, 306 - bold.widthOfTextAtSize(title, 12) / 2, 758, 12, bold);
  txt('For use of this form, see DA PAM 30-22; the proponent agency is DCS, G-4.', 168, 747, 6.5);

  // Header boxes — row 1: ORGANIZATION + DATE
  rect(33, 706, 382, 30);
  lbl('1.  ORGANIZATION', 37, 728);
  txt(org, 45, 714, 9);
  rect(415, 706, 164, 30);
  lbl('2.  DATE (YYYYMMDD)', 419, 728);
  txt(ymd, 423, 713, 11);

  // Header boxes — row 2: MEAL / SERVICE COMP / DINER CATEGORY
  rect(33, 664, 240, 42);
  lbl('3.  MEAL', 37, 698);
  const checkbox = (label, x, y, on) => {
    rect(x, y - 1, 7, 7, 0.6);
    if (on) { txt('X', x + 0.7, y - 0.5, 7, bold); }
    txt(label, x + 11, y, 7);
  };
  MEALS.forEach((m, i) => checkbox(m, 70, 690 - i * 13, m === meal));
  MEALS2.forEach((m, i) => checkbox(m, 165, 690 - i * 13, m === meal));
  rect(273, 664, 110, 42);
  lbl('4.  SERVICE COMP', 277, 698);
  rect(383, 664, 196, 42);
  lbl('5.  DINER CATEGORY', 387, 698);

  // Column header band + table
  const headerY = TABLE_TOP;        // top line of table
  const bandTop = headerY + 20;
  rect(33, headerY, 546, 20);       // header band rectangle
  for (const side of ['left', 'right']) {
    const b = BLOCK[side];
    const noX = b.x0, sigX = b.x0 + b.noW, idX = b.x0 + b.noW + b.sigW, endX = b.x0 + b.noW + b.sigW + b.idW;
    lbl('No.', noX + 4, headerY + 7);
    lbl('6.  SIGNATURE', sigX + 4, headerY + 7);
    lbl('7.  MEAL CARD NO.', idX + 4, headerY + 7);
    // vertical separators within header band
    line(sigX, headerY, sigX, bandTop);
    line(idX, headerY, idX, bandTop);
    line(endX, headerY, endX, bandTop);
    line(noX, headerY, noX, bandTop);
  }

  // Table grid: 22 rows per block
  const bottom = headerY - ROWS_PER_COL * ROW_H;
  for (const side of ['left', 'right']) {
    const b = BLOCK[side];
    const noX = b.x0, sigX = b.x0 + b.noW, idX = b.x0 + b.noW + b.sigW, endX = b.x0 + b.noW + b.sigW + b.idW;
    // verticals
    [noX, sigX, idX, endX].forEach(x => line(x, headerY, x, bottom));
    // horizontals + row numbers
    for (let r = 0; r <= ROWS_PER_COL; r++) {
      const y = headerY - r * ROW_H;
      line(noX, y, endX, y);
      if (r < ROWS_PER_COL) {
        const n = side === 'left' ? r + 1 : ROWS_PER_COL + r + 1;
        txt(`${n}.`, noX + 3, y - 16, 7);
      }
    }
  }

  // Footer
  txt(`Auto-generated equivalent of DA Form 3032 · Diners this sheet: ${count}` +
      (sheetTot > 1 ? ` · Sheet ${sheetNo} of ${sheetTot}` : ''),
      33, bottom - 14, 7);
  txt('C-AK Meal Accountability · 19th ESC · CJLOTS 2026', 33, bottom - 24, 6.5);

  return { headerY, bottom };
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

  const groups = new Map();
  for (const s of scans) {
    const key = `${s.date}|${s.mealPeriod || 'general'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const arr of groups.values()) arr.sort((a, b) => new Date(a.scannedAt) - new Date(b.scannedAt));

  const out = await PDFDocument.create();
  const F = { font: await out.embedFont(StandardFonts.Helvetica), bold: await out.embedFont(StandardFonts.HelveticaBold) };

  for (const key of [...groups.keys()].sort()) {
    const [date, meal] = key.split('|');
    const list = groups.get(key);
    const ymd = (date || '').replace(/-/g, '');
    const sheetTot = Math.ceil(list.length / ROWS_PER_PAGE);

    for (let p = 0; p < sheetTot; p++) {
      const page = out.addPage([612, 792]);
      const slice = list.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
      const { headerY } = drawSheet(page, F, {
        org: 'C-AK / DOGU BEACH', ymd, meal, count: slice.length,
        sheetNo: p + 1, sheetTot,
      });
      slice.forEach((s, idx) => {
        const onLeft = idx < ROWS_PER_COL;
        const b = BLOCK[onLeft ? 'left' : 'right'];
        const r = onLeft ? idx : idx - ROWS_PER_COL;
        const y = headerY - (r + 1) * ROW_H + 7;
        const sigX = b.x0 + b.noW + 4, idX = b.x0 + b.noW + b.sigW + 4;
        const name = `${s.rank || ''} ${s.lastName || ''}, ${s.firstName || ''}`.trim();
        const nf = fit(F.font, name, b.sigW - 8, 8);
        page.drawText(nf.text, { x: sigX, y, size: nf.size, font: F.font });
        page.drawText(passId(s.soldierId), { x: idX, y, size: 7, font: F.font });
      });
    }
  }

  const bytes = await out.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=DA3032_${from}_to_${to}.pdf`);
  res.send(Buffer.from(bytes));
}
