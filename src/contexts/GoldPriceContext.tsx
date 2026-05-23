'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchGoldPrice } from '@/lib/api';
import type { GoldPrice } from '@/types';

interface GoldPriceContextValue {
  price: GoldPrice | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const GoldPriceContext = createContext<GoldPriceContextValue>({
  price: null,
  loading: true,
  refresh: async () => {},
});

export function GoldPriceProvider({ children }: { children: React.ReactNode }) {
  const [price, setPrice] = useState<GoldPrice | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchGoldPrice();
      if (data) setPrice(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <GoldPriceContext.Provider value={{ price, loading, refresh }}>
      {children}
    </GoldPriceContext.Provider>
  );
}

export function useGoldPrice() {
  return useContext(GoldPriceContext);
}
