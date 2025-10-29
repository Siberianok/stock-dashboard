import { extractQuoteFields } from '../src/utils/quotes.js';

const quote = {
  ask: 10,
  bid: 10,
  regularMarketPrice: 10,
  regularMarketVolume: 0,
  regularMarketDayHigh: 10,
  regularMarketDayLow: 10,
};

const { spreadPct, liqM } = extractQuoteFields(quote);

console.assert(spreadPct === 0, `Expected spreadPct to be 0 but received ${spreadPct}`);
console.assert(liqM === 0, `Expected liqM to be 0 but received ${liqM}`);

console.log('Zero spread and liquidity preservation test passed.');
