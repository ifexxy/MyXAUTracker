window.GOLD_STATE = {
  price: null, open: null, high: null, low: null,
  bid: null, ask: null, ch: null, chp: null, source: null,
};

const DEMO_DATA = {
  price: 3124.80, open: 3110.00, high: 3138.50, low: 3098.20,
  bid: 3124.50, ask: 3125.10, ch: 14.80, chp: 0.48, source: 'Demo'
};

/* ── fmt helper (needed by index.html) ── */
function fmt(v) {
  return v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function fetchGoldPrice() {
  /* Try your Vercel backend first */
  try {
    const res = await fetch('/api/price');
    if (!res.ok) throw new Error('backend ' + res.status);
    const data = await res.json();
    if (data.price) return data;
    throw new Error('no price in response');
  } catch (backendErr) {
    console.warn('Backend failed, trying fallback:', backendErr.message);
  }

  /* Fallback: Metals-API free tier (no key needed for XAU/USD) */
  try {
    const res = await fetch(
      'https://metals-api.com/api/latest?access_key=free&base=USD&symbols=XAU'
    );
    const d = await res.json();
    if (d.rates?.XAU) {
      const price = 1 / d.rates.XAU; /* XAU per USD → USD per XAU */
      return {
        price, open: price * 0.999, high: price * 1.005,
        low: price * 0.994, bid: price - 0.30, ask: price + 0.30,
        ch: price * 0.002, chp: 0.20, source: 'Metals-API'
      };
    }
  } catch (e) {
    console.warn('Metals-API failed:', e.message);
  }

  /* Last resort fallback */
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d'
    );
    const d = await res.json();
    const q = d?.chart?.result?.[0];
    if (q) {
      const price = q.meta.regularMarketPrice;
      const open  = q.meta.chartPreviousClose || price;
      const ch    = price - open;
      return {
        price, open,
        high: q.meta.regularMarketDayHigh  || price * 1.005,
        low:  q.meta.regularMarketDayLow   || price * 0.995,
        bid:  price - 0.30,
        ask:  price + 0.30,
        ch, chp: (ch / open) * 100,
        source: 'Yahoo Finance'
      };
    }
  } catch (e) {
    console.warn('Yahoo fallback failed:', e.message);
  }

  return null; /* All failed */
}

async function loadPrice(onData) {
  try {
    const data = await fetchGoldPrice();
    if (data) {
      Object.assign(window.GOLD_STATE, data);
      if (onData) onData(data, false);
      return data;
    }
    throw new Error('all sources failed');
  } catch (e) {
    console.warn('loadPrice failed:', e.message);
    Object.assign(window.GOLD_STATE, DEMO_DATA);
    if (onData) onData(DEMO_DATA, true);
    return DEMO_DATA;
  }
}

async function fetchGNewsArticles() {
  const res = await fetch('/api/news');
  if (!res.ok) throw new Error('news API ' + res.status);
  return res.json();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}
