const ALLOWED_ORIGINS = new Set([
  'https://www.xautracker.com',
  'https://xautracker.com',
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.xautracker.com');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function toNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function roundPrice(value) {
  const num = toNumber(value);
  return num === null ? null : Number(num.toFixed(2));
}

function makeSyntheticFields(price) {
  return {
    open: roundPrice(price * 0.998),
    high: roundPrice(price * 1.007),
    low: roundPrice(price * 0.993),
    bid: roundPrice(price - 0.30),
    ask: roundPrice(price + 0.30),
    ch: roundPrice(price * 0.002),
    chp: 0.20,
  };
}

function normalizeGoldApiResponse(data) {
  const price = roundPrice(
    data?.price ??
    data?.close ??
    data?.rate ??
    data?.value
  );

  if (price === null) {
    throw new Error('Gold API response did not include a valid price');
  }

  const synthetic = makeSyntheticFields(price);

  return {
    price,
    open: roundPrice(data?.open ?? data?.open_price) ?? synthetic.open,
    high: roundPrice(data?.high ?? data?.high_price) ?? synthetic.high,
    low: roundPrice(data?.low ?? data?.low_price) ?? synthetic.low,
    bid: roundPrice(data?.bid) ?? synthetic.bid,
    ask: roundPrice(data?.ask) ?? synthetic.ask,
    ch: roundPrice(data?.ch ?? data?.change) ?? synthetic.ch,
    chp: roundPrice(data?.chp ?? data?.percent_change ?? data?.change_percent) ?? synthetic.chp,
    source: 'Gold API',
    updatedAt: data?.updatedAt ?? data?.updated_at ?? data?.timestamp ?? null,
  };
}

function normalizeTwelveDataResponse(data) {
  if (data?.status === 'error') {
    throw new Error(data?.message || 'Twelve Data returned an error');
  }

  const price = roundPrice(data?.close);

  if (price === null) {
    throw new Error('Twelve Data response did not include a valid close price');
  }

  return {
    price,
    open: roundPrice(data?.open) ?? roundPrice(price * 0.998),
    high: roundPrice(data?.high) ?? roundPrice(price * 1.007),
    low: roundPrice(data?.low) ?? roundPrice(price * 0.993),
    bid: roundPrice(data?.bid) ?? roundPrice(price - 0.30),
    ask: roundPrice(data?.ask) ?? roundPrice(price + 0.30),
    ch: roundPrice(data?.change) ?? roundPrice(price * 0.002),
    chp: roundPrice(data?.percent_change) ?? 0.20,
    source: 'Twelve Data',
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Bad JSON from ${url}`);
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.errors?.[0]?.message ||
      `HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

async function getGoldApiPrice() {
  const headers = {};

  if (process.env.GOLD_API_KEY) {
    headers['x-api-key'] = process.env.GOLD_API_KEY;
  }

  if (process.env.GOLD_API_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GOLD_API_BEARER_TOKEN}`;
  }

  const data = await fetchJson('https://api.gold-api.com/price/XAU', {
    headers,
  });

  return normalizeGoldApiResponse(data);
}

async function getTwelveDataPrice() {
  if (!process.env.TWELVE_DATA_KEY) {
    throw new Error('Missing TWELVE_DATA_KEY');
  }

  const params = new URLSearchParams({
    symbol: 'XAU/USD',
    apikey: process.env.TWELVE_DATA_KEY,
  });

  const data = await fetchJson(`https://api.twelvedata.com/quote?${params}`);

  return normalizeTwelveDataResponse(data);
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const result = await getGoldApiPrice();

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json(result);
  } catch (goldApiError) {
    console.error('Gold API failed:', goldApiError.message);

    try {
      const fallback = await getTwelveDataPrice();

      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
      return res.status(200).json({
        ...fallback,
        fallback: true,
        primaryError: goldApiError.message,
      });
    } catch (twelveDataError) {
      console.error('Twelve Data fallback failed:', twelveDataError.message);

      return res.status(500).json({
        error: 'Both price APIs failed',
        primary: {
          source: 'Gold API',
          message: goldApiError.message,
        },
        fallback: {
          source: 'Twelve Data',
          message: twelveDataError.message,
        },
      });
    }
  }
}
