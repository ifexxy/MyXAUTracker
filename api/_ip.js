/* Real client IP on Vercel.
   Vercel overwrites x-forwarded-for / x-real-ip with the connecting client's
   public IP, so a visitor can't spoof it by sending their own header. */
function getClientIp(req) {
  const raw =
    req.headers['x-vercel-forwarded-for'] ||
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    (req.socket && req.socket.remoteAddress) ||
    '';
  let ip = String(Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);          // IPv4-mapped IPv6
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0]; // strip port
  return ip.slice(0, 64) || 'unknown';
}

module.exports = { getClientIp };
