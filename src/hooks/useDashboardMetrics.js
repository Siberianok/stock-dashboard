import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  aggregateSnapshots,
  buildSnapshot,
  buildSankeyData,
  buildScoreDistributionData,
  deserializeSnapshots,
  filterSnapshotsByRange,
  serializeSnapshots,
  TIME_RANGE_WINDOWS,
  upsertSnapshot,
} from '../utils/dashboardMetrics.js';

const STORAGE_KEY = 'dashboard.snapshots.v1';

const loadSnapshots = () => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return deserializeSnapshots(stored);
  } catch (error) {
    console.error('No se pudo leer el historial de métricas', error);
    return [];
  }
};

const persistSnapshots = (snapshots) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeSnapshots(snapshots));
  } catch (error) {
    console.error('No se pudo guardar el historial de métricas', error);
  }
};

const DEFAULT_RANGE = '1D';

export const useDashboardMetrics = ({ activeComputed, totalRows, lastUpdated, palette }) => {
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [timeRange, setTimeRange] = useState(DEFAULT_RANGE);

  useEffect(() => {
    persistSnapshots(snapshots);
  }, [snapshots]);

  useEffect(() => {
    if (!lastUpdated || !activeComputed?.length) {
      return;
    }
    const timestamp = Number(new Date(lastUpdated).getTime());
    if (!Number.isFinite(timestamp)) {
      return;
    }
    const snapshot = buildSnapshot(activeComputed, totalRows, timestamp);
    setSnapshots((prev) => upsertSnapshot(prev, snapshot));
  }, [activeComputed, lastUpdated, totalRows]);

  const filteredSnapshots = useMemo(
    () => filterSnapshotsByRange(snapshots, timeRange),
    [snapshots, timeRange],
  );

  const aggregated = useMemo(() => {
    if (filteredSnapshots.length) {
      return aggregateSnapshots(filteredSnapshots);
    }
    if (activeComputed.length) {
      const fallbackTimestamp = Number(new Date(lastUpdated).getTime());
      const normalizedTimestamp = Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : Date.now();
      return {
        ...buildSnapshot(activeComputed, totalRows, normalizedTimestamp),
        latestTimestamp: Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : null,
      };
    }
    return {
      kpis: { top: 0, inPlay: 0, ready70: 0, total: 0, totalAll: totalRows },
      buckets: { hi: 0, mid: 0, lo: 0 },
      pipeline: { price: 0, ema: 0, rvol2: 0, ready: 0 },
      averageScore: 0,
      latestTimestamp: null,
    };
  }, [filteredSnapshots, activeComputed, totalRows, lastUpdated]);

  const scoreDistribution = useMemo(
    () => buildScoreDistributionData(aggregated.buckets, palette),
    [aggregated.buckets, palette],
  );

  const sankeyData = useMemo(
    () => buildSankeyData(aggregated.pipeline),
    [aggregated.pipeline],
  );

  const clearHistory = useCallback(() => setSnapshots([]), []);

  const changeRange = useCallback((nextRange) => {
    if (!(nextRange in TIME_RANGE_WINDOWS)) return;
    setTimeRange(nextRange);
  }, []);

  return {
    timeRange,
    setTimeRange: changeRange,
    kpis: aggregated.kpis,
    scoreDistribution,
    sankeyData,
    averageScore: aggregated.averageScore,
    lastSnapshotTimestamp: aggregated.latestTimestamp,
    snapshots: filteredSnapshots,
    hasSnapshots: snapshots.length > 0,
    clearHistory,
  };
};
