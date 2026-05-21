import './globals.css';
import { Providers } from '../components/providers';

export const metadata = {
  title: 'XAU Tracker',
  description: 'Gold price, auth, and market news',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
