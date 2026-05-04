export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://xautracker.vercel.app');

  /* ── Primary: Finnhub ── */
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=OANDA:XAU_USD&token=${process.env.FINNHUB_KEY}`;
    const r   = await fetch(url);
    const d   = await r.json();

    if (!d.c || d.c === 0) throw new Error('Finnhub returned no price');

    const price = parseFloat(d.c);   /* c = current price */
    const open  = parseFloat(d.o);   /* o = open price    */
    const high  = parseFloat(d.h);   /* h = day high      */
    const low   = parseFloat(d.l);   /* l = day low       */
    const prev  = parseFloat(d.pc);  /* pc = prev close   */
    const ch    = parseFloat((price - prev).toFixed(2));
    const chp   = parseFloat(((ch / prev) * 100).toFixed(2));

    return res.status(200).json({
      price,
      open,
      high,
      low,
      bid:    price - 0.30,
      ask:    price + 0.30,
      ch,
      chp,
      source: 'Finnhub'
    });

  } catch (e) {
    console.warn('Finnhub failed:', e.message);
  }

  /* ── Fallback: Alpha Vantage ── */
  try {
    const url2 = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
    const r2   = await fetch(url2);
    const d2   = await r2.json();
    const rate = d2['Realtime Currency Exchange Rate'];
    if (!rate) throw new Error('Alpha Vantage bad response');

    const price = parseFloat(rate['5. Exchange Rate']);
    return res.status(200).json({
      price,
      open:   price * 0.998,
      high:   price * 1.007,
      low:    price * 0.993,
      bid:    price - 0.30,
      ask:    price + 0.30,
      ch:     price * 0.002,
      chp:    0.20,
      source: 'Alpha Vantage'
    });

  } catch (e) {
    console.warn('Alpha Vantage failed:', e.message);
  }

  return res.status(500).json({ error: 'Both price APIs failed' });
        }
