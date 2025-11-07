import { test } from 'vitest';
import assert from 'node:assert/strict';

import { extractQuoteFields } from '../src/utils/quotes.js';

test('extractQuoteFields normalises volumes and liquidity', () => {
  const quote = {
    symbol: 'TEST',
    regularMarketOpen: 10,
    regularMarketPrice: 12,
    regularMarketVolume: 1_500_000,
    averageDailyVolume10Day: 500_000,
    floatShares: 20_000_000,
    shortPercentOfFloat: 15,
    sharesShort: 1_000_000,
    ask: 12.2,
    bid: 11.8,
    regularMarketDayHigh: 12.5,
    regularMarketDayLow: 9.5,
    fiftyDayAverage: 11,
    twoHundredDayAverage: 9,
  };

  const fields = extractQuoteFields(quote);
  assert.equal(fields.open, 10);
  assert.equal(fields.close, 12);
  assert.equal(fields.volToday, 1_500_000);
  assert.equal(fields.volAvg10, 500_000);
  assert.equal(fields.floatM, 20);
  assert.equal(fields.dtc, 2);
  assert.ok(fields.spreadPct > 0);
  assert.ok(fields.liqM > 0);
});
