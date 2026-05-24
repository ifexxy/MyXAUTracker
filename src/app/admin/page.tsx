'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, orderBy, query, serverTimestamp, where
} from 'firebase/firestore';
import { showToast } from '@/components/Toast';

const ADMIN_EMAIL = 'ifexxy9@gmail.com';

interface Post {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  link?: string;
  category?: string;
  readTime?: string;
  published?: boolean;
  tags?: string[];
  createdAt?: any;
}

interface ManualUser {
  email?: string;
  manualAccess?: boolean;
  manualAccessExpiresAt?: any;
  manualAccessNote?: string;
}

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // Post editor
  const [editId, setEditId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Market Update');
  const [postReadTime, setPostReadTime] = useState('');
  const [postImg, setPostImg] = useState('');
  const [postLink, setPostLink] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postPublished, setPostPublished] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [saving, setSaving] = useState(false);

  // Access management
  const [accessEmail, setAccessEmail] = useState('');
  const [accessAction, setAccessAction] = useState('grant');
  const [accessDuration, setAccessDuration] = useState(1);
  const [accessUnit, setAccessUnit] = useState('months');
  const [accessNote, setAccessNote] = useState('');
  const [accessResult, setAccessResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [manualUsers, setManualUsers] = useState<ManualUser[]>([]);

  // Price in topbar
  const [topbarPrice, setTopbarPrice] = useState('—');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/price');
        const d = await res.json();
        if (d?.price) setTopbarPrice('$' + Number(d.price).toLocaleString('en-US', { minimumFractionDigits: 2 }));
      } catch {}
    })();
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/price');
        const d = await res.json();
        if (d?.price) setTopbarPrice('$' + Number(d.price).toLocaleString('en-US', { minimumFractionDigits: 2 }));
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); return; }
    if (user.email === ADMIN_EMAIL) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (isAdmin) {
      loadPosts();
      loadManualAccessList();
    }
  }, [isAdmin]);

  const doLogin = async () => {
    setLoginErr('');
    try {
      const fb = getFirebase();
      await signInWithEmailAndPassword(fb.auth, loginEmail, loginPass);
    } catch {
      setLoginErr('Incorrect email or password.');
    }
  };

  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const val = tagInput.trim().replace(/,/g, '');
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(x => x !== t));
  };

  const previewImg = postImg.startsWith('http');

  const savePost = async () => {
    const title = postTitle.trim();
    const body = postBody.trim();
    if (!title) { showToast('⚠ Title is required'); return; }
    if (!body) { showToast('⚠ Body content is required'); return; }

    setSaving(true);
    const data: Record<string, any> = {
      title, body,
      imageUrl: postImg,
      link: postLink,
      category: postCategory,
      readTime: postReadTime || '3 min read',
      published: postPublished,
      tags,
      updatedAt: serverTimestamp(),
    };

    try {
      const fb = getFirebase();
      if (editId) {
        await updateDoc(doc(fb.db, 'posts', editId), data);
        showToast('✓ Post updated');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(fb.db, 'posts'), data);
        showToast('✓ Post ' + (postPublished ? 'published' : 'saved as draft'));
      }
      resetForm();
      loadPosts();
    } catch (e: any) {
      showToast('⚠ Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadPosts = async () => {
    try {
      const fb = getFirebase();
      const q = query(collection(fb.db, 'posts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    } catch {}
  };

  const editPost = async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    setEditId(id);
    setPostTitle(post.title || '');
    setPostBody(post.body || '');
    setPostImg(post.imageUrl || '');
    setPostLink(post.link || '');
    setPostCategory(post.category || 'Market Update');
    setPostReadTime(post.readTime || '');
    setPostPublished(post.published ?? true);
    setTags(post.tags || []);
    document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth' });
  };

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      const fb = getFirebase();
      await deleteDoc(doc(fb.db, 'posts', id));
      showToast('Post deleted');
      loadPosts();
    } catch {}
  };

  const copyPostLink = async (id: string) => {
    const url = `https://xautracker.vercel.app/post?id=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('✓ Link copied');
    } catch {
      showToast('Link: ' + url);
    }
  };

  const resetForm = () => {
    setEditId('');
    setPostTitle('');
    setPostBody('');
    setPostImg('');
    setPostLink('');
    setPostCategory('Market Update');
    setPostReadTime('');
    setPostPublished(true);
    setTags([]);
    setTagInput('');
  };

  const grantAccess = async () => {
    if (!accessEmail) { showToast('⚠ Enter a user email'); return; }
    setAccessResult(null);
    try {
      const fb = getFirebase();
      const token = await fb.auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminToken: token,
          targetEmail: accessEmail,
          action: accessAction,
          daysOrMonths: String(accessDuration),
          unit: accessUnit,
          note: accessNote,
        }),
      });
      const data = await res.json();
      setAccessResult({ ok: data.success, msg: data.message || data.error });
      if (data.success) {
        setAccessEmail('');
        setAccessNote('');
        loadManualAccessList();
        showToast('✓ ' + data.message);
      }
    } catch (e: any) {
      setAccessResult({ ok: false, msg: e.message });
    }
  };

  const revokeFromList = async (email: string) => {
  if (!confirm(`Revoke access for ${email}?`)) return;
  if (!email) { showToast('⚠ Enter a user email'); return; }
  try {
    const fb = getFirebase();
    const token = await fb.auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch('/api/grant-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminToken: token,
        targetEmail: email,
        action: 'revoke',
        daysOrMonths: '1',
        unit: 'months',
        note: '',
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Access revoked for ' + email);
      loadManualAccessList();
    } else {
      showToast('⚠ ' + (data.error || 'Revoke failed'));
    }
  } catch (e: any) {
    showToast('⚠ ' + e.message);
  }
};

  const loadManualAccessList = async () => {
    try {
      const fb = getFirebase();
      const snap = await getDocs(
        query(collection(fb.db, 'users'), where('manualAccess', '==', true))
      );
      setManualUsers(snap.docs.map(d => d.data() as ManualUser));
    } catch {}
  };

  const fmtDate = (val: any) => {
    if (!val) return '';
    const d = val?.toDate?.() || new Date(val);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (authLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--ink-3)' }}>Loading...</div>;

  return (
    <>
      {/* Login screen */}
      {!isAdmin && (
        <div id="login-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px 24px', minHeight: '80vh' }}>
          <div className="login-box" style={{ width: '100%', maxWidth: 380, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 18, padding: 24 }}>
            <div className="login-logo" style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--gold)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 18 }}><i className="fa-solid fa-coins" /></div>
            <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Admin Login</h2>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-2)', marginBottom: 18 }}>Sign in to manage blog posts</p>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Email</label>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@email.com"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Password</label>
            <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••••"
              onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
            {loginErr && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{loginErr}</p>}
            <button className="btn btn-gold btn-full" onClick={doLogin} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none', background: 'var(--ink)', color: 'var(--bg)', width: '100%', marginTop: 16 }}>
              <i className="fa-solid fa-right-to-bracket" /> Sign In
            </button>
          </div>
        </div>
      )}

      {/* Admin app */}
      {isAdmin && (
        <div id="admin-app" className="section" style={{ padding: '0 20px', maxWidth: 900, margin: '0 auto', marginTop: 20 }}>
          <div className="admin-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div className="admin-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="admin-logo" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--gold)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}><i className="fa-solid fa-coins" /></div>
              <h1 style={{ fontSize: 18, fontWeight: 800 }}>XAU <span style={{ color: 'var(--gold)' }}>Admin</span></h1>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <a href="/news" target="_blank" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', textDecoration: 'none', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                <i className="fa-solid fa-arrow-up-right-from-square" /> View News Page
              </a>
              <button className="btn btn-outline btn-sm" onClick={() => signOut()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                <i className="fa-solid fa-right-from-bracket" /> Sign Out
              </button>
            </div>
          </div>

          {/* Post Editor */}
          <div className="card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <h2 id="editor-heading" style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
              <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8, color: 'var(--gold)' }} />
              {editId ? 'Editing Post' : 'New Post'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Post Title *</label>
                <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value.slice(0, 120))} placeholder="e.g. Gold Surges Past $3,200 Amid Fed Uncertainty" maxLength={120}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
                <div style={{ fontSize: 11, color: postTitle.length > 108 ? 'var(--red)' : 'var(--ink-3)', textAlign: 'right', marginTop: 4 }}>{postTitle.length}/120</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Category</label>
                <select value={postCategory} onChange={(e) => setPostCategory(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }}>
                  <option value="Market Update">Market Update</option>
                  <option value="Analysis">Analysis</option>
                  <option value="Central Banks">Central Banks</option>
                  <option value="Fed & USD">Fed & USD</option>
                  <option value="Geopolitics">Geopolitics</option>
                  <option value="ETFs">ETFs</option>
                  <option value="Opinion">Opinion</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Read Time</label>
                <input type="text" value={postReadTime} onChange={(e) => setPostReadTime(e.target.value)} placeholder="e.g. 3 min read"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Cover Image URL</label>
                <input type="url" value={postImg} onChange={(e) => setPostImg(e.target.value)} placeholder="https://example.com/image.jpg"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
                {previewImg && (
                  <img src={postImg} alt="Cover preview"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginTop: 10, border: '1px solid var(--border)' }} />
                )}
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} />
                  Upload to <a href="https://imgur.com/upload" target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>imgur.com</a>
                  {' '}or <a href="https://imgbb.com" target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>imgbb.com</a> and paste the direct link here.
                </p>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>External Link (optional)</label>
                <input type="url" value={postLink} onChange={(e) => setPostLink(e.target.value)} placeholder="https://... — if this post links out to a source"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Body / Content *</label>
                <textarea value={postBody} onChange={(e) => setPostBody(e.target.value.slice(0, 4000))} placeholder="Write your post content here. You can use line breaks for paragraphs." maxLength={4000}
                  style={{ width: '100%', minHeight: 160, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none', lineHeight: 1.6, resize: 'vertical' }} />
                <div style={{ fontSize: 11, color: postBody.length > 3600 ? 'var(--red)' : 'var(--ink-3)', textAlign: 'right', marginTop: 4 }}>{postBody.length}/4000</div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Tags</label>
                <div className="tag-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
                  {tags.map(t => (
                    <span key={t} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px', borderRadius: 10, background: 'var(--gold-bg)', color: 'var(--gold)' }}>
                      {t}
                      <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                  <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKey}
                    placeholder="Type tag + Enter"
                    style={{ border: 'none', background: 'transparent', padding: 4, flex: 1, minWidth: 100, outline: 'none', color: 'var(--ink)', fontSize: 13 }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>Press Enter to add each tag</p>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div className="toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                  <div>
                    <div className="toggle-label" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>Publish immediately</div>
                    <div className="toggle-sub" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Off = saved as draft, not visible on news page</div>
                  </div>
                  <label className="toggle" style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={postPublished} onChange={(e) => setPostPublished(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                    <div className="toggle-track" style={{ position: 'absolute', inset: 0, background: postPublished ? 'var(--green)' : 'var(--bg)', borderRadius: 12, border: postPublished ? '1px solid var(--green)' : '1px solid var(--border)', transition: 'background .2s' }} />
                    <div className="toggle-thumb" style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'transform .2s', transform: postPublished ? 'translateX(20px)' : 'translateX(0)' }} />
                  </label>
                </div>
              </div>
            </div>

            <div className="btn-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button className="btn btn-gold" onClick={savePost} disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--ink)', color: 'var(--bg)', opacity: saving ? 0.5 : 1 }}>
                <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving...' : editId ? 'Update Post' : 'Publish Post'}
              </button>
              <button className="btn btn-outline" onClick={resetForm}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                <i className="fa-solid fa-xmark" /> Clear Form
              </button>
            </div>
          </div>

          {/* Post List */}
          <div className="card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
              <i className="fa-solid fa-list" style={{ marginRight: 8, color: 'var(--gold)' }} />
              All Posts
              <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 400, marginLeft: 8 }}>({posts.length})</span>
            </h2>
            <div id="post-list">
              {posts.length === 0 ? (
                <div className="empty" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                  <i className="fa-solid fa-newspaper" style={{ display: 'block', fontSize: 28, marginBottom: 10 }} />
                  No posts yet — write your first one above.
                </div>
              ) : (
                posts.map(p => {
                  const date = p.createdAt?.toDate?.()?.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) || '—';
                  return (
                    <div key={p.id} className="post-item" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', flexShrink: 0 }}>
                          <i className="fa-solid fa-newspaper" />
                        </div>
                      )}
                      <div className="post-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="post-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                        <div className="post-meta" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 5, fontSize: 11, color: 'var(--ink-3)' }}>
                          <span>{date}</span>
                          <span className="badge" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: p.published ? 'var(--green-bg)' : 'var(--bg-3)', color: p.published ? 'var(--green)' : 'var(--ink-3)' }}>{p.published ? 'Published' : 'Draft'}</span>
                          <span className="badge" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'var(--gold-bg)', color: 'var(--gold)' }}>{p.category || 'Update'}</span>
                        </div>
                        <button onClick={() => copyPostLink(p.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <i className="fa-solid fa-link" /> copy link
                        </button>
                      </div>
                      <div className="post-actions" style={{ display: 'flex', gap: 6 }}>
                        <a href={`/post/${p.id}`} target="_blank" className="btn btn-outline btn-sm" title="View live post"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', textDecoration: 'none', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                          <i className="fa-solid fa-eye" />
                        </a>
                        <button className="btn btn-outline btn-sm" onClick={() => editPost(p.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => deletePost(p.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Grant/Revoke Access */}
          <div className="card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
              <i className="fa-solid fa-users-gear" style={{ marginRight: 8, color: 'var(--gold)' }} />
              Grant / Revoke Access
            </h2>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>User Email</label>
            <input type="email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} placeholder="user@email.com"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Action</label>
            <select value={accessAction} onChange={(e) => setAccessAction(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }}>
              <option value="grant">Grant timed access</option>
              <option value="extend">Extend existing access</option>
              <option value="permanent">Grant permanent access</option>
              <option value="revoke">Revoke access</option>
            </select>
            {accessAction !== 'revoke' && accessAction !== 'permanent' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 800, marginTop: 0 }}>Duration</label>
                  <input type="number" value={accessDuration} onChange={(e) => setAccessDuration(Number(e.target.value))} min={1} max={365}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 800, marginTop: 0 }}>Unit</label>
                  <select value={accessUnit} onChange={(e) => setAccessUnit(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }}>
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
            )}
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.09em', margin: '14px 0 8px', fontWeight: 800 }}>Note (internal only)</label>
            <input type="text" value={accessNote} onChange={(e) => setAccessNote(e.target.value)} placeholder="e.g. Influencer partnership, Beta tester..."
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
            <div className="btn-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button className="btn btn-gold" onClick={grantAccess}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}>
                <i className="fa-solid fa-key" /> {accessAction === 'grant' ? 'Grant Access' : accessAction === 'extend' ? 'Extend Access' : accessAction === 'permanent' ? 'Grant Permanent' : 'Revoke Access'}
              </button>
            </div>
            {accessResult && (
              <p style={{ fontSize: 12, marginTop: 12, padding: 10, borderRadius: 8, background: accessResult.ok ? 'rgba(0,212,143,0.08)' : 'rgba(255,69,97,0.08)', color: accessResult.ok ? 'var(--green)' : 'var(--red)', border: accessResult.ok ? '1px solid rgba(0,212,143,0.2)' : '1px solid rgba(255,69,97,0.2)' }}>
                <i className={`fa-solid ${accessResult.ok ? 'fa-check' : 'fa-xmark'}`} style={{ marginRight: 6 }} />
                {accessResult.msg}
              </p>
            )}
          </div>

          {/* Manual Access List */}
          <div className="card" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 40 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
              <i className="fa-solid fa-list-check" style={{ marginRight: 8, color: 'var(--gold)' }} />
              Manual Access List
              <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 400, marginLeft: 8 }}>({manualUsers.length})</span>
            </h2>
            <div id="manual-access-list">
              {manualUsers.length === 0 ? (
                <div className="empty" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                  <i className="fa-solid fa-users" style={{ display: 'block', fontSize: 28, marginBottom: 10 }} />
                  No manual access granted yet.
                </div>
              ) : (
                manualUsers.map((u, i) => {
                  const expires = u.manualAccessExpiresAt?.toDate?.();
                  const expired = expires && expires.getTime() < Date.now();
                  let label: React.ReactNode;
                  if (!expires) label = <span style={{ color: 'var(--gold)' }}>Permanent</span>;
                  else if (expired) label = <span style={{ color: 'var(--red)' }}>Expired</span>;
                  else label = <span style={{ color: 'var(--green)' }}>Until {fmtDate(expires)}</span>;

                  return (
                    <div key={i} className="post-item" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 54, height: 54, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', flexShrink: 0 }}>
                        <i className="fa-solid fa-user" />
                      </div>
                      <div className="post-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="post-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{u.email || 'Unknown'}</div>
                        <div className="post-meta" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 5, fontSize: 11, color: 'var(--ink-3)' }}>
                          {label}
                          {u.manualAccessNote && <span className="badge" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'var(--gold-bg)', color: 'var(--gold)' }}>{u.manualAccessNote}</span>}
                        </div>
                      </div>
                      <div className="post-actions" style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setAccessEmail(u.email || ''); setAccessAction('revoke'); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer', background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }}>
                          <i className="fa-solid fa-ban" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
