


window.GOLD_STATE = {
  price: null, open: null, high: null, low: null,
  bid: null, ask: null, ch: null, chp: null, source: null,
};

const DEMO_DATA = {
  price: 3124.80, open: 3110.00, high: 3138.50, low: 3098.20,
  bid: 3124.50, ask: 3125.10, ch: 14.80, chp: 0.48, source: 'Demo'
};

async function fetchGoldPrice() {
  const res = await fetch('/api/price');
  if (!res.ok) throw new Error('price API ' + res.status);
  return res.json();
}

async function loadPrice(onData) {
  try {
    const data = await fetchGoldPrice();
    Object.assign(window.GOLD_STATE, data);
    if (onData) onData(data, false);
    return data;
  } catch (e) {
    console.warn('Price fetch failed:', e.message);
    Object.assign(window.GOLD_STATE, DEMO_DATA);
    if (onData) onData(DEMO_DATA, true);
    return DEMO_DATA;
  }
}

/* Used in news.html */
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

function fmt(v) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}
