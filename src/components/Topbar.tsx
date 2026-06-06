'use client';

import { useGoldPrice } from '@/contexts/GoldPriceContext';

interface TopbarProps {
  onMenuClick: () => void;
  rightContent?: React.ReactNode;
}

export default function Topbar({ onMenuClick, rightContent }: TopbarProps) {
  return (
    <div
      id="topbar"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 18px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100,
        transition: 'background .22s, border-color .22s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          id="topbar-menu-btn"
          onClick={onMenuClick}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            width: 34, height: 34, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 6,
            color: 'var(--ink)', fontSize: 15,
          }}
        >
          <i className="fa-solid fa-bars" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
          XauTracker
        </span>
      </div>
      {rightContent}
    </div>
  );
}