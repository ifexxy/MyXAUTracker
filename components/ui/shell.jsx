'use client';

import Link from 'next/link';
import { useState } from 'react';

const links = [
  ['/', 'Home'], ['/news', 'News'], ['/login', 'Login'], ['/predict', 'Predict'],
  ['/trends', 'Trends'], ['/subscribe', 'Subscribe'], ['/minds', 'Minds'],
  ['/post', 'Post'], ['/about', 'About'], ['/contact', 'Contact'], ['/disclaimer', 'Disclaimer'],
  ['/signup', 'Signup'], ['/admin', 'Admin'], ['/admin/stats', 'Admin Stats'],
];

export function Shell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-[480px] min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-bg px-4 py-3">
        <button onClick={() => setOpen(true)} className="text-xl">☰</button>
        <h1 className="font-bold tracking-wide">XAU Tracker</h1>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">LIVE</span>
      </header>
      {open && <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />}
      {open && (
        <aside className="fixed left-0 top-0 z-30 h-full w-72 overflow-y-auto bg-card p-4">
          <button onClick={() => setOpen(false)} className="mb-3">✕</button>
          <nav className="grid gap-2">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded px-3 py-2 hover:bg-white/10">{label}</Link>
            ))}
          </nav>
        </aside>
      )}
      <main className="p-4">{children}</main>
    </div>
  );
}
