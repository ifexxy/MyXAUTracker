function toNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function round(value, decimals = 2) {
  const num = toNumber(value);
  if (num === null) return null;
  return Number(num.toFixed(decimals));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  return data;
}

async function fetchMetalsDevPrice() {
  if (!process.env.METALS_DEV_KEY) {
    throw new Error('Missing METALS_DEV_KEY');
  }

  const params = new URLSearchParams({
    api_key: process.env.METALS_DEV_KEY,
    metal: 'gold',
    currency: 'USD',
  });

  const data = await fetchJson(
    `https://api.metals.dev/v1/metal/spot?${params}`
  );

  if (data?.status !== 'success' || !data?.rate) {
    throw new Error('Bad Metals.Dev response');
  }

  const rate = data.rate;

  const price = round(rate.price);

  if (price === null) {
    throw new Error('Metals.Dev did not return a valid price');
  }

  const ch = round(rate.change) ?? 0;
  const chp = round(rate.change_percent) ?? 0;

  /*
    Metals.Dev spot response may not include "open".
    If change is current price minus previous/open reference,
    then open/reference price can be derived as price - change.
  */
  const open = round(rate.open) ?? round(rate.open_price) ?? round(price - ch);

  const high = round(rate.high) ?? Math.max(price, open);
  const low = round(rate.low) ?? Math.min(price, open);

  return {
    price,
    open,
    high,
    low,
    bid: round(rate.bid) ?? round(price - 0.30),
    ask: round(rate.ask) ?? round(price + 0.30),
    ch,
    chp,
    source: 'Metals.Dev',
    updatedAt: data.timestamp || null,
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
    const result = await fetchMetalsDevPrice();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(result);
  } catch (primaryError) {
    console.error('Metals.Dev failed:', primaryError.message);

    try {
      const fallback = await fetchTwelveDataPrice();

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({
        ...fallback,
        fallback: true,
        primaryError: primaryError.message,
      });
    } catch (fallbackError) {
      console.error('Twelve Data failed:', fallbackError.message);

      return res.status(500).json({
        error: 'Both price APIs failed',
        primary: {
          source: 'Metals.Dev',
          message: primaryError.message,
        },
        fallback: {
          source: 'Twelve Data',
          message: fallbackError.message,
        },
      });
    }
  }
}
