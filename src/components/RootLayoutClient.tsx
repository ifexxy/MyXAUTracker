'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { GoldPriceProvider } from '@/contexts/GoldPriceContext';
import Topbar from '@/components/Topbar';
import Drawer from '@/components/Drawer';
import Toast from '@/components/Toast';

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
  }, [drawerOpen]);

  return (
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
  );
}
