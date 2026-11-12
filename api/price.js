function toNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function round(value, decimals = 2) {
  const num = toNumber(value);
  if (num === null) return null;
  return Number(num.toFixed(decimals));
}

async function fetchJson(url, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  return data;
}

/* ── Gold-API.com (fallback) ────────────────────────────────────────────
   /price/XAU      live USD price per troy ounce, no key needed, no bid/ask,
                   no open/high/low/change.
   /ohlc/XAU       open/high/low for a time range, needs GOLD_API_KEY (sent in
                   the x-api-key header). Free plan = 10 requests per hour, so
                   the result is cached in memory and the live price is fetched
                   separately on every call.
   If GOLD_API_KEY is missing or OHLC fails, we still return the live price
   (open/high/low/change come back null and the page falls back to the price). */
const OHLC_TTL_MS = 10 * 60 * 1000;
let ohlcCache = null; // { at, day, data }

async function fetchGoldApiOhlc() {
  const key = process.env.GOLD_API_KEY;
  if (!key) return null;

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);

  if (ohlcCache && ohlcCache.day === day && now - ohlcCache.at < OHLC_TTL_MS) {
    return ohlcCache.data;
  }

  try {
    const startOfDay = Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);
    const params = new URLSearchParams({
      startTimestamp: String(startOfDay),
      endTimestamp: String(Math.floor(now / 1000)),
    });
    const data = await fetchJson(`https://api.gold-api.com/ohlc/XAU?${params}`, {
      'x-api-key': key,
    });
    const ohlc = {
      open: round(data?.open),
      high: round(data?.high),
      low: round(data?.low),
    };
    if (ohlc.open === null) throw new Error('No OHLC data');
    ohlcCache = { at: now, day, data: ohlc };
    return ohlc;
  } catch (e) {
    console.error('Gold-API OHLC failed:', e.message);
    // Reuse a stale value from the same UTC day rather than losing the range;
    // stamp it so we don't hammer a throttled endpoint.
    if (ohlcCache && ohlcCache.day === day) {
      ohlcCache.at = now - OHLC_TTL_MS + 60 * 1000;
      return ohlcCache.data;
    }
    return null;
  }
}

async function fetchGoldApiPrice() {
  const data = await fetchJson('https://api.gold-api.com/price/XAU');

  const price = round(data?.price);
  if (price === null || price <= 0) {
    throw new Error('Gold-API did not return a valid price');
  }

  const ohlc = await fetchGoldApiOhlc();

  let open = null;
  let high = null;
  let low = null;
  let ch = null;
  let chp = null;

  if (ohlc) {
    open = ohlc.open;
    // the live price can sit outside the cached range, so widen it
    high = round(Math.max(ohlc.high ?? price, price));
    low = round(Math.min(ohlc.low ?? price, price));
    ch = round(price - open);
    chp = open ? round(((price - open) / open) * 100) : null;
  }

  return {
    price,
    open,
    high,
    low,
    bid: round(price - 0.30),
    ask: round(price + 0.30),
    ch,
    chp,
    source: 'Gold-API.com',
    updatedAt: data?.updatedAt || null,
  };
}

async function fetchTwelveDataPrice() {
  if (!process.env.TWELVE_DATA_KEY) {
    throw new Error('Missing TWELVE_DATA_KEY');
  }

  const params = new URLSearchParams({
    symbol: 'XAU/USD',
    apikey: process.env.TWELVE_DATA_KEY,
  });

  const data = await fetchJson(`https://api.twelvedata.com/quote?${params}`);

  if (data?.status === 'error' || !data?.close) {
    throw new Error(data?.message || 'Bad Twelve Data response');
  }

  const price = round(data.close);

  return {
    price,
    open: round(data.open),
    high: round(data.high),
    low: round(data.low),
    bid: round(data.bid) ?? round(price - 0.30),
    ask: round(data.ask) ?? round(price + 0.30),
    ch: round(data.change),
    chp: round(data.percent_change),
    source: 'Twelve Data',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.xautracker.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const result = await fetchTwelveDataPrice();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(result);
  } catch (primaryError) {
    console.error('Twelve Data failed:', primaryError.message);

    try {
      const fallback = await fetchGoldApiPrice();

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({
        ...fallback,
        fallback: true,
        primaryError: primaryError.message,
      });
    } catch (fallbackError) {
      console.error('Gold-API failed:', fallbackError.message);

      return res.status(500).json({
        error: 'Both price APIs failed',
        primary: {
          source: 'Twelve Data',
          message: primaryError.message,
        },
        fallback: {
          source: 'Gold-API.com',
          message: fallbackError.message,
        },
      });
    }
  }
}
