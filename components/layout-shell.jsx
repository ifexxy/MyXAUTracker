'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from 'next-themes';

export function LayoutShell({ children }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div id="app-shell">
      <header id="topbar">
        <div className="topbar-left">
          <button className="menu-btn" onClick={() => setOpen(true)}>☰</button>
          <div className="wordmark">XAU Tracker</div>
        </div>
        <div className="topbar-right">
          <div className="live-chip">● LIVE</div>
          <button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>🌓</button>
        </div>
      </header>

      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}
      {open && (
        <aside className="drawer">
          <button className="drawer-close" onClick={() => setOpen(false)}>✕</button>
          <nav>
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
            <Link href="/news" onClick={() => setOpen(false)}>News</Link>
            <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
          </nav>
        </aside>
      )}

      <main>{children}</main>
    </div>
  );
}
