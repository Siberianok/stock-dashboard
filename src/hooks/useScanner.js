import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchQuotes } from '../services/yahooFinance.js';
import { REQUIRED_FLAGS, UNIVERSE } from '../utils/constants.js';
import { extractQuoteFields } from '../utils/quotes.js';
import { logError } from '../utils/logger.js';

const isBrowser = typeof window !== 'undefined';

export const scanUniverse = async ({ enabledMarkets, calc, fetcher, coverageThreshold = 0.8 }) => {
  const entries = enabledMarkets.flatMap((market) => (UNIVERSE[market] || []).map((symbol) => [symbol.toUpperCase(), market]));
  if (!entries.length) {
    return {
      matches: [],
      error: null,
      coverage: { totalRequested: 0, totalFetched: 0, ratio: 1, alert: false },
    };
  }
  const symbolToMarket = Object.fromEntries(entries);
  const symbols = entries.map(([symbol]) => symbol);
  const { quotes, error: quotesError, coverage: fetchCoverage } = await fetcher(symbols, {
    force: true,
    marketBySymbol: symbolToMarket,
  });
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
  const coverage = fetchCoverage || {
    totalRequested: symbols.length,
    totalFetched: matches.length,
    ratio: symbols.length ? matches.length / symbols.length : 1,
    alert: false,
  };
  const normalizedCoverage = {
    ...coverage,
    alert: coverage.ratio < coverageThreshold,
  };
  return { matches, error: quotesError || null, coverage: normalizedCoverage };
};

export const useScanner = ({ thresholds, calc, thresholdsKey, mode = 'live', coverageThreshold = 0.8 }) => {
  const [state, setState] = useState({
    matches: [],
    loading: false,
    error: null,
    lastUpdated: null,
    lastThresholdsKey: null,
    coverage: { totalRequested: 0, totalFetched: 0, ratio: 1, alert: false },
  });
  const latestThresholdsKeyRef = useRef(thresholdsKey);
  const lastRequestRef = useRef({ key: thresholdsKey, id: 0 });
  const abortRef = useRef(null);

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
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (!enabledMarkets.length) {
      setState({
        matches: [],
        loading: false,
        error: null,
        lastUpdated: null,
        lastThresholdsKey: scanKey,
        coverage: { totalRequested: 0, totalFetched: 0, ratio: 1, alert: false },
      });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null, lastThresholdsKey: scanKey }));
    let controller;
    try {
      const entries = enabledMarkets.flatMap((market) => (UNIVERSE[market] || []).map((symbol) => [symbol.toUpperCase(), market]));
      if (!entries.length) {
        setState({
          matches: [],
          loading: false,
          error: null,
          lastUpdated: null,
          lastThresholdsKey: scanKey,
          coverage: { totalRequested: 0, totalFetched: 0, ratio: 1, alert: false },
        });
        return;
      }
      const symbolToMarket = Object.fromEntries(entries);
      const symbols = entries.map(([symbol]) => symbol);
      controller = new AbortController();
      abortRef.current = controller;
      const { quotes, error: quotesError, coverage: quotesCoverage } = await fetchQuotes(symbols, {
        force: true,
        signal: controller.signal,
        marketBySymbol: symbolToMarket,
        mode,
      });
      const isLatest = lastRequestRef.current.id === requestId && lastRequestRef.current.key === scanKey;
      if (!isLatest) {
        controller.abort();
        return;
      }
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
      const coverage = quotesCoverage || {
        totalRequested: symbols.length,
        totalFetched: matches.length,
        ratio: symbols.length ? matches.length / symbols.length : 1,
        alert: false,
      };
      const normalizedCoverage = {
        ...coverage,
        alert: coverage.ratio < coverageThreshold,
      };
      setState({
        matches,
        loading: false,
        error: quotesError || null,
        lastUpdated: new Date().toISOString(),
        lastThresholdsKey: scanKey,
        coverage: normalizedCoverage,
      });
    } catch (error) {
      logError('scanner.fetch', error);
      const isLatest = lastRequestRef.current.id === requestId && lastRequestRef.current.key === scanKey;
      if (!isLatest) {
        controller.abort();
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'Error al escanear universo',
        lastThresholdsKey: scanKey,
        coverage: prev.coverage || { totalRequested: 0, totalFetched: 0, ratio: 1, alert: false },
      }));
    } finally {
      if (controller && abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [calc, enabledMarkets, coverageThreshold, mode]);

  useEffect(() => {
    runScan(thresholdsKey);
  }, [runScan, thresholdsKey, mode]);

  useEffect(() => {
    if (!isBrowser) return () => {};
    const interval = window.setInterval(runScan, 60_000);
    return () => window.clearInterval(interval);
  }, [runScan]);

  const triggerScan = useCallback(() => {
    runScan(latestThresholdsKeyRef.current);
  }, [runScan]);

  useEffect(() => () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return {
    state,
    triggerScan,
  };
};
