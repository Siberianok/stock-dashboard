import { useEffect, useMemo, useState } from 'react';
import { fetchMarketsConfig, getCachedMarkets } from '../services/marketConfig.js';

const normalizeEntries = (markets) => Object.entries(markets || {});

export function useMarkets() {
  const [markets, setMarkets] = useState(() => getCachedMarkets());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchMarketsConfig({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setMarkets(data);
        setError(null);
      })
      .catch((err) => {
        if (!active && err?.name === 'AbortError') return;
        console.error('No se pudo cargar la configuración de mercados', err);
        if (active) {
          setMarkets(getCachedMarkets());
          setError('No se pudieron cargar los mercados remotos. Se usa la configuración local.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const marketEntries = useMemo(() => normalizeEntries(markets), [markets]);

  return {
    markets,
    marketEntries,
    loading,
    error,
  };
}
