'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { GoldPriceProvider } from '@/contexts/GoldPriceContext';
import Topbar from '@/components/Topbar';
import Drawer from '@/components/Drawer';
import DesktopSidebar from '@/components/DesktopSidebar';
import Toast from '@/components/Toast';

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('config', 'G-1T072J6769', { page_path: pathname });
    }
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
  }, [drawerOpen]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <GoldPriceProvider>
          {/* Mobile drawer */}
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

          {/* Desktop persistent sidebar */}
          <DesktopSidebar />

          <div id="app-shell">
            <Topbar onMenuClick={() => setDrawerOpen(true)} />
            <div id="content">{children}</div>
          </div>
          <Toast />
        </GoldPriceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}