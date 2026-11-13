export interface GoldPrice {
  price: number;
  open: number;
  high: number;
  low: number;
  bid: number;
  ask: number;
  ch: number;
  chp: number;
  source: string;
  updatedAt?: string;
  fallback?: boolean;      // true when Twelve Data failed and Gold-API.com answered
partial?: boolean;       // true when open/high/low/change are unavailable
primaryError?: string;
}

export interface ForecastSignal {
  timeframe: string;
  price: number;
  direction: 'bull' | 'bear' | 'flat' | 'wait';
  confidence: number;
  band?: string;
  reason?: string;
  prediction?: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  category?: string;
  createdAt: { toDate: () => Date };
  published: boolean;
  readTime?: string;
  tags?: string[];
}

export interface UserData {
  email: string;
  phone?: string;
  trialEndsAt?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  manualAccess?: boolean;
  manualAccessExpiresAt?: string;
  role?: string;
}
