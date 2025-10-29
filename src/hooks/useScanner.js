import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchQuotes } from '../services/yahooFinance.js';
import { REQUIRED_FLAGS, UNIVERSE } from '../utils/constants.js';
import { extractQuoteFields } from '../utils/quotes.js';

export const useScanner = ({ thresholds, calc, thresholdsKey }) => {
  const [state, setState] = useState({
    matches: [],
    loading: false,
    error: null,
    lastUpdated: null,
    lastThresholdsKey: null,
  });
  const latestThresholdsKeyRef = useRef(thresholdsKey);
  const lastRequestRef = useRef({ key: thresholdsKey, id: 0 });

  useEffect(() => {
    latestThresholdsKeyRef.current = thresholdsKey;
  }, [thresholdsKey]);

  const enabledMarkets = useMemo(
    () => Object.entries(thresholds.marketsEnabled || {})
      .filter(([, enabled]) => enabled)
      .map(([market]) => market),
    [thresholds.marketsEnabled],
  );

  const runScan = useCallback(async (scanKey = latestThresholdsKeyRef.current) => {
    const requestId = Date.now();
    lastRequestRef.current = { key: scanKey, id: requestId };
    if (!enabledMarkets.length) {
      setState({ matches: [], loading: false, error: null, lastUpdated: null, lastThresholdsKey: scanKey });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const entries = enabledMarkets.flatMap((market) => (UNIVERSE[market] || []).map((symbol) => [symbol.toUpperCase(), market]));
      if (!entries.length) {
        setState({ matches: [], loading: false, error: null, lastUpdated: null });
        return;
      }
      const symbolToMarket = Object.fromEntries(entries);
      const symbols = entries.map(([symbol]) => symbol);
      const { quotes, error: quotesError } = await fetchQuotes(symbols, { force: true });
      const matches = symbols.map((symbol) => {
        const quote = quotes[symbol];
        if (!quote) return null;
        const market = symbolToMarket[symbol] || 'US';
        const fields = extractQuoteFields(quote);
        const data = { ticker: symbol, market, ...fields };
        const computed = calc(data, market);
        const flags = computed?.flags || {};
        const passes = REQUIRED_FLAGS.every((flag) => {
          if (flag === 'shortOK' && flags.shortMissing) return true;
          return Boolean(flags[flag]);
        });
        if (!passes) return null;
        return { data, computed };
      }).filter(Boolean);
      matches.sort((a, b) => (b.computed.score || 0) - (a.computed.score || 0));
      setState({ matches, loading: false, error: quotesError || null, lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error(error);
      const isLatest = lastRequestRef.current.id === requestId && lastRequestRef.current.key === scanKey;
      if (!isLatest) {
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'Error al escanear universo',
        lastThresholdsKey: scanKey,
      }));
    }
  }, [calc, enabledMarkets]);

  useEffect(() => {
    runScan(thresholdsKey);
  }, [runScan, thresholdsKey]);

  useEffect(() => {
    const interval = window.setInterval(runScan, 60_000);
    return () => window.clearInterval(interval);
  }, [runScan]);

  const triggerScan = useCallback(() => {
    runScan(latestThresholdsKeyRef.current);
  }, [runScan]);

  return {
    state,
    triggerScan,
  };
};
