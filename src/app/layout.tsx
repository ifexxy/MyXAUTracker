'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { GoldPriceProvider } from '@/contexts/GoldPriceContext';
import Topbar from '@/components/Topbar';
import Drawer from '@/components/Drawer';
import Toast from '@/components/Toast';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
  }, [drawerOpen]);

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-1T072J6769" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('xau-theme')||'light';document.documentElement.setAttribute('data-theme',t);})()` }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <GoldPriceProvider>
              <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
              <div id="app-shell">
                <Topbar onMenuClick={() => setDrawerOpen(true)} />
                <div id="content">{children}</div>
              </div>
              <Toast />
            </GoldPriceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
