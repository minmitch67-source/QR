import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Shell from '../components/Shell';
import Hero from '../components/Hero';
import styles from '../styles/Admin.module.css';

const TABS = ['pending', 'approved', 'denied', 'scans', 'report', 'demo', 'settings'];
const NAV_FOR_TAB = { pending: 'approver', approved: 'qrpasses', denied: 'approver', scans: 'approver', report: 'reports', demo: 'approver', settings: 'settings' };

export default function Admin() {
  const router = useRouter();
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
  const [scanErrors, setScanErrors] = useState(null);
  const [scanErrorsLoading, setScanErrorsLoading] = useState(false);

  function today() { return new Date().toISOString().slice(0, 10); }

  // Deep-link the active tab so sidebar links (Reports, QR Passes, Settings)
  // actually land on the section they claim to, and the URL is shareable
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.tab;
    if (q && TABS.includes(q) && q !== tab) setTab(q);
  }, [router.isReady, router.query.tab]);

  const goToTab = (t) => {
    setTab(t);
    router.push(`/admin?tab=${t}`, undefined, { shallow: true });
  };

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
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, dateFrom, dateTo }),
      });
      if (res.status === 401) { setPinErr('Incorrect PIN'); return; }
      if (!res.ok) { setPinErr('Server error — please try again'); return; }
      const json = await res.json();
      setData(json);
      setStoredPin(pin);
      setAuthed(true);
    } catch {
      setPinErr('Network error — please try again');
    }
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

  const copyLink = async (path) => {
    const url = `${window.location.origin}${path}`;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt('Copy this link:', url); }
    setCopied(path);
    setTimeout(() => setCopied(''), 2000);
  };

  const demo = async (action) => {
    if (action === 'clear' && !confirm('Remove ALL demo data?')) return;
    setActionLoading(l => ({ ...l, demo: true }));
    await fetch('/api/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: storedPin, action }),
    });
    setActionLoading(l => ({ ...l, demo: false }));
    fetchData();
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

  const loadScanErrors = async () => {
    setScanErrorsLoading(true);
    try {
      const res = await fetch(`/api/scan-debug?pin=${encodeURIComponent(storedPin)}`);
      const json = await res.json();
      setScanErrors(json.entries || []);
    } finally {
      setScanErrorsLoading(false);
    }
  };

  const clearScanErrors = async () => {
    await fetch('/api/scan-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: storedPin, action: 'clear' }),
    });
    setScanErrors([]);
  };

  const exportDA3032 = async () => {
    const res = await fetch('/api/export3032', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: storedPin, dateFrom, dateTo }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Could not generate DA 3032');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DA3032_${dateFrom}_to_${dateTo}.pdf`;
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

            <div className={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d} type="button" className={styles.keypadBtn}
                  onClick={() => setPin(p => p + d)}
                >{d}</button>
              ))}
              <button
                type="button" className={styles.keypadBtn}
                onClick={() => setPin(p => p.slice(0, -1))}
              >&larr;</button>
              <button
                key="0" type="button" className={styles.keypadBtn}
                onClick={() => setPin(p => p + '0')}
              >0</button>
              <button
                type="button" className={styles.keypadBtn}
                onClick={() => setPin('')}
              >Clear</button>
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
      <Shell active={NAV_FOR_TAB[tab] || 'approver'} actions={
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
          {TABS.map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => goToTab(t)}>
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
                      {g.label} <span style={{ color: 'var(--gmd)', fontWeight: 600 }}>· {g.count} pending</span>
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
                  <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn btn-p" onClick={exportDA3032}>Export DA Form 3032 (PDF)</button>
                    <button className="btn btn-g" onClick={() => exportCSV('soldiers')}>Export Soldiers CSV</button>
                    <button className="btn btn-g" onClick={() => exportCSV('scans')}>Export Scans CSV</button>
                  </div>
                  <p className={styles.sectionNote} style={{ marginTop: 10 }}>
                    DA 3032 = one Signature Headcount Sheet per date &amp; meal in the range (44 diners/page). Meal Card # column uses the QR pass identifier.
                  </p>
                </>
              )}
            </div>
          )}

          {/* DEMO */}
          {tab === 'demo' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Demo Mode</h2>
                <span className={styles.sectionNote}>For presentations — safe to load &amp; clear</span>
              </div>
              <p style={{ color: 'var(--ghi)', fontSize: 13, lineHeight: 1.7, maxWidth: 560, marginBottom: 20 }}>
                Loads a realistic sample roster (multiple battalions, pending &amp; approved soldiers,
                live scans, and a week of report data) so you can demo the full flow. Everything it
                creates is tagged and removed by <strong>Clear</strong> — your real data is untouched.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-green" onClick={() => demo('seed')} disabled={actionLoading.demo}>
                  {actionLoading.demo ? 'Working…' : 'Load Demo Data'}
                </button>
                <button className="btn btn-red" onClick={() => demo('clear')} disabled={actionLoading.demo}>
                  Clear Demo Data
                </button>
              </div>
              <p style={{ color: 'var(--gmd)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', marginTop: 20 }}>
                Tip: after loading, open the Pending tab to show grouping &amp; S1 links, then Scans and Report.
              </p>
            </div>
          )}

          {/* SETTINGS */}
          {tab === 'settings' && (
            <div>
              <div className={styles.sectionHdr}>
                <h2 className={styles.sectionH2}>Settings</h2>
              </div>

              <div style={{ marginBottom: 28 }}>
                <div className={styles.sectionNote} style={{ marginBottom: 8 }}>Site</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>C-AK / Recon Base</div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <div className={styles.sectionNote} style={{ marginBottom: 8 }}>Admin PIN</div>
                <p style={{ fontSize: 12, color: 'var(--ghi)', lineHeight: 1.7, maxWidth: 520 }}>
                  Set via the <code>ADMIN_PIN</code> environment variable in the Vercel project
                  (Settings → Environment Variables). Defaults to <strong>3032</strong> if unset.
                </p>
              </div>

              <div>
                <div className={styles.sectionNote} style={{ marginBottom: 12 }}>Kiosk Links</div>
                {[
                  { label: 'Register — public sign-up link (share with soldiers)', path: '/register' },
                  { label: 'Register — kiosk mode (no sidebar, PIN-locked exit)', path: '/register?kiosk=1' },
                  { label: 'Scanner — kiosk mode (no sidebar, PIN-locked exit)', path: '/scan?kiosk=1' },
                ].map(l => (
                  <div key={l.path} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid #1a1a1a',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{l.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--gmd)', fontFamily: 'var(--mono)', marginTop: 2 }}>{l.path}</div>
                    </div>
                    <button className="btn btn-g" onClick={() => copyLink(l.path)}>
                      {copied === l.path ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 28 }}>
                <div className={styles.sectionNote} style={{ marginBottom: 8 }}>Recent Scan Errors</div>
                <p style={{ fontSize: 12, color: 'var(--ghi)', lineHeight: 1.7, maxWidth: 560, marginBottom: 12 }}>
                  The last few scans the server couldn&apos;t parse into a pass id — useful for spotting a
                  scanner transmitting the wrong characters (e.g. a keyboard-layout mismatch) without
                  needing a photo of the kiosk screen.
                </p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <button className="btn btn-g" onClick={loadScanErrors} disabled={scanErrorsLoading}>
                    {scanErrorsLoading ? 'Loading…' : 'Load Recent Scan Errors'}
                  </button>
                  {scanErrors?.length > 0 && (
                    <button className="btn btn-g" onClick={clearScanErrors}>Clear</button>
                  )}
                </div>
                {scanErrors && scanErrors.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--gmd)' }}>No parse failures logged.</p>
                )}
                {scanErrors?.map((e, i) => (
                  <div key={i} style={{
                    padding: '10px 0', borderBottom: '1px solid #1a1a1a',
                    fontFamily: 'var(--mono)', fontSize: 12,
                  }}>
                    <div style={{ color: 'var(--gmd)', fontSize: 10, marginBottom: 4 }}>
                      {new Date(e.ts).toLocaleString('en-US', { hour12: false })} · {e.mealPeriod || 'no meal set'} · {(e.qrData || '').length} chars
                    </div>
                    <div style={{ wordBreak: 'break-all', userSelect: 'all' }}>{e.qrData}</div>
                  </div>
                ))}
              </div>
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
      <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gmd)', marginTop: 4, fontFamily:'var(--mono)' }}>{label}</div>
    </div>
  );
}

