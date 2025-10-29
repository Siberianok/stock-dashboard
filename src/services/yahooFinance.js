const CACHE_TTL = 30_000;
const MAX_SYMBOLS_PER_REQUEST = 50;

const cache = new Map(); // symbol -> { timestamp, data }
const inflight = new Map(); // key -> promise

const normalizeSymbol = (symbol) => symbol?.toUpperCase().trim();

const fetchChunk = async (symbols) => {
  const key = symbols.sort().join(',');
  if (inflight.has(key)) {
    return inflight.get(key);
  }
  const promise = (async () => {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
    const response = await fetch(url);
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
  })()
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
};

export const fetchQuotes = async (inputSymbols, { force = false } = {}) => {
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
      chunkTasks.push({ symbols: chunk, promise: fetchChunk(chunk) });
    }
  }

  const failedSymbols = [];
  const staleSymbols = new Set();

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
        console.error(`Error al obtener cotizaciones para ${chunkSymbols.join(', ')}`, result.reason);
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
  if (uniqueFailed.length) {
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
  inflight.clear();
};
