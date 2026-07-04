import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Shell from '../components/Shell';
import Hero from '../components/Hero';
import KioskGuard from '../components/KioskGuard';
import styles from '../styles/Scanner.module.css';

const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner'];

export default function Scanner() {
  const router = useRouter();
  const kiosk = 'kiosk' in router.query;
  const [mealPeriod, setMealPeriod] = useState('');
  const [scanState, setScanState] = useState('idle'); // idle | scanning | hardwareReady | processing | success | error | duplicate | notapproved
  const [mode, setMode] = useState('camera'); // camera | hardware
  const [result, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [captured, setCaptured] = useState('');
  const [registerQr, setRegisterQr] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const resetTimer = useRef(null);
  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);
  const idleRef = useRef(null);
  const hwInputRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      animRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setErrorMsg('Camera access denied. Please allow camera permissions.');
      setScanState('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  const tick = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Dynamically import jsQR to avoid SSR issues
    const jsQR = (await import('jsqr')).default;
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      stopCamera();
      await processScan(code.data);
      return;
    }
    animRef.current = requestAnimationFrame(tick);
  };

  const processScan = async (qrData) => {
    setScanState('processing');
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData, mealPeriod }),
      });
      const data = await res.json();
      if (res.status === 409) { setScanState('duplicate'); return; }
      if (res.status === 403) { setScanState('notapproved'); setErrorMsg(data.error); return; }
      if (!res.ok) throw new Error(data.error);
      setScanResult(data.soldier);
      setScanState('success');
    } catch (e) {
      setErrorMsg(e.message);
      setScanState('error');
    }
    // Auto-reset (faster in hardware mode to keep a chow line moving)
    resetTimer.current = setTimeout(reset, mode === 'hardware' ? 2500 : 5000);
  };

  const reset = () => {
    clearTimeout(resetTimer.current);
    setScanResult(null);
    setErrorMsg('');
    if (mode === 'hardware') {
      // Return to the ready screen so handheld scanning continues
      setScanState('hardwareReady');
    } else {
      // Reopen the camera automatically so the next soldier can scan
      // without anyone touching the tablet
      setScanState('scanning');
      startCamera();
    }
  };

  const fullReset = () => {
    clearTimeout(resetTimer.current);
    setMode('camera');
    setScanResult(null);
    setErrorMsg('');
    setScanState('idle');
  };

  const beginScan = () => {
    if (!mealPeriod) return;
    setMode('camera');
    setScanState('scanning');
    startCamera();
  };

  const beginHardware = () => {
    if (!mealPeriod) return;
    setMode('hardware');
    bufferRef.current = '';
    setCaptured('');
    setScanState('hardwareReady');
  };

  // Handheld (keyboard-wedge) capture. On Android, hardware key events only
  // reach a *focused input*, so we keep a hidden field focused and read from
  // it. Many scanners send no Enter suffix, so we also auto-submit on idle.
  const submitHw = () => {
    clearTimeout(idleRef.current);
    const el = hwInputRef.current;
    const data = (el?.value || '').trim();
    if (el) el.value = '';
    setCaptured('');
    if (data) processScan(data);
  };

  const onHwChange = (e) => {
    setCaptured(e.target.value);
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(submitHw, 200);
  };

  const onHwKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); submitHw(); }
  };

  // Keep the hidden capture field focused while in handheld-ready state
  useEffect(() => {
    if (scanState !== 'hardwareReady') return;
    const t = setTimeout(() => hwInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [scanState]);

  useEffect(() => () => { stopCamera(); clearTimeout(resetTimer.current); }, []);

  // Generate a QR to the public register page so soldiers without a pass
  // yet can sign up on their own phone right from the kiosk screen
  useEffect(() => {
    (async () => {
      const QRCode = (await import('qrcode')).default;
      const url = `${window.location.origin}/register`;
      const data = await QRCode.toDataURL(url, { width: 240, margin: 1 });
      setRegisterQr(data);
    })();
  }, []);

  return (
    <>
      <Head>
        <title>C-AK Meal Pass — Scan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {kiosk && <KioskGuard />}
      <Shell active="scanner" kiosk={kiosk}>
        {(scanState === 'idle' || scanState === 'hardwareReady') && (
          <Hero
            short
            eyebrow="19th ESC · Containerized Autonomous Kitchen"
            title="Meal Scanner"
            lead="Verify QR meal passes at the line. Camera or handheld scanner — each scan logs automatically."
          />
        )}
        <div className={styles.body}>

          {scanState === 'idle' && (
            <div className={styles.idleBox}>
              <div className={styles.scanIcon}>⬡</div>
              <h1 className={styles.h1}>Scan Your Meal Pass Here</h1>
              <div className={styles.mealBtns}>
                {MEAL_PERIODS.map(m => (
                  <button
                    key={m}
                    className={`${styles.mealBtn} ${mealPeriod === m ? styles.mealBtnActive : ''}`}
                    onClick={() => setMealPeriod(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                className={`btn btn-p btn-lg ${styles.scanStartBtn}`}
                onClick={beginScan}
                disabled={!mealPeriod}
              >
                📷 Camera Scan →
              </button>
              <button
                className={`btn btn-g btn-lg ${styles.scanStartBtn}`}
                onClick={beginHardware}
                disabled={!mealPeriod}
              >
                ⌨ Handheld Scanner →
              </button>
              <p className={styles.hint}>Pick a meal period, then choose camera or a plugged-in handheld scanner</p>

              <div className={styles.altDivider}><span>Don&apos;t have a pass yet?</span></div>

              <div className={styles.noPassBox}>
                {registerQr && <img src={registerQr} alt="Scan to register" className={styles.registerQr} />}
                <p className={styles.noPassText}>
                  Scan this code with <b>your own phone</b> to request a meal pass.
                  Your unit S1 or Food Service NCO must approve it before it works here —
                  until then, tell your Food Service NCO so your meal can be logged manually.
                </p>
              </div>
            </div>
          )}

          {scanState === 'hardwareReady' && (
            <div className={styles.idleBox} onClick={() => hwInputRef.current?.focus()}>
              {/* Hidden field that actually receives the scanner keystrokes */}
              <input
                ref={hwInputRef}
                onChange={onHwChange}
                onKeyDown={onHwKey}
                onBlur={() => setTimeout(() => { if (scanState === 'hardwareReady') hwInputRef.current?.focus(); }, 80)}
                inputMode="none"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                aria-hidden
                style={{ position: 'absolute', opacity: 0, height: 1, width: 1, left: -9999 }}
              />
              <div className={styles.mealBadge}>{mealPeriod}</div>
              <div className={styles.scanIcon}>⌨</div>
              <h1 className={styles.h1}>Ready — Scan Pass</h1>
              <p className={styles.hint}>Scan a soldier&apos;s QR pass with the handheld reader. Each scan logs automatically.</p>
              <div className={styles.captured}>
                {captured ? `▣ receiving… ${captured.length} chars` : '○ waiting for scanner…'}
              </div>
              <button className="btn btn-g" onClick={fullReset} style={{ marginTop: 24 }}>Change Meal / Cancel</button>
            </div>
          )}

          {scanState === 'scanning' && (
            <div className={styles.cameraBox}>
              <div className={styles.mealBadge}>{mealPeriod}</div>
              <div className={styles.viewfinder}>
                <video ref={videoRef} className={styles.video} playsInline muted />
                <canvas ref={canvasRef} className={styles.canvas} />
                <div className={styles.scanLine} />
                <div className={styles.corner} style={{ top: 20, left: 20, borderTop: '3px solid #fff', borderLeft: '3px solid #fff' }} />
                <div className={styles.corner} style={{ top: 20, right: 20, borderTop: '3px solid #fff', borderRight: '3px solid #fff' }} />
                <div className={styles.corner} style={{ bottom: 20, left: 20, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff' }} />
                <div className={styles.corner} style={{ bottom: 20, right: 20, borderBottom: '3px solid #fff', borderRight: '3px solid #fff' }} />
              </div>
              <p className={styles.scanHint}>Hold QR code steady in frame</p>
              <button className="btn btn-g" onClick={() => { stopCamera(); fullReset(); }}>Cancel</button>
            </div>
          )}

          {scanState === 'processing' && (
            <div className={styles.resultBox}>
              <div className={styles.spinner} />
              <p>Verifying pass…</p>
            </div>
          )}

          {scanState === 'success' && result && (
            <div className={styles.resultBox}>
              <div className={`${styles.resultIcon} ${styles.ok}`}>✓</div>
              <h2 className={styles.resultName}>{result.rank} {result.lastName}</h2>
              <p className={styles.resultUnit}>{result.firstName} · {result.unit}</p>
              <div className={styles.resultMeal}>{mealPeriod} — Meal Logged</div>
              <div className={styles.resultCount}>Total meals served: {result.mealsServed}</div>
              <div className={styles.autoReset}>Resetting in 5s…</div>
            </div>
          )}

          {scanState === 'duplicate' && (
            <div className={styles.resultBox}>
              <div className={`${styles.resultIcon} ${styles.warn}`}>⚠</div>
              <h2 className={styles.resultName}>Already Scanned</h2>
              <p className={styles.resultUnit}>This pass was already used for {mealPeriod} today.</p>
              <button className="btn btn-g" onClick={reset} style={{ marginTop: 24 }}>Try Again</button>
            </div>
          )}

          {scanState === 'notapproved' && (
            <div className={styles.resultBox}>
              <div className={`${styles.resultIcon} ${styles.err}`}>✕</div>
              <h2 className={styles.resultName}>Pass Not Approved</h2>
              <p className={styles.resultUnit}>This pass is still pending approval. See your Food Service NCO.</p>
              <button className="btn btn-g" onClick={reset} style={{ marginTop: 24 }}>Try Again</button>
            </div>
          )}

          {scanState === 'error' && (
            <div className={styles.resultBox}>
              <div className={`${styles.resultIcon} ${styles.err}`}>✕</div>
              <h2 className={styles.resultName}>Scan Error</h2>
              <p className={styles.resultUnit}>{errorMsg}</p>
              <button className="btn btn-g" onClick={reset} style={{ marginTop: 24 }}>Try Again</button>
            </div>
          )}

        </div>
      </Shell>
    </>
  );
}
