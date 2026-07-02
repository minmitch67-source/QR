import { useState, useEffect } from 'react';

const DISMISS_KEY = 'cak-install-dismissed';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [platform, setPlatform] = useState(null); // 'android' | 'ios' | null
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setPlatform('android');
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if (isIos) {
      setPlatform('ios');
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!visible) return null;

  return (
    <div style={S.bar}>
      <div style={S.text}>
        {platform === 'ios'
          ? <>Add this to your Home Screen: tap <b>Share</b> ⬆ then <b>Add to Home Screen</b> — for one-tap access with no browser bar.</>
          : <>Install this as an app on your phone for one-tap access with no browser bar.</>}
      </div>
      <div style={S.actions}>
        {platform === 'android' && (
          <button className="btn btn-p" onClick={install} style={S.btn}>Install</button>
        )}
        <button style={S.close} onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}

const S = {
  bar: {
    position: 'sticky', top: 0, zIndex: 60,
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 16px',
    background: '#fff', color: '#000',
    fontSize: 12, lineHeight: 1.5,
  },
  text: { flex: 1 },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  btn: { padding: '8px 16px', fontSize: 11 },
  close: {
    background: 'none', border: 'none', color: '#000', opacity: .6,
    fontSize: 14, cursor: 'pointer', padding: 4,
  },
};
