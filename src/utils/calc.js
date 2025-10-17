import { MARKETS } from "../constants.js";
import { toNum } from "./number.js";

/**
 * @typedef {import("../state/rows.js").Row} Row
 * @typedef {import("../state/thresholds.js").Thresholds} Thresholds
 */

export const getPriceConfig = (thresholds, market) => (
  thresholds.priceRange?.[market] || thresholds.priceRange?.US || {}
);

export const getLiquidityMin = (thresholds, market) => {
  const value = thresholds.liquidityMin?.[market];
  return typeof value === "number" ? value : 0;
};

export const calcScore = (row, thresholds, forcedMarket) => {
  const marketKey = forcedMarket || row.market || "US";
  const priceCfg = getPriceConfig(thresholds, marketKey);
  const marketPriceMin = typeof priceCfg.min === "number" ? priceCfg.min : 0;
  const marketPriceMax = typeof priceCfg.max === "number" ? priceCfg.max : Number.POSITIVE_INFINITY;
  const marketLiquidityMin = getLiquidityMin(thresholds, marketKey);

  const open = toNum(row.open);
  const close = toNum(row.close);
  const volToday = toNum(row.volToday);
  const volAvg20 = toNum(row.volAvg20);
  const floatM = toNum(row.floatM);
  const atr14 = toNum(row.atr14);
  const ema9 = toNum(row.ema9);
  const ema200 = toNum(row.ema200);
  const shortPct = toNum(row.shortPct);
  const dtc = toNum(row.dtc);
  const spreadPct = toNum(row.spreadPct);
  const liqM = toNum(row.liqM);

  const rvol = typeof volToday === "number" && typeof volAvg20 === "number" && volAvg20 > 0
    ? (volToday / volAvg20)
    : undefined;
  const atrPct = typeof atr14 === "number" && typeof close === "number" && close > 0
    ? (atr14 / close) * 100
    : undefined;
  const chgPct = typeof open === "number" && typeof close === "number" && open > 0
    ? ((close - open) / open) * 100
    : undefined;
  const rotation = typeof volToday === "number" && typeof floatM === "number" && floatM > 0
    ? (volToday / (floatM * 1e6))
    : undefined;

  const priceOK = typeof close === "number" && close >= marketPriceMin && close <= marketPriceMax;
  const emaOK = typeof close === "number" && typeof ema9 === "number" && close > ema9
    && (!thresholds.needEMA200 || (typeof ema200 === "number" && close > ema200));
  const rvol2 = typeof rvol === "number" && rvol >= thresholds.rvolMin;
  const rvol5 = typeof rvol === "number" && rvol >= thresholds.rvolIdeal;
  const chgOK = typeof chgPct === "number" && chgPct >= (thresholds.parabolic50 ? 50 : thresholds.chgMin);
  const atrOK = (typeof atr14 === "number" && atr14 >= thresholds.atrMin)
    || (typeof atrPct === "number" && atrPct >= thresholds.atrPctMin);
  const float50 = typeof floatM === "number" && floatM < thresholds.float50;
  const float10 = typeof floatM === "number" && floatM < thresholds.float10;
  const rot1 = typeof rotation === "number" && rotation >= thresholds.rotationMin;
  const rot3 = typeof rotation === "number" && rotation >= thresholds.rotationIdeal;
  const shortOK = typeof shortPct === "number" && shortPct >= thresholds.shortMin;
  const spreadOK = typeof spreadPct !== "number" ? true : spreadPct <= thresholds.spreadMaxPct;
  const liqOK = typeof liqM !== "number" ? true : liqM >= marketLiquidityMin;

  let score = 0;
  score += float10 ? 20 : (float50 ? 10 : 0);
  score += rvol2 ? 15 : 0;
  score += rvol5 ? 10 : 0;
  score += priceOK ? 10 : 0;
  score += emaOK ? 10 : 0;
  score += typeof chgPct === "number" && chgPct >= thresholds.chgMin ? 10 : 0;
  score += typeof chgPct === "number" && chgPct >= 50 ? 10 : 0;
  score += atrOK ? 10 : 0;
  score += rot1 ? 5 : 0;
  score += rot3 ? 5 : 0;
  score += shortOK ? 5 : 0;
  score += row.intradiaOK ? 5 : 0;
  score += row.catalyst ? 5 : 0;

  return {
    market: marketKey,
    priceLimits: { min: marketPriceMin, max: marketPriceMax },
    liquidityMin: marketLiquidityMin,
    rvol,
    atrPct,
    chgPct,
    rotation,
    score,
    flags: { priceOK, emaOK, rvol2, rvol5, chgOK, atrOK, float50, float10, rot1, rot3, shortOK, spreadOK, liqOK },
    raw: { open, close, volToday, volAvg20, floatM, atr14, ema9, ema200, shortPct, dtc, spreadPct, liqM },
  };
};

