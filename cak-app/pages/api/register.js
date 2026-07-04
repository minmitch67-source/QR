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

  // Generate QR code data URI
  const qrData = JSON.stringify({ id, rank, lastName, firstName, unit });
  const qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 1 });

  soldier.qrCode = qrCode;

  await db.hset(`soldier:${id}`, soldier);
  await db.sadd('pending', id);
  await db.sadd('all', id);

  res.status(200).json({ id, qrCode });
}
