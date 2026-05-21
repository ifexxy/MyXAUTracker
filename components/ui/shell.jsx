'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  ['/', 'Home'],
  ['/news', 'News'],
  ['/predict', 'Predict'],
  ['/login', 'Login'],
  ['/subscribe', 'Subscribe'],
  ['/trends', 'Trends'],
];

export function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-screen max-w-[480px]" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <button onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xl hover:bg-white/10">☰</button>
        <h1 className="text-lg font-extrabold tracking-wide">XAU <span style={{ color: 'var(--gold)' }}>Tracker</span></h1>
        <span className="rounded-full px-2 py-1 text-xs" style={{ color: 'var(--green)', background: 'var(--green-dim)' }}>● LIVE</span>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-full w-[78%] max-w-[320px] transform p-4 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
        <button onClick={() => setOpen(false)} className="mb-3 rounded-md px-2 py-1 text-2xl hover:bg-white/10">✕</button>
        <nav className="grid gap-2">
          {links.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded px-3 py-2" style={active ? { background: 'var(--gold-glow)', color: 'var(--gold)' } : { color: 'var(--txt-1)' }}>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="space-y-3 p-4">{children}</main>
    </div>
  );
}
