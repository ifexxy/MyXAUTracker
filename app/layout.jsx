import { Providers } from '../components/providers';
import { LayoutShell } from '../components/layout-shell';

export const metadata = {
  title: 'XAU Tracker',
  description: 'Gold price, auth, and market news',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <LayoutShell>{children}</LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
