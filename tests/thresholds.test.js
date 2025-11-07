import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from '../src/hooks/thresholdConfig.js';
import { createCalc } from '../src/utils/calc.js';

const baseRow = {
  market: 'US',
  open: 10,
  close: 12,
  volToday: 5_000_000,
  volAvg10: 2_000_000,
  floatM: 5,
  atr14: 1.2,
  ema9: 11,
  ema200: 15,
  shortPct: 25,
  spreadPct: 0.5,
  liqM: 60,
  catalyst: false,
  intradiaOK: true,
};

test('applyPresetModerado restores balanced numeric thresholds', () => {
  const custom = structuredClone(DEFAULT_THRESHOLDS);
  custom.rvolMin = 9;
  custom.rvolIdeal = 12;
  custom.chgMin = 25;
  custom.parabolic50 = true;
  custom.atrMin = 2;
  custom.atrPctMin = 8;
  custom.needEMA200 = false;

  const updated = applyPresetModerado(custom);

  assert.equal(updated.rvolMin, 2);
  assert.equal(updated.rvolIdeal, 5);
  assert.equal(updated.chgMin, 10);
  assert.equal(updated.parabolic50, false);
  assert.equal(updated.atrMin, 0.5);
  assert.equal(updated.atrPctMin, 3);
  assert.equal(updated.needEMA200, true);
  assert.equal(updated.float50, custom.float50);
});

test('applyPresetAgresivo enforces higher momentum requirements', () => {
  const custom = structuredClone(DEFAULT_THRESHOLDS);

  const updated = applyPresetAgresivo(custom);

  assert.equal(updated.rvolMin, 3);
  assert.equal(updated.rvolIdeal, 6);
  assert.equal(updated.chgMin, 20);
  assert.equal(updated.parabolic50, true);
  assert.equal(updated.atrMin, 0.6);
  assert.equal(updated.atrPctMin, 4);
  assert.equal(updated.needEMA200, true);
  assert.equal(updated.float10, custom.float10);
});

test('needEMA200 toggle flips emaOK flag and adjusts score immediately', () => {
  const thresholdsWithNeed = structuredClone(DEFAULT_THRESHOLDS);
  thresholdsWithNeed.needEMA200 = true;
  thresholdsWithNeed.parabolic50 = false;

  const calcWithNeed = createCalc(thresholdsWithNeed);
  const resultWithNeed = calcWithNeed(baseRow);

  assert.equal(resultWithNeed.flags.emaOK, false);

  const thresholdsWithoutNeed = { ...thresholdsWithNeed, needEMA200: false };
  const calcWithoutNeed = createCalc(thresholdsWithoutNeed);
  const resultWithoutNeed = calcWithoutNeed(baseRow);

  assert.equal(resultWithoutNeed.flags.emaOK, true);
  assert.ok(resultWithoutNeed.score > resultWithNeed.score);

  const calcReset = createCalc({ ...thresholdsWithoutNeed, needEMA200: true });
  const resultReset = calcReset(baseRow);
  assert.equal(resultReset.flags.emaOK, resultWithNeed.flags.emaOK);
  assert.equal(resultReset.score, resultWithNeed.score);
});

test('parabolic mode switch tightens and releases chgOK flag as expected', () => {
  const thresholdsBase = structuredClone(DEFAULT_THRESHOLDS);
  thresholdsBase.needEMA200 = false;
  thresholdsBase.parabolic50 = false;

  const calcBase = createCalc(thresholdsBase);
  const baseResult = calcBase(baseRow);
  assert.equal(baseResult.flags.chgOK, true);

  const thresholdsParabolic = { ...thresholdsBase, parabolic50: true };
  const calcParabolic = createCalc(thresholdsParabolic);
  const parabolicResult = calcParabolic(baseRow);
  assert.equal(parabolicResult.flags.chgOK, false);

  const thresholdsReset = { ...thresholdsParabolic, parabolic50: false };
  const calcReset = createCalc(thresholdsReset);
  const resetResult = calcReset(baseRow);
  assert.equal(resetResult.flags.chgOK, true);
  assert.ok(resetResult.score >= baseResult.score);
});
