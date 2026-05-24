'use client';

import { useState, useEffect } from 'react';
import { fetchNews } from '@/lib/api';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { NewsArticle, BlogPost } from '@/types';
import Footer from '@/components/Footer';

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [news, fb] = await Promise.all([
          fetchNews(),
          getFirebase().catch(() => null),
        ]);
        setArticles(Array.isArray(news) ? news : []);

        if (fb) {
          try {
            const q = query(
              collection(fb.db, 'posts'),
              where('published', '==', true),
              orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            const blogPosts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as BlogPost[];
            setPosts(blogPosts);
          } catch {}
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Gold News<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Follow XAU/USD market updates, gold headlines, central-bank news and XauTracker posts in one feed.
        </p>
      </section>

      {posts.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div className="px-[20px] mb-[18px]">
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Latest posts</div>
          </div>
          <div className="px-[20px]">
            {posts.map((p) => (
              <a key={p.id} href={`/post/${p.id}`} style={{ display: 'block', textDecoration: 'none', marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    <div className="flex items-center gap-[8px] mb-[8px]">
                      <span style={{ fontSize: 10, color: 'var(--gold)', background: 'var(--gold-bg)', padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        <i className="fa-solid fa-pen-nib" style={{ marginRight: 4, fontSize: 8 }} /> {p.category || 'Update'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {p.createdAt?.toDate?.()?.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) || ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.45, color: 'var(--ink)', marginBottom: 8 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                      {(p.body || '').slice(0, 160)}{(p.body || '').length > 160 ? '...' : ''}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="px-[20px] mb-[18px]">
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Market headlines</div>
        </div>
        <div className="px-[20px]">
          {loading ? (
            <div className="rounded-[16px] p-[16px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="h-[18px] w-[70%] mb-[10px] rounded-[6px]" style={{ background: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
              <div className="h-[44px] w-full rounded-[6px]" style={{ background: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            </div>
          ) : articles.length === 0 ? (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>No headlines available</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Please check back shortly for fresh gold market updates.</div>
            </div>
          ) : (
            articles.slice(0, 12).map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none', marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                  <div className="flex items-center gap-[8px] mb-[8px]">
                    <span style={{ fontSize: 10, color: 'var(--gold)', background: 'var(--gold-bg)', padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {a.source}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {a.publishedAt ? new Date(a.publishedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Latest'}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.45, color: 'var(--ink)', marginBottom: 8 }}>{a.title}</div>
                  {a.description && <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{a.description}</div>}
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 5 }} /> Read story
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
