import { test } from 'vitest';
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
      const { quotes, coverage } = await fetchQuotes(['AAPL']);
      assert.equal(calls, 1);
      assert.ok(quotes.AAPL);
      assert.equal(coverage.totalRequested, 1);
      assert.equal(coverage.totalFetched, 1);
    });

    await t.test('subsequent call uses cache', async () => {
      const { quotes, coverage } = await fetchQuotes(['AAPL']);
      assert.equal(calls, 1);
      assert.ok(quotes.AAPL);
      assert.equal(coverage.totalRequested, 1);
      assert.equal(coverage.totalFetched, 1);
    });

    await t.test('force option bypasses cache', async () => {
      const { quotes, coverage } = await fetchQuotes(['AAPL'], { force: true });
      assert.equal(calls, 2);
      assert.ok(quotes.AAPL);
      assert.equal(coverage.totalRequested, 1);
      assert.equal(coverage.totalFetched, 1);
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
    const { error, quotes, coverage } = await fetchQuotes(['AAPL']);
    assert.equal(Object.keys(quotes).length, 0);
    assert.ok(error?.includes('Yahoo limitó las consultas'));
    assert.ok(error?.includes(String(retryAfter)));
    assert.equal(coverage.totalFetched, 0);
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});

test('fetchQuotes valida datos y conserva fallback', async () => {
  clearCache();
  const responses = [
    {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({
        quoteResponse: {
          result: [
            {
              symbol: 'MSFT',
              regularMarketPrice: 10,
              regularMarketOpen: 9,
              regularMarketVolume: 1_000_000,
            },
          ],
        },
      }),
    },
    {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({
        quoteResponse: {
          result: [
            {
              symbol: 'MSFT',
              regularMarketPrice: null,
              regularMarketOpen: 9,
              regularMarketVolume: null,
            },
          ],
        },
      }),
    },
  ];
  let idx = 0;
  global.fetch = async () => responses[idx++];

  try {
    const first = await fetchQuotes(['MSFT']);
    assert.equal(first.error, null);
    assert.ok(first.quotes.MSFT);
    const second = await fetchQuotes(['MSFT'], { force: true });
    assert.ok(second.error);
    assert.ok(second.staleSymbols.includes('MSFT'));
    assert.ok(second.invalidSymbols.includes('MSFT'));
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});

test('fetchQuotes usa modo simulado cuando se solicita', async () => {
  clearCache();
  global.fetch = async () => {
    throw new Error('No debería llamar a fetch en modo simulado');
  };

  try {
    const { quotes, coverage, error } = await fetchQuotes(['NVDA', 'TSLA'], { mode: 'mock' });
    assert.equal(error, null);
    assert.equal(Object.keys(quotes).length, 2);
    assert.equal(coverage.totalFetched, 2);
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});

test('fetchQuotes respeta concurrencia máxima', async () => {
  clearCache();
  const symbols = Array.from({ length: 120 }, (_, i) => `SYM${i}`);
  let active = 0;
  let maxActive = 0;
  global.fetch = async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    const params = new URL(url).searchParams.get('symbols');
    const chunkSymbols = decodeURIComponent(params).split(',');
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({
        quoteResponse: {
          result: chunkSymbols.map((symbol) => ({
            symbol,
            regularMarketPrice: 20,
            regularMarketOpen: 19,
            regularMarketVolume: 2_000_000,
          })),
        },
      }),
    };
  };

  try {
    const { coverage } = await fetchQuotes(symbols);
    assert.equal(coverage.totalFetched, symbols.length);
    assert.ok(maxActive <= 2);
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});

test('fetchQuotes separa cache por mercado', async () => {
  clearCache();
  let calls = 0;
  global.fetch = async (url) => {
    calls += 1;
    const params = new URL(url).searchParams.get('symbols');
    const symbol = decodeURIComponent(params);
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({
        quoteResponse: {
          result: [
            {
              symbol,
              regularMarketPrice: 30,
              regularMarketOpen: 29,
              regularMarketVolume: 500_000,
            },
          ],
        },
      }),
    };
  };

  try {
    await fetchQuotes(['AAPL'], { marketBySymbol: { AAPL: 'US' } });
    await fetchQuotes(['AAPL'], { marketBySymbol: { AAPL: 'AR' } });
    assert.equal(calls, 2);
  } finally {
    clearCache();
    global.fetch = originalFetch;
  }
});
