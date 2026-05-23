/* api/btc-price.js
   ─────────────────────────────────────────────────────────────
   Bitcoin price endpoint for /api/btc-price
   Fallback chain:
     1. Twelve Data  (BTC/USD quote — same key you already have)
     2. CoinGecko    (free, no key required)
     3. Binance      (free public API, no key required)

   All three return the same normalised shape:
   {
     price, open, high, low, bid, ask, ch, chp, source
   }
   ─────────────────────────────────────────────────────────────
*/

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.xautracker.com');
  res.setHeader('Cache-Control', 'no-store');

  /* ── 1. Twelve Data ──────────────────────────────────────── */
  try {
    const url = `https://api.twelvedata.com/quote?symbol=BTC/USD&apikey=${process.env.TWELVE_DATA_KEY}`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const d   = await r.json();

    if (d.status === 'error' || !d.close) throw new Error(d.message || 'No close price');

    const price = parseFloat(d.close);
    const ch    = parseFloat(d.change);
    const chp   = parseFloat(d.percent_change);

    return res.status(200).json({
      price,
      open:   parseFloat(d.open),
      high:   parseFloat(d.high),
      low:    parseFloat(d.low),
      bid:    price - 5,    /* BTC spread is typically $5–$20 */
      ask:    price + 5,
      ch,
      chp,
      source: 'Twelve Data',
    });
  } catch (e) {
    console.warn('[btc-price] Twelve Data failed:', e.message);
  }

  /* ── 2. CoinGecko (free, no key) ────────────────────────── */
  /* Returns current price + 24h change. We derive open from
     price and 24h change since CoinGecko simple price doesn't
     return OHLC. For OHLC we hit the /ohlc endpoint separately. */
  try {
    const [priceRes, ohlcRes] = await Promise.all([
      fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true',
        { signal: AbortSignal.timeout(5000) }
      ),
      fetch(
        'https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=1',
        { signal: AbortSignal.timeout(5000) }
      ),
    ]);

    const priceData = await priceRes.json();
    const ohlcData  = await ohlcRes.json();

    const btc  = priceData?.bitcoin;
    if (!btc?.usd) throw new Error('CoinGecko bad price response');

    const price = btc.usd;
    const chp   = btc.usd_24h_change ?? 0;
    const ch    = parseFloat(((chp / 100) * price).toFixed(2));
    const open  = parseFloat((price - ch).toFixed(2));

    /* Extract high/low from OHLC array — each item: [timestamp, open, high, low, close] */
    let high = price, low = price;
    if (Array.isArray(ohlcData) && ohlcData.length > 0) {
      high = Math.max(...ohlcData.map(c => c[2]));
      low  = Math.min(...ohlcData.map(c => c[3]));
    }

    return res.status(200).json({
      price,
      open,
      high,
      low,
      bid:    price - 8,
      ask:    price + 8,
      ch,
      chp:    parseFloat(chp.toFixed(4)),
      source: 'CoinGecko',
    });
  } catch (e) {
    console.warn('[btc-price] CoinGecko failed:', e.message);
  }

  /* ── 3. Binance public API (no key) ─────────────────────── */
  /* Binance /api/v3/ticker/24hr gives full OHLCV for the day */
  try {
    const r = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT',
      { signal: AbortSignal.timeout(5000) }
    );
    const d = await r.json();

    if (!d.lastPrice) throw new Error('Binance bad response');

    const price = parseFloat(d.lastPrice);
    const open  = parseFloat(d.openPrice);
    const high  = parseFloat(d.highPrice);
    const low   = parseFloat(d.lowPrice);
    const ch    = parseFloat(d.priceChange);
    const chp   = parseFloat(d.priceChangePercent);

    return res.status(200).json({
      price,
      open,
      high,
      low,
      bid:    price - 8,
      ask:    price + 8,
      ch,
      chp,
      source: 'Binance',
    });
  } catch (e) {
    console.warn('[btc-price] Binance failed:', e.message);
  }

  /* ── All failed ─────────────────────────────────────────── */
  return res.status(500).json({ error: 'All BTC price APIs failed' });
}
