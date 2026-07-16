import { useState, useRef } from 'react';
import { useRouter } from 'next/router';

// Backup kiosk lock: a hidden top-right hotspot. Triple-tap within 1.5s to
// open a PIN prompt; correct admin PIN exits kiosk to the landing page.
export default function KioskGuard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const taps = useRef([]);

  const hit = () => {
    const now = Date.now();
    taps.current = taps.current.filter(t => now - t < 1500);
    taps.current.push(now);
    if (taps.current.length >= 3) { taps.current = []; setOpen(true); }
  };

  const unlock = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.status === 401) { setErr('Incorrect PIN'); setBusy(false); return; }
      router.push('/');
    } catch {
      setErr('Network error'); setBusy(false);
    }
  };

  const close = () => { setOpen(false); setPin(''); setErr(''); };

  return (
    <>
      {/* invisible corner hotspot */}
      <div onClick={hit} aria-hidden style={{ position: 'fixed', top: 0, right: 0, width: 72, height: 72, zIndex: 9998 }} />

      {open && (
        <div style={S.overlay}>
          <div style={S.box}>
            <div style={S.eyebrow}>Kiosk Lock</div>
            <div style={S.title}>Exit Kiosk</div>
            <input
              type="password" inputMode="numeric" pattern="[0-9]*"
              value={pin} autoFocus
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && unlock()}
              placeholder="····"
              style={S.input}
            />
            {err && <div style={S.err}>{err}</div>}
            <div style={S.row}>
              <button className="btn btn-g" onClick={close} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-p" onClick={unlock} disabled={busy} style={{ flex: 1 }}>
                {busy ? '…' : 'Unlock →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 320, textAlign: 'center' },
  eyebrow: { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--gmd)', marginBottom: 10 },
  title: { fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.01em', marginBottom: 22 },
  input: { width: '100%', textAlign: 'center', fontSize: 24, letterSpacing: '.4em', padding: '14px 12px' },
  err: { color: 'var(--red)', fontSize: 12, marginTop: 10 },
  row: { display: 'flex', gap: 10, marginTop: 20 },
};
