import { generateMockQuotes as defaultGenerateMockQuotes } from './mockQuotes.js';
import { logError } from '../utils/logger.js';

const CACHE_TTL = 30_000;
const MAX_SYMBOLS_PER_REQUEST = 50;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 400;
const RATE_LIMIT_STATUS = 429;
const MAX_CONCURRENT_CHUNKS = 2;
const DEFAULT_MARKET_KEY = 'DEFAULT';
const COVERAGE_ALERT_THRESHOLD = 0.8;
const JITTER_FACTOR = 0.3;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT_MS = 60_000;

const cache = new Map(); // `${market}::${symbol}` -> { timestamp, data }

const circuitState = {
  failures: 0,
  openUntil: 0,
};

const getCacheKey = (symbol, market = DEFAULT_MARKET_KEY) => `${market}::${symbol}`;

const resolveMarket = (symbol, marketBySymbol = {}) => {
  if (!symbol) return DEFAULT_MARKET_KEY;
  const direct = marketBySymbol[symbol];
  if (direct) return direct;
  const lowerKey = symbol.toLowerCase();
  const found = Object.entries(marketBySymbol).find(([key]) => key.toLowerCase() === lowerKey);
  return found ? found[1] : DEFAULT_MARKET_KEY;
};

const sanitizeQuote = (quote) => {
  if (!quote || typeof quote !== 'object') {
    return { valid: false, quote: null };
  }
  const symbol = quote.symbol?.toUpperCase?.();
  if (!symbol) {
    return { valid: false, quote: null };
  }
  const criticalFields = ['regularMarketPrice', 'regularMarketVolume'];
  const sanitized = { ...quote, symbol };
  for (const field of criticalFields) {
    const value = sanitized[field];
    if (value === null || value === undefined) {
      return { valid: false, quote: null };
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return { valid: false, quote: null };
    }
    sanitized[field] = numeric;
  }
  return { valid: true, quote: sanitized };
};

