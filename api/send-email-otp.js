const crypto = require('crypto');
const { db, adminAuth } = require('./_firebase');
const {
  COLLECTION,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  normalizeEmail,
  isValidEmail,
  otpDocId,
  hashCode,
  setCors,
} = require('./_otp');

/* Google reCAPTCHA v2 — checked server-side so it can't be skipped */
async function verifyCaptcha(token, ip) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) throw new Error('RECAPTCHA_SECRET_KEY is not set');

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await r.json();
  return data.success === true;
}

/* Email delivery via Resend's REST API (no extra dependency).
   To switch provider later, only this function needs to change. */
async function sendOtpEmail(to, code) {
  const key  = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // e.g. "XAU Tracker <no-reply@xautracker.com>"
  if (!key || !from) throw new Error('RESEND_API_KEY / EMAIL_FROM is not set');

  const minutes = OTP_TTL_MS / 60000;
  const text =
    `Your XAU Tracker verification code is ${code}.\n\n` +
    `It expires in ${minutes} minutes. If you didn't try to create an account, you can ignore this email.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px">` +
    `<h2 style="margin:0 0 12px">Verify your email</h2>` +
    `<p style="margin:0 0 16px;color:#444">Use this code to finish creating your XAU Tracker account:</p>` +
    `<div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:14px 0">${code}</div>` +
    `<p style="margin:16px 0 0;color:#777;font-size:13px">It expires in ${minutes} minutes. ` +
    `If you didn't try to create an account, you can ignore this email.</p></div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your XAU Tracker verification code: ${code}`,
      text,
      html,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`Resend ${r.status}: ${detail.slice(0, 200)}`);
  }
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { email: rawEmail, captchaToken } = req.body || {};
  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!captchaToken || typeof captchaToken !== 'string')
    return res.status(400).json({ error: 'Please tick "I\'m not a robot" first.' });

  try {
    /* 1. Captcha */
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
    if (!(await verifyCaptcha(captchaToken, ip)))
      return res.status(400).json({ error: 'Captcha check failed. Please tick it again.' });

    /* 2. Email must not already have an account */
    try {
      await adminAuth.getUserByEmail(email);
      return res.status(409).json({ error: 'An account with this email already exists.' });
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    /* 3. Cooldown check + store the new code, atomically */
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const ref  = db.collection(COLLECTION).doc(otpDocId(email));
    const now  = Date.now();

    const waitSeconds = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const left = (snap.data().lastSentAt || 0) + RESEND_COOLDOWN_MS - now;
        if (left > 0) return Math.ceil(left / 1000);
      }
      tx.set(ref, {
        email,
        codeHash:   hashCode(email, code),
        expiresAt:  now + OTP_TTL_MS,
        attempts:   0,
        lastSentAt: now,
      });
      return 0;
    });

    if (waitSeconds > 0) {
      return res.status(429).json({
        error: `Please wait ${waitSeconds}s before requesting another code.`,
        retryAfter: waitSeconds,
      });
    }

    /* 4. Send. If delivery fails, drop the code so the user isn't locked out by the cooldown */
    try {
      await sendOtpEmail(email, code);
    } catch (e) {
      await ref.delete().catch(() => {});
      throw e;
    }

    return res.status(200).json({
      success: true,
      expiresInSeconds: OTP_TTL_MS / 1000,
      cooldownSeconds:  RESEND_COOLDOWN_MS / 1000,
    });
  } catch (e) {
    console.error('send-email-otp error:', e.message);
    return res.status(500).json({ error: 'Could not send the verification email. Please try again.' });
  }
};