export const getKpis = (items) => {
  const scores = items.map((item) => item.score || 0);
  const top = scores.length ? Math.max(...scores) : 0;
  const inPlay = items.filter((item) => item.flags?.rvol2 && item.flags?.priceOK && item.flags?.emaOK).length;
  const ready70 = items.filter((item) => (item.score || 0) >= 70).length;
  return { top, inPlay, ready70, total: items.length };
};

export const buildScoreBuckets = (items) => {
  const hi = items.filter((item) => (item.score || 0) >= 70).length;
  const mid = items.filter((item) => {
    const score = item.score || 0;
    return score >= 40 && score < 70;
  }).length;
  const lo = Math.max(0, (items.length || 0) - hi - mid);
  return [
    { name: ">=70", value: hi },
    { name: "40–69", value: mid },
    { name: "<40", value: lo },
  ];
};

export const buildSankeyData = (items) => {
  const price = items.filter((item) => item.flags.priceOK);
  const ema = price.filter((item) => item.flags.emaOK);
  const rvol2 = ema.filter((item) => item.flags.rvol2);
  const ready = rvol2.filter((item) => (item.score || 0) >= 70);
  return {
    nodes: [
      { name: `Universe (${items.length})` },
      { name: `PrecioOK (${price.length})` },
      { name: `EMAOK (${ema.length})` },
      { name: `RVOL≥2 (${rvol2.length})` },
      { name: `SCORE≥70 (${ready.length})` },
    ],
    links: [
      { source: 0, target: 1, value: price.length },
      { source: 1, target: 2, value: ema.length },
      { source: 2, target: 3, value: rvol2.length },
      { source: 3, target: 4, value: ready.length },
    ],
  };
};

export const buildRadarData = (computed, thresholds, row) => {
  if (!computed) return [];
  const scale = (val, thr) => {
    if (val === undefined || thr === undefined || thr === 0) return 0;
    return Math.max(0, Math.min(100, (val / thr) * 100));
  };
  const rvolScore = scale(computed.rvol, thresholds.rvolIdeal);
  const chgScore = scale(computed.chgPct, thresholds.parabolic50 ? 50 : thresholds.chgMin);
  const atrScore = scale(computed.atrPct, thresholds.atrPctMin * 2);
  const rotScore = scale(computed.rotation, thresholds.rotationIdeal);
  const shortScore = scale(toNum(row?.shortPct), thresholds.shortMin);
  const scoreScore = Math.max(0, Math.min(100, computed.score || 0));
  return [
    { k: "RVOL", v: rvolScore },
    { k: "%día", v: chgScore },
    { k: "ATR%", v: atrScore },
    { k: "Rot", v: rotScore },
    { k: "Short%", v: shortScore },
    { k: "SCORE", v: scoreScore },
  ];
};

export const buildCsv = (rows, thresholds) => {
  const headers = [
    "Ticker","Mercado","Moneda","Open","Close","Bid","Ask","Promedio","VolHoy","VolProm20","RVOL","Float(M)","Rotación","Short%","DTC","ATR14","ATR%","EMA9","EMA200","%día","Catal","IntradíaOK","Spread%","Liquidez(M)","SCORE","priceOK","emaOK","rvol2","rvol5","chgOK","atrOK","float<50","float<10","rot≥1","rot≥3","shortOK","spreadOK","liqOK",
  ];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const market = row.market || "US";
    const info = MARKETS[market] || MARKETS.US;
    const computed = calcScore(row, thresholds, market);
    const { rvol, atrPct, chgPct, rotation, score, flags } = computed;
    lines.push([
      row.ticker,
      info.label,
      info.currency,
      row.open,
      row.close,
      row.bid,
      row.ask,
      row.avgPrice,
      row.volToday,
      row.volAvg20,
      rvol ?? "",
      row.floatM,
      rotation ?? "",
      row.shortPct,
      row.dtc,
      row.atr14,
      atrPct ?? "",
      row.ema9,
      row.ema200,
      chgPct ?? "",
      row.catalyst,
      row.intradiaOK,
      row.spreadPct,
      row.liqM,
      Math.round(score || 0),
      flags.priceOK,
      flags.emaOK,
      flags.rvol2,
      flags.rvol5,
      flags.chgOK,
      flags.atrOK,
      flags.float50,
      flags.float10,
      flags.rot1,
      flags.rot3,
      flags.shortOK,
      flags.spreadOK,
      flags.liqOK,
    ].join(","));
  });
  return lines.join("\n");
};
