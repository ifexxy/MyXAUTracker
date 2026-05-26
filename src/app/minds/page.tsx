'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, query, orderBy, limit,
  onSnapshot, serverTimestamp, where, getDocs, startAfter,
  updateDoc, deleteDoc, getCountFromServer
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast } from '@/components/Toast';
import Footer from '@/components/Footer';

/* ─── types ─── */
interface ChatProfile { username: string; photoURL: string | null; }
interface ReplyTo { id: string; username: string; text: string; }
interface Message {
  id: string; uid: string; username: string; photoURL: string | null;
  text: string; createdAt: any;
  reactions?: Record<string, string[]>;
  replyTo?: ReplyTo | null;
}
interface Announcement {
  id: string; text: string; createdAt: any; pinned: boolean; createdBy: string;
}

/* ─── helpers ─── */
function timeAgo(date: any): string {
  if (!date) return '';
  const ms = date?.toMillis?.() ?? date?.seconds * 1000 ?? date;
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const d = Math.floor(hr / 24);
  return d + 'd ago';
}

function avatarColor(username: string) {
  const pal = ['#d4a72c','#00d48f','#a080ff','#ff6b35','#00b4d8','#ff4561'];
  return pal[(username.charCodeAt(0) || 0) % pal.length];
}

function linkify(raw: string) {
  const esc = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return esc.replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--gold);text-decoration:underline">$1</a>');
}

const EMOJIS = ['👍', '🔥', '❤️', '😂', '😮'];

