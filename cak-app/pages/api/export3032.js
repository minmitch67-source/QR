import db from '../../lib/db';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import templateB64 from '../../lib/da3032template';

// --- DA Form 3032 cell geometry (PDF points, origin bottom-left) ---
const ROWS_PER_PAGE = 44;
const ROW_Y = [];
for (let i = 0; i < 22; i++) ROW_Y.push(559 - i * 24); // rows 1..22 (left), 23..44 (right)

const COL = {
  left:  { sig: 106, idc: 231, sigW: 116, idW: 64 },
  right: { sig: 380, idc: 503, sigW: 116, idW: 70 },
};
const MEAL_BOX = { Breakfast: 669, Lunch: 645, Dinner: 621 };

const passId = (soldierId) =>
  String(soldierId || '').replace(/^demo-/, '').replace(/-/g, '').slice(0, 12).toUpperCase();

// Shrink text to fit a column width (min size 6)
function fit(font, text, maxW, size) {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  if (font.widthOfTextAtSize(text, s) > maxW) {
    while (text.length > 4 && font.widthOfTextAtSize(text + '…', s) > maxW) text = text.slice(0, -1);
    text += '…';
  }
  return { text, size: s };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { pin, dateFrom, dateTo } = req.body;
  if (pin !== (process.env.ADMIN_PIN || '3032')) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const to = dateTo || today;

  // Collect scans across the date range
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

  // Group by date + meal, ordered like a sign-in sheet (by time)
  const groups = new Map();
  for (const s of scans) {
    const key = `${s.date}|${s.mealPeriod || 'general'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const arr of groups.values()) arr.sort((a, b) => new Date(a.scannedAt) - new Date(b.scannedAt));

  const template = await PDFDocument.load(Buffer.from(templateB64, 'base64'), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  const sortedKeys = [...groups.keys()].sort();
  for (const key of sortedKeys) {
    const [date, meal] = key.split('|');
    const list = groups.get(key);
    const ymd = (date || '').replace(/-/g, '');

    for (let pageStart = 0; pageStart < list.length; pageStart += ROWS_PER_PAGE) {
      const [page] = await out.copyPages(template, [0]);
      out.addPage(page);
      const draw = (t, x, y, f = font, size = 8) => page.drawText(String(t), { x, y, size, font: f });

      // Header
      draw('C-AK / DOGU BEACH  (19TH ESC · CJLOTS 2026)', 52, 699, font, 8);
      draw(ymd, 433, 699, font, 9);
      if (MEAL_BOX[meal]) draw('X', 64, MEAL_BOX[meal], bold, 10);

      // Rows
      const slice = list.slice(pageStart, pageStart + ROWS_PER_PAGE);
      slice.forEach((s, idx) => {
        const onLeft = idx < 22;
        const c = onLeft ? COL.left : COL.right;
        const y = ROW_Y[onLeft ? idx : idx - 22] - 1;
        const name = `${s.rank || ''} ${s.lastName || ''}, ${s.firstName || ''}`.trim();
        const nameFit = fit(font, name, c.sigW, 8);
        draw(nameFit.text, c.sig, y, font, nameFit.size);
        draw(passId(s.soldierId), c.idc, y, font, 7);
      });
    }
  }

  const bytes = await out.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=DA3032_${from}_to_${to}.pdf`);
  res.send(Buffer.from(bytes));
}
