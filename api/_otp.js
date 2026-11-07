const crypto = require('crypto');

const COLLECTION         = 'emailOtps';
const OTP_TTL_MS         = 10 * 60 * 1000; // code valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;      // min gap between sends to one email
const MAX_ATTEMPTS       = 5;              // wrong guesses allowed per code

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function isValidEmail(v) {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Doc id is a hash of the email so addresses never appear in document paths.
function otpDocId(email) {
  return crypto.createHash('sha256').update(email).digest('hex');
}

// HMAC (not a bare hash) so a leaked doc can't be brute-forced offline.
function hashCode(email, code) {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error('OTP_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}

function safeEqualHex(a, b) {
  const A = Buffer.from(String(a), 'hex');
  const B = Buffer.from(String(b), 'hex');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.xautracker.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
  COLLECTION,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
  normalizeEmail,
  isValidEmail,
  otpDocId,
  hashCode,
  safeEqualHex,
  setCors,
};
