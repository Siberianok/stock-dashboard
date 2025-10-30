import { toNum } from './format.js';

const formatSignaturePart = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(6);
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
};

export const createCalc = (thresholds) => {
  const th = thresholds;
  const cache = new Map();

  return (row, forcedMarket) => {
    const marketKey = forcedMarket || row.market || 'US';
    const priceCfg = th.priceRange?.[marketKey] || th.priceRange?.US || {};
    const marketPriceMin = Number.isFinite(priceCfg.min) ? priceCfg.min : 0;
    const marketPriceMax = Number.isFinite(priceCfg.max) ? priceCfg.max : Number.POSITIVE_INFINITY;
    const liqCfg = th.liquidityMin?.[marketKey];
    const marketLiquidityMin = Number.isFinite(liqCfg) ? liqCfg : 0;
    const rvolMin = Number.isFinite(th.rvolMin) ? th.rvolMin : 0;
    const rvolIdeal = Number.isFinite(th.rvolIdeal) ? th.rvolIdeal : rvolMin;
    const chgMin = Number.isFinite(th.chgMin) ? th.chgMin : 0;
    const atrMin = Number.isFinite(th.atrMin) ? th.atrMin : 0;
    const atrPctMin = Number.isFinite(th.atrPctMin) ? th.atrPctMin : 0;
    const float50Limit = Number.isFinite(th.float50) ? th.float50 : Number.POSITIVE_INFINITY;
    const float10Limit = Number.isFinite(th.float10) ? th.float10 : float50Limit;
    const rotationMin = Number.isFinite(th.rotationMin) ? th.rotationMin : 0;
    const rotationIdeal = Number.isFinite(th.rotationIdeal) ? th.rotationIdeal : Math.max(rotationMin, 0);
    const shortMin = Number.isFinite(th.shortMin) ? th.shortMin : 0;
    const spreadMaxPct = Number.isFinite(th.spreadMaxPct) ? th.spreadMaxPct : Number.POSITIVE_INFINITY;
    const needEMA200 = !!th.needEMA200;
    const parabolic50 = !!th.parabolic50;

    const open = toNum(row.open);
    const close = toNum(row.close);
    const volToday = toNum(row.volToday);
    const volAvg10 = toNum(row.volAvg10);
    const floatM = toNum(row.floatM);
    const atr14 = toNum(row.atr14);
    const ema9 = toNum(row.ema9);
    const ema200 = toNum(row.ema200);
    const shortPct = toNum(row.shortPct);
    const spreadPct = toNum(row.spreadPct);
    const liqM = toNum(row.liqM);

    const rotation = typeof volToday === 'number' && typeof floatM === 'number' && floatM > 0
      ? volToday / (floatM * 1e6)
      : undefined;
    const rvol = typeof volToday === 'number' && typeof volAvg10 === 'number' && volAvg10 > 0
      ? volToday / volAvg10
      : undefined;
    const atrPct = typeof atr14 === 'number' && typeof close === 'number' && close > 0
      ? (atr14 / close) * 100
      : undefined;
    const chgPct = typeof open === 'number' && typeof close === 'number' && open > 0
      ? ((close - open) / open) * 100
      : undefined;

    const cacheKey = row.id || `${row.ticker || ''}-${marketKey}`;
    const signature = [
      marketKey,
      row.id,
      row.ticker,
      open,
      close,
      volToday,
      volAvg10,
      floatM,
      atr14,
      ema9,
      ema200,
      shortPct,
      spreadPct,
      liqM,
      rotation,
      rvol,
      atrPct,
      chgPct,
      row.intradiaOK ? 1 : 0,
      row.catalyst ? 1 : 0,
    ].map(formatSignaturePart).join('|');

    const cached = cache.get(cacheKey);
    if (cached?.signature === signature) {
      return cached.result;
    }

    const priceOK = typeof close === 'number' && close >= marketPriceMin && close <= marketPriceMax;
    const emaOK = typeof close === 'number'
      && typeof ema9 === 'number'
      && close > ema9
      && (!needEMA200 || (typeof ema200 === 'number' && close > ema200));
    const rvol2 = typeof rvol === 'number' && rvol >= rvolMin;
    const rvol5 = typeof rvol === 'number' && rvol >= rvolIdeal;
    const chgOK = typeof chgPct === 'number' && chgPct >= (parabolic50 ? 50 : chgMin);
    const atrOK = (typeof atr14 === 'number' && atr14 >= atrMin)
      || (typeof atrPct === 'number' && atrPct >= atrPctMin);
    const float50 = typeof floatM === 'number' && floatM < float50Limit;
    const float10 = typeof floatM === 'number' && floatM < float10Limit;
    const rot1 = typeof rotation === 'number' && rotation >= rotationMin;
    const rot3 = typeof rotation === 'number' && rotation >= rotationIdeal;
    const hasShortPct = typeof shortPct === 'number';
    const shortOK = hasShortPct && shortPct >= shortMin;
    const shortMissing = !hasShortPct;
    const spreadOK = typeof spreadPct !== 'number' ? true : spreadPct <= spreadMaxPct;
    const liqOK = typeof liqM !== 'number' ? true : liqM >= marketLiquidityMin;

    const flags = {
      priceOK,
      emaOK,
      rvol2,
      rvol5,
      chgOK,
      atrOK,
      float50,
      float10,
      rot1,
      rot3,
      shortOK,
      shortMissing,
      spreadOK,
      liqOK,
    };

    const requiredWeights = {
      priceOK: 14,
      emaOK: 14,
      rvol2: 16,
      chgOK: 10,
      atrOK: 8,
      float50: 8,
      rot1: 6,
      shortOK: 6,
      spreadOK: 6,
      liqOK: 6,
    };
    const optionalWeights = {
      rvol5: 6,
      float10: 10,
      rot3: 4,
    };

    let score = 0;
    let penalty = 0;

    Object.entries(requiredWeights).forEach(([flag, weight]) => {
      if (flags[flag]) {
        score += weight;
      } else {
        penalty += weight * 0.6;
      }
    });

    Object.entries(optionalWeights).forEach(([flag, weight]) => {
      if (flags[flag]) {
        score += weight;
      }
    });

    if (row.intradiaOK) {
      score += 4;
    }
    if (row.catalyst) {
      score += 6;
    }

    if (typeof rvol === 'number' && rvolMin > 0) {
      const target = Math.max(rvolIdeal || rvolMin, rvolMin);
      if (target > 0) {
        const ratio = Math.min(rvol / target, 2);
        score += Math.max(0, ratio * 6);
      }
    }

    if (typeof chgPct === 'number') {
      const base = parabolic50 ? 50 : chgMin;
      if (Number.isFinite(base) && chgPct > base) {
        score += Math.min(8, (chgPct - base) * 0.3);
      }
    }

    if (typeof atrPct === 'number' && atrPctMin > 0) {
      if (atrPct > atrPctMin) {
        score += Math.min(6, (atrPct - atrPctMin) * 0.5);
      }
    } else if (typeof atr14 === 'number' && atrMin > 0 && atr14 > atrMin) {
      score += Math.min(6, (atr14 - atrMin) * 0.5);
    }

    if (typeof rotation === 'number' && rotationMin > 0 && rotation > rotationMin) {
      score += Math.min(6, (rotation - rotationMin) * 2);
    }

    if (!shortMissing && !shortOK) {
      penalty += 4;
    }

    score -= penalty;
    score = Math.max(0, Math.min(120, score));

    const result = {
      rvol,
      atrPct,
      chgPct,
      rotation,
      score,
      flags,
      market: marketKey,
      priceLimits: { min: marketPriceMin, max: marketPriceMax },
      liquidityMin: marketLiquidityMin,
    };

    cache.set(cacheKey, { signature, result });
    return result;
  };
};
