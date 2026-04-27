
const TWELVE_DATA_KEY   = '4bfe15a2ab7a43e89d1c3b86f126aa37';
const ALPHA_VANTAGE_KEY = 'N5ZYQU29IN023LBN';
const GNEWS_KEY = 'fe8c7d413e5dee922d87e0430edf6f98';

/* Shared state — all pages read from this */
window.GOLD_STATE = {
  price: null,
  open:  null,
  high:  null,
  low:   null,
  bid:   null,
  ask:   null,
  ch:    null,
  chp:   null,
  source: null,
};

const DEMO_DATA = {
  price: 3124.80, open: 3110.00, high: 3138.50, low: 3098.20,
  bid: 3124.50, ask: 3125.10, ch: 14.80, chp: 0.48, source: 'Demo'
};

async function fetchFromTwelveData() {
  const url = `https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${TWELVE_DATA_KEY}`;
  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('TD ' + res.status);
  const d = await res.json();
  if (d.status === 'error' || !d.close) throw new Error(d.message || 'TD bad response');
  const price = parseFloat(d.close);
  return {
    price, open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low),
    bid: price - 0.30, ask: price + 0.30,
    ch: parseFloat(d.change), chp: parseFloat(d.percent_change),
    source: 'Twelve Data'
  };
}

async function fetchFromAlphaVantage() {
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${ALPHA_VANTAGE_KEY}`;
  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('AV ' + res.status);
  const d   = await res.json();
  const rate = d['Realtime Currency Exchange Rate'];
  if (!rate) throw new Error('AV bad response');
  const price = parseFloat(rate['5. Exchange Rate']);
  return {
    price, open: price * 0.998, high: price * 1.007, low: price * 0.993,
    bid: price - 0.30, ask: price + 0.30, ch: price * 0.002, chp: 0.20,
    source: 'Alpha Vantage'
  };
}

async function fetchGoldPrice() {
  const tdReady = TWELVE_DATA_KEY   !== 'YOUR_TWELVE_DATA_KEY';
  const avReady = ALPHA_VANTAGE_KEY !== 'YOUR_ALPHA_VANTAGE_KEY';
  try {
    if (tdReady)  return await fetchFromTwelveData();
    if (avReady)  return await fetchFromAlphaVantage();
    return null;
  } catch (e1) {
    console.warn('Primary failed:', e1.message);
    try {
      if (avReady) return await fetchFromAlphaVantage();
    } catch (e2) { console.warn('Fallback failed:', e2.message); }
    return null;
  }
}

/* Shared helper — all pages call this */
async function loadPrice(onData) {
  const noKeys = TWELVE_DATA_KEY === 'YOUR_TWELVE_DATA_KEY' && ALPHA_VANTAGE_KEY === 'YOUR_ALPHA_VANTAGE_KEY';
  const data   = noKeys ? null : await fetchGoldPrice();
  const result = data || DEMO_DATA;
  Object.assign(window.GOLD_STATE, result);
  if (onData) onData(result, !data);
  return result;
}

/* Toast helper — available on every page */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function fmt(v) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Mark active nav link based on current page */
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}
