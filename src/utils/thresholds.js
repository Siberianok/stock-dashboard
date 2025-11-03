import { DEFAULT_THRESHOLDS } from '../hooks/thresholdConfig.js';

const DEFAULT_DECIMALS = 2;
const MARKET_PRICE_DECIMALS = 2;
const MARKET_LIQUIDITY_DECIMALS = 2;

const NUMERIC_FORMAT = {
  rvolMin: { min: 0, decimals: DEFAULT_DECIMALS },
  rvolIdeal: { min: 0, decimals: DEFAULT_DECIMALS },
  atrMin: { min: 0, decimals: 3 },
  atrPctMin: { min: 0, decimals: DEFAULT_DECIMALS },
  chgMin: { min: 0, decimals: DEFAULT_DECIMALS },
  float50: { min: 0, decimals: DEFAULT_DECIMALS },
  float10: { min: 0, decimals: DEFAULT_DECIMALS },
  rotationMin: { min: 0, decimals: DEFAULT_DECIMALS },
  rotationIdeal: { min: 0, decimals: DEFAULT_DECIMALS },
  shortMin: { min: 0, max: 100, decimals: DEFAULT_DECIMALS },
  spreadMaxPct: { min: 0, decimals: 3 },
};

const toFiniteNumber = (value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

export const sanitizeNumber = (value, { min = -Infinity, max = Infinity } = {}) => {
  const numeric = toFiniteNumber(value);
  if (numeric === undefined) return undefined;
  const clamped = Math.min(Math.max(numeric, min), max);
  return clamped;
};

export const normalizeNumericValue = (value, options = {}) => {
  const { min = -Infinity, max = Infinity, decimals = DEFAULT_DECIMALS } = options;
  const sanitized = sanitizeNumber(value, { min, max });
  if (sanitized === undefined) return undefined;
  if (!Number.isInteger(decimals) || decimals < 0) {
    return sanitized;
  }
  const factor = 10 ** decimals;
  return Math.round(sanitized * factor) / factor;
};

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const normalizeMarketPriceRange = (rawRanges = {}, baseRanges = {}) => {
  const result = {};
  const markets = new Set([
    ...Object.keys(baseRanges || {}),
    ...Object.keys(rawRanges || {}),
  ]);

  markets.forEach((market) => {
    const base = baseRanges?.[market] || {};
    const candidate = rawRanges?.[market] || {};
    const min = normalizeNumericValue(candidate.min, { min: 0, decimals: MARKET_PRICE_DECIMALS });
    const max = normalizeNumericValue(candidate.max, { min: 0, decimals: MARKET_PRICE_DECIMALS });
    const normalized = {
      ...(base.min !== undefined ? { min: normalizeNumericValue(base.min, { min: 0, decimals: MARKET_PRICE_DECIMALS }) } : {}),
      ...(base.max !== undefined ? { max: normalizeNumericValue(base.max, { min: 0, decimals: MARKET_PRICE_DECIMALS }) } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    };
    if (Object.keys(normalized).length > 0) {
      result[market] = normalized;
    }
  });
  return result;
};

const normalizeMarketLiquidity = (rawLiquidity = {}, baseLiquidity = {}) => {
  const result = {};
  const markets = new Set([
    ...Object.keys(baseLiquidity || {}),
    ...Object.keys(rawLiquidity || {}),
  ]);

  markets.forEach((market) => {
    const baseValue = normalizeNumericValue(baseLiquidity?.[market], {
      min: 0,
      decimals: MARKET_LIQUIDITY_DECIMALS,
    });
    const rawValue = toFiniteNumber(rawLiquidity?.[market]);
    const candidate =
      rawValue !== undefined && rawValue >= 0
        ? normalizeNumericValue(rawValue, {
            min: 0,
            decimals: MARKET_LIQUIDITY_DECIMALS,
          })
        : undefined;
    if (candidate !== undefined) {
      result[market] = candidate;
    } else if (baseValue !== undefined) {
      result[market] = baseValue;
    }
  });
  return result;
};

const normalizeMarketsEnabled = (rawEnabled = {}, baseEnabled = {}) => {
  const result = {};
  const markets = new Set([
    ...Object.keys(baseEnabled || {}),
    ...Object.keys(rawEnabled || {}),
  ]);

  markets.forEach((market) => {
    const fallback = Boolean(baseEnabled?.[market]);
    if (market in (rawEnabled || {})) {
      result[market] = Boolean(rawEnabled[market]);
    } else {
      result[market] = fallback;
    }
  });
  return result;
};

export const normalizeThresholds = (raw = {}) => {
  const base = clone(DEFAULT_THRESHOLDS);
  const source = raw && typeof raw === 'object' ? raw : {};

  const marketsEnabled = normalizeMarketsEnabled(source.marketsEnabled, base.marketsEnabled);
  const priceRange = normalizeMarketPriceRange(source.priceRange, base.priceRange);
  const liquidityMin = normalizeMarketLiquidity(source.liquidityMin, base.liquidityMin);

  const normalized = {
    ...base,
    marketsEnabled,
    priceRange,
    liquidityMin,
  };

  Object.entries(NUMERIC_FORMAT).forEach(([key, options]) => {
    const normalizedValue = normalizeNumericValue(source[key], options);
    if (normalizedValue !== undefined) {
      normalized[key] = normalizedValue;
    }
  });

  if (typeof source.parabolic50 === 'boolean') {
    normalized.parabolic50 = source.parabolic50;
  }
  if (typeof source.needEMA200 === 'boolean') {
    normalized.needEMA200 = source.needEMA200;
  }

  return normalized;
};

export const areThresholdsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

export const cloneThresholds = (thresholds) => clone(thresholds);

const pickSignatureFields = (thresholds = {}) => ({
  marketsEnabled: thresholds.marketsEnabled,
  priceRange: thresholds.priceRange,
  liquidityMin: thresholds.liquidityMin,
  rvolMin: thresholds.rvolMin,
  rvolIdeal: thresholds.rvolIdeal,
  atrMin: thresholds.atrMin,
  atrPctMin: thresholds.atrPctMin,
  chgMin: thresholds.chgMin,
  parabolic50: thresholds.parabolic50,
  needEMA200: thresholds.needEMA200,
  float50: thresholds.float50,
  float10: thresholds.float10,
  rotationMin: thresholds.rotationMin,
  rotationIdeal: thresholds.rotationIdeal,
  shortMin: thresholds.shortMin,
  spreadMaxPct: thresholds.spreadMaxPct,
});

export const createThresholdSignature = (thresholds) =>
  JSON.stringify(pickSignatureFields(thresholds));
