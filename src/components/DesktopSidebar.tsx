'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

const NAV_ITEMS = [
  { href: '/',                label: 'Home',        icon: 'fa-house' },
  { href: '/predict',         label: 'XAU Forecast', icon: 'fa-brain' },
  { href: '/predict/bitcoin', label: 'BTC Forecast', icon: 'fa-bitcoin-sign' },
  { href: '/minds',           label: 'Minds',       icon: 'fa-comments' },
];

const BOTTOM_ITEMS = [
  { href: '/subscribe', label: 'Subscribe', icon: 'fa-star' },
  { href: '/about',     label: 'About',     icon: 'fa-circle-info' },
  { href: '/contact',   label: 'Contact',   icon: 'fa-envelope' },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <aside
      id="desktop-sidebar"
      style={{
        display: 'none', // shown via CSS media query
        position: 'fixed',
        top: 0, left: 0,
        width: 240,
        height: '100vh',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        flexDirection: 'column',
        zIndex: 400,
        transition: 'background .22s, border-color .22s',
      }}
    >
      {/* Brand */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--gold-bg)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold)', fontSize: 14, flexShrink: 0,
        }}>
          <i className="fa-solid fa-coins" />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
          XauTracker
        </span>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                background: active ? 'var(--bg-2)' : 'transparent',
                transition: 'background .14s, color .14s',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <i
                className={`fa-solid ${item.icon}`}
                style={{
                  fontSize: 13, width: 18, textAlign: 'center',
                  color: active ? 'var(--gold)' : 'var(--ink-3)',
                }}
              />
              {item.label}
            </Link>
          );
        })}

        <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px' }} />

        {BOTTOM_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                color: active ? 'var(--ink)' : 'var(--ink-3)',
                background: active ? 'var(--bg-2)' : 'transparent',
                transition: 'background .14s, color .14s',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <i
                className={`fa-solid ${item.icon}`}
                style={{ fontSize: 12, width: 18, textAlign: 'center', color: 'var(--ink-4)' }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div style={{ padding: '10px 8px 16px', borderTop: '1px solid var(--border)' }}>
        <div
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--bg-2)', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
            <i
              className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`}
              style={{ fontSize: 13, color: 'var(--ink-3)', width: 18, textAlign: 'center' }}
            />
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </div>
          {/* Toggle knob */}
          <div style={{
            width: 38, height: 22,
            background: isDark ? 'var(--ink)' : 'var(--border)',
            borderRadius: 11, position: 'relative', transition: 'background .2s', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 3, left: 3,
              width: 16, height: 16, borderRadius: '50%',
              background: 'var(--bg)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'transform .2s',
              transform: isDark ? 'translateX(16px)' : 'translateX(0)',
            }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
