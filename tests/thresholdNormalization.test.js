import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_THRESHOLDS } from '../src/hooks/thresholdConfig.js';
import {
  normalizeThresholds,
  normalizeNumericValue,
} from '../src/utils/thresholds.js';
import {
  createSnapshot,
  loadThresholdState,
  persistThresholdState,
  MAX_THRESHOLD_HISTORY,
} from '../src/services/storage/thresholdStorage.js';

const almostEqual = (a, b, epsilon = 1e-6) => Math.abs(a - b) < epsilon;

test('normalizeNumericValue clamps and rounds consistently', () => {
  assert.equal(normalizeNumericValue('12.3456', { decimals: 2 }), 12.35);
  assert.equal(normalizeNumericValue('12,3456', { decimals: 2 }), 12.35);
  assert.equal(normalizeNumericValue(0.0049, { decimals: 3 }), 0.005);
  assert.equal(normalizeNumericValue(-5, { min: 0, decimals: 2 }), 0);
  assert.equal(normalizeNumericValue(110, { max: 100, decimals: 0 }), 100);
  assert.equal(normalizeNumericValue('nope', { decimals: 2 }), undefined);
});

test('normalizeThresholds merges defaults and normalizes per market values', () => {
  const dirty = {
    marketsEnabled: { US: false, EU: 'yes', BR: 0 },
    priceRange: {
      US: { min: '5.123', max: '20.879' },
      AR: { min: -5 },
    },
    liquidityMin: {
      US: '10.5',
      CN: -1,
      BR: 22.789,
    },
    rvolMin: '3.777',
    shortMin: 120,
    spreadMaxPct: '0.4567',
    needEMA200: 'false',
    parabolic50: true,
  };

  const normalized = normalizeThresholds(dirty);

  assert.equal(normalized.marketsEnabled.US, false);
  assert.equal(normalized.marketsEnabled.EU, true);
  assert.equal(normalized.marketsEnabled.BR, false);
  assert.equal(normalized.priceRange.US.min, 5.12);
  assert.equal(normalized.priceRange.US.max, 20.88);
  assert.equal(normalized.priceRange.AR.min, 0);
  assert.equal(normalized.liquidityMin.US, 10.5);
  assert.equal(normalized.liquidityMin.CN, DEFAULT_THRESHOLDS.liquidityMin.CN);
  assert.equal(normalized.liquidityMin.BR, 22.79);
  assert.ok(almostEqual(normalized.rvolMin, 3.78));
  assert.equal(normalized.shortMin, 100);
  assert.equal(normalized.spreadMaxPct, 0.457);
  assert.equal(normalized.needEMA200, DEFAULT_THRESHOLDS.needEMA200);
  assert.equal(normalized.parabolic50, true);
});

test('createSnapshot clones and timestamps thresholds', () => {
  const payload = { ...DEFAULT_THRESHOLDS, rvolMin: 9.9 };
  const savedAt = '2024-01-01T00:00:00.000Z';
  const snapshot = createSnapshot(payload, { label: 'Test', savedAt });

  assert.equal(snapshot.label, 'Test');
  assert.equal(snapshot.savedAt, savedAt);
  assert.notStrictEqual(snapshot.thresholds, payload);
  assert.equal(snapshot.thresholds.rvolMin, 9.9);

  payload.rvolMin = 1;
  assert.equal(snapshot.thresholds.rvolMin, 9.9);
});

test('persistThresholdState stores normalized state and trims history', () => {
  persistThresholdState({ thresholds: DEFAULT_THRESHOLDS, history: [] });
  const history = [];
  for (let i = 0; i < MAX_THRESHOLD_HISTORY + 5; i += 1) {
    history.push(createSnapshot(DEFAULT_THRESHOLDS, { label: `snap-${i}`, savedAt: `2024-01-01T00:00:${String(i).padStart(2, '0')}.000Z` }));
  }

  const state = {
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      rvolMin: 4.444,
      priceRange: {
        ...DEFAULT_THRESHOLDS.priceRange,
        US: { min: 1.2345, max: 9.8765 },
      },
    },
    history,
  };

  const persisted = persistThresholdState(state);

  assert.equal(persisted.thresholds.rvolMin, 4.44);
  assert.equal(persisted.thresholds.priceRange.US.min, 1.23);
  assert.equal(persisted.history.length, MAX_THRESHOLD_HISTORY);

  const reloaded = loadThresholdState();
  assert.equal(reloaded.thresholds.rvolMin, 4.44);
  assert.equal(reloaded.history.length, MAX_THRESHOLD_HISTORY);

  persistThresholdState({ thresholds: DEFAULT_THRESHOLDS, history: [] });
});
