'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/price')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-card p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-muted">XAU / USD</p>
        <h2 className="mt-2 text-5xl font-bold">{data?.price ? `$${data.price}` : '—'}</h2>
        <p className="mt-2 text-sm text-muted">{data?.source || 'Loading source...'}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-card p-3"><p className="text-xs text-muted">Open</p><p className="text-lg">{data?.open ?? '—'}</p></div>
        <div className="rounded-xl border border-white/10 bg-card p-3"><p className="text-xs text-muted">High</p><p className="text-lg">{data?.high ?? '—'}</p></div>
        <div className="rounded-xl border border-white/10 bg-card p-3"><p className="text-xs text-muted">Low</p><p className="text-lg">{data?.low ?? '—'}</p></div>
        <div className="rounded-xl border border-white/10 bg-card p-3"><p className="text-xs text-muted">Change %</p><p className="text-lg">{data?.chp ?? '—'}</p></div>
      </div>
    </section>
  );
}
