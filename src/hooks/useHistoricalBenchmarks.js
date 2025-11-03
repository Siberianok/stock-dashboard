import { useEffect, useMemo, useState } from 'react';
import { selectHistoricalBenchmarkByFeatures, buildBenchmarkFeatures } from '../services/historicalBenchmarks.js';

const buildRequestKey = (features, timeRange) => JSON.stringify({ features, timeRange });

export const useHistoricalBenchmarks = ({ thresholds, timeRange }) => {
  const features = useMemo(() => buildBenchmarkFeatures(thresholds), [thresholds]);
  const requestKey = useMemo(() => buildRequestKey(features, timeRange), [features, timeRange]);

  const [state, setState] = useState({ benchmark: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ benchmark: prev.benchmark, loading: true, error: null }));
    selectHistoricalBenchmarkByFeatures(features, { timeRange })
      .then((benchmark) => {
        if (cancelled) return;
        setState({ benchmark, loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ benchmark: null, loading: false, error: error?.message || 'No se pudo cargar benchmarks' });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, features, timeRange]);

  return state;
};
