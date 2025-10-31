import { COLORS } from './constants.js';

const clampNumber = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return value;
};

export const calculateKPIs = (entries, totalRows) => {
  const scores = entries.map((entry) => entry.computed?.score || 0);
  const top = scores.length ? Math.max(...scores) : 0;
  const inPlay = entries.filter((entry) => {
    const flags = entry.computed?.flags || {};
    return Boolean(flags.rvol2 && flags.priceOK && flags.emaOK);
  }).length;
  const ready70 = entries.filter((entry) => (entry.computed?.score || 0) >= 70).length;
  return {
    top,
    inPlay,
    ready70,
    total: entries.length,
    totalAll: totalRows,
  };
};

export const calculateScoreBuckets = (entries) => {
  let hi = 0;
  let mid = 0;
  entries.forEach((entry) => {
    const score = entry.computed?.score || 0;
    if (score >= 70) {
      hi += 1;
    } else if (score >= 40) {
      mid += 1;
    }
  });
  const lo = Math.max(0, entries.length - hi - mid);
  return { hi, mid, lo };
};

export const calculatePipelineCounts = (entries) => {
  const price = entries.filter((entry) => entry.computed?.flags?.priceOK).length;
  const ema = entries.filter((entry) => entry.computed?.flags?.priceOK && entry.computed?.flags?.emaOK).length;
  const rvol2 = entries.filter(
    (entry) => entry.computed?.flags?.priceOK && entry.computed?.flags?.emaOK && entry.computed?.flags?.rvol2,
  ).length;
  const ready = entries.filter(
    (entry) =>
      entry.computed?.flags?.priceOK &&
      entry.computed?.flags?.emaOK &&
      entry.computed?.flags?.rvol2 &&
      (entry.computed?.score || 0) >= 70,
  ).length;
  return { price, ema, rvol2, ready };
};

export const buildScoreDistributionData = (buckets, palette = COLORS) => [
  { name: '>=70', value: clampNumber(buckets?.hi), color: palette.scoreHi || COLORS.scoreHi },
  { name: '40–69', value: clampNumber(buckets?.mid), color: palette.scoreMid || COLORS.scoreMid },
  { name: '<40', value: clampNumber(buckets?.lo), color: palette.scoreLo || COLORS.scoreLo },
];

export const buildSankeyData = (pipeline) => {
  const price = clampNumber(pipeline?.price);
  const ema = clampNumber(pipeline?.ema);
  const rvol2 = clampNumber(pipeline?.rvol2);
  const ready = clampNumber(pipeline?.ready);
  const total = Math.max(price, ema, rvol2, ready);
  return {
    nodes: [
      { name: `Universe (${total})` },
      { name: `PrecioOK (${price})` },
      { name: `EMAOK (${ema})` },
      { name: `RVOL≥2 (${rvol2})` },
      { name: `SCORE≥70 (${ready})` },
    ],
    links: [
      { source: 0, target: 1, value: price },
      { source: 1, target: 2, value: ema },
      { source: 2, target: 3, value: rvol2 },
      { source: 3, target: 4, value: ready },
    ],
  };
};

export const buildSnapshot = (entries, totalRows, timestamp) => {
  const kpis = calculateKPIs(entries, totalRows);
  const buckets = calculateScoreBuckets(entries);
  const pipeline = calculatePipelineCounts(entries);
  const sumScore = entries.reduce((acc, entry) => acc + (entry.computed?.score || 0), 0);
  const averageScore = entries.length ? sumScore / entries.length : 0;
  return {
    timestamp,
    kpis,
    buckets,
    pipeline,
    averageScore,
  };
};

const SNAPSHOT_LIMIT = 200;

