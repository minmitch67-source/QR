import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Scanner.module.css';

const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner'];

export default function Scanner() {
  const [mealPeriod, setMealPeriod] = useState('');
  const [scanState, setScanState] = useState('idle'); // idle | scanning | hardwareReady | processing | success | error | duplicate | notapproved
  const [mode, setMode] = useState('camera'); // camera | hardware
  const [result, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const resetTimer = useRef(null);
  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);

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
    // In hardware mode, return to the ready screen so scanning continues
    setScanState(mode === 'hardware' ? 'hardwareReady' : 'idle');
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
    setScanState('hardwareReady');
  };

  // Keyboard-wedge listener for external USB/Bluetooth QR scanners.
  // These devices "type" the decoded string fast and send Enter.
  useEffect(() => {
    if (scanState !== 'hardwareReady') return;
    const onKey = (e) => {
      const now = Date.now();
      // Clear stale partial input if there was a long pause before this key
      if (now - lastKeyRef.current > 500) bufferRef.current = '';
      lastKeyRef.current = now;
      if (e.key === 'Enter') {
        const data = bufferRef.current.trim();
        bufferRef.current = '';
        if (data) processScan(data);
        e.preventDefault();
        return;
      }
      if (e.key.length === 1) bufferRef.current += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scanState, mealPeriod, mode]);

  useEffect(() => () => { stopCamera(); clearTimeout(resetTimer.current); }, []);

  return (
    <>
      <Head>
        <title>C-AK Meal Pass — Scan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <header className={styles.hdr}>
          <span className={styles.hdrTitle}>C-AK / Meal Scanner</span>
          <span className={styles.hdrSite}>DOGU BEACH · 19th ESC</span>
        </header>

        <div className={styles.body}>

          {scanState === 'idle' && (
            <div className={styles.idleBox}>
              <div className={styles.scanIcon}>⬡</div>
              <h1 className={styles.h1}>Select Meal Period</h1>
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
            </div>
          )}

          {scanState === 'hardwareReady' && (
            <div className={styles.idleBox}>
              <div className={styles.mealBadge}>{mealPeriod}</div>
              <div className={styles.scanIcon}>⌨</div>
              <h1 className={styles.h1}>Ready — Scan Pass</h1>
              <p className={styles.hint}>Pull the trigger on the handheld scanner to read a soldier&apos;s QR pass. Each scan logs automatically.</p>
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
              <button className="btn btn-g" onClick={() => { stopCamera(); reset(); }}>Cancel</button>
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
      </div>
    </>
  );
}
