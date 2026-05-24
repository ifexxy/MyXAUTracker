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
  // Nigeria first
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },

  // A
  { name: 'Afghanistan', code: '+93', flag: '🇦🇫' },
  { name: 'Albania', code: '+355', flag: '🇦🇱' },
  { name: 'Algeria', code: '+213', flag: '🇩🇿' },
  { name: 'Andorra', code: '+376', flag: '🇦🇩' },
  { name: 'Angola', code: '+244', flag: '🇦🇴' },
  { name: 'Antigua and Barbuda', code: '+1-268', flag: '🇦🇬' },
  { name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { name: 'Armenia', code: '+374', flag: '🇦🇲' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Austria', code: '+43', flag: '🇦🇹' },
  { name: 'Azerbaijan', code: '+994', flag: '🇦🇿' },

  // B
  { name: 'Bahamas', code: '+1-242', flag: '🇧🇸' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Barbados', code: '+1-246', flag: '🇧🇧' },
  { name: 'Belarus', code: '+375', flag: '🇧🇾' },
  { name: 'Belgium', code: '+32', flag: '🇧🇪' },
  { name: 'Belize', code: '+501', flag: '🇧🇿' },
  { name: 'Benin', code: '+229', flag: '🇧🇯' },
  { name: 'Bhutan', code: '+975', flag: '🇧🇹' },
  { name: 'Bolivia', code: '+591', flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', code: '+387', flag: '🇧🇦' },
  { name: 'Botswana', code: '+267', flag: '🇧🇼' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'Brunei', code: '+673', flag: '🇧🇳' },
  { name: 'Bulgaria', code: '+359', flag: '🇧🇬' },
  { name: 'Burkina Faso', code: '+226', flag: '🇧🇫' },
  { name: 'Burundi', code: '+257', flag: '🇧🇮' },

  // C
  { name: 'Cambodia', code: '+855', flag: '🇰🇭' },
  { name: 'Cameroon', code: '+237', flag: '🇨🇲' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Cape Verde', code: '+238', flag: '🇨🇻' },
  { name: 'Central African Republic', code: '+236', flag: '🇨🇫' },
  { name: 'Chad', code: '+235', flag: '🇹🇩' },
  { name: 'Chile', code: '+56', flag: '🇨🇱' },
  { name: 'China', code: '+86', flag: '🇨🇳' },
  { name: 'Colombia', code: '+57', flag: '🇨🇴' },
  { name: 'Comoros', code: '+269', flag: '🇰🇲' },
  { name: 'Congo (DRC)', code: '+243', flag: '🇨🇩' },
  { name: 'Congo (Republic)', code: '+242', flag: '🇨🇬' },
  { name: 'Costa Rica', code: '+506', flag: '🇨🇷' },
  { name: 'Croatia', code: '+385', flag: '🇭🇷' },
  { name: 'Cuba', code: '+53', flag: '🇨🇺' },
  { name: 'Cyprus', code: '+357', flag: '🇨🇾' },
  { name: 'Czech Republic', code: '+420', flag: '🇨🇿' },

  // D
  { name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { name: 'Djibouti', code: '+253', flag: '🇩🇯' },
  { name: 'Dominica', code: '+1-767', flag: '🇩🇲' },
  { name: 'Dominican Republic', code: '+1-809', flag: '🇩🇴' },

  // E
  { name: 'Ecuador', code: '+593', flag: '🇪🇨' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬' },
  { name: 'El Salvador', code: '+503', flag: '🇸🇻' },
  { name: 'Equatorial Guinea', code: '+240', flag: '🇬🇶' },
  { name: 'Eritrea', code: '+291', flag: '🇪🇷' },
  { name: 'Estonia', code: '+372', flag: '🇪🇪' },
  { name: 'Eswatini', code: '+268', flag: '🇸🇿' },
  { name: 'Ethiopia', code: '+251', flag: '🇪🇹' },

  // F
  { name: 'Fiji', code: '+679', flag: '🇫🇯' },
  { name: 'Finland', code: '+358', flag: '🇫🇮' },
  { name: 'France', code: '+33', flag: '🇫🇷' },

  // G
  { name: 'Gabon', code: '+241', flag: '🇬🇦' },
  { name: 'Gambia', code: '+220', flag: '🇬🇲' },
  { name: 'Georgia', code: '+995', flag: '🇬🇪' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'Ghana', code: '+233', flag: '🇬🇭' },
  { name: 'Greece', code: '+30', flag: '🇬🇷' },
  { name: 'Grenada', code: '+1-473', flag: '🇬🇩' },
  { name: 'Guatemala', code: '+502', flag: '🇬🇹' },
  { name: 'Guinea', code: '+224', flag: '🇬🇳' },
  { name: 'Guinea-Bissau', code: '+245', flag: '🇬🇼' },
  { name: 'Guyana', code: '+592', flag: '🇬🇾' },

  // H
  { name: 'Haiti', code: '+509', flag: '🇭🇹' },
  { name: 'Honduras', code: '+504', flag: '🇭🇳' },
  { name: 'Hungary', code: '+36', flag: '🇭🇺' },

  // I
  { name: 'Iceland', code: '+354', flag: '🇮🇸' },
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Iran', code: '+98', flag: '🇮🇷' },
  { name: 'Iraq', code: '+964', flag: '🇮🇶' },
  { name: 'Ireland', code: '+353', flag: '🇮🇪' },
  { name: 'Israel', code: '+972', flag: '🇮🇱' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Ivory Coast', code: '+225', flag: '🇨🇮' },

  // J
  { name: 'Jamaica', code: '+1-876', flag: '🇯🇲' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'Jordan', code: '+962', flag: '🇯🇴' },

  // K
  { name: 'Kazakhstan', code: '+7', flag: '🇰🇿' },
  { name: 'Kenya', code: '+254', flag: '🇰🇪' },
  { name: 'Kiribati', code: '+686', flag: '🇰🇮' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', code: '+996', flag: '🇰🇬' },

  // L
  { name: 'Laos', code: '+856', flag: '🇱🇦' },
  { name: 'Latvia', code: '+371', flag: '🇱🇻' },
  { name: 'Lebanon', code: '+961', flag: '🇱🇧' },
  { name: 'Lesotho', code: '+266', flag: '🇱🇸' },
  { name: 'Liberia', code: '+231', flag: '🇱🇷' },
  { name: 'Libya', code: '+218', flag: '🇱🇾' },
  { name: 'Liechtenstein', code: '+423', flag: '🇱🇮' },
  { name: 'Lithuania', code: '+370', flag: '🇱🇹' },
  { name: 'Luxembourg', code: '+352', flag: '🇱🇺' },

  // M
  { name: 'Madagascar', code: '+261', flag: '🇲🇬' },
  { name: 'Malawi', code: '+265', flag: '🇲🇼' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { name: 'Maldives', code: '+960', flag: '🇲🇻' },
  { name: 'Mali', code: '+223', flag: '🇲🇱' },
  { name: 'Malta', code: '+356', flag: '🇲🇹' },
  { name: 'Marshall Islands', code: '+692', flag: '🇲🇭' },
  { name: 'Mauritania', code: '+222', flag: '🇲🇷' },
  { name: 'Mauritius', code: '+230', flag: '🇲🇺' },
  { name: 'Mexico', code: '+52', flag: '🇲🇽' },
  { name: 'Micronesia', code: '+691', flag: '🇫🇲' },
  { name: 'Moldova', code: '+373', flag: '🇲🇩' },
  { name: 'Monaco', code: '+377', flag: '🇲🇨' },
  { name: 'Mongolia', code: '+976', flag: '🇲🇳' },
  { name: 'Montenegro', code: '+382', flag: '🇲🇪' },
  { name: 'Morocco', code: '+212', flag: '🇲🇦' },
  { name: 'Mozambique', code: '+258', flag: '🇲🇿' },
  { name: 'Myanmar', code: '+95', flag: '🇲🇲' },

  // N
  { name: 'Namibia', code: '+264', flag: '🇳🇦' },
  { name: 'Nauru', code: '+674', flag: '🇳🇷' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { name: 'Nicaragua', code: '+505', flag: '🇳🇮' },
  { name: 'Niger', code: '+227', flag: '🇳🇪' },
  { name: 'North Korea', code: '+850', flag: '🇰🇵' },
  { name: 'North Macedonia', code: '+389', flag: '🇲🇰' },
  { name: 'Norway', code: '+47', flag: '🇳🇴' },

  // O
  { name: 'Oman', code: '+968', flag: '🇴🇲' },

  // P
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Palau', code: '+680', flag: '🇵🇼' },
  { name: 'Palestine', code: '+970', flag: '🇵🇸' },
  { name: 'Panama', code: '+507', flag: '🇵🇦' },
  { name: 'Papua New Guinea', code: '+675', flag: '🇵🇬' },
  { name: 'Paraguay', code: '+595', flag: '🇵🇾' },
  { name: 'Peru', code: '+51', flag: '🇵🇪' },
  { name: 'Philippines', code: '+63', flag: '🇵🇭' },
  { name: 'Poland', code: '+48', flag: '🇵🇱' },
  { name: 'Portugal', code: '+351', flag: '🇵🇹' },

  // Q
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },

  // R
  { name: 'Romania', code: '+40', flag: '🇷🇴' },
  { name: 'Russia', code: '+7', flag: '🇷🇺' },
  { name: 'Rwanda', code: '+250', flag: '🇷🇼' },

  // S
  { name: 'Saint Kitts and Nevis', code: '+1-869', flag: '🇰🇳' },
  { name: 'Saint Lucia', code: '+1-758', flag: '🇱🇨' },
  { name: 'Saint Vincent and the Grenadines', code: '+1-784', flag: '🇻🇨' },
  { name: 'Samoa', code: '+685', flag: '🇼🇸' },
  { name: 'San Marino', code: '+378', flag: '🇸🇲' },
  { name: 'Sao Tome and Principe', code: '+239', flag: '🇸🇹' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Senegal', code: '+221', flag: '🇸🇳' },
  { name: 'Serbia', code: '+381', flag: '🇷🇸' },
  { name: 'Seychelles', code: '+248', flag: '🇸🇨' },
  { name: 'Sierra Leone', code: '+232', flag: '🇸🇱' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Slovakia', code: '+421', flag: '🇸🇰' },
  { name: 'Slovenia', code: '+386', flag: '🇸🇮' },
  { name: 'Solomon Islands', code: '+677', flag: '🇸🇧' },
  { name: 'Somalia', code: '+252', flag: '🇸🇴' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { name: 'South Sudan', code: '+211', flag: '🇸🇸' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { name: 'Sudan', code: '+249', flag: '🇸🇩' },
  { name: 'Suriname', code: '+597', flag: '🇸🇷' },
  { name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { name: 'Syria', code: '+963', flag: '🇸🇾' },

  // T
  { name: 'Taiwan', code: '+886', flag: '🇹🇼' },
  { name: 'Tajikistan', code: '+992', flag: '🇹🇯' },
  { name: 'Tanzania', code: '+255', flag: '🇹🇿' },
  { name: 'Thailand', code: '+66', flag: '🇹🇭' },
  { name: 'Timor-Leste', code: '+670', flag: '🇹🇱' },
  { name: 'Togo', code: '+228', flag: '🇹🇬' },
  { name: 'Tonga', code: '+676', flag: '🇹🇴' },
  { name: 'Trinidad and Tobago', code: '+1-868', flag: '🇹🇹' },
  { name: 'Tunisia', code: '+216', flag: '🇹🇳' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { name: 'Turkmenistan', code: '+993', flag: '🇹🇲' },
  { name: 'Tuvalu', code: '+688', flag: '🇹🇻' },

  // U
  { name: 'Uganda', code: '+256', flag: '🇺🇬' },
  { name: 'Ukraine', code: '+380', flag: '🇺🇦' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'Uruguay', code: '+598', flag: '🇺🇾' },
  { name: 'Uzbekistan', code: '+998', flag: '🇺🇿' },

  // V
  { name: 'Vanuatu', code: '+678', flag: '🇻🇺' },
  { name: 'Vatican City', code: '+39-06', flag: '🇻🇦' },
  { name: 'Venezuela', code: '+58', flag: '🇻🇪' },
  { name: 'Vietnam', code: '+84', flag: '🇻🇳' },

  // Y
  { name: 'Yemen', code: '+967', flag: '🇾🇪' },

  // Z
  { name: 'Zambia', code: '+260', flag: '🇿🇲' },
  { name: 'Zimbabwe', code: '+263', flag: '🇿🇼' },
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

  // ── FIX: initialise reCAPTCHA as soon as step 2 mounts ──
  // Guard with !recaptchaVerifier so navigating back then forward
  // doesn't attempt to render a second widget on the same DOM node.
  useEffect(() => {
    if (step === 2 && !recaptchaVerifier) {
      const { auth } = getFirebase();
      const rv = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
      setRecaptchaVerifier(rv);
    }
  }, [step]);

  const getFullPhone = () => selectedCountry.code + phone.replace(/^0/, '');

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
  );

  const goToPhoneStep = () => {
    setError('');
    if (!email) { setError('Enter your email.'); return; }
    if (password.length < 6) { setError('Password must be 6+ characters.'); return; }
    if (password !== password2) { setError('Passwords do not match.'); return; }
    setStep(2);
  };

  // ── FIX: removed initRecaptcha() — verifier is now ready before this runs ──
  const sendOTP = async () => {
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    if (!recaptchaVerifier) { setError('reCAPTCHA not ready yet, please wait.'); return; }
    setLoading(true);
    try {
      const fb = getFirebase();
      // Check phone not already used
      const q = query(collection(fb.db, 'users'), where('phone', '==', getFullPhone()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setError('This phone number is already registered.');
        setLoading(false);
        return;
      }
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
        e.code === 'auth/code-expired'               ? 'Code expired. Request a new one.' :
        e.code === 'auth/email-already-in-use'       ? 'An account with this email already exists.' :
        e.message || 'Sign up failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
          Start your 7-day free trial and unlock the gold forecast dashboard,
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
              Phone Verification
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
                Email Address
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
              onClick={goToPhoneStep}
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
                Phone Number
              </label>
              <div className="flex gap-[10px]">
                {/* Country picker */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    onClick={() => setCountryOpen(!countryOpen)}
                    className="flex items-center gap-[7px] cursor-pointer select-none"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '14px 12px',
                      minWidth: 105,
                      fontSize: 14,
                      color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{selectedCountry.flag}</span>
                    <span>{selectedCountry.code}</span>
                    <span
                      style={{
                        fontSize: 9,
                        color: 'var(--ink-3)',
                        transition: 'transform 0.2s',
                        transform: countryOpen ? 'rotate(180deg)' : 'none',
                      }}
                    >
                      ▼
                    </span>
                  </div>

                  {countryOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        width: 280,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        zIndex: 500,
                        boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: 10,
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <input
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country..."
                          style={{
                            width: '100%',
                            fontSize: 13,
                            padding: '10px 12px',
                            background: 'var(--bg-2)',
                            border: 'none',
                            borderRadius: 8,
                            color: 'var(--ink)',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          maxHeight: 240,
                          overflowY: 'auto',
                          padding: 6,
                        }}
                      >
                        {filteredCountries.map((c, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedCountry(c);
                              setCountryOpen(false);
                              setCountrySearch('');
                            }}
                            className="flex items-center gap-[9px] px-[9px] py-[10px] rounded-[9px] cursor-pointer"
                            style={{
                              color:
                                c.name === selectedCountry.name
                                  ? 'var(--ink)'
                                  : 'var(--ink-2)',
                              background:
                                c.name === selectedCountry.name
                                  ? 'var(--bg-2)'
                                  : 'transparent',
                              fontSize: 13,
                            }}
                          >
                            <span>{c.flag}</span>
                            <span style={{ flex: 1 }}>{c.name}</span>
                            <span style={{ fontWeight: 800, color: 'var(--gold)' }}>
                              {c.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Phone number input */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7xxxxxxx"
                    autoComplete="tel"
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
              </div>
            </div>

            {/* ── FIX: reCAPTCHA renders here immediately on step 2 mount ── */}
            <div id="recaptcha-container" style={{ marginTop: 10 }} />

            {error && (
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
                {error}
              </div>
            )}

            {!otpSent ? (
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
                    <i className="fa-solid fa-mobile-screen" /> Send Verification Code
                  </>
                )}
              </button>
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
