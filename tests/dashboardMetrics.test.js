import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateSnapshots,
  buildSnapshot,
  buildSankeyData,
  buildScoreDistributionData,
  calculateKPIs,
  calculatePipelineCounts,
  calculateScoreBuckets,
  filterSnapshotsByRange,
  TIME_RANGE_WINDOWS,
  upsertSnapshot,
} from '../src/utils/dashboardMetrics.js';

const buildEntry = ({ score = 0, flags = {} } = {}) => ({ computed: { score, flags } });

test('calculateKPIs summarises KPI values correctly', () => {
  const entries = [
    buildEntry({ score: 85, flags: { priceOK: true, emaOK: true, rvol2: true } }),
    buildEntry({ score: 65, flags: { priceOK: true, emaOK: true } }),
    buildEntry({ score: 35, flags: { priceOK: false } }),
  ];
  const kpis = calculateKPIs(entries, 5);
  assert.equal(kpis.top, 85);
  assert.equal(kpis.inPlay, 1);
  assert.equal(kpis.ready70, 1);
  assert.equal(kpis.total, 3);
  assert.equal(kpis.totalAll, 5);
});

test('calculateScoreBuckets splits scores into buckets', () => {
  const entries = [
    buildEntry({ score: 72 }),
    buildEntry({ score: 71 }),
    buildEntry({ score: 55 }),
    buildEntry({ score: 44 }),
    buildEntry({ score: 10 }),
  ];
  const buckets = calculateScoreBuckets(entries);
  assert.equal(buckets.hi, 2);
  assert.equal(buckets.mid, 2);
  assert.equal(buckets.lo, 1);
});

test('calculatePipelineCounts respects flag hierarchy', () => {
  const entries = [
    buildEntry({ flags: { priceOK: true, emaOK: true, rvol2: true }, score: 80 }),
    buildEntry({ flags: { priceOK: true, emaOK: false, rvol2: true }, score: 60 }),
    buildEntry({ flags: { priceOK: true, emaOK: true, rvol2: false }, score: 50 }),
  ];
  const pipeline = calculatePipelineCounts(entries);
  assert.equal(pipeline.price, 3);
  assert.equal(pipeline.ema, 2);
  assert.equal(pipeline.rvol2, 1);
  assert.equal(pipeline.ready, 1);
});

test('buildSnapshot stores aggregates and average score', () => {
  const entries = [
    buildEntry({ score: 80, flags: { priceOK: true, emaOK: true, rvol2: true } }),
    buildEntry({ score: 60, flags: { priceOK: true, emaOK: true } }),
  ];
  const snapshot = buildSnapshot(entries, 3, 123);
  assert.equal(snapshot.timestamp, 123);
  assert.equal(snapshot.kpis.top, 80);
  assert.equal(snapshot.buckets.hi, 1);
  assert.equal(snapshot.pipeline.price, 2);
  assert.equal(snapshot.averageScore, 70);
});

test('upsertSnapshot enforces uniqueness and limit', () => {
  const base = [];
  const first = buildSnapshot([], 0, 1);
  const second = buildSnapshot([], 0, 2);
  let next = upsertSnapshot(base, first);
  next = upsertSnapshot(next, second);
  next = upsertSnapshot(next, { ...first, timestamp: 2, averageScore: 5 });
  assert.equal(next.length, 2);
  assert.equal(next[1].averageScore, 5);
  const many = Array.from({ length: 220 }, (_, idx) => buildSnapshot([], 0, idx + 10));
  let limited = [];
  many.forEach((snap) => {
    limited = upsertSnapshot(limited, snap);
  });
  assert.ok(limited.length <= 200);
  assert.equal(limited[0].timestamp, many[many.length - 200].timestamp);
});

test('filterSnapshotsByRange respects configured windows', () => {
  const now = 1_000_000;
  const snapshots = [
    buildSnapshot([], 0, now - TIME_RANGE_WINDOWS['1D'] - 1000),
    buildSnapshot([], 0, now - 1000),
    buildSnapshot([], 0, now),
  ];
  const filtered = filterSnapshotsByRange(snapshots, '1D', now);
  assert.equal(filtered.length, 2);
});

test('aggregateSnapshots averages metrics over time', () => {
  const a = buildSnapshot([buildEntry({ score: 80, flags: { priceOK: true, emaOK: true, rvol2: true } })], 2, 10);
  const b = buildSnapshot([buildEntry({ score: 60, flags: { priceOK: true, emaOK: true } })], 4, 20);
  const aggregated = aggregateSnapshots([a, b]);
  assert.equal(aggregated.kpis.top, 70);
  assert.equal(aggregated.kpis.total, 1);
  assert.equal(aggregated.buckets.hi, 1);
  assert.equal(aggregated.pipeline.price, 1);
  assert.ok(aggregated.averageScore > 0);
  assert.equal(aggregated.latestTimestamp, 20);
});

test('buildScoreDistributionData and buildSankeyData generate chart payloads', () => {
  const buckets = { hi: 3, mid: 2, lo: 1 };
  const scoreData = buildScoreDistributionData(buckets, { scoreHi: '#111', scoreMid: '#222', scoreLo: '#333' });
  assert.deepEqual(scoreData, [
    { name: '>=70', value: 3, color: '#111' },
    { name: '40–69', value: 2, color: '#222' },
    { name: '<40', value: 1, color: '#333' },
  ]);
  const sankey = buildSankeyData({ price: 5, ema: 4, rvol2: 3, ready: 2 });
  assert.equal(sankey.nodes.length, 5);
  assert.equal(sankey.links[0].value, 5);
});
