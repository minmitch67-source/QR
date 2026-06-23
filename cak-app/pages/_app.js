import '../styles/globals.css';
import localFont from 'next/font/local';

// Real D-DIN PRO — SpaceX's typeface — self-hosted.
const dDin = localFont({
  src: [
    { path: '../fonts/D-DIN-PRO-400-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/D-DIN-PRO-500-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/D-DIN-PRO-600-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/D-DIN-PRO-700-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/D-DIN-PRO-800-ExtraBold.woff2', weight: '800', style: 'normal' },
    { path: '../fonts/D-DIN-PRO-900-Heavy.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-ddin',
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <div className={dDin.variable}>
      <Component {...pageProps} />
    </div>
  );
}
