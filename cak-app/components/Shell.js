import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import s from '../styles/Shell.module.css';

const NAV = [
  { section: 'Operations' },
  { id: 'register', label: 'Register', icon: '＋', href: '/register?staff=1' },
  { id: 'dashboard', label: 'Dashboard', icon: '▦', href: '/admin' },
  { id: 'approver', label: 'Approver Queue', icon: '▶', href: '/admin' },
  { section: 'Access' },
  { id: 'qrpasses', label: 'QR Passes', icon: '◆', href: '/register?staff=1' },
  { id: 'scanner', label: 'Scanner', icon: '◎', href: '/scan' },
  { section: 'Data' },
  { id: 'reports', label: 'Reports', icon: '▤', href: '/admin' },
  { section: 'System' },
  { id: 'settings', label: 'Settings', icon: '⚙', href: '/admin' },
];

export default function Shell({ active, actions, children, kiosk }) {
  const router = useRouter();
  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <div className={s.tbLeft}>
          <div className={s.logos}>
            <img src="/usfk.png" alt="USFK" className={s.logo} />
            <img src="/esc19.png" alt="19th ESC" className={s.logo} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={s.tbTitle}>19th ESC // C-AK Meal Accountability</div>
          </div>
        </div>
        <div className={s.tbRight}>
          {actions}
          <span className={s.tbSite}>Site: <b>C-AK / Recon Base</b></span>
          <Clock />
        </div>
      </header>

      <div className={`${s.layout} ${kiosk ? s.layoutKiosk : ''}`}>
        {!kiosk && (
          <nav className={s.sidebar}>
            {NAV.map((n, i) =>
              n.section ? (
                <div key={i} className={s.navSection}>{n.section}</div>
              ) : (
                <button
                  key={i}
                  className={`${s.navItem} ${active === n.id ? s.navActive : ''}`}
                  onClick={() => router.push(n.href)}
                >
                  <span className={s.navDot}>{n.icon}</span> {n.label}
                </button>
              )
            )}
          </nav>
        )}
        <main className={s.main}>{children}</main>
      </div>
    </div>
  );
}

function Clock() {
  const [t, setT] = useState({ time: '', date: '' });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setT({
        time: d.toLocaleTimeString('en-US', { hour12: false }),
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
      });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className={s.clock}>
      <div className={s.clockTime}>{t.time}</div>
      <div className={s.clockDate}>{t.date}</div>
    </div>
  );
}
