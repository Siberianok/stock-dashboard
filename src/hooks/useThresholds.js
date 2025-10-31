import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from './thresholdConfig.js';
import {
  normalizeThresholds,
  areThresholdsEqual,
} from '../utils/thresholds.js';
import {
  loadThresholdState,
  persistThresholdState,
  createSnapshot,
  MAX_THRESHOLD_HISTORY,
} from '../services/storage/thresholdStorage.js';

const cloneState = (state) => ({
  thresholds: normalizeThresholds(state.thresholds ?? DEFAULT_THRESHOLDS),
  history: Array.isArray(state.history) ? [...state.history] : [],
});

export function useThresholds() {
  const [state, setState] = useState(() => cloneState(loadThresholdState()));

  useEffect(() => {
    persistThresholdState(state);
  }, [state]);

  const commit = useCallback((updater, { snapshot = true, label } = {}) => {
    setState((prevState) => {
      const previous = prevState.thresholds;
      const nextValue = typeof updater === 'function' ? updater(previous) : updater;
      const normalized = normalizeThresholds(nextValue);

      if (areThresholdsEqual(previous, normalized)) {
        return prevState;
      }

      const nextHistory = snapshot
        ? [...prevState.history, createSnapshot(previous, { label })].slice(-MAX_THRESHOLD_HISTORY)
        : prevState.history;

      return {
        thresholds: normalized,
        history: nextHistory,
      };
    });
  }, []);

  const setThresholds = useCallback((value) => {
    commit(value);
  }, [commit]);

  const updatePriceRange = useCallback((market, field, value) => {
    commit((prev) => {
      const prevMarket = prev.priceRange?.[market] || {};
      if (value === undefined) {
        if (!(field in prevMarket)) return prev;
        const nextMarket = { ...prevMarket };
        delete nextMarket[field];
        return {
          ...prev,
          priceRange: {
            ...prev.priceRange,
            [market]: nextMarket,
          },
        };
      }
      return {
        ...prev,
        priceRange: {
          ...prev.priceRange,
          [market]: { ...prevMarket, [field]: value },
        },
      };
    });
  }, [commit]);

  const updateLiquidityMin = useCallback((market, value) => {
    commit((prev) => {
      const prevLiquidity = prev.liquidityMin || {};
      if (value === undefined) {
        if (!(market in prevLiquidity)) return prev;
        const nextLiquidity = { ...prevLiquidity };
        delete nextLiquidity[market];
        return {
          ...prev,
          liquidityMin: nextLiquidity,
        };
      }
      return {
        ...prev,
        liquidityMin: {
          ...prevLiquidity,
          [market]: value,
        },
      };
    });
  }, [commit]);

  const toggleMarket = useCallback((market, enabled) => {
    commit((prev) => ({
      ...prev,
      marketsEnabled: {
        ...prev.marketsEnabled,
        [market]: enabled,
      },
    }));
  }, [commit]);

  const presetModerado = useCallback(() => {
    commit((prev) => applyPresetModerado(prev), { label: 'Preset moderado' });
  }, [commit]);

  const presetAgresivo = useCallback(() => {
    commit((prev) => applyPresetAgresivo(prev), { label: 'Preset agresivo' });
  }, [commit]);

  const undo = useCallback(() => {
    setState((prevState) => {
      if (!prevState.history.length) {
        return prevState;
      }
      const nextHistory = prevState.history.slice(0, -1);
      const lastSnapshot = prevState.history[prevState.history.length - 1];
      const restored = normalizeThresholds(lastSnapshot.thresholds);
      if (areThresholdsEqual(prevState.thresholds, restored)) {
        return {
          thresholds: restored,
          history: nextHistory,
        };
      }
      return {
        thresholds: restored,
        history: nextHistory,
      };
    });
  }, []);

  const pushSnapshot = useCallback((label) => {
    setState((prevState) => {
      const nextHistory = [...prevState.history, createSnapshot(prevState.thresholds, { label })]
        .slice(-MAX_THRESHOLD_HISTORY);
      return {
        thresholds: prevState.thresholds,
        history: nextHistory,
      };
    });
  }, []);

  const thresholdsKey = useMemo(
    () => JSON.stringify({
      marketsEnabled: state.thresholds.marketsEnabled,
      priceRange: state.thresholds.priceRange,
      liquidityMin: state.thresholds.liquidityMin,
      rvolMin: state.thresholds.rvolMin,
      rvolIdeal: state.thresholds.rvolIdeal,
      atrMin: state.thresholds.atrMin,
      atrPctMin: state.thresholds.atrPctMin,
      chgMin: state.thresholds.chgMin,
      parabolic50: state.thresholds.parabolic50,
      needEMA200: state.thresholds.needEMA200,
      float50: state.thresholds.float50,
      float10: state.thresholds.float10,
      rotationMin: state.thresholds.rotationMin,
      rotationIdeal: state.thresholds.rotationIdeal,
      shortMin: state.thresholds.shortMin,
      spreadMaxPct: state.thresholds.spreadMaxPct,
    }),
    [state.thresholds],
  );

  return {
    thresholds: state.thresholds,
    history: state.history,
    setThresholds,
    thresholdsKey,
    updatePriceRange,
    updateLiquidityMin,
    toggleMarket,
    presetModerado,
    presetAgresivo,
    undo,
    pushSnapshot,
  };
}
