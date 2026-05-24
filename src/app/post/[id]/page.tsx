'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { BlogPost } from '@/types';
import Footer from '@/components/Footer';

export default function PostPage() {
  const params = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!params.id) return;
      try {
        const fb = getFirebase();
        const snap = await getDoc(doc(fb.db, 'posts', params.id as string));
        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data() } as BlogPost);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return <div className="flex items-center justify-center p-[40px]" style={{ color: 'var(--ink-3)' }}>Loading...</div>;
  }

  if (!post) {
    return (
      <>
        <section className="px-[20px] pt-[28px] pb-[18px] text-center">
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
            Not Found<span style={{ color: 'var(--gold)' }}>.</span>
          </h1>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.title}
          style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <section className="px-[20px] pt-[28px] pb-[18px]">
        <div className="flex items-center gap-[8px] mb-[12px]">
          <span style={{ fontSize: 10, color: 'var(--gold)', background: 'var(--gold-bg)', padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            {post.category || 'Update'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {post.createdAt?.toDate?.()?.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) || ''}
          </span>
          {post.readTime && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}><i className="fa-regular fa-clock" style={{ marginRight: 3 }} />{post.readTime}</span>}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 14 }}>{post.title}</h1>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{post.body}</div>
        {post.tags && post.tags.length > 0 && (
          <div className="flex gap-[5px] flex-wrap mt-[16px]">
            {post.tags.map((t, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--gold-bg)', color: 'var(--gold)', borderRadius: 8 }}>#{t}</span>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}
