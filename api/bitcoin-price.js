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
    headers: { Accept: 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }
  return data;
}

async function fetchTwelveDataBtcPrice() {
  if (!process.env.TWELVE_DATA_KEY) {
    throw new Error('Missing TWELVE_DATA_KEY');
  }

  const params = new URLSearchParams({
    symbol: 'BTC/USD',
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
    bid: round(data.bid) ?? round(price * 0.999),
    ask: round(data.ask) ?? round(price * 1.001),
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await fetchTwelveDataBtcPrice();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Bitcoin price API failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
