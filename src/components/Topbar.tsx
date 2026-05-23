'use client';

import { useGoldPrice } from '@/contexts/GoldPriceContext';
import { fmtPrice } from '@/lib/api';

interface TopbarProps {
  onMenuClick: () => void;
  rightContent?: React.ReactNode;
}

export default function Topbar({ onMenuClick, rightContent }: TopbarProps) {
  const { price } = useGoldPrice();

  return (
    <div id="topbar" className="flex items-center justify-between px-[18px] py-[13px] border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="flex items-center gap-[10px]">
        <button
          onClick={onMenuClick}
          className="w-[34px] h-[34px] flex items-center justify-center rounded-[6px]"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontSize: 15 }}
        >
          <i className="fa-solid fa-bars" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>XauTracker</span>
      </div>
      <div className="flex items-center gap-[10px]">
        <div
          className="flex items-center gap-[5px] text-[10px] font-bold px-[9px] py-[4px] rounded-full"
          style={{ color: 'var(--green)', background: 'var(--green-bg)', letterSpacing: '0.04em' }}
        >
          <div className="w-[5px] h-[5px] rounded-full" style={{ background: 'var(--green)', animation: 'blink 1.6s ease-in-out infinite' }} />
          LIVE
        </div>
        {rightContent}
      </div>
    </div>
  );
}
