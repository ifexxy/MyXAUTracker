'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/price').then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);

  return (
    <section>
      <div className="card">
        <h2>Live XAU/USD</h2>
        {!data ? <p>Loading...</p> : (
          <>
            <p className="mono" style={{ fontSize: 36, margin: '6px 0' }}>${data.price}</p>
            <p className="mono">Open: {data.open} · High: {data.high} · Low: {data.low}</p>
            <p>Source: {data.source}</p>
          </>
        )}
      </div>
    </section>
  );
}