const processQueue = async (items, handler, { concurrency = 1 } = {}) => {
  if (!items.length) {
    return [];
  }
  const settled = new Array(items.length);
  let index = 0;
  const runWorker = async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const item = items[currentIndex];
      try {
        const value = await handler(item, currentIndex);
        settled[currentIndex] = { status: 'fulfilled', value };
      } catch (error) {
        settled[currentIndex] = { status: 'rejected', reason: error };
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return settled;
};

const normalizeSymbol = (symbol) => symbol?.toUpperCase().trim();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RateLimitError extends Error {
  constructor(retryAfter) {
    super('Límite de consultas de Yahoo alcanzado');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const getBackoffDelay = (attempt) => {
  const base = BASE_BACKOFF_MS * 2 ** attempt;
  const jitter = base * JITTER_FACTOR * Math.random();
  return base + jitter;
};

const registerFailure = () => {
  circuitState.failures += 1;
  if (circuitState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitState.openUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT_MS;
  }
};

const registerSuccess = () => {
  circuitState.failures = 0;
  circuitState.openUntil = 0;
};

const isCircuitOpen = () => circuitState.openUntil && Date.now() < circuitState.openUntil;

const circuitRemainingMs = () => Math.max(0, circuitState.openUntil - Date.now());

/* eslint-disable no-console */

const fetchChunk = async (symbols, { signal } = {}) => {
  const sortedSymbols = symbols.slice().sort();
  const joined = encodeURIComponent(sortedSymbols.join(','));
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}`;

  let attempt = 0;
  const startedAt = nowMs();
  for (;;) {
    try {
      const response = await fetch(url, { signal });
      if (response.status === RATE_LIMIT_STATUS) {
        const retryAfterHeader = response.headers?.get?.('Retry-After');
        const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
        throw new RateLimitError(Number.isFinite(retryAfter) ? retryAfter : undefined);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      const result = json?.quoteResponse?.result;
      if (!Array.isArray(result)) {
        throw new Error('Respuesta inválida de Yahoo Finance');
      }
      const serialized = JSON.stringify(json || {});
      const payloadSize = serialized.length;
      const duration = Math.max(0, nowMs() - startedAt);
      return { quotes: result, metrics: { duration, payloadSize, attempts: attempt + 1 } };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      if (error instanceof RateLimitError) {
        throw error;
      }
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      const wait = getBackoffDelay(attempt);
      attempt += 1;
      await delay(wait);
    }
  }
};

const logFetchEvent = (level, message, extra = {}) => {
  const payload = { ...extra };
  if (typeof console === 'undefined') return;
  if (level === 'warn' && console.warn) {
    console.warn(`[fetchQuotes] ${message}`, payload);
  } else if (level === 'info' && console.info) {
    console.info(`[fetchQuotes] ${message}`, payload);
  } else if (level === 'debug' && console.debug) {
    console.debug(`[fetchQuotes] ${message}`, payload);
  }
};

export const fetchQuotes = async (
  inputSymbols,
  { force = false, signal, marketBySymbol = {}, mode = 'live', generateMockQuotes } = {},
) => {
  const symbols = Array.from(new Set((inputSymbols || []).map(normalizeSymbol).filter(Boolean)));
  if (!symbols.length) {
    return {
      quotes: {},
      error: null,
      staleSymbols: [],
      invalidSymbols: [],
      coverage: { totalRequested: 0, totalFetched: 0, ratio: 1, alert: false },
    };
  }

  const now = Date.now();
  const freshQuotes = {};
  const missing = [];
  const fallbackBySymbol = {};
  const processedSymbols = new Set();

  const cacheHits = [];

  symbols.forEach((symbol) => {
    const market = resolveMarket(symbol, marketBySymbol);
    const cacheKey = getCacheKey(symbol, market);
    const cached = cache.get(cacheKey);
    if (cached) {
      fallbackBySymbol[symbol] = cached.data;
    }
    if (!force && cached && now - cached.timestamp <= CACHE_TTL) {
      freshQuotes[symbol] = cached.data;
      processedSymbols.add(symbol);
      cacheHits.push(symbol);
    } else {
      missing.push(symbol);
    }
  });

  if (cacheHits.length) {
    logFetchEvent('info', 'cache-hit', { symbols: cacheHits });
  }

  const staleSymbols = new Set();
  const invalidSymbols = new Set();
  const failedSymbols = [];
  let rateLimitHit = false;
  let suggestedRetrySeconds;
  let circuitTriggered = false;

  if (missing.length && isCircuitOpen()) {
    circuitTriggered = true;
  }

  const handleFallback = (symbol, reason) => {
    const fallback = fallbackBySymbol[symbol];
    if (fallback) {
      freshQuotes[symbol] = { ...fallback };
      processedSymbols.add(symbol);
      staleSymbols.add(symbol);
      logFetchEvent('warn', 'using-fallback', { symbol, reason });
    } else {
      logFetchEvent('warn', 'fallback-unavailable', { symbol, reason });
    }
  };

  if (mode === 'mock' && missing.length) {
    const generator = typeof generateMockQuotes === 'function' ? generateMockQuotes : defaultGenerateMockQuotes;
    if (!generator) {
      logFetchEvent('warn', 'mock-generator-missing');
    }
    if (generator) {
      try {
        const mocked = await generator(missing, { marketBySymbol });
        missing.forEach((symbol) => {
          const quote = mocked?.[symbol];
          if (!quote) {
            invalidSymbols.add(symbol);
            handleFallback(symbol, 'mock-missing');
            return;
          }
          const { valid, quote: sanitized } = sanitizeQuote({ ...quote, symbol });
          if (!valid) {
            invalidSymbols.add(symbol);
            handleFallback(symbol, 'mock-invalid');
            return;
          }
          const market = resolveMarket(symbol, marketBySymbol);
          const cacheKey = getCacheKey(symbol, market);
          cache.set(cacheKey, { timestamp: Date.now(), data: sanitized });
          freshQuotes[symbol] = sanitized;
          processedSymbols.add(symbol);
        });
        registerSuccess();
        logFetchEvent('info', 'mock-success', { symbols: missing });
      } catch (error) {
        logError('fetchQuotes.mock', error, { symbols: missing });
        failedSymbols.push(...missing);
        missing.forEach((symbol) => {
          handleFallback(symbol, 'mock-error');
        });
      }
    }
  } else if (missing.length && !circuitTriggered) {
    const chunkTasks = [];
    for (let i = 0; i < missing.length; i += MAX_SYMBOLS_PER_REQUEST) {
      const chunk = missing.slice(i, i + MAX_SYMBOLS_PER_REQUEST);
      if (chunk.length) {
        chunkTasks.push(chunk);
      }
    }
    const settled = await processQueue(
      chunkTasks,
      (chunk) => fetchChunk(chunk, { signal }),
      { concurrency: MAX_CONCURRENT_CHUNKS },
    );

    let anySuccess = false;

    settled.forEach((result, index) => {
      const chunkSymbols = chunkTasks[index];
      if (result?.status === 'fulfilled') {
        anySuccess = true;
        const found = new Set();
        const { quotes: rawQuotes, metrics } = result.value;
        logFetchEvent('info', 'chunk-success', {
          symbols: chunkSymbols,
          attempts: metrics?.attempts,
          durationMs: metrics?.duration,
          payloadSize: metrics?.payloadSize,
        });
        rawQuotes.forEach((rawQuote) => {
          const symbol = normalizeSymbol(rawQuote?.symbol);
          if (!symbol) {
            return;
          }
          found.add(symbol);
          const { valid, quote } = sanitizeQuote(rawQuote);
          if (!valid) {
            invalidSymbols.add(symbol);
            handleFallback(symbol, 'live-invalid');
            return;
          }
          const market = resolveMarket(symbol, marketBySymbol);
          const cacheKey = getCacheKey(symbol, market);
          cache.set(cacheKey, { timestamp: Date.now(), data: quote });
          freshQuotes[symbol] = quote;
          processedSymbols.add(symbol);
        });
        chunkSymbols.forEach((symbol) => {
          if (!found.has(symbol)) {
            failedSymbols.push(symbol);
            handleFallback(symbol, 'live-missing');
          }
        });
      } else {
        failedSymbols.push(...chunkSymbols);
        const reason = result?.reason;
        if (reason instanceof RateLimitError) {
          rateLimitHit = true;
          suggestedRetrySeconds = reason.retryAfter;
          registerFailure();
          logError('fetchQuotes.rateLimit', reason, { symbols: chunkSymbols, retryAfter: reason.retryAfter });
        } else if (reason?.name === 'AbortError') {
          // caller cancelled
        } else {
          registerFailure();
          if (reason) {
            logError('fetchQuotes.chunk', reason, { symbols: chunkSymbols });
          }
        }
        chunkSymbols.forEach((symbol) => {
          handleFallback(symbol, reason instanceof RateLimitError ? 'rate-limit' : reason?.name || 'live-error');
        });
      }
    });

    if (anySuccess) {
      registerSuccess();
    } else {
      logFetchEvent('warn', 'live-misses-all', { symbols: missing });
    }
  } else if (missing.length && circuitTriggered) {
    logFetchEvent('warn', 'circuit-open', { symbols: missing, reopenInMs: circuitRemainingMs() });
    missing.forEach((symbol) => {
      handleFallback(symbol, 'circuit');
    });
  }

  const missingAfter = symbols.filter((symbol) => !freshQuotes[symbol]);
  const uniqueFailed = Array.from(new Set(failedSymbols));
  const uniqueMissing = Array.from(new Set(missingAfter));
  const uniqueInvalid = Array.from(invalidSymbols);

  const coverageRatio = symbols.length ? processedSymbols.size / symbols.length : 1;
  const coverage = {
    totalRequested: symbols.length,
    totalFetched: processedSymbols.size,
    ratio: coverageRatio,
    alert: coverageRatio < COVERAGE_ALERT_THRESHOLD,
  };

  let errorMessage = null;
  if (rateLimitHit) {
    const waitMessage = suggestedRetrySeconds
      ? `Intenta nuevamente en ${suggestedRetrySeconds} segundos.`
      : 'Intenta nuevamente más tarde.';
    errorMessage = `Yahoo limitó las consultas. ${waitMessage}`;
  } else if (uniqueFailed.length && !uniqueInvalid.length) {
    const list = uniqueFailed.join(', ');
    errorMessage = `No se pudo actualizar ${uniqueFailed.length === 1 ? 'el símbolo' : 'los símbolos'} ${list}.`;
  }

  if (!errorMessage && uniqueInvalid.length) {
    errorMessage = `Datos incompletos para ${uniqueInvalid.join(', ')}. Se mantienen datos previos si están disponibles.`;
  } else if (!errorMessage && coverage.alert) {
    errorMessage = 'Cobertura baja en la actualización. Algunos tickers no pudieron refrescarse.';
  }

  if (circuitTriggered && !rateLimitHit) {
    registerFailure();
    if (!errorMessage) {
      const wait = Math.ceil(circuitRemainingMs() / 1000);
      errorMessage = `Servicio temporalmente limitado. Intentaremos nuevamente en ${wait} segundos.`;
    }
  }

  return {
    quotes: freshQuotes,
    error: errorMessage,
    staleSymbols: Array.from(staleSymbols),
    invalidSymbols: uniqueInvalid,
    coverage,
  };
};

export const clearCache = () => {
  cache.clear();
  circuitState.failures = 0;
  circuitState.openUntil = 0;
};
