export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://xautracker.vercel.app');

  try {
    const url  = `https://gnews.io/api/v4/search?q=gold+XAU+USD&lang=en&max=15&sortby=publishedAt&apikey=${process.env.GNEWS_KEY}`;
    const r    = await fetch(url);
    const data = await r.json();
    if (!data.articles?.length) throw new Error('No articles');
    res.status(200).json(data.articles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
