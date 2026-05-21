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
];

export function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-bg text-txt">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-bg px-4 py-3">
        <button onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xl hover:bg-white/10">☰</button>
        <h1 className="font-bold tracking-wide">XAU Tracker</h1>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">LIVE</span>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />}
      <aside className={`fixed left-0 top-0 z-50 h-full w-[78%] max-w-[320px] transform bg-card p-4 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setOpen(false)} className="mb-3 rounded-md px-2 py-1 text-2xl hover:bg-white/10">✕</button>
        <nav className="grid gap-2">
          {links.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`rounded px-3 py-2 ${active ? 'bg-gold/20 text-gold' : 'hover:bg-white/10'}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="p-4">{children}</main>
    </div>
  );
}
