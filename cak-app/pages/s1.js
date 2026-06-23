import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function S1Page() {
  const router = useRouter();
  const { u, t } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState({});

  const call = useCallback(async (action, id) => {
    if (!u || !t) return;
    const res = await fetch('/api/s1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ u, t, action, id }),
    });
    if (res.status === 401) { setErr('This approval link is invalid or expired. Ask for a fresh link.'); setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [u, t]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!u || !t) { setErr('Missing link parameters.'); setLoading(false); return; }
    call('list');
    const iv = setInterval(() => call('list'), 30000);
    return () => clearInterval(iv);
  }, [router.isReady, u, t, call]);

  const act = async (id, action) => {
    setBusy(b => ({ ...b, [id]: true }));
    await call(action, id);
    setBusy(b => ({ ...b, [id]: false }));
  };

  const approveAll = async () => {
    if (!data?.pending?.length) return;
    if (!confirm(`Approve ALL ${data.pending.length} pending soldier(s) for ${data.unit}?`)) return;
    setLoading(true);
    await call('approveAll');
  };

  return (
    <>
      <Head><title>S1 Approvals — {u || ''}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={S.page}>
        <header style={S.hdr}>
          <div>
            <div style={S.eyebrow}>19th ESC · C-AK Meal Pass</div>
            <div style={S.unit}>{data?.unit || u || '—'}</div>
            <div style={S.role}>S1 Approval Queue</div>
          </div>
          <button style={S.refresh} onClick={() => call('list')}>↻</button>
        </header>

        {err && <div style={S.err}>{err}</div>}

        {!err && (
          <div style={S.body}>
            <div style={S.statRow}>
              <Stat n={data?.pending?.length ?? '—'} label="Pending" color="#fa0" />
              <Stat n={data?.approvedCount ?? '—'} label="Approved" color="#2d9" />
            </div>

            {data?.pending?.length > 0 && (
              <button style={S.approveAll} onClick={approveAll} disabled={loading}>
                ✓ Approve All {data.pending.length} Pending
              </button>
            )}

            {loading && !data && <div style={S.empty}>Loading…</div>}
            {data && !data.pending.length && <div style={S.empty}>No pending requests for this unit. 🎉</div>}

            {data?.pending?.map(s => (
              <div key={s.id} style={{ ...S.card, opacity: busy[s.id] ? 0.5 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.name}>{s.rank} {s.lastName}, {s.firstName}</div>
                  <div style={S.meta}>{s.unit} · {s.component} · {String(s.entitlement || '').replace(/_/g, ' ')}</div>
                  <div style={S.dates}>{s.startDate || '—'} → {s.endDate || '—'}{s.notes ? ` · ${s.notes}` : ''}</div>
                </div>
                <div style={S.btns}>
                  <button style={S.approve} onClick={() => act(s.id, 'approve')} disabled={busy[s.id]}>Approve</button>
                  <button style={S.deny} onClick={() => act(s.id, 'deny')} disabled={busy[s.id]}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ n, label, color }) {
  return (
    <div style={S.stat}>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{n}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' },
  hdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid #1a1a1a' },
  eyebrow: { fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#888', fontFamily: 'Courier New, monospace' },
  unit: { fontSize: 26, fontWeight: 900, marginTop: 6, letterSpacing: '-.02em' },
  role: { fontSize: 11, color: '#888', marginTop: 2 },
  refresh: { background: '#111', border: '1px solid #2a2a2a', color: '#fff', width: 44, height: 44, borderRadius: 10, fontSize: 18, cursor: 'pointer' },
  body: { padding: 20, maxWidth: 640, margin: '0 auto' },
  statRow: { display: 'flex', gap: 12, marginBottom: 16 },
  stat: { flex: 1, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 0', textAlign: 'center' },
  statLabel: { fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#888', marginTop: 6, fontFamily: 'Courier New, monospace' },
  approveAll: { width: '100%', padding: 16, marginBottom: 20, background: '#2d9', border: 'none', borderRadius: 12, color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
  card: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: '1px solid #1a1a1a', flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: 700 },
  meta: { fontSize: 11, color: '#888', marginTop: 3 },
  dates: { fontSize: 10, color: '#555', marginTop: 3, fontFamily: 'Courier New, monospace' },
  btns: { display: 'flex', gap: 8 },
  approve: { padding: '12px 18px', background: '#fff', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  deny: { padding: '12px 18px', background: 'transparent', color: '#e53', border: '1px solid #e53', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  empty: { padding: '48px 0', textAlign: 'center', color: '#555', fontSize: 13 },
  err: { margin: 20, padding: 16, background: '#1a0000', border: '1px solid #e53', color: '#e53', borderRadius: 10, fontSize: 13 },
};
