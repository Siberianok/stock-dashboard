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
  if (!symbols.length) return {};
  const now = Date.now();
  const freshQuotes = {};
  const missing = [];

  symbols.forEach((symbol) => {
    const cached = cache.get(symbol);
    if (!force && cached && now - cached.timestamp <= CACHE_TTL) {
      freshQuotes[symbol] = cached.data;
    } else {
      missing.push(symbol);
    }
  });

  const chunkPromises = [];
  for (let i = 0; i < missing.length; i += MAX_SYMBOLS_PER_REQUEST) {
    const chunk = missing.slice(i, i + MAX_SYMBOLS_PER_REQUEST);
    if (chunk.length) {
      chunkPromises.push(fetchChunk(chunk));
    }
  }

  if (chunkPromises.length) {
    const results = await Promise.all(chunkPromises);
    results.flat().forEach((quote) => {
      if (quote?.symbol) {
        freshQuotes[quote.symbol.toUpperCase()] = quote;
      }
    });
  }

  return freshQuotes;
};

export const clearCache = () => {
  cache.clear();
  inflight.clear();
};
