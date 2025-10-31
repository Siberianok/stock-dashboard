import { logError } from '../utils/logger.js';
import { recordMetric } from '../utils/metrics.js';
import { createSharedAbortController } from './requestCoordinator.js';

const CACHE_TTL = 30_000;
const MAX_SYMBOLS_PER_REQUEST = 50;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 400;
const RATE_LIMIT_STATUS = 429;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT_MS = 30_000;
const JITTER_FACTOR = 0.2;

const circuitState = {
  failures: 0,
  openUntil: 0,
};

const cache = new Map(); // symbol -> { timestamp, data }

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
      let json;
      try {
        json = await response.json();
      } catch (error) {
        throw new Error('Respuesta inválida de Yahoo Finance');
      }
      const serialized = JSON.stringify(json || {});
      const payloadSize = serialized.length;
      const result = json?.quoteResponse?.result || [];
      const duration = Math.max(0, nowMs() - startedAt);
      result.forEach((quote) => {
        if (quote?.symbol) {
          cache.set(quote.symbol.toUpperCase(), { timestamp: Date.now(), data: quote });
        }
      });
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

export const fetchQuotes = async (inputSymbols, { force = false, signal, requestKey = 'quotes' } = {}) => {
  const symbols = Array.from(new Set((inputSymbols || []).map(normalizeSymbol).filter(Boolean)));
  if (!symbols.length) {
    return { quotes: {}, error: null, staleSymbols: [] };
  }

  const sharedContext = createSharedAbortController(`fetchQuotes:${requestKey}`, signal);
  const requestStart = nowMs();

  let cacheHits = 0;
  let networkHits = 0;
  let fallbackHits = 0;

  try {
    const now = Date.now();
    const freshQuotes = {};
    const missing = [];
    const fallbackBySymbol = {};

    symbols.forEach((symbol) => {
      const cached = cache.get(symbol);
      if (!force && cached && now - cached.timestamp <= CACHE_TTL) {
        freshQuotes[symbol] = cached.data;
        cacheHits += 1;
      } else {
        if (cached?.data) {
          fallbackBySymbol[symbol] = cached.data;
        }
        missing.push(symbol);
      }
    });

    const chunkTasks = [];
    const metricsByChunk = [];
    const staleSymbols = new Set();

    let circuitTriggered = false;
    let rateLimitHit = false;
    let suggestedRetrySeconds;
    let circuitMessage = null;

    if (missing.length && isCircuitOpen()) {
      circuitTriggered = true;
      circuitMessage = 'Consultas suspendidas temporalmente por errores previos. Se muestran datos en caché.';
      logError('fetchQuotes.circuit', new Error('Circuit breaker abierto'), {
        remainingMs: circuitRemainingMs(),
        symbols: missing,
        requestKey,
      });
      registerFailure();
    } else {
      for (let i = 0; i < missing.length; i += MAX_SYMBOLS_PER_REQUEST) {
        const chunk = missing.slice(i, i + MAX_SYMBOLS_PER_REQUEST);
        if (chunk.length) {
          chunkTasks.push({
            symbols: chunk,
            promise: fetchChunk(chunk, { signal: sharedContext.signal }),
          });
        }
      }
    }

    const failedSymbols = [];

    if (!circuitTriggered && chunkTasks.length) {
      const settled = await Promise.allSettled(chunkTasks.map((task) => task.promise));
      settled.forEach((result, index) => {
        const { symbols: chunkSymbols } = chunkTasks[index];
        if (result.status === 'fulfilled') {
          const { quotes: chunkQuotes, metrics } = result.value;
          metricsByChunk.push(metrics);
          chunkQuotes.forEach((quote) => {
            if (quote?.symbol) {
              freshQuotes[quote.symbol.toUpperCase()] = quote;
              networkHits += 1;
            }
          });
        } else {
          failedSymbols.push(...chunkSymbols);
          const reason = result.reason;
          if (reason instanceof RateLimitError) {
            rateLimitHit = true;
            if (Number.isFinite(reason.retryAfter)) {
              suggestedRetrySeconds = reason.retryAfter;
            }
          } else if (reason?.name !== 'AbortError') {
            logError('fetchQuotes.chunk', reason, { symbols: chunkSymbols, requestKey });
          }
          chunkSymbols.forEach((symbol) => {
            const fallback = fallbackBySymbol[symbol];
            if (fallback) {
              freshQuotes[symbol] = { ...fallback };
              staleSymbols.add(symbol);
              fallbackHits += 1;
            }
          });
        }
      });
    } else if (circuitTriggered) {
      missing.forEach((symbol) => {
        const fallback = fallbackBySymbol[symbol];
        if (fallback) {
          freshQuotes[symbol] = { ...fallback };
          staleSymbols.add(symbol);
          fallbackHits += 1;
        }
      });
    }

    const missingAfter = symbols.filter((symbol) => !freshQuotes[symbol]);
    const uniqueFailed = Array.from(new Set(failedSymbols));
    const uniqueMissing = Array.from(new Set(missingAfter));

    let errorMessage = circuitMessage;
    if (rateLimitHit) {
      const waitMessage = suggestedRetrySeconds
        ? `Intenta nuevamente en ${suggestedRetrySeconds} segundos.`
        : 'Intenta nuevamente más tarde.';
      errorMessage = `Yahoo limitó las consultas. ${waitMessage}`;
      registerFailure();
    } else if (uniqueFailed.length) {
      const list = uniqueFailed.join(', ');
      const prefix = `No se pudo actualizar ${uniqueFailed.length === 1 ? 'el símbolo' : 'los símbolos'} ${list}`;
      if (uniqueMissing.length) {
        const missingList = uniqueMissing.join(', ');
        errorMessage = `${prefix}. Sin datos actuales para ${missingList}.`;
      } else {
        errorMessage = `${prefix}. Se mantienen los datos en caché disponibles.`;
      }
      registerFailure();
    } else if (uniqueMissing.length && !errorMessage) {
      const missingList = uniqueMissing.join(', ');
      errorMessage = `No se encontraron datos para ${missingList}.`;
    } else if (!errorMessage && !circuitTriggered) {
      registerSuccess();
    }

    const totalDuration = Math.max(0, nowMs() - requestStart);
    const totalPayloadSize = metricsByChunk.reduce((sum, entry) => sum + (entry?.payloadSize || 0), 0);
    const totalAttempts = metricsByChunk.length
      ? metricsByChunk.reduce((max, entry) => Math.max(max, entry?.attempts || 0), 0)
      : 1;

    recordMetric({
      type: 'fetchQuotes',
      requestKey,
      durationMs: totalDuration,
      payloadSize: totalPayloadSize,
      fetchedSymbols: networkHits,
      cacheHits,
      fallbackHits,
      totalSymbols: symbols.length,
      success: !errorMessage,
      circuitOpen: circuitTriggered,
      rateLimited: rateLimitHit,
      retries: Math.max(0, totalAttempts - 1),
      timestamp: new Date().toISOString(),
    });

    return {
      quotes: freshQuotes,
      error: errorMessage,
      staleSymbols: Array.from(staleSymbols),
    };
  } finally {
    sharedContext.release();
  }
};

export const clearCache = () => {
  cache.clear();
};
