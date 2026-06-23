import Head from 'next/head';
import { useRouter } from 'next/router';
import Shell from '../components/Shell';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>C-AK Meal Pass — 19th ESC</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Shell active="register">
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <img src="/container.png" alt="Containerized Autonomous Kitchen" className={styles.heroImg} />
          <div className={styles.heroShade} />
          <div className={styles.heroInner}>
            <div className={styles.heroEye}>
              <span className="eyebrow">19th ESC · Autonomous Kitchen Program · CJLOTS 2026</span>
            </div>
            <h1 className={styles.h1}>
              C-AK<br /><span className={styles.dim}>Meal</span><br />Pass
            </h1>
            <p className={styles.lead}>
              Request a QR meal pass for the Containerized Autonomous Kitchen at
              Dogu Beach, Pohang. Passes are issued after your unit S1 or Food
              Service NCO approval.
            </p>
            <div className={styles.heroBtns}>
              <button className="btn btn-p btn-lg" onClick={() => router.push('/register')}>Request Pass →</button>
              <button className="btn btn-g btn-lg" onClick={() => router.push('/scan')}>Scan Pass</button>
            </div>
            <div className={styles.scrollHint}>↓ Approvers — open the Dashboard</div>
          </div>
        </section>

        {/* Cards */}
        <section className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardImgWrap}>
              <img src="/container.png" alt="Containerized Autonomous Kitchen" className={styles.cardImg} />
            </div>
            <div className={styles.cardOverlay}>
              <div className={styles.cardKick}>System</div>
              <div className={styles.cardTitle}>Containerized Autonomous Kitchen</div>
              <div className={styles.cardDesc}>Dual-line robotic galley — sustained autonomous meals at the point of need.</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardImgWrap} style={{ background: 'radial-gradient(circle at 50% 40%, #14110c, #050505 70%)' }} />
            <div className={styles.cardOverlay}>
              <div className={styles.cardKick}>Platform</div>
              <div className={styles.cardTitle}>Robotic Kitchen Platform</div>
              <div className={styles.cardDesc}>~250 PAX/day throughput with QR-verified, unit-accountable meal logging.</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className={styles.cta}>
          <div className={styles.ctaH}>Three taps to a meal pass</div>
          <div className={styles.ctaSub}>Register → unit S1 approves → scan at the line.</div>
          <div className={styles.heroBtns} style={{ justifyContent: 'center' }}>
            <button className="btn btn-p btn-lg" onClick={() => router.push('/register')}>Request Pass →</button>
            <button className="btn btn-g btn-lg" onClick={() => router.push('/admin')}>Admin Dashboard</button>
          </div>
        </section>

        <footer className={styles.foot}>19th ESC · CJLOTS 2026 · Dogu Beach, Pohang · For official use during exercise</footer>
      </Shell>
    </>
  );
}
