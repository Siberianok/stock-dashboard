import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useRadarChartData } from '../src/hooks/useRadarChartData.js';

test('useRadarChartData normalizes metrics using thresholds', () => {
  let result = null;
  const selectedCalc = {
    rvol: 4,
    chgPct: 25,
    atrPct: 6,
    rotation: 3,
    score: 82,
  };
  const selectedRow = { shortPct: 15 };
  const thresholds = {
    rvolIdeal: 2,
    parabolic50: false,
    chgMin: 10,
    atrPctMin: 2,
    rotationIdeal: 4,
    shortMin: 20,
  };

  function Wrapper() {
    result = useRadarChartData({ selectedCalc, selectedRow, thresholds });
    return React.createElement('div');
  }

  renderToStaticMarkup(React.createElement(Wrapper));

  assert.ok(Array.isArray(result));
  const scoreEntry = result.find((entry) => entry.k === 'SCORE');
  assert.equal(scoreEntry.v, 82);
  const rvolEntry = result.find((entry) => entry.k === 'RVOL');
  assert.equal(rvolEntry.v, 100);
  const shortEntry = result.find((entry) => entry.k === 'Short%');
  assert.equal(shortEntry.v, 75);
});

test('useRadarChartData returns empty array without calc', () => {
  let result = null;
  function Wrapper() {
    result = useRadarChartData({ selectedCalc: null, selectedRow: null, thresholds: {} });
    return React.createElement('div');
  }

  renderToStaticMarkup(React.createElement(Wrapper));
  assert.deepEqual(result, []);
});
