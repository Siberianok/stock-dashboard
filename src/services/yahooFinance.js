const CACHE_TTL = 30_000;
const MAX_SYMBOLS_PER_REQUEST = 50;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 400;
const RATE_LIMIT_STATUS = 429;

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

const fetchChunk = async (symbols, { signal } = {}) => {
  const controller = new AbortController();
  const { signal: requestSignal } = controller;

  let abortListener;
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      abortListener = () => controller.abort(signal.reason);
      signal.addEventListener('abort', abortListener, { once: true });
    }
  }

  try {
    const sortedSymbols = symbols.slice().sort();
    const joined = encodeURIComponent(sortedSymbols.join(','));
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}`;

    let attempt = 0;
    for (;;) {
      try {
        const response = await fetch(url, { signal: requestSignal });
        if (response.status === RATE_LIMIT_STATUS) {
          const retryAfterHeader = response.headers?.get('Retry-After');
          const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
          throw new RateLimitError(Number.isFinite(retryAfter) ? retryAfter : undefined);
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        const result = json?.quoteResponse?.result || [];
        result.forEach((quote) => {
          if (quote?.symbol) {
            cache.set(quote.symbol.toUpperCase(), { timestamp: Date.now(), data: quote });
          }
        });
        return result;
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
        const wait = BASE_BACKOFF_MS * 2 ** attempt;
        attempt += 1;
        await delay(wait);
      }
    }
  } finally {
    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener);
    }
  }
};

export const fetchQuotes = async (inputSymbols, { force = false, signal } = {}) => {
  const symbols = Array.from(new Set((inputSymbols || []).map(normalizeSymbol).filter(Boolean)));
  if (!symbols.length) {
    return { quotes: {}, error: null, staleSymbols: [] };
  }

  const now = Date.now();
  const freshQuotes = {};
  const missing = [];
  const fallbackBySymbol = {};

  symbols.forEach((symbol) => {
    const cached = cache.get(symbol);
    if (!force && cached && now - cached.timestamp <= CACHE_TTL) {
      freshQuotes[symbol] = cached.data;
    } else {
      if (cached?.data) {
        fallbackBySymbol[symbol] = cached.data;
      }
      missing.push(symbol);
    }
  });

  const chunkTasks = [];
  for (let i = 0; i < missing.length; i += MAX_SYMBOLS_PER_REQUEST) {
    const chunk = missing.slice(i, i + MAX_SYMBOLS_PER_REQUEST);
    if (chunk.length) {
      chunkTasks.push({ symbols: chunk, promise: fetchChunk(chunk, { signal }) });
    }
  }

  const failedSymbols = [];
  const staleSymbols = new Set();
  let rateLimitHit = false;
  let suggestedRetrySeconds;

  if (chunkTasks.length) {
    const settled = await Promise.allSettled(chunkTasks.map((task) => task.promise));
    settled.forEach((result, index) => {
      const { symbols: chunkSymbols } = chunkTasks[index];
      if (result.status === 'fulfilled') {
        result.value.forEach((quote) => {
          if (quote?.symbol) {
            freshQuotes[quote.symbol.toUpperCase()] = quote;
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
        } else if (reason?.name === 'AbortError') {
          // ignore, caller cancelled
        } else {
          console.error(`Error al obtener cotizaciones para ${chunkSymbols.join(', ')}`, reason);
        }
        chunkSymbols.forEach((symbol) => {
          const fallback = fallbackBySymbol[symbol];
          if (fallback) {
            freshQuotes[symbol] = { ...fallback };
            staleSymbols.add(symbol);
          }
        });
      }
    });
  }

  const missingAfter = symbols.filter((symbol) => !freshQuotes[symbol]);
  const uniqueFailed = Array.from(new Set(failedSymbols));
  const uniqueMissing = Array.from(new Set(missingAfter));

  let errorMessage = null;
  if (rateLimitHit) {
    const waitMessage = suggestedRetrySeconds
      ? `Intenta nuevamente en ${suggestedRetrySeconds} segundos.`
      : 'Intenta nuevamente más tarde.';
    errorMessage = `Yahoo limitó las consultas. ${waitMessage}`;
  } else if (uniqueFailed.length) {
    const list = uniqueFailed.join(', ');
    const prefix = `No se pudo actualizar ${uniqueFailed.length === 1 ? 'el símbolo' : 'los símbolos'} ${list}`;
    if (uniqueMissing.length) {
      const missingList = uniqueMissing.join(', ');
      errorMessage = `${prefix}. Sin datos actuales para ${missingList}.`;
    } else {
      errorMessage = `${prefix}. Se mantienen los datos en caché disponibles.`;
    }
  } else if (uniqueMissing.length) {
    const missingList = uniqueMissing.join(', ');
    errorMessage = `No se encontraron datos para ${missingList}.`;
  }

  return {
    quotes: freshQuotes,
    error: errorMessage,
    staleSymbols: Array.from(staleSymbols),
  };
};

export const clearCache = () => {
  cache.clear();
};
