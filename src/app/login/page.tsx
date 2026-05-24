'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOk, setResetOk] = useState(false);
  const [resetErr, setResetErr] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/predict');
    }
  }, [user, authLoading, router]);

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    try {
      const { auth } = getFirebase();
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/predict');
    } catch (e: any) {
      const msg =
        e.code === 'auth/user-not-found' ? 'No account found with this email.' :
        e.code === 'auth/wrong-password' ? 'Incorrect password.' :
        e.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.' :
        'Sign in failed. Check your details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetErr('');
    setResetOk(false);
    if (!resetEmail) { setResetErr('Enter your email address.'); return; }
    setLoading(true);
    try {
      const { auth } = getFirebase();
      await sendPasswordResetEmail(auth, resetEmail);
      setResetOk(true);
    } catch {
      setResetErr('Failed to send reset link. Check the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center p-[40px]" style={{ color: 'var(--ink-3)' }}>Loading...</div>;
  }

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Sign In<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 330, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Welcome back. Sign in to open your gold forecast dashboard, Minds community.
        </p>
      </section>

      <div className="mx-[20px] mb-[18px] p-[18px] rounded-[16px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        {!showReset ? (
          <>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
                style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }}
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()} />
            </div>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }}
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()} />
            </div>
            {error && <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 10, marginTop: 10, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.22)' }}>{error}</div>}
            <button onClick={handleSignIn} disabled={loading}
              className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: loading ? 0.5 : 1 }}>
              {loading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Signing in...</> : <><i className="fa-solid fa-right-to-bracket" /> Sign In</>}
            </button>
            <div className="flex items-center gap-[10px] my-[16px]" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <Link href="/signup" className="w-full rounded-[12px] py-[13px] px-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] no-underline"
              style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
              <i className="fa-solid fa-user-plus" /> Create Account, 7 Days Free
            </Link>
            <div className="text-center text-[13px] mt-[18px]" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <button onClick={() => setShowReset(true)} style={{ color: 'var(--gold)', cursor: 'pointer', fontWeight: 800, background: 'none', border: 'none', fontSize: 13 }}>Forgot password?</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65, marginBottom: 18 }}>Enter your email and we will send a password reset link.</p>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Email</label>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
                style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }} />
            </div>
            {resetErr && <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 10, marginTop: 10, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.22)' }}>{resetErr}</div>}
            {resetOk && <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 10, marginTop: 10, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid rgba(26,122,74,0.22)' }}>Reset link sent. Check your inbox or spam folder.</div>}
            <button onClick={handleReset} disabled={loading}
              className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: loading ? 0.5 : 1 }}>
              {loading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Sending...</> : <><i className="fa-solid fa-envelope" /> Send Reset Link</>}
            </button>
            <div className="text-center text-[13px] mt-[18px]" style={{ color: 'var(--ink-2)' }}>
              <button onClick={() => { setShowReset(false); setResetErr(''); setResetOk(false); }} style={{ color: 'var(--gold)', cursor: 'pointer', fontWeight: 800, background: 'none', border: 'none', fontSize: 13 }}>Back to sign in</button>
            </div>
          </>
        )}
      </div>
      <Footer />
    </>
  );
}
