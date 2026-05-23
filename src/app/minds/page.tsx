'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp, where, getCountFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast } from '@/components/Toast';
import Footer from '@/components/Footer';

interface ChatProfile { username: string; photoURL: string | null; }
interface Message { id: string; uid: string; username: string; photoURL: string | null; text: string; createdAt: any; }

export default function MindsPage() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<'loading' | 'access-wall' | 'setup' | 'chat'>('loading');
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
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);

  // Auth + access check
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setScreen('access-wall'); return; }
    (async () => {
      try {
        const fb = getFirebase();
        const snap = await getDoc(doc(fb.db, 'users', user.uid));
        const d = snap.data();
        const now = Date.now();
        const hasAccess = d ? (
          (d.trialEndsAt && new Date(d.trialEndsAt).getTime() > now) ||
          (d.subscriptionStatus === 'active' && d.currentPeriodEnd && new Date(d.currentPeriodEnd).getTime() > now) ||
          (d.manualAccess === true && (!d.manualAccessExpiresAt || new Date(d.manualAccessExpiresAt).getTime() > now))
        ) : false;
        if (!hasAccess) { setScreen('access-wall'); return; }
        // Check chat profile
        const profileSnap = await getDoc(doc(fb.db, 'chatProfiles', user.uid));
        if (profileSnap.exists()) {
          setScreen('chat');
          startFeed(fb);
          loadCount(fb);
        } else {
          setScreen('setup');
        }
      } catch { setScreen('access-wall'); }
    })();
  }, [user]);

  const loadCount = async (fb: any) => {
    try {
      const snap = await getCountFromServer(collection(fb.db, 'chatMessages'));
      setMessageCount(snap.data().count);
    } catch {}
  };

  const startFeed = useCallback((fb: any) => {
    const q = query(collection(fb.db, 'chatMessages'), orderBy('createdAt', 'desc'), limit(80));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message));
      msgs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        const tb = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        return tb - ta;
      });
      setMessages(msgs);
      setMessageCount(msgs.length);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (screen !== 'chat') return;
    const fb = getFirebase();
    const unsub = startFeed(fb);
    return () => unsub();
  }, [screen, startFeed]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showToast('Image must be under 3MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const registerUsername = async () => {
    const name = setupName.trim();
    if (!name || name.length < 3) { setSetupErr('Username must be at least 3 characters.'); return; }
    setSetupLoading(true);
    setSetupErr('');
    try {
      const fb = getFirebase();
      // Check uniqueness
      const taken = await getDocs(query(collection(fb.db, 'chatUsernames'), where('usernameLower', '==', name.toLowerCase())));
      if (!taken.empty) { setSetupErr('That username is already taken.'); setSetupLoading(false); return; }
      // Upload avatar
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
    } finally {
      setSetupLoading(false);
    }
  };

  const avatarColor = (username: string) => {
    const palette = ['#d4a72c', '#00d48f', '#a080ff', '#ff6b35', '#00b4d8', '#ff4561'];
    return palette[(username.charCodeAt(0) || 0) % palette.length];
  };

  const linkify = (raw: string) => {
    const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  };

  const sendMessage = async () => {
    const text = composeText.trim();
    if (!text || sending || cooldown > 0 || !user) return;
    setSending(true);
    try {
      const fb = getFirebase();
      const profileSnap = await getDoc(doc(fb.db, 'chatProfiles', user.uid));
      const profile = profileSnap.data() as ChatProfile;
      await addDoc(collection(fb.db, 'chatMessages'), { uid: user.uid, username: profile.username, photoURL: profile.photoURL || null, text, createdAt: serverTimestamp() });
      setComposeText('');
      setSending(false);
      // Start cooldown
      setCooldown(15);
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      cooldownTimer.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) { clearInterval(cooldownTimer.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      showToast('Failed to send message.');
      setSending(false);
    }
  };

  useEffect(() => {
    return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); };
  }, []);

  return (
    <>
      {/* Hero */}
      <section style={{ padding: '28px 20px 18px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 42, lineHeight: 0.98, fontWeight: 800, letterSpacing: -1.5, color: 'var(--ink)' }}>
          Minds<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 330, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Share your mind on gold, trading sessions, chart levels with the XauTracker community.
        </p>
        <div className="flex justify-center gap-[8px] flex-wrap mt-[16px]">
          <span className="inline-flex items-center gap-[6px] text-[11px] font-bold px-[11px] py-[7px] rounded-full" style={{ color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-bolt" style={{ color: 'var(--gold)' }} /> Newest messages first
          </span>
          <span className="inline-flex items-center gap-[6px] text-[11px] font-bold px-[11px] py-[7px] rounded-full" style={{ color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-link" style={{ color: 'var(--gold)' }} /> Links supported
          </span>
        </div>
      </section>

      {/* Community strip */}
      <div className="grid grid-cols-2 mx-[20px] mb-[18px] rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Community</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{messageCount || '—'} messages</div>
        </div>
        <div style={{ padding: 14, textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Access</div>
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

      {/* Setup screen */}
      {screen === 'setup' && (
        <div className="mx-[20px] mb-[18px] p-[20px] rounded-[16px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 16px', borderRadius: 18, background: 'var(--gold-bg)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            <i className="fa-solid fa-user-pen" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', color: 'var(--ink)', marginBottom: 8 }}>Pick Your Username</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, textAlign: 'center', marginBottom: 18 }}>Choose a trader name before entering Minds. You can optionally add a profile photo.</div>

          {/* Avatar picker */}
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

      {/* Chat screen */}
      {screen === 'chat' && (
        <>
          <div style={{ padding: '0 16px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '54px 18px', color: 'var(--ink-3)' }}>
                <i className="fa-solid fa-comments" style={{ fontSize: 36, marginBottom: 12 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 5 }}>No messages yet</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Be the first to share your thoughts!</div>
              </div>
            ) : (
              messages.map((m) => {
                const isOwn = m.uid === user?.uid;
                const ac = avatarColor(m.username || '?');
                const letter = (m.username || '?')[0].toUpperCase();
                return (
                  <div key={m.id} style={{ background: isOwn ? 'var(--gold-bg)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 15, marginBottom: 12, borderColor: isOwn ? 'var(--gold)' : undefined }}>
                    <div className="flex items-center gap-[10px] mb-[10px]">
                      <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, background: `${ac}22`, border: `2px solid ${ac}55`, color: ac }}>
                        {m.photoURL ? <img src={m.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : letter}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isOwn ? 'var(--gold)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.username}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {m.createdAt?.toDate?.()?.toLocaleString() || 'sending...'}
                        </div>
                      </div>
                      {isOwn && <span style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg)', color: 'var(--gold)', borderRadius: 20, fontWeight: 800 }}>You</span>}
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: linkify(m.text) }} />
                  </div>
                );
              })
            )}
          </div>

          {/* Compose bar */}
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.94)', WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', padding: '10px 16px 12px', zIndex: 90 }}>
            <div className="flex gap-[10px] items-end">
              <textarea value={composeText} onChange={(e) => { if (e.target.value.length <= 300) setComposeText(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="What's on your mind?" rows={1} maxLength={300}
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--ink)', fontSize: 15, padding: '12px 15px', outline: 'none', resize: 'none', lineHeight: 1.45, maxHeight: 100, overflowY: 'auto' }} />
              <button onClick={sendMessage} disabled={sending || cooldown > 0 || !composeText.trim()}
                style={{ width: 48, height: 48, background: 'var(--ink)', color: 'var(--bg)', border: 'none', borderRadius: 14, fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: sending || cooldown > 0 || !composeText.trim() ? 0.4 : 1 }}>
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
            <div className="flex justify-between items-center mt-[7px] px-[2px]">
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
        </>
      )}

      <Footer />
    </>
  );
}