export const upsertSnapshot = (snapshots, nextSnapshot) => {
  if (!nextSnapshot || !Number.isFinite(nextSnapshot.timestamp)) {
    return snapshots;
  }
  const existingIndex = snapshots.findIndex((snap) => snap.timestamp === nextSnapshot.timestamp);
  if (existingIndex >= 0) {
    const updated = snapshots.slice();
    updated[existingIndex] = nextSnapshot;
    return updated;
  }
  const next = [...snapshots, nextSnapshot].sort((a, b) => a.timestamp - b.timestamp);
  if (next.length > SNAPSHOT_LIMIT) {
    return next.slice(next.length - SNAPSHOT_LIMIT);
  }
  return next;
};

export const TIME_RANGE_WINDOWS = {
  '1D': 24 * 60 * 60 * 1000,
  '5D': 5 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '3M': 90 * 24 * 60 * 60 * 1000,
  ALL: null,
};

export const filterSnapshotsByRange = (snapshots, rangeKey, now = Date.now()) => {
  const windowMs = TIME_RANGE_WINDOWS[rangeKey];
  if (!windowMs) {
    return snapshots.slice();
  }
  const minTs = now - windowMs;
  return snapshots.filter((snapshot) => snapshot.timestamp >= minTs);
};

export const aggregateSnapshots = (snapshots) => {
  if (!snapshots.length) {
    return null;
  }
  const totals = snapshots.reduce(
    (acc, snap) => {
      acc.count += 1;
      acc.kpis.top += snap.kpis.top || 0;
      acc.kpis.inPlay += snap.kpis.inPlay || 0;
      acc.kpis.ready70 += snap.kpis.ready70 || 0;
      acc.kpis.total += snap.kpis.total || 0;
      acc.kpis.totalAll += snap.kpis.totalAll || 0;
      acc.buckets.hi += snap.buckets.hi || 0;
      acc.buckets.mid += snap.buckets.mid || 0;
      acc.buckets.lo += snap.buckets.lo || 0;
      acc.pipeline.price += snap.pipeline.price || 0;
      acc.pipeline.ema += snap.pipeline.ema || 0;
      acc.pipeline.rvol2 += snap.pipeline.rvol2 || 0;
      acc.pipeline.ready += snap.pipeline.ready || 0;
      acc.averageScore += snap.averageScore || 0;
      acc.latest = snap.timestamp;
      return acc;
    },
    {
      count: 0,
      kpis: { top: 0, inPlay: 0, ready70: 0, total: 0, totalAll: 0 },
      buckets: { hi: 0, mid: 0, lo: 0 },
      pipeline: { price: 0, ema: 0, rvol2: 0, ready: 0 },
      averageScore: 0,
      latest: null,
    },
  );
  const count = totals.count || 1;
  const round = (value) => Math.round((value || 0) / count);
  return {
    kpis: {
      top: Math.round((totals.kpis.top || 0) / count),
      inPlay: round(totals.kpis.inPlay),
      ready70: round(totals.kpis.ready70),
      total: round(totals.kpis.total),
      totalAll: round(totals.kpis.totalAll),
    },
    buckets: {
      hi: round(totals.buckets.hi),
      mid: round(totals.buckets.mid),
      lo: round(totals.buckets.lo),
    },
    pipeline: {
      price: round(totals.pipeline.price),
      ema: round(totals.pipeline.ema),
      rvol2: round(totals.pipeline.rvol2),
      ready: round(totals.pipeline.ready),
    },
    averageScore: totals.averageScore / count,
    latestTimestamp: totals.latest,
  };
};

export const serializeSnapshots = (snapshots) => JSON.stringify(snapshots);

export const deserializeSnapshots = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        timestamp: Number(entry.timestamp),
        kpis: entry.kpis || {},
        buckets: entry.buckets || {},
        pipeline: entry.pipeline || {},
        averageScore: Number(entry.averageScore) || 0,
      }))
      .filter((entry) => Number.isFinite(entry.timestamp));
  } catch (error) {
    console.error('No se pudieron leer snapshots guardados', error);
    return [];
  }
};
