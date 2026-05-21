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

  const chp = Number(data?.chp);
  const up = Number.isFinite(chp) ? chp >= 0 : true;

  return (
    <section className="space-y-3">
      <div className="card text-center">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--txt-2)' }}>XAU / USD</p>
        <h2 className="mono mt-2 text-5xl font-bold">{data?.price ? `$${data.price}` : '—'}</h2>
        <div className="mx-auto mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold" style={{ background: up ? 'var(--green-dim)' : 'rgba(255,69,97,.12)', color: up ? 'var(--green)' : 'var(--red)' }}>
          {Number.isFinite(chp) ? `${up ? '+' : ''}${chp}%` : '...' }
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--txt-2)' }}>{data?.source || 'Loading source...'}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ['Open', data?.open],
          ['High', data?.high],
          ['Low', data?.low],
          ['Change', data?.ch],
        ].map(([k, v]) => (
          <div key={k} className="card py-3">
            <p className="text-xs uppercase" style={{ color: 'var(--txt-2)' }}>{k}</p>
            <p className="mono mt-1 text-lg">{v ?? '—'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
