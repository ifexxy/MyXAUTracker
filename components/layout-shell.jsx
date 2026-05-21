'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from 'next-themes';

export function LayoutShell({ children }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <header style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ccc' }}>
        <button onClick={() => setOpen(!open)}>☰</button>
        <h1 style={{ margin: 0, fontSize: 18 }}>XAU Tracker</h1>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ marginLeft: 'auto' }}>
          Toggle Theme
        </button>
      </header>
      <div style={{ display: 'flex' }}>
        {open && (
          <aside style={{ minWidth: 220, borderRight: '1px solid #ccc', padding: 12 }}>
            <nav style={{ display: 'grid', gap: 8 }}>
              <Link href="/">Home</Link>
              <Link href="/news">News</Link>
              <Link href="/login">Login</Link>
            </nav>
          </aside>
        )}
        <main style={{ padding: 16, width: '100%' }}>{children}</main>
      </div>
    </div>
  );
}
