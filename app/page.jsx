'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/price')
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h2>Live XAU/USD</h2>
      {error && <p>{error}</p>}
      {!data ? <p>Loading...</p> : (
        <ul>
          <li>Price: {data.price}</li>
          <li>Open: {data.open}</li>
          <li>High: {data.high}</li>
          <li>Low: {data.low}</li>
          <li>Source: {data.source}</li>
        </ul>
      )}
    </section>
  );
}
