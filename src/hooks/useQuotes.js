import { useEffect, useMemo, useState } from "../vendor/react.js";
import { extractQuoteFields } from "../utils/quotes.js";
import { fetchJson } from "../utils/network.js";

const INTERVAL_MS = 30000;

export const useQuotes = (tickers, { enabled = true, refreshToken } = {}) => {
  const tickersKey = useMemo(() => tickers.filter(Boolean).map((t) => t.toUpperCase()).sort().join(","), [tickers]);
  const [state, setState] = useState({ data: {}, loading: false, error: null, updatedAt: null });

  useEffect(() => {
    if (!enabled || !tickersKey) {
      setState({ data: {}, loading: false, error: null, updatedAt: null });
      return undefined;
    }

    let cancelled = false;
    let activeController = null;

    const run = async () => {
      if (cancelled) return;
      if (activeController) {
        activeController.abort();
      }
      const controller = new AbortController();
      activeController = controller;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const json = await fetchJson(
          `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tickersKey)}`,
          { signal: controller.signal },
        );
        const result = (json?.quoteResponse?.result || []).reduce((acc, quote) => {
          if (quote?.symbol) {
            acc[quote.symbol.toUpperCase()] = extractQuoteFields(quote);
          }
          return acc;
        }, {});
        if (!cancelled) {
          setState({ data: result, loading: false, error: null, updatedAt: new Date().toISOString() });
        }
      } catch (err) {
        if (err?.name === "AbortError" || cancelled) return;
        console.error("Error fetching quotes", err);
        setState((prev) => ({ ...prev, loading: false, error: err?.message || "Error al actualizar datos" }));
      }
    };

    run();
    const interval = window.setInterval(run, INTERVAL_MS);

    return () => {
      cancelled = true;
      if (activeController) activeController.abort();
      window.clearInterval(interval);
    };
  }, [enabled, tickersKey, refreshToken]);

  return {
    quotes: state.data,
    loading: state.loading,
    error: state.error,
    updatedAt: state.updatedAt,
  };
};
