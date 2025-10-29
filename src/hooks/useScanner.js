import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchQuotes } from '../services/yahooFinance.js';
import { REQUIRED_FLAGS, UNIVERSE } from '../utils/constants.js';
import { extractQuoteFields } from '../utils/quotes.js';

export const useScanner = ({ thresholds, calc, thresholdsKey }) => {
  const [state, setState] = useState({ matches: [], loading: false, error: null, lastUpdated: null });
  const [manualTrigger, setManualTrigger] = useState(0);

  const enabledMarkets = useMemo(
    () => Object.entries(thresholds.marketsEnabled || {})
      .filter(([, enabled]) => enabled)
      .map(([market]) => market),
    [thresholds.marketsEnabled],
  );

  const runScan = useCallback(async () => {
    if (!enabledMarkets.length) {
      setState({ matches: [], loading: false, error: null, lastUpdated: null });
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
      const quotes = await fetchQuotes(symbols, { force: true });
      const matches = symbols.map((symbol) => {
        const quote = quotes[symbol];
        if (!quote) return null;
        const market = symbolToMarket[symbol] || 'US';
        const fields = extractQuoteFields(quote);
        const data = { ticker: symbol, market, ...fields };
        const computed = calc(data, market);
        const flags = computed?.flags || {};
        const passes = REQUIRED_FLAGS.every((flag) => flags[flag]);
        if (!passes) return null;
        return { data, computed };
      }).filter(Boolean);
      matches.sort((a, b) => (b.computed.score || 0) - (a.computed.score || 0));
      setState({ matches, loading: false, error: null, lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, loading: false, error: error?.message || 'Error al escanear universo' }));
    }
  }, [calc, enabledMarkets]);

  useEffect(() => {
    runScan();
  }, [runScan, thresholdsKey]);

  useEffect(() => {
    if (!manualTrigger) return;
    runScan();
  }, [manualTrigger, runScan]);

  useEffect(() => {
    const interval = window.setInterval(runScan, 60_000);
    return () => window.clearInterval(interval);
  }, [runScan]);

  const triggerScan = useCallback(() => {
    setManualTrigger(Date.now());
  }, []);

  return {
    state,
    triggerScan,
  };
};
