import { test } from 'vitest';
import assert from 'node:assert/strict';

import { DEFAULT_THRESHOLDS } from '../src/hooks/thresholdConfig.js';
import {
  filterThresholdSchema,
  validateThresholdDraft,
  THRESHOLD_FIELD_VALIDATIONS,
} from '../src/validation/filterRules.js';
import { createThresholdSignature } from '../src/utils/thresholds.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('filterThresholdSchema accepts normalized defaults', () => {
  const result = filterThresholdSchema.safeParse(clone(DEFAULT_THRESHOLDS));
  assert.equal(result.success, true, 'default thresholds should be valid');
});

test('validateThresholdDraft returns normalized values and no errors for defaults', () => {
  const result = validateThresholdDraft(DEFAULT_THRESHOLDS);
  assert.equal(result.success, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.priceRange.US.min, DEFAULT_THRESHOLDS.priceRange.US.min);
});

test('validateThresholdDraft detects rvolIdeal below rvolMin', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.rvolIdeal = invalid.rvolMin - 1;
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, false);
  assert.equal(result.errors['rvolIdeal'], `Debe ser ≥ ${invalid.rvolMin}`);
});

test('price range min greater than max is rejected', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.priceRange.US = { min: 15, max: 10 };
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, false);
  assert.equal(result.errors['priceRange.US.max'], 'Debe ser ≥ mínimo');
});

test('multiple markets with inverted ranges flag each error path', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.priceRange.US = { min: 30, max: 10 };
  invalid.priceRange.EU = { min: 55, max: 20 };
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, false);
  assert.equal(result.errors['priceRange.US.max'], 'Debe ser ≥ mínimo');
  assert.equal(result.errors['priceRange.EU.max'], 'Debe ser ≥ mínimo');
});

test('float preferences enforce ordering', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.float10 = invalid.float50 + 5;
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, false);
  assert.equal(result.errors['float10'], `Debe ser ≤ ${invalid.float50}`);
});

test('rotation ideal cannot drop below minimum', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.rotationIdeal = invalid.rotationMin - 0.5;
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, false);
  assert.equal(result.errors['rotationIdeal'], `Debe ser ≥ ${invalid.rotationMin}`);
});

test('short interest percentage is capped at 100', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.shortMin = 150;
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, true);
  assert.equal(result.value.shortMin, 100);
});

test('spread values are normalized to three decimals', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.spreadMaxPct = 1.23456;
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, true);
  assert.equal(result.value.spreadMaxPct, 1.235);
});

test('null numeric values fall back to defaults without crashing', () => {
  const invalid = clone(DEFAULT_THRESHOLDS);
  invalid.rvolMin = null;
  invalid.priceRange.US = { min: null, max: null };
  invalid.liquidityMin.US = null;
  const result = validateThresholdDraft(invalid);
  assert.equal(result.success, true);
  assert.equal(result.value.rvolMin, DEFAULT_THRESHOLDS.rvolMin);
  assert.equal(result.value.priceRange.US.min, DEFAULT_THRESHOLDS.priceRange.US.min);
  assert.equal(result.value.priceRange.US.max, DEFAULT_THRESHOLDS.priceRange.US.max);
  assert.equal(result.value.liquidityMin.US, DEFAULT_THRESHOLDS.liquidityMin.US);
});

test('validation map covers every editable filter field', () => {
  const mappedKeys = new Set(Object.keys(THRESHOLD_FIELD_VALIDATIONS));
  const required = [
    'marketsEnabled',
    'priceRangeMin',
    'priceRangeMax',
    'liquidityMin',
    'rvolMin',
    'rvolIdeal',
    'atrMin',
    'atrPctMin',
    'chgMin',
    'float50',
    'float10',
    'rotationMin',
    'rotationIdeal',
    'shortMin',
    'spreadMaxPct',
    'parabolic50',
    'needEMA200',
  ];
  required.forEach((key) => {
    assert.ok(mappedKeys.has(key), `Missing validation mapping for ${key}`);
  });
});

test('createThresholdSignature produces stable key for matching subsets', () => {
  const keyA = createThresholdSignature(DEFAULT_THRESHOLDS);
  const cloneB = clone(DEFAULT_THRESHOLDS);
  cloneB.history = [{ label: 'sample', thresholds: clone(DEFAULT_THRESHOLDS) }];
  const keyB = createThresholdSignature(cloneB);
  assert.equal(keyA, keyB);
});
