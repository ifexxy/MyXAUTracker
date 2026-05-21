import './globals.css';
import { Providers } from '../components/providers';
import { Shell } from '../components/ui/shell';

export const metadata = { title: 'XAU Tracker' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
