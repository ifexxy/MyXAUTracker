'use client';

import { useEffect, useState } from 'react';

export default function NewsPage() {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetch('/api/news').then((r) => r.json()).then((d) => setArticles(Array.isArray(d) ? d : []));
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Latest Gold News</h2>
      {articles.map((a) => (
        <a key={a.url} href={a.url} target="_blank" className="block rounded-xl border border-white/10 bg-card p-4">
          <p className="text-xs text-gold">{a.source?.name || 'Source'}</p>
          <p className="mt-1 font-medium">{a.title}</p>
          <p className="mt-2 text-sm text-muted">{a.description || 'Open article...'}</p>
        </a>
      ))}
    </section>
  );
}
