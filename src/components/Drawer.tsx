'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/minds', label: 'Minds' },
  { href: '/predict', label: 'XAU Forecast' },
  { href: '/predict/bitcion', label: 'BTC Forecast' },
];

const BOTTOM_NAV = [
  { href: '/about', label: 'About' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/contact', label: 'Contact' },
];

export default function Drawer({ open, onClose }: DrawerProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      <div
        className="overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.42)',
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.22s',
        }}
      />
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 268,
          height: '100%',
          background: 'var(--bg)',
          zIndex: 201,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.22s',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between p-[16px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>XauTracker</span>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px]"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13 }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-[11px] px-[12px] py-[11px] rounded-[7px] text-[14px] font-semibold no-underline"
                style={{
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  background: active ? 'var(--bg-2)' : 'transparent',
                  display: 'block',
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 8px' }} />
          {BOTTOM_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-[11px] px-[12px] py-[11px] rounded-[7px] text-[14px] font-semibold no-underline"
                style={{
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  background: active ? 'var(--bg-2)' : 'transparent',
                  display: 'block',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border)' }}>
          <div
            onClick={toggleTheme}
            className="flex items-center justify-between px-[12px] py-[10px] rounded-[8px] cursor-pointer select-none"
            style={{ background: 'var(--bg-2)' }}
          >
            <div className="flex items-center gap-[9px] text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
              <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`} style={{ fontSize: 13, color: 'var(--ink-3)', width: 16, textAlign: 'center' }} />
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <div
              className="sw"
              style={{
                width: 38,
                height: 22,
                background: isDark ? 'var(--ink)' : 'var(--border)',
                borderRadius: 11,
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div
                className="sw-knob"
                style={{
                  position: 'absolute',
                  top: 3,
                  left: 3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s',
                  transform: isDark ? 'translateX(16px)' : 'translateX(0)',
                }}
              />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