function SoldierCard({ soldier: s, children, loading }) {
  const registered = s.createdAt ? new Date(s.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : null;
  return (
    <div style={{
      borderBottom: '1px solid #1a1a1a', padding: '16px 0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap', opacity: loading ? .5 : 1,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{s.rank} {s.lastName}, {s.firstName}</div>
        <div style={{ fontSize: 11, color: 'var(--gmd)', marginTop: 2 }}>{s.unit} · {s.component} · {s.entitlement?.replace('_',' ')}</div>
        <div style={{ fontSize: 10, color: 'var(--gmd)', marginTop: 2, fontFamily: 'var(--mono)' }}>
          {s.startDate} → {s.endDate} · Meals served: {s.mealsServed}
        </div>
        {registered && (
          <div style={{ fontSize: 10, color: 'var(--gmd)', marginTop: 2, fontFamily: 'var(--mono)' }}>
            Registered {registered}
          </div>
        )}
        <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
          <span className={`tag tag-${s.status}`}>{s.status}</span>
          {s.demo === '1' && (
            <span className="tag" style={{ background: 'rgba(150,150,255,.14)', color: '#9aa3ff' }}>demo</span>
          )}
        </div>
      </div>
      {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--gmd)', fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '.1em' }}>{text}</div>;
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 132, padding: '0 2px 4px', borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
      {data.map(d => (
        <div key={d.date} style={{ flex: '0 0 auto', width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700 }}>{d.count}</div>
          <div style={{ width: 28, background: '#fff', height: `${(d.count / max) * 88}px`, minHeight: d.count ? 3 : 1, borderRadius: '2px 2px 0 0' }} />
          <div style={{ fontSize: 8, color: 'var(--gmd)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}
