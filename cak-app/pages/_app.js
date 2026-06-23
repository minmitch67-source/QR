import '../styles/globals.css';
import { Barlow } from 'next/font/google';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-barlow',
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <div className={barlow.variable}>
      <Component {...pageProps} />
    </div>
  );
}
