import { test } from 'vitest';
import assert from 'node:assert/strict';

import { DEFAULT_THRESHOLDS } from '../src/hooks/thresholdConfig.js';
import {
  selectHistoricalBenchmark,
  clearHistoricalBenchmarkCache,
} from '../src/services/historicalBenchmarks.js';
import { buildHistoricalComparisonDataset } from '../src/utils/historicalBenchmarks.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('selectHistoricalBenchmark caches results for identical filters', async () => {
  clearHistoricalBenchmarkCache();
  const first = await selectHistoricalBenchmark(DEFAULT_THRESHOLDS, { timeRange: '1M' });
  const second = await selectHistoricalBenchmark(clone(DEFAULT_THRESHOLDS), { timeRange: '1M' });
  assert.ok(first);
  assert.strictEqual(first, second);
});

test('selectHistoricalBenchmark reacts to aggressive filters', async () => {
  clearHistoricalBenchmarkCache();
  const base = await selectHistoricalBenchmark(DEFAULT_THRESHOLDS, { timeRange: '1M' });
  const aggressiveThresholds = {
    ...clone(DEFAULT_THRESHOLDS),
    rvolMin: 4,
    chgMin: 25,
    needEMA200: false,
    marketsEnabled: { US: false, AR: true, BR: true, EU: false, CN: false },
  };
  const aggressive = await selectHistoricalBenchmark(aggressiveThresholds, { timeRange: '1M' });
  assert.ok(base);
  assert.ok(aggressive);
  assert.notEqual(base.id, aggressive.id);
});

test('buildHistoricalComparisonDataset produces chart-friendly snapshot', () => {
  const dataset = buildHistoricalComparisonDataset({
    current: {
      averageScore: 72,
      kpis: { top: 110, inPlay: 28, ready70: 14 },
    },
    benchmark: {
      averageScore: 64,
      kpis: { top: 90, inPlay: 20, ready70: 10 },
    },
  });
  assert.deepEqual(dataset.chartData, [
    { metric: 'Score promedio', actual: 72, historical: 64 },
    { metric: 'En juego', actual: 28, historical: 20 },
    { metric: 'Listos ≥70', actual: 14, historical: 10 },
    { metric: 'Score máximo', actual: 110, historical: 90 },
  ]);
  const scoreRow = dataset.rows.find((row) => row.id === 'averageScore');
  assert.ok(scoreRow);
  assert.equal(scoreRow.delta, 8);
  assert.ok(dataset.hasData);
});
