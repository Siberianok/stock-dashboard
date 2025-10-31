const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const pseudoRandom = (seed) => {
  let x = Math.sin(seed) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
};

const baseMetricsByMarket = {
  US: { price: 40, volume: 8_000_000 },
  AR: { price: 1500, volume: 150_000 },
  BR: { price: 30, volume: 5_000_000 },
  EU: { price: 60, volume: 3_000_000 },
  CN: { price: 120, volume: 6_500_000 },
  DEFAULT: { price: 25, volume: 2_000_000 },
};

const buildQuote = (symbol, market, rand) => {
  const base = baseMetricsByMarket[market] || baseMetricsByMarket.DEFAULT;
  const randomFactor = 0.6 + rand() * 0.8;
  const price = clamp(base.price * randomFactor, 1, base.price * 4);
  const spread = clamp(price * (0.001 + rand() * 0.004), 0.01, price * 0.02);
  const volume = Math.round(base.volume * (0.5 + rand() * 1.2));
  const avg10 = Math.round(volume * (0.5 + rand() * 0.5));
  const floatShares = Math.round(volume * (50 + rand() * 250));
  const shortPct = clamp(rand() * 20, 0, 30);
  const sharesShort = Math.round((shortPct / 100) * floatShares);
  const ask = price + spread / 2;
  const bid = price - spread / 2;
  const high = price * (1 + rand() * 0.03);
  const low = price * (1 - rand() * 0.03);
  const ema9 = price * (0.97 + rand() * 0.03);
  const ema200 = price * (0.9 + rand() * 0.05);

  return {
    symbol,
    regularMarketPrice: Number(price.toFixed(2)),
    regularMarketOpen: Number((price * (0.99 + rand() * 0.02)).toFixed(2)),
    regularMarketVolume: volume,
    averageDailyVolume10Day: avg10,
    regularMarketDayHigh: Number(high.toFixed(2)),
    regularMarketDayLow: Number(low.toFixed(2)),
    floatShares,
    shortPercentOfFloat: Number(shortPct.toFixed(2)),
    sharesShort,
    ask: Number(ask.toFixed(2)),
    bid: Number(bid.toFixed(2)),
    fiftyDayAverage: Number(ema9.toFixed(2)),
    twoHundredDayAverage: Number(ema200.toFixed(2)),
  };
};

export const generateMockQuotes = async (symbols, { marketBySymbol = {} } = {}) => {
  const now = Date.now();
  const rand = pseudoRandom(now % 1_000_000);
  const entries = symbols.map((symbol) => {
    const market = marketBySymbol[symbol] || 'US';
    return [symbol, buildQuote(symbol, market, rand)];
  });
  return Object.fromEntries(entries);
};

