export interface PageMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  canonical: string;
  robots?: string;
}

export const pageMeta: Record<string, PageMeta> = {
   '/': {
    title: 'Forecast Realtime Gold and Bitcoin Prices',
    description: 'Real-time XAU/USD gold and BTC/USD bitcoin price predictions, entry signals, market sentiment, and key price levels powered by ATR volatility modelling.',
    ogTitle: 'Gold & Bitcoin Market Analysis',
    ogDescription: 'Real-time algorithmic price predictions for gold and bitcoin with ATR-based volatility models.',
    canonical: 'https://www.xautracker.com',
  },
  '/predict': {
    title: 'XAU/USD Price Forecast & Market Signals — Xautracker.com',
    description: 'Algorithmic XAU/USD gold price predictions for 5m, 10m, 15m, 1h, 6h and 24h. Key levels, sentiment and market signals.',
    ogTitle: 'XAU/USD Forecast — Xautracker.com',
    ogDescription: 'Realistic algorithmic XAU/USD gold price predictions with ATR-based volatility model.',
    canonical: 'https://www.xautracker.com/predict',
  },
  '/predict/bitcoin': {
    title: 'BTC/USD Price Forecast & Market Signals — Xautracker.com',
    description: 'Algorithmic BTC/USD bitcoin price predictions for 5m, 10m, 15m, 1h, 6h and 24h. Key levels, sentiment and market signals.',
    ogTitle: 'BTC/USD Forecast — Xautracker.com',
    ogDescription: 'Realistic algorithmic BTC/USD bitcoin price predictions with ATR-based volatility model.',
    canonical: 'https://www.xautracker.com/predict/bitcoin',
  },
   '/predict/usdchf': {
    title: 'USD/CHF Price Forecast & Market Signals — Xautracker.com',
    description: 'Algorithmic USD/CHF bitcoin price predictions for 5m, 10m, 15m, 1h, 6h and 24h. Key levels, sentiment and market signals.',
    ogTitle: 'USD/CHF Forecast — Xautracker.com',
    ogDescription: 'Realistic algorithmic USDCHF price predictions with ATR-based volatility model.',
    canonical: 'https://www.xautracker.com/predict/usdchf',
  },
  '/minds': {
    title: 'Community Chat',
    description: 'Join the XAU Tracker community. Discuss gold, bitcoin, trading strategies and market analysis with fellow traders.',
    canonical: 'https://www.xautracker.com/minds',
  },
  '/news': {
    title: 'News',
    description: 'Latest gold and bitcoin market news, analysis and updates from trusted sources.',
    canonical: 'https://www.xautracker.com/news',
  },
  '/subscribe': {
    title: 'Subscribe to Pro',
    description: 'Subscribe to XAU Tracker for premium gold and bitcoin price predictions, entry signals and market analysis.',
    canonical: 'https://www.xautracker.com/subscribe',
  },
  '/about': {
    title: 'About Us',
    description: 'Learn about XAU Tracker — algorithmic gold and bitcoin price forecasting powered by ATR volatility modelling.',
    canonical: 'https://www.xautracker.com/about',
  },
  '/contact': {
    title: 'Contact Us',
    description: 'Get in touch with the XAU Tracker team. Support, inquiries and feedback.',
    canonical: 'https://www.xautracker.com/contact',
  },
  '/disclaimer': {
    title: 'Disclaimer',
    description: 'Important legal disclaimer regarding XAU Tracker predictions and trading risks.',
    canonical: 'https://www.xautracker.com/disclaimer',
  },
  '/trends': {
    title: 'Trends — XAU Tracker Price Charts',
    description: 'Interactive gold and bitcoin price charts with technical analysis and historical data.',
    canonical: 'https://www.xautracker.com/trends',
  },
  '/login': {
    title: 'Sign In to your Account',
    description: 'Sign in to your XAU Tracker account to access gold and bitcoin price predictions.',
    canonical: 'https://www.xautracker.com/login',
  },
  '/signup': {
    title: 'Create new Account',
    description: 'Create a free XAU Tracker account to access real-time gold and bitcoin price forecasts.',
    canonical: 'https://www.xautracker.com/signup',
  },
  '/admin': {
    title: 'Admin Dashboard',
    description: 'XAU Tracker administration panel.',
    canonical: 'https://www.xautracker.com/admin',
    robots: 'noindex, nofollow',
  },
  '/post': {
    title: 'Blog — Xautracker.com',
    description: 'Read the latest articles and analysis from XAU Tracker.',
    canonical: 'https://www.xautracker.com/post',
  },
};