/* ─── component ─── */
export default function MindsPage() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<'loading'|'access-wall'|'setup'|'chat'>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [setupName, setSetupName] = useState('');
  const [setupErr, setSetupErr] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);

  /* new state */
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestDocSnap, setOldestDocSnap] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const unsubsRef = useRef<(() => void)[]>([]);
  const messagesRef = useRef<Message[]>([]);

  /* keep messagesRef in sync */
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  /* ─── Auth + access ─── */
  const fbRef = useRef<any>(null);
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setScreen('access-wall'); return; }
    (async () => {
      try {
        const fb = getFirebase();
        fbRef.current = fb;
        const snap = await getDoc(doc(fb.db, 'users', user.uid));
        const d = snap.data();
        const now = Date.now();
        const hasAccess = d ? (
          (d.trialEndsAt && new Date(d.trialEndsAt).getTime() > now) ||
          (d.subscriptionStatus === 'active' && d.currentPeriodEnd && new Date(d.currentPeriodEnd).getTime() > now) ||
          (d.manualAccess === true && (!d.manualAccessExpiresAt || new Date(d.manualAccessExpiresAt).getTime() > now))
        ) : false;
        if (!hasAccess) { setScreen('access-wall'); return; }
        const profileSnap = await getDoc(doc(fb.db, 'chatProfiles', user.uid));
        if (profileSnap.exists()) {
          setScreen('chat');
        } else {
          setScreen('setup');
        }
      } catch { setScreen('access-wall'); }
    })();
  }, [user]);

  /* ─── init chat when screen becomes 'chat' ─── */
  useEffect(() => {
    if (screen !== 'chat' || !fbRef.current) return;
    const fb = fbRef.current;

    // Count
    getCountFromServer(collection(fb.db, 'chatMessages')).then(snap => setMessageCount(snap.data().count)).catch(() => {});

    // Announcements
    const unsubAnn = onSnapshot(
      query(collection(fb.db, 'chatAnnouncements'), where('pinned', '==', true), orderBy('createdAt', 'desc')),
      snap => { const l: Announcement[] = []; snap.forEach(d => l.push({ id: d.id, ...d.data() } as Announcement)); setAnnouncements(l); }
    );
    unsubsRef.current.push(unsubAnn);

    // Messages: initial fetch + realtime listener
    loadMessages(fb);

    // Presence
    trackPresence(fb);

    return () => {
      unsubsRef.current.forEach(fn => fn());
      unsubsRef.current = [];
      if (user) deleteDoc(doc(fb.db, 'chatOnline', user.uid)).catch(() => {});
    };
  }, [screen]);

  /* ─── messages: paginated + realtime ─── */
  const loadMessages = async (fb: any) => {
    setInitialLoading(true);
    const q = query(collection(fb.db, 'chatMessages'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    const docs = snap.docs;
    if (docs.length < 20) setHasMore(false);
    setOldestDocSnap(docs.length > 0 ? docs[docs.length - 1] : null);
    const msgs: Message[] = docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
    setMessages(msgs);
    messagesRef.current = msgs;
    setInitialLoading(false);

    // Realtime listener for new messages after the last loaded
    const lastTs = msgs.length > 0 ? msgs[msgs.length - 1].createdAt : null;
    const listenQ = lastTs
      ? query(collection(fb.db, 'chatMessages'), orderBy('createdAt', 'asc'), startAfter(lastTs))
      : query(collection(fb.db, 'chatMessages'), orderBy('createdAt', 'asc'), limit(20));
    const unsub = onSnapshot(listenQ, (snap2) => {
      const news: Message[] = [];
      const current = messagesRef.current;
      snap2.forEach(d => {
        if (!current.find(m => m.id === d.id)) news.push({ id: d.id, ...d.data() } as Message);
      });
      if (news.length > 0) setMessages(prev => [...prev, ...news]);
    });
    unsubsRef.current.push(unsub);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !oldestDocSnap || !fbRef.current) return;
    setLoadingMore(true);
    try {
      const q = query(collection(fbRef.current.db, 'chatMessages'), orderBy('createdAt', 'desc'), startAfter(oldestDocSnap), limit(20));
      const snap = await getDocs(q);
      const docs = snap.docs;
      if (docs.length < 20) setHasMore(false);
      if (docs.length > 0) setOldestDocSnap(docs[docs.length - 1]);
      const older = docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      setMessages(prev => [...older, ...prev]);
    } catch {}
    setLoadingMore(false);
  };

  /* ─── presence ─── */
  const trackPresence = async (fb: any) => {
    if (!user) return;
    try {
      await setDoc(doc(fb.db, 'chatOnline', user.uid), { uid: user.uid, onlineAt: serverTimestamp() });
    } catch {}
    const unsub = onSnapshot(collection(fb.db, 'chatOnline'), snap => setOnlineCount(snap.size));
    unsubsRef.current.push(unsub);
    const handleUnload = () => { if (user) deleteDoc(doc(fb.db, 'chatOnline', user.uid)).catch(() => {}); };
    window.addEventListener('beforeunload', handleUnload);
    unsubsRef.current.push(() => window.removeEventListener('beforeunload', handleUnload));
  };

  /* ─── scroll to bottom on new messages ─── */
  const msgLenRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > msgLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    msgLenRef.current = messages.length;
  }, [messages.length]);

  /* ─── infinite scroll (load more on scroll to top) ─── */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; });
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || initialLoading) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMoreRef.current();
    }, { rootMargin: '200px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, initialLoading]);

  /* ─── auto-expand textarea ─── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [composeText]);

  /* ─── handlers ─── */
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showToast('Image must be under 3MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarDataUrl(ev?.target?.result as string);
    reader.readAsDataURL(file);
  };

  const registerUsername = async () => {
    const name = setupName.trim();
    if (!name || name.length < 3) { setSetupErr('Username must be at least 3 characters.'); return; }
    setSetupLoading(true); setSetupErr('');
    try {
      const fb = getFirebase();
      const taken = await getDocs(query(collection(fb.db, 'chatUsernames'), where('usernameLower', '==', name.toLowerCase())));
      if (!taken.empty) { setSetupErr('That username is already taken.'); setSetupLoading(false); return; }
      let photoURL: string | null = null;
      if (avatarDataUrl) {
        const blob = await fetch(avatarDataUrl).then(r => r.blob());
        const imgRef = ref(getStorage(fb.app), `chatAvatars/${user!.uid}`);
        await uploadBytes(imgRef, blob);
        photoURL = await getDownloadURL(imgRef);
      }
      await setDoc(doc(fb.db, 'chatUsernames', name.toLowerCase()), { uid: user!.uid, username: name, usernameLower: name.toLowerCase(), createdAt: serverTimestamp() });
      await setDoc(doc(fb.db, 'chatProfiles', user!.uid), { uid: user!.uid, username: name, photoURL, createdAt: serverTimestamp() });
      setScreen('chat');
    } catch (e: any) {
      setSetupErr(e.message || 'Error setting up profile.');
    } finally { setSetupLoading(false); }
  };

  const sendMessage = async () => {
    const text = composeText.trim();
    if (!text || sending || cooldown > 0 || !user) return;
    setSending(true);
    try {
      const fb = getFirebase();
      const profileSnap = await getDoc(doc(fb.db, 'chatProfiles', user.uid));
      const profile = profileSnap.data() as ChatProfile;
      const data: any = { uid: user.uid, username: profile.username, photoURL: profile.photoURL || null, text, createdAt: serverTimestamp() };
      if (replyTo) data.replyTo = replyTo;
      await addDoc(collection(fb.db, 'chatMessages'), data);
      setComposeText('');
      setReplyTo(null);
      setSending(false);
      setCooldown(15);
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      cooldownTimer.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) { clearInterval(cooldownTimer.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch { showToast('Failed to send message.'); setSending(false); }
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    try {
      const fb = getFirebase();
      const msgRef = doc(fb.db, 'chatMessages', msgId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      const data = msgSnap.data();
      const reactions = { ...(data.reactions || {}) };
      const list = [...(reactions[emoji] || [])];
      const idx = list.indexOf(user.uid);
      if (idx > -1) list.splice(idx, 1);
      else list.push(user.uid);
      if (list.length) reactions[emoji] = list;
      else delete reactions[emoji];
      await updateDoc(msgRef, { reactions });
    } catch {}
  };

  useEffect(() => {
    return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); };
  }, []);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <>
      {/* Hero */}
      <section style={{ padding: '28px 20px 12px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 42, lineHeight: 0.98, fontWeight: 800, letterSpacing: -1.5, color: 'var(--ink)' }}>
          Minds<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 330, margin: '12px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Share your mind on gold, trading sessions, chart levels with the XauTracker community.
        </p>
        <div className="flex justify-center gap-[6px] flex-wrap mt-[12px]">
          <span className="inline-flex items-center gap-[5px] text-[11px] font-bold px-[10px] py-[6px] rounded-full" style={{ color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-bolt" style={{ fontSize: 9, color: 'var(--gold)' }} /> Newest first
          </span>
          <span className="inline-flex items-center gap-[5px] text-[11px] font-bold px-[10px] py-[6px] rounded-full" style={{ color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-link" style={{ fontSize: 9, color: 'var(--gold)' }} /> Links supported
          </span>
        </div>
      </section>

      {/* Community strip */}
      <div className="flex mx-[20px] mb-[16px] rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Messages</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{messageCount || '—'}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Online</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>{onlineCount}&thinsp;users</div>
        </div>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Access</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>Trial / Pro</div>
        </div>
      </div>

      {/* Access wall */}
      {screen === 'access-wall' && (
        <div className="mx-[20px] mb-[18px] p-[20px] rounded-[16px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 16px', borderRadius: 18, background: 'var(--gold-bg)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            <i className="fa-solid fa-comments" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', color: 'var(--ink)', marginBottom: 8 }}>Join the Conversation</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, textAlign: 'center', marginBottom: 18 }}>Sign in with an active trial or subscription to chat with other gold traders.</div>
          <Link href="/login" className="flex items-center justify-center gap-[9px] w-full py-[14px] text-[14px] font-bold rounded-[12px] no-underline" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
            <i className="fa-solid fa-right-to-bracket" /> Sign In
          </Link>
        </div>
      )}

      {/* Setup */}
      {screen === 'setup' && (
        <div className="mx-[20px] mb-[18px] p-[20px] rounded-[16px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 16px', borderRadius: 18, background: 'var(--gold-bg)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            <i className="fa-solid fa-user-pen" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', color: 'var(--ink)', marginBottom: 8 }}>Pick Your Username</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, textAlign: 'center', marginBottom: 18 }}>Choose a trader name before entering Minds. You can optionally add a profile photo.</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
            <div style={{ position: 'relative', width: 88, height: 88, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--bg)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'var(--ink-3)', fontSize: 30 }}>
                {avatarDataUrl ? <img src={avatarDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="fa-solid fa-camera" />}
              </div>
              <div style={{ position: 'absolute', right: 1, bottom: 1, width: 27, height: 27, borderRadius: '50%', background: 'var(--gold)', color: '#000', border: '3px solid var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                <i className="fa-solid fa-plus" />
              </div>
            </div>
            <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>Tap to add profile photo (optional)</div>
          </div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Username</label>
          <input type="text" value={setupName} onChange={(e) => setSetupName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="goldtrader" maxLength={20}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 16, padding: '14px 15px', outline: 'none' }} />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 7 }}>Letters, numbers and underscores only · 3–20 characters</div>
          {setupErr && <div style={{ fontSize: 13, color: 'var(--red)', padding: '12px 14px', background: 'var(--red-bg)', borderRadius: 10, marginTop: 14 }}>{setupErr}</div>}
          <button onClick={registerUsername} disabled={setupLoading}
            className="flex items-center justify-center gap-[9px] w-full py-[14px] mt-[18px] text-[14px] font-bold rounded-[12px] cursor-pointer"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: setupLoading ? 0.55 : 1 }}>
            {setupLoading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Setting up...</> : <><i className="fa-solid fa-check" /> Set Username & Enter</>}
          </button>
        </div>
      )}

      {/* ═══════ CHAT ═══════ */}
      {screen === 'chat' && (
        <div style={{ padding: '0 16px' }}>
          {/* ── Announcements ── */}
          {announcements.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 12, background: 'var(--gold-bg)', border: '1px solid rgba(200,150,42,0.2)', borderRadius: 12, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <i className="fa-solid fa-bullhorn" style={{ color: 'var(--gold)', fontSize: 14, flexShrink: 0, marginTop: 1 }} />
              <div>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Announcement</span>
                <div style={{ marginTop: 2 }}>{a.text}</div>
              </div>
            </div>
          ))}

          {/* ── Compose bar ── */}
          <div style={{ marginBottom: 16 }}>
            {/* Reply context bar */}
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', marginBottom: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--ink-2)' }}>
                <i className="fa-solid fa-reply" style={{ fontSize: 10, color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>@{replyTo.username}</span>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{replyTo.text}</div>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0 }}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            )}

            {/* Compose row */}
            <div className="flex gap-[10px] items-end">
              <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: `${avatarColor(user?.email || '?')}22`, border: `2px solid ${avatarColor(user?.email || '?')}55`, color: avatarColor(user?.email || '?') }}>
                {user?.email?.[0].toUpperCase() || '?'}
              </div>
              <textarea ref={textareaRef} value={composeText} onChange={(e) => { if (e.target.value.length <= 300) setComposeText(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="What's on your mind?" maxLength={300} rows={1}
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--ink)', fontSize: 15, padding: '10px 14px', outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 40, overflow: 'hidden' }} />
              <button onClick={sendMessage} disabled={sending || cooldown > 0 || !composeText.trim()}
                style={{ width: 40, height: 40, background: 'var(--ink)', color: 'var(--bg)', border: 'none', borderRadius: 12, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: sending || cooldown > 0 || !composeText.trim() ? 0.35 : 1 }}>
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
            <div className="flex justify-between items-center mt-[6px] px-[2px]">
              {cooldown > 0 ? (
                <div className="flex items-center gap-[8px]" style={{ flex: 1 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--red)', borderRadius: 2, transition: 'width 1s linear', width: `${(cooldown / 15) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--red)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cooldown}s</span>
                </div>
              ) : <div />}
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{composeText.length} / 300</span>
            </div>
          </div>

          {/* ── Messages ── */}
          <div ref={feedRef} style={{ paddingBottom: 20 }}>
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} style={{ height: 1 }} />
            {/* Load more button (manual fallback) */}
            {hasMore && !initialLoading && (
              <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                <button onClick={loadMore} disabled={loadingMore} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 20px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontWeight: 600 }}>
                  {loadingMore ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Loading…</> : 'Load earlier messages'}
                </button>
              </div>
            )}

            {initialLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
                <i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite', fontSize: 24 }} />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '44px 18px', color: 'var(--ink-3)' }}>
                <i className="fa-solid fa-comments" style={{ fontSize: 32, marginBottom: 10 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 5 }}>No messages yet</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Be the first to share your thoughts!</div>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isOwn = m.uid === user?.uid;
                const ac = avatarColor(m.username || '?');
                const letter = (m.username || '?')[0].toUpperCase();
                const reactions = m.reactions || {};
                const userReacted = (emoji: string) => user ? (reactions[emoji] || []).includes(user.uid) : false;
                return (
                  <div key={m.id} style={{ borderBottom: idx < messages.length - 1 ? '1px solid var(--border)' : 'none', padding: '14px 0' }}>
                    {/* Header row */}
                    <div className="flex items-center gap-[8px] mb-[4px]">
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: `${ac}22`, border: `2px solid ${ac}44`, color: ac }}>
                        {m.photoURL ? <img src={m.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : letter}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isOwn ? 'var(--gold)' : 'var(--ink)' }}>{m.username}</span>
                      {(idx === 0 || messages[idx - 1]?.uid !== m.uid) && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{timeAgo(m.createdAt)}</span>}
                      {isOwn && <span style={{ fontSize: 10, padding: '1px 7px', background: 'var(--bg-2)', color: 'var(--gold)', borderRadius: 10, fontWeight: 700 }}>You</span>}
                    </div>

                    {/* Reply context */}
                    {m.replyTo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)', marginBottom: 4, paddingLeft: 40 }}>
                        <i className="fa-solid fa-reply" style={{ fontSize: 9, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>@{m.replyTo.username}</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.replyTo.text}</span>
                      </div>
                    )}

                    {/* Text */}
                    <div style={{ paddingLeft: 40, fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: linkify(m.text) }} />

                    {/* Reactions + actions row */}
                    <div style={{ paddingLeft: 40, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {EMOJIS.map(emoji => {
                        const count = (reactions[emoji] || []).length;
                        const reacted = userReacted(emoji);
                        if (count === 0 && !reacted) return null;
                        return (
                          <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, fontSize: 12, border: '1px solid', cursor: 'pointer', background: reacted ? 'var(--gold-bg)' : 'transparent', borderColor: reacted ? 'var(--gold)' : 'var(--border)', color: 'var(--ink-2)' }}>
                            {emoji} {count > 0 && <span style={{ fontWeight: 600 }}>{count}</span>}
                          </button>
                        );
                      })}
                      {/* Reply button */}
                      <button onClick={() => setReplyTo({ id: m.id, username: m.username, text: m.text })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, fontSize: 12, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--ink-3)' }}>
                        <i className="fa-solid fa-reply" style={{ fontSize: 10 }} /> Reply
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}