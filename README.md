# XAU Tracker

Real-time algorithmic price predictions for **XAU/USD (Gold)** and **BTC/USD (Bitcoin)** using ATR-based volatility modelling.

## Features

- **Gold Predict** — Entry signals and price forecasts for 10m, 1h, 4h and 24h timeframes using the ATR × √(t/1440) model
- **Bitcoin Predict** — Same ATR-based prediction engine for BTC/USD
- **Market Signals** — Real-time buy/hold/sell sentiment gauges
- **Key Price Levels** — Pivot-point based support and resistance levels
- **TradingView Charts** — Embedded advanced chart widgets
- **Live Price Strip** — Streaming bid/ask with daily change and ATR
- **Session Tracking** — Asian, London, New York session indicators with volatility multipliers
- **Account Dashboard** — Trial/subscription access management with Firebase auth

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Firebase** (Auth + Firestore)
- **Tailwind CSS** + custom CSS variables (light/dark themes)
- **TwelveData / Metals.dev** — price APIs
- **TradingView** — embedded charts

## Getting Started

```bash
npm install
npm run dev
```


## Project Structure

```
src/
  app/            — Route pages and layouts
  components/     — Shared React components
  contexts/       — Auth, GoldPrice, Theme providers
  lib/            — API helpers, Firebase init, SEO config
  types/          — TypeScript interfaces
api/              — Serverless API routes (price, news, payment)
```

## Routes

| Path | Description |
|---|---|
| `/` | Homepage |
| `/predict` | Gold XAU/USD forecast |
| `/predict/bitcoin` | Bitcoin BTC/USD forecast |
| `/minds` | Community chat |
| `/news` | Market news |
| `/trends` | Price charts |
| `/subscribe` | Premium subscription |
| `/about` | About |
| `/contact` | Contact |
| `/disclaimer` | Legal disclaimer |
| `/login` / `/signup` | Authentication |
| `/admin` | Admin panel |
