'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

/* ── Google reCAPTCHA v2 (checkbox). Checked server-side in /api/send-email-otp ── */
type RecaptchaApi = {
  ready: (cb: () => void) => void;
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: 'light' | 'dark';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    }
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: RecaptchaApi;
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

let recaptchaScript: Promise<void> | null = null;
function loadRecaptcha(): Promise<void> {
  if (window.grecaptcha) return Promise.resolve();
  if (!recaptchaScript) {
    recaptchaScript = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        recaptchaScript = null;
        reject(new Error('captcha script failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return recaptchaScript;
}

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && user) router.push('/welcome');
  }, [user, authLoading, router]);

  // Render the captcha each time step 2 mounts. The widget goes into a fresh
  // child node so going back and forward (or React strict-mode remounts)
  // never hits "already rendered in this element".
  useEffect(() => {
    if (step !== 2 || !RECAPTCHA_SITE_KEY) return;
    const host = captchaRef.current;
    if (!host) return;

    let cancelled = false;
    const holder = document.createElement('div');
    host.appendChild(holder);

    loadRecaptcha()
      .then(() => {
        const g = window.grecaptcha;
        if (cancelled || !g) return;
        g.ready(() => {
          if (cancelled) return;
          widgetIdRef.current = g.render(holder, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme:
              document.documentElement.getAttribute('data-theme') === 'dark'
                ? 'dark'
                : 'light',
            callback: (token) => setCaptchaToken(token),
            'expired-callback': () => setCaptchaToken(''),
            'error-callback': () => setCaptchaToken(''),
          });
        });
      })
      .catch(() => {
        if (!cancelled)
          setError('Could not load the captcha. Check your connection and refresh.');
      });

    return () => {
      cancelled = true;
      widgetIdRef.current = null;
      holder.remove();
    };
  }, [step]);

  const goToVerifyStep = () => {
    setError('');
    if (!email) { setError('Enter your email.'); return; }
    if (password.length < 6) { setError('Password must be 6+ characters.'); return; }
    if (password !== password2) { setError('Passwords do not match.'); return; }
    setStep(2);
  };

  const sendOTP = async () => {
    setError('');
    if (!captchaToken) { setError('Please tick "I\'m not a robot" first.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), captchaToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to send code.');
        return;
      }
      setOtpSent(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      // Captcha tokens are single-use, so require a fresh tick for the next send
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
      setCaptchaToken('');
      setLoading(false);
    }
  };

  const doSignUp = async () => {
    setError('');
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    if (!otpSent) { setError('Please request a code first.'); return; }
    setLoading(true);
    try {
      // Server checks the code, then creates the account + user document
      const res = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Sign up failed.');
        return;
      }

      try {
        const fb = getFirebase();
        await signInWithEmailAndPassword(fb.auth, email.trim(), password);
      } catch {
        setError('Account created. Please sign in on the login page.');
        return;
      }
      router.push('/welcome');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const shownError =
    error ||
    (step === 2 && !RECAPTCHA_SITE_KEY
      ? 'Captcha is not configured. Please contact support.'
      : '');

  if (authLoading) {
    return (
      <div
        className="flex items-center justify-center p-[40px]"
        style={{ color: 'var(--ink-3)' }}
      >
        Loading...
      </div>
    );
  }

  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1
          style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: -1.3,
            color: 'var(--ink)',
          }}
        >
          Create Account
          <span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p
          style={{
            maxWidth: 330,
            margin: '14px auto 0',
            color: 'var(--ink-2)',
            fontSize: 14,
            lineHeight: 1.65,
          }}
        >
          Start your 3 days free trial and unlock the gold/bitcoin forecast dashboard,
          live signals, and trader tools.
        </p>
      </section>

      <div
        className="mx-[20px] mb-[18px] p-[18px] rounded-[16px]"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
      >
        {/* Step indicators */}
        <div className="flex items-center mb-[22px]">
          <div className="flex items-center gap-[8px]">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                border: '1px solid var(--border)',
                background: step > 1 ? 'var(--green-bg)' : 'var(--ink)',
                borderColor: step > 1 ? 'var(--green)' : 'var(--ink)',
                color: step > 1 ? 'var(--green)' : 'var(--bg)',
              }}
            >
              {step > 1 ? <i className="fa-solid fa-check" /> : '1'}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: step >= 1 ? 'var(--ink)' : 'var(--ink-3)',
              }}
            >
              Your Details
            </span>
          </div>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'var(--border)',
              margin: '0 10px',
            }}
          />
          <div className="flex items-center gap-[8px]">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                border: '1px solid var(--border)',
                background: step === 2 ? 'var(--ink)' : 'var(--bg)',
                borderColor: step === 2 ? 'var(--ink)' : 'var(--border)',
                color: step === 2 ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >
              2
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: step === 2 ? 'var(--ink)' : 'var(--ink-3)',
              }}
            >
              Email Verification
            </span>
          </div>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 ? (
          <>
            <div className="mb-[16px]">
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.09em',
                  marginBottom: 8,
                  fontWeight: 800,
                }}
              >
                Email Address(
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--ink)',
                  fontSize: 15,
                  padding: '14px 15px',
                  outline: 'none',
                }}
              />
            </div>

            <div className="mb-[16px]">
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.09em',
                  marginBottom: 8,
                  fontWeight: 800,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--ink)',
                  fontSize: 15,
                  padding: '14px 15px',
                  outline: 'none',
                }}
              />
            </div>

            <div className="mb-[16px]">
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.09em',
                  marginBottom: 8,
                  fontWeight: 800,
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--ink)',
                  fontSize: 15,
                  padding: '14px 15px',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  color: 'var(--red)',
                  background: 'var(--red-bg)',
                  border: '1px solid rgba(184,50,50,0.22)',
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={goToVerifyStep}
              className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
            >
              <i className="fa-solid fa-arrow-right" /> Continue
            </button>

            <div
              className="text-center text-[13px] mt-[18px]"
              style={{ color: 'var(--ink-2)' }}
            >
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 800 }}>
                Sign in
              </Link>
            </div>
          </>
        ) : (
          /* ── STEP 2 ── */
          <>
            <p
              style={{
                fontSize: 13,
                color: 'var(--ink-2)',
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              We&apos;ll email a 6-digit verification code to{' '}
              <strong style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>
                {email.trim()}
              </strong>
              .
            </p>

            {/* reCAPTCHA renders here each time step 2 mounts */}
            <div ref={captchaRef} style={{ marginTop: 10 }} />

            {shownError && (
              <div
                style={{
                  fontSize: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  marginTop: 10,
                  color: 'var(--red)',
                  background: 'var(--red-bg)',
                  border: '1px solid rgba(184,50,50,0.22)',
                }}
              >
                {shownError}
              </div>
            )}

            {!otpSent ? (
              <>
                <button
                  onClick={sendOTP}
                  disabled={loading}
                  className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    border: 'none',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <i
                        className="fa-solid fa-spinner"
                        style={{ animation: 'spin 0.8s linear infinite' }}
                      />{' '}
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-envelope" /> Send Verification Code
                    </>
                  )}
                </button>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
                  Tick the{' '}
                  <strong style={{ color: 'var(--ink-2)' }}>I&apos;m not a robot</strong> box, then
                  send the code. Can&apos;t find the email? Check your spam folder.
                </p>
              </>
            ) : (
              <>
                <div className="mb-[16px]" style={{ marginTop: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      marginBottom: 8,
                      fontWeight: 800,
                    }}
                  >
                    Verification Code
                  </label>
                  <input
                    type="number"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter the 6-digit code"
                    style={{
                      display: 'block',
                      width: '100%',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--ink)',
                      fontSize: 15,
                      padding: '14px 15px',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={doSignUp}
                  disabled={loading}
                  className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    border: 'none',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <i
                        className="fa-solid fa-spinner"
                        style={{ animation: 'spin 0.8s linear infinite' }}
                      />{' '}
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-rocket" /> Create Account
                    </>
                  )}
                </button>

                <button
                  onClick={sendOTP}
                  className="w-full rounded-[12px] py-[13px] px-[16px] mt-[10px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
                  style={{
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <i className="fa-solid fa-rotate-right" /> Resend Code
                </button>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
                  To resend, tick <strong style={{ color: 'var(--ink-2)' }}>I&apos;m not a robot</strong>{' '}
                  again first.
                </p>
              </>
            )}

            <div
              style={{
                height: 1,
                background: 'var(--border)',
                margin: '24px 0 14px',
              }}
            />

            <button
              onClick={() => {
                setStep(1);
                setOtpSent(false);
                setOtp('');
                setCaptchaToken('');
                setError('');
              }}
              className="w-full rounded-[12px] py-[13px] px-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
              style={{
                background: 'transparent',
                color: 'var(--ink-2)',
                border: '1px solid var(--border)',
              }}
            >
              <i className="fa-solid fa-arrow-left" /> Back to Step 1
            </button>

            <div
              className="text-center text-[13px] mt-[18px]"
              style={{ color: 'var(--ink-2)' }}
            >
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 800 }}>
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  );
}
