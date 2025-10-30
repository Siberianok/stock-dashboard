import test from 'node:test';
import assert from 'node:assert/strict';
import { extractQuoteFields } from '../src/utils/quotes.js';

test('preserves zero values for spread and liquidity', () => {
  const quote = {
    ask: 10,
    bid: 10,
    regularMarketPrice: 10,
    regularMarketVolume: 0,
    regularMarketDayHigh: 10,
    regularMarketDayLow: 10,
  };

  const { spreadPct, liqM } = extractQuoteFields(quote);

  assert.equal(spreadPct, 0);
  assert.equal(liqM, 0);
});
