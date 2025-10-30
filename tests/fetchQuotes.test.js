import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchQuotes, clearCache } from '../src/services/yahooFinance.js';

const originalFetch = global.fetch;

test('fetchQuotes caches results and honours force option', async (t) => {
  clearCache();
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({
        quoteResponse: {
          result: [
            {
              symbol: 'AAPL',
              regularMarketPrice: 10,
              regularMarketOpen: 9,
              regularMarketVolume: 1_000_000,
              averageDailyVolume10Day: 500_000,
              floatShares: 50_000_000,
              fiftyDayAverage: 8,
              twoHundredDayAverage: 7,
            },
          ],
        },
      }),
    };
  };

  try {
    await t.test('initial call hits network', async () => {
      const { quotes } = await fetchQuotes(['AAPL']);
      assert.equal(calls, 1);
      assert.ok(quotes.AAPL);
    });

    await t.test('subsequent call uses cache', async () => {
      const { quotes } = await fetchQuotes(['AAPL']);
      assert.equal(calls, 1);
      assert.ok(quotes.AAPL);
    });

    await t.test('force option bypasses cache', async () => {
      const { quotes } = await fetchQuotes(['AAPL'], { force: true });
      assert.equal(calls, 2);
      assert.ok(quotes.AAPL);
    });
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});

test('fetchQuotes reports rate limit gracefully', async () => {
  clearCache();
  const retryAfter = 120;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    headers: {
      get: (name) => (name === 'Retry-After' ? String(retryAfter) : null),
    },
    json: async () => ({ quoteResponse: { result: [] } }),
  });

  try {
    const { error, quotes } = await fetchQuotes(['AAPL']);
    assert.equal(Object.keys(quotes).length, 0);
    assert.ok(error?.includes('Yahoo limitó las consultas'));
    assert.ok(error?.includes(String(retryAfter)));
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});
