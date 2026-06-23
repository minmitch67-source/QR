import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Shell from '../components/Shell';
import Hero from '../components/Hero';
import styles from '../styles/Admin.module.css';

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [tab, setTab] = useState('pending');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [actionLoading, setActionLoading] = useState({});
  const [storedPin, setStoredPin] = useState('');
  const [copied, setCopied] = useState('');

  function today() { return new Date().toISOString().slice(0, 10); }

  const fetchData = useCallback(async (p = storedPin) => {
    if (!p) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p, dateFrom, dateTo }),
      });
      if (res.status === 401) { setAuthed(false); return; }
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }, [storedPin, dateFrom, dateTo]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!authed) return;
    fetchData();
    const t = setInterval(() => fetchData(), 30000);
    return () => clearInterval(t);
  }, [authed, fetchData]);

  const login = async () => {
    setPinErr('');
    const res = await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, dateFrom, dateTo }),
    });
    if (res.status === 401) { setPinErr('Incorrect PIN'); return; }
    const json = await res.json();
    setData(json);
    setStoredPin(pin);
    setAuthed(true);
  };

  const approve = async (id, action) => {
    setActionLoading(l => ({ ...l, [id]: true }));
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: storedPin, id, action }),
    });
    setActionLoading(l => ({ ...l, [id]: false }));
    fetchData();
  };

  const approveAllUnit = async (g) => {
    if (!confirm(`Approve ALL ${g.count} pending soldier(s) in ${g.label}?`)) return;
    const key = `unit:${g.unitKey}`;
    setActionLoading(l => ({ ...l, [key]: true }));
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: storedPin, action: 'approveAllUnit', unit: g.unitKey }),
    });
    setActionLoading(l => ({ ...l, [key]: false }));
    fetchData();
  };

  const copyS1Link = async (g) => {
    const url = `${window.location.origin}/s1?u=${encodeURIComponent(g.unitKey)}&t=${g.token}`;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt('Copy this S1 approval link:', url); }
    setCopied(g.unitKey);
    setTimeout(() => setCopied(''), 2000);
  };

  const exportCSV = async (type) => {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: storedPin, type }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'soldiers' ? `cak_soldiers_${today()}.csv` : `cak_scans_${today()}.csv`;
    a.click();
  };

  if (!authed) {
    return (
      <>
        <Head><title>C-AK Admin</title></Head>
        <div className={styles.loginPage}>
          <div className={styles.loginBox}>
            <div className={styles.loginEye}>19th ESC</div>
            <h1 className={styles.loginH1}>Admin Access</h1>
            <p className={styles.loginSub}>C-AK Meal Accountability System</p>
            <div className={styles.pinWrap}>
              <label>Admin PIN</label>
              <input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pin} onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="····"
                className={styles.pinInput}
              />
              {pinErr && <p className={styles.pinErr}>{pinErr}</p>}
            </div>
            <button className="btn btn-p btn-block btn-lg" onClick={login}>Enter →</button>
          </div>
        </div>
      </>
    );
  }

  const counts = data?.counts || {};

  return (
    <>
      <Head><title>C-AK Admin Dashboard</title></Head>
      <Shell active="dashboard" actions={
        <>
          <button className="btn btn-g" onClick={() => fetchData()}>{loading ? '…' : '↻'} Refresh</button>
          <button className="btn btn-g" onClick={() => setAuthed(false)}>Lock</button>
        </>
      }>
        <Hero
          short
          eyebrow="19th ESC · Meal Accountability · CJLOTS 2026"
          title={<>Admin<br />Dashboard</>}
          lead="Approve requests by unit, monitor live scans, and export accountability reports."
        />

        {/* Stat strip */}
        <div className={styles.statStrip}>
          <Stat label="Pending" val={counts.pending ?? '—'} color="#fa0" />
          <Stat label="Approved" val={counts.approved ?? '—'} color="#2d9" />
          <Stat label="Denied" val={counts.denied ?? '—'} color="#e53" />
          <Stat label="Meals Today" val={counts.mealsToday ?? '—'} color="#fff" />
        </div>

        {/* Tab nav */}
        <nav className={styles.tabs}>
          {['pending','approved','denied','scans','report'].map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
              {t === 'pending' ? `Pending (${counts.pending ?? 0})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>

        <div className={styles.content}>

          {/* PENDING */}
          {tab === 'pending' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Pending Approvals</h2>
                <span className={styles.sectionNote}>Grouped by unit · share a link with each S1</span>
              </div>
              {!data?.pendingByUnit?.length && <Empty text="No pending requests" />}
              {data?.pendingByUnit?.map(g => (
                <div key={g.unitKey} style={{ marginBottom: 28 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap', padding: '10px 0', borderBottom: '2px solid #2a2a2a',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em' }}>
                      {g.label} <span style={{ color: '#888', fontWeight: 600 }}>· {g.count} pending</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-g" onClick={() => copyS1Link(g)}>
                        {copied === g.unitKey ? '✓ Copied' : 'Copy S1 Link'}
                      </button>
                      <button className="btn btn-green" onClick={() => approveAllUnit(g)} disabled={actionLoading[`unit:${g.unitKey}`]}>
                        Approve All ({g.count})
                      </button>
                    </div>
                  </div>
                  {g.soldiers.map(s => (
                    <SoldierCard key={s.id} soldier={s} loading={actionLoading[s.id]}>
                      <button className="btn btn-green" onClick={() => approve(s.id,'approve')} disabled={actionLoading[s.id]}>
                        Approve
                      </button>
                      <button className="btn btn-red" onClick={() => approve(s.id,'deny')} disabled={actionLoading[s.id]}>
                        Deny
                      </button>
                    </SoldierCard>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* APPROVED */}
          {tab === 'approved' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Approved Passes</h2>
                <button className="btn btn-g" onClick={() => exportCSV('soldiers')}>Export CSV</button>
              </div>
              {!data?.approved?.length && <Empty text="No approved soldiers" />}
              {data?.approved?.map(s => <SoldierCard key={s.id} soldier={s} />)}
            </div>
          )}

          {/* DENIED */}
          {tab === 'denied' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Denied Requests</h2>
              </div>
              {!data?.denied?.length && <Empty text="No denied requests" />}
              {data?.denied?.map(s => <SoldierCard key={s.id} soldier={s} />)}
            </div>
          )}

          {/* TODAY'S SCANS */}
          {tab === 'scans' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Today's Scans</h2>
                <button className="btn btn-g" onClick={() => exportCSV('scans')}>Export CSV</button>
              </div>
              {!data?.todayScans?.length && <Empty text="No scans today yet" />}
              <div className={styles.scanTable}>
                {data?.todayScans?.map((s, i) => (
                  <div key={i} className={styles.scanRow}>
                    <span className={styles.scanTime}>{new Date(s.scannedAt).toLocaleTimeString('en-US',{hour12:false})}</span>
                    <span className={styles.scanName}>{s.rank} {s.lastName}, {s.firstName}</span>
                    <span className={styles.scanUnit}>{s.unit}</span>
                    <span className={styles.scanMeal}>{s.mealPeriod}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REPORT */}
          {tab === 'report' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Meal Report</h2>
              </div>
              <div className={styles.dateRow}>
                <div className={styles.fg}>
                  <label>From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className={styles.fg}>
                  <label>To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <button className="btn btn-p" onClick={() => fetchData()}>Run Report</button>
              </div>

              {data?.dailyMeals?.length > 0 && (
                <>
                  <div className={styles.chartWrap}>
                    <BarChart data={data.dailyMeals} />
                  </div>
                  <div className={styles.reportTotal}>
                    Total meals in range: <strong>{data.dailyMeals.reduce((s, d) => s + d.count, 0)}</strong>
                  </div>
                  <div className={styles.reportTable}>
                    {data.dailyMeals.map(d => (
                      <div key={d.date} className={styles.reportRow}>
                        <span className={styles.reportDate}>{d.date}</span>
                        <span className={styles.reportBar}>
                          <span style={{ width: `${Math.min(100, (d.count / 250) * 100)}%` }} className={styles.reportBarFill} />
                        </span>
                        <span className={styles.reportCount}>{d.count}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                    <button className="btn btn-g" onClick={() => exportCSV('soldiers')}>Export Soldiers CSV</button>
                    <button className="btn btn-g" onClick={() => exportCSV('scans')}>Export Scans CSV</button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </Shell>
    </>
  );
}

function Stat({ label, val, color }) {
  return (
    <div style={{ textAlign:'center', padding: '16px 24px', borderRight: '1px solid #1a1a1a' }}>
      <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#888', marginTop: 4, fontFamily:'Courier New,monospace' }}>{label}</div>
    </div>
  );
}

function SoldierCard({ soldier: s, children, loading }) {
  return (
    <div style={{
      borderBottom: '1px solid #1a1a1a', padding: '16px 0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap', opacity: loading ? .5 : 1,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{s.rank} {s.lastName}, {s.firstName}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.unit} · {s.component} · {s.entitlement?.replace('_',' ')}</div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2, fontFamily: 'Courier New,monospace' }}>
          {s.startDate} → {s.endDate} · Meals served: {s.mealsServed}
        </div>
        <div style={{ marginTop: 4 }}>
          <span className={`tag tag-${s.status}`}>{s.status}</span>
        </div>
      </div>
      {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: '48px 0', textAlign: 'center', color: '#444', fontSize: 12, fontFamily: 'Courier New,monospace', letterSpacing: '.1em' }}>{text}</div>;
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '0 0 8px' }}>
      {data.map(d => (
        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#888' }}>{d.count}</div>
          <div style={{ width: '100%', background: '#fff', height: `${(d.count / max) * 80}px`, minHeight: d.count ? 2 : 0 }} />
          <div style={{ fontSize: 8, color: '#555', fontFamily: 'Courier New,monospace', transform: 'rotate(-45deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' }}>
            {d.date.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}
