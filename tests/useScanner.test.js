import test from 'node:test';
import assert from 'node:assert/strict';

import { scanUniverse } from '../src/hooks/useScanner.js';
import { DEFAULT_THRESHOLDS } from '../src/hooks/thresholdConfig.js';
import { createCalc } from '../src/utils/calc.js';

const buildQuote = (symbol) => ({
  symbol,
  regularMarketPrice: 10,
  regularMarketOpen: 9,
  regularMarketVolume: 20_000_000,
  averageDailyVolume10Day: 1_000_000,
  regularMarketDayHigh: 11,
  regularMarketDayLow: 8,
  floatShares: 20_000_000,
  shortPercentOfFloat: 18,
  sharesShort: 500_000,
  ask: 10.02,
  bid: 9.98,
  fiftyDayAverage: 8,
  twoHundredDayAverage: 7,
});

test('scanUniverse filters matches based on required flags', async () => {
  const thresholds = structuredClone(DEFAULT_THRESHOLDS);
  thresholds.marketsEnabled = { US: true };
  const calc = createCalc(thresholds);

  const enabledMarkets = ['US'];
  const fetcher = async (symbols) => ({
    quotes: Object.fromEntries(symbols.map((symbol) => [symbol, buildQuote(symbol)])),
    error: null,
  });

  const { matches, error } = await scanUniverse({ enabledMarkets, calc, fetcher });
  assert.equal(error, null);
  assert.ok(matches.length > 0);
  assert.ok(matches.every((entry) => entry.computed.flags.priceOK));
});

test('scanUniverse returns empty array when markets disabled', async () => {
  const thresholds = structuredClone(DEFAULT_THRESHOLDS);
  const calc = createCalc(thresholds);
  const result = await scanUniverse({ enabledMarkets: [], calc, fetcher: async () => ({ quotes: {}, error: null }) });
  assert.equal(result.matches.length, 0);
  assert.equal(result.error, null);
});
