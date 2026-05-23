'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from '@/components/Toast';
import Footer from '@/components/Footer';

interface MindPost {
  id: string;
  text: string;
  author: string;
  email: string;
  createdAt: { toDate?: () => Date };
}

export default function MindsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<MindPost[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fb = getFirebase();
        const q = query(
          collection(fb.db, 'minds'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setPosts(items);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePost = async () => {
    if (!text.trim() || !user) return;
    setPosting(true);
    try {
      const fb = getFirebase();
      const docRef = await addDoc(collection(fb.db, 'minds'), {
        text: text.trim(),
        author: user.email?.split('@')[0] || 'Anonymous',
        email: user.email,
        createdAt: serverTimestamp(),
      });
      setPosts([{ id: docRef.id, text: text.trim(), author: user.email?.split('@')[0] || 'Anonymous', email: user.email || '', createdAt: { toDate: () => new Date() } }, ...posts]);
      setText('');
      showToast('Posted to Minds');
    } catch {
      showToast('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Minds<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Share your gold market thoughts with the community.
        </p>
      </section>

      {user && (
        <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>
            Share your thought
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind about gold today?"
            rows={3}
            style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none', lineHeight: 1.6, marginBottom: 10 }}
          />
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{text.length}/280</div>
            <button
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className="py-[10px] px-[18px] rounded-[10px] text-[13px] font-bold cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: posting || !text.trim() ? 0.5 : 1 }}
            >
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      )}

      <div className="px-[20px]">
        {loading ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : posts.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
            No posts yet. Be the first to share your thoughts!
          </div>
        ) : (
          posts.map((p) => (
            <div key={p.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <div className="flex items-center gap-[10px] mb-[10px]">
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontSize: 12 }}>
                  <i className="fa-solid fa-user" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.author}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                    {p.createdAt?.toDate?.()?.toLocaleString() || 'Just now'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{p.text}</div>
            </div>
          ))
        )}
      </div>

      <Footer />
    </>
  );
}
