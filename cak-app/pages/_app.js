import '../styles/globals.css';
import { Archivo } from 'next/font/google';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <div className={archivo.variable}>
      <Component {...pageProps} />
    </div>
  );
}
