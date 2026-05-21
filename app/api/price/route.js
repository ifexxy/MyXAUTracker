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
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  return data;
}

async function fetchMetalsDevPrice() {
  if (!process.env.METALS_DEV_KEY) throw new Error('Missing METALS_DEV_KEY');

  const params = new URLSearchParams({ api_key: process.env.METALS_DEV_KEY, metal: 'gold', currency: 'USD' });
  const data = await fetchJson(`https://api.metals.dev/v1/metal/spot?${params}`);

  if (data?.status !== 'success' || !data?.rate) throw new Error('Bad Metals.Dev response');

  const rate = data.rate;
  const price = round(rate.price);
  if (price === null) throw new Error('Metals.Dev did not return a valid price');

  const ch = round(rate.change) ?? 0;
  const open = round(rate.open) ?? round(rate.open_price) ?? round(price - ch);

  return {
    price,
    open,
    high: round(rate.high) ?? Math.max(price, open),
    low: round(rate.low) ?? Math.min(price, open),
    bid: round(rate.bid) ?? round(price - 0.3),
    ask: round(rate.ask) ?? round(price + 0.3),
    ch,
    chp: round(rate.change_percent) ?? 0,
    source: 'Metals.Dev',
    updatedAt: data.timestamp || null,
  };
}

async function fetchTwelveDataPrice() {
  if (!process.env.TWELVE_DATA_KEY) throw new Error('Missing TWELVE_DATA_KEY');

  const params = new URLSearchParams({ symbol: 'XAU/USD', apikey: process.env.TWELVE_DATA_KEY });
  const data = await fetchJson(`https://api.twelvedata.com/quote?${params}`);

  if (data?.status === 'error' || !data?.close) throw new Error(data?.message || 'Bad Twelve Data response');

  const price = round(data.close);

  return {
    price,
    open: round(data.open),
    high: round(data.high),
    low: round(data.low),
    bid: round(data.bid) ?? round(price - 0.3),
    ask: round(data.ask) ?? round(price + 0.3),
    ch: round(data.change),
    chp: round(data.percent_change),
    source: 'Twelve Data',
  };
}

export async function GET() {
  try {
    const result = await fetchMetalsDevPrice();
    return Response.json(result, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } });
  } catch (primaryError) {
    try {
      const fallback = await fetchTwelveDataPrice();
      return Response.json({ ...fallback, fallback: true, primaryError: primaryError.message }, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } });
    } catch (fallbackError) {
      return Response.json({
        error: 'Both price APIs failed',
        primary: { source: 'Metals.Dev', message: primaryError.message },
        fallback: { source: 'Twelve Data', message: fallbackError.message },
      }, { status: 500 });
    }
  }
}
