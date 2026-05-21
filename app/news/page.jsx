'use client';

import { useEffect, useState } from 'react';

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/news')
      .then((r) => r.json())
      .then(setArticles)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h2>Gold News</h2>
      {error && <p>{error}</p>}
      <ul>
        {articles.map((a) => (
          <li key={a.url}><a href={a.url} target="_blank">{a.title}</a></li>
        ))}
      </ul>
    </section>
  );
}
