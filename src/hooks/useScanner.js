import { useEffect, useMemo, useState } from "../vendor/react.js";
import { REQUIRED_FLAGS, UNIVERSE } from "../constants.js";
import { fetchJson } from "../utils/network.js";
import { extractQuoteFields } from "../utils/quotes.js";
import { calcScore } from "../utils/calc.js";

const CHUNK_SIZE = 25;
const INTERVAL_MS = 60000;

export const useScanner = (thresholds, { enabled = true, token } = {}) => {
  const enabledMarkets = useMemo(
    () => Object.entries(thresholds.marketsEnabled || {})
      .filter(([, isEnabled]) => isEnabled)
      .map(([market]) => market),
    [thresholds.marketsEnabled],
  );

  const entries = useMemo(() => {
    if (!enabledMarkets.length) return [];
    return enabledMarkets.flatMap((market) => (UNIVERSE[market] || []).map((symbol) => [symbol.toUpperCase(), market]));
  }, [enabledMarkets]);

  const [state, setState] = useState({ matches: [], loading: false, error: null, lastUpdated: null });

  useEffect(() => {
    if (!enabled || !entries.length) {
      setState({ matches: [], loading: false, error: null, lastUpdated: null });
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
        const symbolToMarket = Object.fromEntries(entries);
        const symbols = entries.map(([symbol]) => symbol);
        const quotes = {};
        for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
          if (cancelled) return;
          const chunk = symbols.slice(i, i + CHUNK_SIZE);
          if (!chunk.length) continue;
          const json = await fetchJson(
            `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(","))}`,
            { signal: controller.signal },
          );
          (json?.quoteResponse?.result || []).forEach((quote) => {
            if (quote?.symbol) {
              quotes[quote.symbol.toUpperCase()] = extractQuoteFields(quote);
            }
          });
        }
        if (cancelled) return;
        const matches = symbols.map((symbol) => {
          const key = symbol.toUpperCase();
          const market = symbolToMarket[key] || "US";
          const fields = quotes[key];
          if (!fields) return null;
          const computed = calcScore({ ticker: key, market, ...fields }, thresholds, market);
          const passes = REQUIRED_FLAGS.every((flag) => computed.flags[flag]);
          if (!passes) return null;
          return { data: { ticker: key, market, ...fields }, computed };
        }).filter(Boolean);
        matches.sort((a, b) => (b.computed.score || 0) - (a.computed.score || 0));
        setState({ matches, loading: false, error: null, lastUpdated: new Date().toISOString() });
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        console.error("Error scanning universe", err);
        setState((prev) => ({ ...prev, loading: false, error: err?.message || "Error al escanear universo" }));
      }
    };

    run();
    const interval = window.setInterval(run, INTERVAL_MS);
    return () => {
      cancelled = true;
      if (activeController) {
        activeController.abort();
      }
      window.clearInterval(interval);
    };
  }, [enabled, entries, thresholds, token]);

  return state;
};
