import { test } from 'vitest';
import assert from 'node:assert/strict';

import { createCalc } from '../src/utils/calc.js';
import { DEFAULT_THRESHOLDS } from '../src/hooks/thresholdConfig.js';

const sampleRow = {
  id: 'row-1',
  ticker: 'AAA',
  market: 'US',
  open: 10,
  close: 12,
  volToday: 2_000_000,
  volAvg10: 1_000_000,
  floatM: 10,
  atr14: 1.2,
  ema9: 11,
  ema200: 9,
  shortPct: 20,
  spreadPct: 0.4,
  liqM: 24,
  intradiaOK: true,
  catalyst: true,
};

test('createCalc memoises results per row signature', () => {
  const calc = createCalc(DEFAULT_THRESHOLDS);
  const resultA = calc(sampleRow, 'US');
  const resultB = calc(sampleRow, 'US');
  assert.equal(resultA, resultB);

  const modifiedRow = { ...sampleRow, close: 14 };
  const resultC = calc(modifiedRow, 'US');
  assert.notEqual(resultA, resultC);
  assert.ok(resultC.score >= resultA.score);
});
