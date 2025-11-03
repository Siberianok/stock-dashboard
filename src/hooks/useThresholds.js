import { useMemo, useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from './thresholdConfig.js';
import { areThresholdsEqual } from '../utils/thresholds.js';
import { filtersStore } from '../store/filters.js';

const buildKey = (thresholds = DEFAULT_THRESHOLDS) =>
  JSON.stringify({
    marketsEnabled: thresholds.marketsEnabled,
    priceRange: thresholds.priceRange,
    liquidityMin: thresholds.liquidityMin,
    rvolMin: thresholds.rvolMin,
    rvolIdeal: thresholds.rvolIdeal,
    atrMin: thresholds.atrMin,
    atrPctMin: thresholds.atrPctMin,
    chgMin: thresholds.chgMin,
    parabolic50: thresholds.parabolic50,
    needEMA200: thresholds.needEMA200,
    float50: thresholds.float50,
    float10: thresholds.float10,
    rotationMin: thresholds.rotationMin,
    rotationIdeal: thresholds.rotationIdeal,
    shortMin: thresholds.shortMin,
    spreadMaxPct: thresholds.spreadMaxPct,
  });

export function useThresholds() {
  const state = useSyncExternalStore(
    filtersStore.subscribe,
    filtersStore.getState,
    filtersStore.getState,
  );

  const draftThresholds = state.draft.thresholds;
  const appliedThresholds = state.applied.thresholds;
  const history = state.applied.history;
  const hasDraftChanges = state.draft.dirty || !areThresholdsEqual(draftThresholds, appliedThresholds);

  const thresholdsKey = useMemo(() => buildKey(appliedThresholds), [appliedThresholds]);

  const setThresholds = useCallback((value) => {
    filtersStore.updateDraft(value);
  }, []);

  const updatePriceRange = useCallback((market, field, value) => {
    filtersStore.updateDraft((prev) => {
      const prevMarket = prev.priceRange?.[market] || {};
      if (value === undefined) {
        if (!(field in prevMarket)) return prev;
        const nextMarket = { ...prevMarket };
        delete nextMarket[field];
        const nextPriceRange = { ...prev.priceRange };
        if (Object.keys(nextMarket).length) {
          nextPriceRange[market] = nextMarket;
        } else {
          delete nextPriceRange[market];
        }
        return {
          ...prev,
          priceRange: nextPriceRange,
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
  }, []);

  const updateLiquidityMin = useCallback((market, value) => {
    filtersStore.updateDraft((prev) => {
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
  }, []);

  const toggleMarket = useCallback((market, enabled) => {
    filtersStore.updateDraft((prev) => ({
      ...prev,
      marketsEnabled: {
        ...prev.marketsEnabled,
        [market]: enabled,
      },
    }));
  }, []);

  const presetModerado = useCallback(() => {
    filtersStore.updateDraft((prev) => applyPresetModerado(prev));
  }, []);

  const presetAgresivo = useCallback(() => {
    filtersStore.updateDraft((prev) => applyPresetAgresivo(prev));
  }, []);

  const undo = useCallback(() => {
    filtersStore.undo();
  }, []);

  const pushSnapshot = useCallback((label) => {
    filtersStore.pushSnapshot(label);
  }, []);

  const applyDraft = useCallback((options) => {
    filtersStore.applyDraft(options);
  }, []);

  const resetDraft = useCallback(() => {
    filtersStore.resetDraft();
  }, []);

  const startPreview = useCallback(() => {
    filtersStore.startPreview();
  }, []);

  const completePreview = useCallback((result) => {
    filtersStore.completePreview(result);
  }, []);

  const failPreview = useCallback((message) => {
    filtersStore.failPreview(message);
  }, []);

  const clearPreview = useCallback(() => {
    filtersStore.clearPreview();
  }, []);

  return {
    thresholds: draftThresholds,
    appliedThresholds,
    history,
    setThresholds,
    thresholdsKey,
    updatePriceRange,
    updateLiquidityMin,
    toggleMarket,
    presetModerado,
    presetAgresivo,
    undo,
    pushSnapshot,
    applyDraft,
    resetDraft,
    preview: state.preview,
    hasDraftChanges,
    startPreview,
    completePreview,
    failPreview,
    clearPreview,
  };
}
