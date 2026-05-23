import type { GoldPrice, NewsArticle } from '@/types';

const BASE = '';

export async function fetchGoldPrice(): Promise<GoldPrice | null> {
  try {
    const res = await fetch(`${BASE}/api/price`);
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchNews(): Promise<NewsArticle[]> {
  try {
    const res = await fetch(`${BASE}/api/news`);
    if (!res.ok) throw new Error(`news API ${res.status}`);
    return await res.json();
  } catch {
    return [];
  }
}

export async function verifyPayment(transactionId: string, userToken: string) {
  const res = await fetch(`${BASE}/api/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId, userToken }),
  });
  return res.json();
}

export async function cancelSubscription(userToken: string) {
  const res = await fetch(`${BASE}/api/cancel-subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userToken }),
  });
  return res.json();
}

export async function checkPhone(phone: string) {
  const res = await fetch(`${BASE}/api/check-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtChange(v: number | null | undefined): string {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}
