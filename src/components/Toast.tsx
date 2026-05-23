'use client';

import { useEffect, useCallback, useRef } from 'react';

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer) clearTimeout(toastTimer);
  el.textContent = msg;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export default function Toast() {
  return (
    <div
      id="toast"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%) translateY(20px)',
        background: 'var(--ink)',
        color: 'var(--bg)',
        padding: '10px 18px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        opacity: 0,
        transition: 'all 0.28s',
        pointerEvents: 'none',
        zIndex: 300,
        whiteSpace: 'nowrap',
      }}
    />
  );
}
