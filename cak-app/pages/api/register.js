import db from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { lastName, firstName, rank, unit, component, site, startDate, endDate, meals, entitlement, notes } = req.body;

  if (!lastName || !firstName || !rank || !unit || !component || !entitlement) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const soldier = {
    id, lastName, firstName, rank, unit, component,
    site: site || 'C-AK / Recon Base',
    startDate, endDate,
    meals: JSON.stringify(meals || []),
    entitlement, notes: notes || '',
    status: 'pending',
    createdAt,
    mealsServed: '0',
  };

  // Generate QR code data URI. Encode only the bare id — every other field
  // (rank/name/unit) is looked up server-side from `soldier:${id}` on scan,
  // so it doesn't need to ride in the QR itself. A ~36-char UUID needs a much
  // lower QR version (fewer/larger modules) than the old JSON blob, which
  // matters a lot when a fixed-mount imager is reading it off a glossy phone
  // screen instead of print. It also has no JSON punctuation (`{`, `"`, `:`)
  // for a keyboard-wedge scanner to garble under a mismatched keyboard layout
  // — just hex digits and hyphens, the same charset parsePassId's regex
  // fallback already expects.
  const qrData = id;
  // margin: 4 is the QR spec's minimum quiet zone — undersizing it (e.g. margin: 1)
  // reads fine with a phone camera but is unreliable on fixed-mount imagers,
  // especially scanning off a glossy screen instead of print.
  const qrCode = await QRCode.toDataURL(qrData, { width: 320, margin: 4, errorCorrectionLevel: 'M' });

  soldier.qrCode = qrCode;

  await db.hset(`soldier:${id}`, soldier);
  await db.sadd('pending', id);
  await db.sadd('all', id);

  res.status(200).json({ id, qrCode });
}
