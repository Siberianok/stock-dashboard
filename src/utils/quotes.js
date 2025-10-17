import { toNum } from "./number.js";

export const extractQuoteFields = (quote) => {
  if (!quote) return {};
  const open = toNum(quote.regularMarketOpen);
  const close = toNum(quote.regularMarketPrice);
  const volToday = toNum(quote.regularMarketVolume);
  const volAvg10 = toNum(quote.averageDailyVolume10Day);
  const volAvg3m = toNum(quote.averageDailyVolume3Month);
  const floatShares = toNum(quote.floatShares || quote.sharesOutstanding);
  const shortPct = toNum(quote.shortPercentOfFloat);
  const sharesShort = toNum(quote.sharesShort);
  const avgVolForDtc = volAvg10 || volAvg3m;
  const ask = toNum(quote.ask);
  const bid = toNum(quote.bid);
  const dayHigh = toNum(quote.regularMarketDayHigh);
  const dayLow = toNum(quote.regularMarketDayLow);
  const atrApprox = dayHigh && dayLow ? (dayHigh - dayLow) : undefined;
  const avgPrice = dayHigh && dayLow
    ? (dayHigh + dayLow) / 2
    : (typeof open === "number" && typeof close === "number"
      ? (open + close) / 2
      : undefined);
  const spreadPct = ask && bid && close ? ((ask - bid) / close) * 100 : undefined;
  const usdLiquidityM = close && volToday ? (close * volToday) / 1e6 : undefined;
  const dtc = typeof sharesShort === "number" && typeof avgVolForDtc === "number" && avgVolForDtc > 0
    ? (sharesShort / avgVolForDtc)
    : undefined;

  return {
    open,
    close,
    bid,
    ask,
    avgPrice,
    volToday,
    volAvg20: volAvg10,
    floatM: typeof floatShares === "number" ? floatShares / 1e6 : undefined,
    shortPct,
    dtc,
    atr14: atrApprox,
    ema9: toNum(quote.fiftyDayAverage),
    ema200: toNum(quote.twoHundredDayAverage),
    spreadPct,
    liqM: usdLiquidityM,
  };
};
