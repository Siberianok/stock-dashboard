import { toNum } from './format.js';

export const createCalc = (thresholds) => {
  const th = thresholds;
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
    const volAvg20 = toNum(row.volAvg20);
    const floatM = toNum(row.floatM);
    const atr14 = toNum(row.atr14);
    const ema9 = toNum(row.ema9);
    const ema200 = toNum(row.ema200);
    const shortPct = toNum(row.shortPct);
    const rotation = typeof volToday === 'number' && typeof floatM === 'number' && floatM > 0
      ? volToday / (floatM * 1e6)
      : undefined;
    const rvol = typeof volToday === 'number' && typeof volAvg20 === 'number' && volAvg20 > 0
      ? volToday / volAvg20
      : undefined;
    const atrPct = typeof atr14 === 'number' && typeof close === 'number' && close > 0
      ? (atr14 / close) * 100
      : undefined;
    const chgPct = typeof open === 'number' && typeof close === 'number' && open > 0
      ? ((close - open) / open) * 100
      : undefined;
    const spreadPct = toNum(row.spreadPct);
    const liqM = toNum(row.liqM);

    const priceOK = typeof close === 'number' && close >= marketPriceMin && close <= marketPriceMax;
    const emaOK = typeof close === 'number'
      && typeof ema9 === 'number'
      && close > ema9
      && (!th.needEMA200 || (typeof ema200 === 'number' && close > ema200));
    const rvol2 = typeof rvol === 'number' && rvol >= th.rvolMin;
    const rvol5 = typeof rvol === 'number' && rvol >= th.rvolIdeal;
    const chgOK = typeof chgPct === 'number' && chgPct >= (th.parabolic50 ? 50 : th.chgMin);
    const atrOK = (typeof atr14 === 'number' && atr14 >= th.atrMin)
      || (typeof atrPct === 'number' && atrPct >= th.atrPctMin);
    const float50 = typeof floatM === 'number' && floatM < th.float50;
    const float10 = typeof floatM === 'number' && floatM < th.float10;
    const rot1 = typeof rotation === 'number' && rotation >= th.rotationMin;
    const rot3 = typeof rotation === 'number' && rotation >= th.rotationIdeal;
    const hasShortPct = typeof shortPct === 'number';
    const shortOK = hasShortPct && shortPct >= th.shortMin;
    const shortMissing = !hasShortPct;
    const spreadOK = typeof spreadPct !== 'number' ? true : spreadPct <= th.spreadMaxPct;
    const liqOK = typeof liqM !== 'number' ? true : liqM >= marketLiquidityMin;

    let score = 0;
    score += float10 ? 20 : (float50 ? 10 : 0);
    score += rvol2 ? 15 : 0;
    score += rvol5 ? 10 : 0;
    score += priceOK ? 10 : 0;
    score += emaOK ? 10 : 0;
    score += typeof chgPct === 'number' && chgPct >= chgMin ? 10 : 0;
    score += typeof chgPct === 'number' && chgPct >= 50 ? 10 : 0;
    score += atrOK ? 10 : 0;
    score += rot1 ? 5 : 0;
    score += rot3 ? 5 : 0;
    score += shortOK ? 5 : 0;
    score += row.intradiaOK ? 5 : 0;
    score += row.catalyst ? 5 : 0;

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
    return {
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
  };
};
