import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Register.module.css';

const RANKS = [
  'PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM','SMA',
  'WO1','CW2','CW3','CW4','CW5',
  '2LT','1LT','CPT','MAJ','LTC','COL','BG','MG',
  'CIV','CTR','ALLIED'
];

const MEALS = ['Breakfast','Lunch','Dinner'];

export default function Register() {
  const [step, setStep] = useState('form'); // form | success | error
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(15);
  const timerRef = useRef(null);

  const [form, setForm] = useState({
    lastName: '', firstName: '', rank: '', unit: '',
    site: 'C-AK / Dogu Beach',
    startDate: '', endDate: '',
    meals: [], entitlement: '', notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleMeal = (m) => set('meals', form.meals.includes(m)
    ? form.meals.filter(x => x !== m)
    : [...form.meals, m]);

  // Auto-reset after success
  useEffect(() => {
    if (step === 'success') {
      setCountdown(15);
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { reset(); return 15; }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step]);

  const reset = () => {
    clearInterval(timerRef.current);
    setStep('form');
    setResult(null);
    setError('');
    setForm({
      lastName: '', firstName: '', rank: '', unit: '',
      site: 'C-AK / Dogu Beach', startDate: '', endDate: '',
      meals: [], entitlement: '', notes: '',
    });
  };

  const submit = async () => {
    if (!form.lastName || !form.firstName || !form.rank || !form.unit || !form.entitlement) {
      setError('Please complete all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setResult(data);
      setStep('success');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>C-AK Meal Pass — Register</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        {/* Header */}
        <header className={styles.hdr}>
          <div className={styles.hdrLeft}>
            <span className={styles.hdrTag}>19th ESC</span>
            <span className={styles.hdrSep}>·</span>
            <span className={styles.hdrTitle}>C-AK Meal Pass Registration</span>
          </div>
          <div className={styles.hdrRight}>
            <span className={styles.hdrSite}>C-AK / DOGU BEACH</span>
            <Clock />
          </div>
        </header>

        {step === 'form' && (
          <div className={styles.body}>
            <div className={styles.hero}>
              <div className={styles.eyebrow}>Step up to register</div>
              <h1 className={styles.h1}>Request a<br /><em>Meal Pass</em></h1>
              <p className={styles.lead}>Complete the form below. Your request will be reviewed by an approver before your QR pass is issued.</p>
            </div>

            <div className={styles.form}>
              {error && <div className={styles.errBox}>{error}</div>}

              <div className={styles.grid2}>
                <div className={styles.fg}>
                  <label>Last Name *</label>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value.toUpperCase())} placeholder="SMITH" autoComplete="off" />
                </div>
                <div className={styles.fg}>
                  <label>First Name *</label>
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value.toUpperCase())} placeholder="JOHN" autoComplete="off" />
                </div>
                <div className={styles.fg}>
                  <label>Rank *</label>
                  <select value={form.rank} onChange={e => set('rank', e.target.value)}>
                    <option value="">-- Select --</option>
                    {RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className={styles.fg}>
                  <label>Unit *</label>
                  <input value={form.unit} onChange={e => set('unit', e.target.value.toUpperCase())} placeholder="e.g. 2-4 INF" autoComplete="off" />
                </div>
                <div className={styles.fg}>
                  <label>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                </div>
                <div className={styles.fg}>
                  <label>End Date</label>
                  <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
                </div>
              </div>

              <div className={styles.fg} style={{ marginBottom: 14 }}>
                <label>Meal Periods</label>
                <div className={styles.checkRow}>
                  {MEALS.map(m => (
                    <label key={m} className={styles.checkItem}>
                      <input type="checkbox" checked={form.meals.includes(m)} onChange={() => toggleMeal(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.fg} style={{ marginBottom: 14 }}>
                <label>Meal Entitlement *</label>
                <select value={form.entitlement} onChange={e => set('entitlement', e.target.value)}>
                  <option value="">-- Select --</option>
                  <option value="meal_card">Meal Card Holder</option>
                  <option value="travel_order">Approved Travel Order — Meals Furnished at No Cost</option>
                  <option value="bas">I Receive BAS</option>
                </select>
              </div>

              <div className={styles.fg} style={{ marginBottom: 28 }}>
                <label>Notes / Justification (Optional)</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="TDY, field exercise support, attached unit..." />
              </div>

              <button className="btn btn-p btn-lg btn-block" onClick={submit} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Request →'}
              </button>

              <p className={styles.disclaimer}>
                Do not include SSN, DoD ID, or medical information. Submission creates a pending request — a Food Service NCO or designated approver must authorize before a QR pass is issued.
              </p>
            </div>
          </div>
        )}

        {step === 'success' && result && (
          <div className={styles.successPage}>
            <div className={styles.successBox}>
              <div className={styles.successCheck}>✓</div>
              <h2 className={styles.successH2}>Request Submitted</h2>
              <p className={styles.successLead}>
                Your request is <strong>pending approval</strong>. Once approved, return here or check with your Food Service NCO to receive your QR pass.
              </p>
              <div className={styles.successName}>
                {form.rank} {form.lastName}, {form.firstName}
              </div>
              <div className={styles.successUnit}>{form.unit}</div>

              <div className={styles.qrWrap}>
                <img src={result.qrCode} alt="QR Pass" className={styles.qrImg} />
                <p className={styles.qrNote}>Screenshot this QR code — it will be activated upon approval</p>
              </div>

              <div className={styles.countdownRow}>
                <div className={styles.countdownBar} style={{ width: `${(countdown / 15) * 100}%` }} />
              </div>
              <p className={styles.countdownText}>Returning to start in {countdown}s</p>

              <button className="btn btn-g btn-block" onClick={reset} style={{ marginTop: 16 }}>
                Register Another Soldier
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={styles.clock}>{time}</span>;
}
