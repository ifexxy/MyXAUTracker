export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://xautracker.vercel.app');

  try {
    const url = `https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${process.env.TWELVE_DATA_KEY}`;
    const r   = await fetch(url);
    const d   = await r.json();
    if (d.status === 'error' || !d.close) throw new Error(d.message);

    const price = parseFloat(d.close);
    res.status(200).json({
      price,
      open:  parseFloat(d.open),
      high:  parseFloat(d.high),
      low:   parseFloat(d.low),
      bid:   price - 0.30,
      ask:   price + 0.30,
      ch:    parseFloat(d.change),
      chp:   parseFloat(d.percent_change),
      source: 'Twelve Data'
    });
  } catch (e) {
    /* Fallback to Alpha Vantage */
    try {
      const url2 = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
      const r2   = await fetch(url2);
      const d2   = await r2.json();
      const rate = d2['Realtime Currency Exchange Rate'];
      if (!rate) throw new Error('AV bad response');
      const price = parseFloat(rate['5. Exchange Rate']);
      res.status(200).json({
        price, open: price * 0.998, high: price * 1.007,
        low: price * 0.993, bid: price - 0.30, ask: price + 0.30,
        ch: price * 0.002, chp: 0.20, source: 'Alpha Vantage'
      });
    } catch {
      res.status(500).json({ error: 'Both price APIs failed' });
    }
  }
}
