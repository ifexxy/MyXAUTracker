export async function GET() {
  try {
    const url = `https://gnews.io/api/v4/search?q=gold+XAU+USD&lang=en&max=15&sortby=publishedAt&apikey=${process.env.GNEWS_KEY}`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();

    if (!data.articles?.length) {
      throw new Error('No articles');
    }

    return Response.json(data.articles, {
      headers: {
        'Access-Control-Allow-Origin': 'https://xautracker.vercel.app',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
