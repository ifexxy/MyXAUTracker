'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebase';
import { createUserWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

const COUNTRIES = [
  { name: 'Nigeria', code: '+234', flag: '\u{1F1F3}\u{1F1EC}' },
  { name: 'Ghana', code: '+233', flag: '\u{1F1EC}\u{1F1ED}' },
  { name: 'Kenya', code: '+254', flag: '\u{1F1F0}\u{1F1EA}' },
  { name: 'South Africa', code: '+27', flag: '\u{1F1FF}\u{1F1E6}' },
  { name: 'United Kingdom', code: '+44', flag: '\u{1F1EC}\u{1F1E7}' },
  { name: 'United States', code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
  { name: 'India', code: '+91', flag: '\u{1F1EE}\u{1F1F3}' },
];

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && user) router.push('/predict');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (step !== 2) return;
    const { auth } = getFirebase();
    const rv = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
    setRecaptchaVerifier(rv);
    return () => { try { rv.clear(); } catch {} };
  }, [step]);

  const getFullPhone = () => selectedCountry.code + phone.replace(/^0/, '');

  const filteredCountries = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)
  );

  const goToPhoneStep = () => {
    setError('');
    if (!email) { setError('Enter your email.'); return; }
    if (password.length < 6) { setError('Password must be 6+ characters.'); return; }
    if (password !== password2) { setError('Passwords do not match.'); return; }
    setStep(2);
  };

  const sendOTP = async () => {
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    setLoading(true);
    try {
      const fb = getFirebase();
      // Check phone not used
      const q = query(collection(fb.db, 'users'), where('phone', '==', getFullPhone()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setError('This phone number is already registered.');
        setLoading(false);
        return;
      }
      if (!recaptchaVerifier) { setError('reCAPTCHA not ready. Please refresh.'); setLoading(false); return; }
      const result = await signInWithPhoneNumber(fb.auth, getFullPhone(), recaptchaVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (e: any) {
      setError(e.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const doSignUp = async () => {
    setError('');
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    if (!confirmationResult) { setError('Please request a code first.'); return; }
    setLoading(true);
    try {
      const fb = getFirebase();
      const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
      const { user: newUser } = await createUserWithEmailAndPassword(fb.auth, email, password);
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await setDoc(doc(fb.db, 'users', newUser.uid), {
        email,
        phone: getFullPhone(),
        createdAt: serverTimestamp(),
        trialEndsAt,
        subscriptionStatus: 'trial',
        manualAccess: false,
        manualAccessNote: '',
        manualAccessExpiresAt: null,
        currentPeriodEnd: null,
        lastPaymentAt: null,
        lastPaymentAmount: null,
      });
      router.push('/predict');
    } catch (e: any) {
      const msg =
        e.code === 'auth/invalid-verification-code' ? 'Incorrect code. Try again.' :
        e.code === 'auth/code-expired' ? 'Code expired. Request a new one.' :
        e.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' :
        e.message || 'Sign up failed.';
      setError(msg);
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
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>Create Account<span style={{ color: 'var(--gold)' }}>.</span></h1>
        <p style={{ maxWidth: 330, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>Start your 7-day free trial and unlock the gold forecast dashboard, live signals, and trader tools.</p>
      </section>

      <div className="mx-[20px] mb-[18px] p-[18px] rounded-[16px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        {/* Step indicators */}
        <div className="flex items-center mb-[22px]">
          <div className="flex items-center gap-[8px]">
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, border: '1px solid var(--border)', background: step > 1 ? 'var(--green-bg)' : 'var(--ink)', borderColor: step > 1 ? 'var(--green)' : 'var(--ink)', color: step > 1 ? 'var(--green)' : 'var(--bg)' }}>
              {step > 1 ? <i className="fa-solid fa-check" /> : '1'}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: step >= 1 ? 'var(--ink)' : 'var(--ink-3)' }}>Your Details</span>
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 10px' }} />
          <div className="flex items-center gap-[8px]">
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, border: '1px solid var(--border)', background: step === 2 ? 'var(--ink)' : 'var(--bg)', borderColor: step === 2 ? 'var(--ink)' : 'var(--border)', color: step === 2 ? 'var(--bg)' : 'var(--ink-3)' }}>2</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: step === 2 ? 'var(--ink)' : 'var(--ink-3)' }}>Phone Verification</span>
          </div>
        </div>

        {step === 1 ? (
          <>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
                style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }} />
            </div>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" autoComplete="new-password"
                style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }} />
            </div>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Confirm Password</label>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repeat password" autoComplete="new-password"
                style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }} />
            </div>
            {error && <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 10, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.22)' }}>{error}</div>}
            <button onClick={goToPhoneStep} className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}>
              <i className="fa-solid fa-arrow-right" /> Continue
            </button>
            <div className="text-center text-[13px] mt-[18px]" style={{ color: 'var(--ink-2)' }}>
              Already have an account? <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 800 }}>Sign in</Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-[16px]">
              <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Phone Number</label>
              <div className="flex gap-[10px]">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div onClick={() => setCountryOpen(!countryOpen)} className="flex items-center gap-[7px] cursor-pointer select-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px', minWidth: 105, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    <span>{selectedCountry.flag}</span><span>{selectedCountry.code}</span>
                    <span style={{ fontSize: 9, color: 'var(--ink-3)', transition: 'transform 0.2s', transform: countryOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                  </div>
                  {countryOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 280, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, zIndex: 500, boxShadow: '0 18px 40px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
                      <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search country..."
                          style={{ width: '100%', fontSize: 13, padding: '10px 12px', background: 'var(--bg-2)', border: 'none', borderRadius: 8, color: 'var(--ink)', outline: 'none' }} />
                      </div>
                      <div style={{ maxHeight: 240, overflowY: 'auto', padding: 6 }}>
                        {filteredCountries.map((c, i) => (
                          <div key={i} onClick={() => { setSelectedCountry(c); setCountryOpen(false); setCountrySearch(''); }}
                            className="flex items-center gap-[9px] px-[9px] py-[10px] rounded-[9px] cursor-pointer"
                            style={{ color: c.name === selectedCountry.name ? 'var(--ink)' : 'var(--ink-2)', background: c.name === selectedCountry.name ? 'var(--bg-2)' : 'transparent', fontSize: 13 }}>
                            <span>{c.flag}</span><span style={{ flex: 1 }}>{c.name}</span><span style={{ fontWeight: 800, color: 'var(--gold)' }}>{c.code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="8012345678" autoComplete="tel"
                    style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }} />
                </div>
              </div>
            </div>
            <div id="recaptcha-container" style={{ marginTop: 10 }} />
            {error && <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 10, marginTop: 10, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.22)' }}>{error}</div>}
            {!otpSent ? (
              <button onClick={sendOTP} disabled={loading} className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
                style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: loading ? 0.5 : 1 }}>
                {loading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Sending...</> : <><i className="fa-solid fa-mobile-screen" /> Send Verification Code</>}
              </button>
            ) : (
              <>
                <div className="mb-[16px]" style={{ marginTop: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Verification Code</label>
                  <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter the 6-digit code"
                    style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 15, padding: '14px 15px', outline: 'none' }} />
                </div>
                <button onClick={doSignUp} disabled={loading} className="w-full rounded-[12px] py-[14px] px-[16px] mt-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', opacity: loading ? 0.5 : 1 }}>
                  {loading ? <><i className="fa-solid fa-spinner" style={{ animation: 'spin 0.8s linear infinite' }} /> Creating...</> : <><i className="fa-solid fa-rocket" /> Create Account</>}
                </button>
                <button onClick={sendOTP} className="w-full rounded-[12px] py-[13px] px-[16px] mt-[10px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
                  style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                  <i className="fa-solid fa-rotate-right" /> Resend Code
                </button>
              </>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '24px 0 14px' }} />
            <button onClick={() => { setStep(1); setOtpSent(false); setError(''); }} className="w-full rounded-[12px] py-[13px] px-[16px] text-[14px] font-bold flex items-center justify-center gap-[8px] cursor-pointer"
              style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
              <i className="fa-solid fa-arrow-left" /> Back to Step 1
            </button>
            <div className="text-center text-[13px] mt-[18px]" style={{ color: 'var(--ink-2)' }}>
              Already have an account? <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 800 }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
      <Footer />
    </>
  );
}
