import HISTORICAL_BENCHMARK_FIXTURES from '../data/historicalBenchmarks.js';

const fixturesPromise = Promise.resolve(HISTORICAL_BENCHMARK_FIXTURES);

const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  return total / valid.length;
};

const normalizeNumber = (value) => {
  if (Number.isFinite(value)) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const buildBenchmarkFeatures = (thresholds = {}) => {
  const markets = Object.entries(thresholds.marketsEnabled || {})
    .filter(([, enabled]) => enabled)
    .map(([market]) => market)
    .sort();

  const priceRanges = markets
    .map((market) => thresholds.priceRange?.[market])
    .filter((range) => range && (Number.isFinite(range.min) || Number.isFinite(range.max)));

  const liquidityValues = markets
    .map((market) => normalizeNumber(thresholds.liquidityMin?.[market]))
    .filter(Number.isFinite);

  const priceMins = priceRanges.map((range) => normalizeNumber(range.min)).filter(Number.isFinite);
  const priceMaxs = priceRanges.map((range) => normalizeNumber(range.max)).filter(Number.isFinite);

  return {
    markets,
    priceMin: normalizeNumber(average(priceMins)),
    priceMax: normalizeNumber(average(priceMaxs)),
    liquidityMin: normalizeNumber(average(liquidityValues)),
    rvolMin: normalizeNumber(thresholds.rvolMin),
    chgMin: normalizeNumber(thresholds.chgMin),
    needEMA200: Boolean(thresholds.needEMA200),
  };
};

const normalizeFeatures = (features = {}) => ({
  markets: Array.isArray(features.markets) ? [...features.markets].sort() : [],
  priceMin: normalizeNumber(features.priceMin),
  priceMax: normalizeNumber(features.priceMax),
  liquidityMin: normalizeNumber(features.liquidityMin),
  rvolMin: normalizeNumber(features.rvolMin),
  chgMin: normalizeNumber(features.chgMin),
  needEMA200: Boolean(features.needEMA200),
});

const distanceBetween = (request, fixture) => {
  let score = 0;
  const requestMarkets = new Set(request.markets);
  const fixtureMarkets = new Set(fixture.markets);
  const missing = [...requestMarkets].filter((market) => !fixtureMarkets.has(market)).length;
  const extra = [...fixtureMarkets].filter((market) => !requestMarkets.has(market)).length;
  score += (missing + extra) * 5;

  const diff = (key, weight, scaleHint = 1) => {
    const requestValue = Number.isFinite(request[key]) ? request[key] : fixture[key];
    const fixtureValue = Number.isFinite(fixture[key]) ? fixture[key] : requestValue;
    if (!Number.isFinite(requestValue) || !Number.isFinite(fixtureValue)) {
      return;
    }
    const scale = Math.max(Math.abs(fixtureValue), Math.abs(requestValue), scaleHint, 1);
    const delta = Math.abs(requestValue - fixtureValue) / scale;
    score += delta * weight;
  };

  diff('priceMin', 0.5, 10);
  diff('priceMax', 0.5, 10);
  diff('liquidityMin', 0.75, 5);
  diff('rvolMin', 3, 1);
  diff('chgMin', 1.5, 5);

  if (request.needEMA200 !== fixture.needEMA200) {
    score += 1;
  }

  return score;
};

const selectionCache = new Map();

const buildCacheKey = (features, timeRange) => JSON.stringify({ features, timeRange });

export const selectHistoricalBenchmarkByFeatures = async (features, { timeRange = '1M' } = {}) => {
  const normalizedFeatures = normalizeFeatures(features);
  const key = buildCacheKey(normalizedFeatures, timeRange);
  if (selectionCache.has(key)) {
    return selectionCache.get(key);
  }

  const fixtures = await fixturesPromise;
  if (!Array.isArray(fixtures) || !fixtures.length) {
    selectionCache.set(key, null);
    return null;
  }

  let best = null;
  let bestScore = Infinity;
  fixtures.forEach((fixture) => {
    const normalizedFixture = normalizeFeatures(fixture.features);
    const score = distanceBetween(normalizedFeatures, normalizedFixture);
    if (score < bestScore) {
      bestScore = score;
      best = fixture;
    }
  });

  if (!best) {
    selectionCache.set(key, null);
    return null;
  }

  const metrics = best.metricsByRange?.[timeRange] || best.metricsByRange?.ALL || null;
  if (!metrics) {
    selectionCache.set(key, null);
    return null;
  }

  const result = {
    id: best.id,
    label: best.label,
    description: best.description,
    timeRange,
    metrics,
  };

  selectionCache.set(key, result);
  return result;
};

export const selectHistoricalBenchmark = async (thresholds, options = {}) => {
  const features = buildBenchmarkFeatures(thresholds);
  return selectHistoricalBenchmarkByFeatures(features, options);
};

export const clearHistoricalBenchmarkCache = () => {
  selectionCache.clear();
};

export const __testing = {
  distanceBetween,
  normalizeFeatures,
};
