// localStorage-backed cache the scanner uses to keep working when the
// network drops: a snapshot of who's approved + who's already eaten today,
// and a queue of scans made offline waiting to sync back to the server.
const ROSTER_KEY = 'cak_scan_roster';
const QUEUE_KEY = 'cak_scan_queue';

export function loadRoster() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(ROSTER_KEY)) || null; } catch { return null; }
}

export function saveRoster(data) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(data)); } catch {}
}

export function loadQueue() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; }
}

export function saveQueue(queue) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}
