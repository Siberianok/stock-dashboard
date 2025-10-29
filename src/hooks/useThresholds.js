import { useMemo, useState, useCallback } from 'react';
import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from './thresholdConfig.js';

export const useThresholds = () => {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  const updatePriceRange = useCallback((market, field, value) => {
    setThresholds((prev) => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [market]: { ...(prev.priceRange?.[market] || {}), [field]: value },
      },
    }));
  }, []);

  const updateLiquidityMin = useCallback((market, value) => {
    setThresholds((prev) => ({
      ...prev,
      liquidityMin: {
        ...prev.liquidityMin,
        [market]: value,
      },
    }));
  }, []);

  const toggleMarket = useCallback((market, enabled) => {
    setThresholds((prev) => ({
      ...prev,
      marketsEnabled: {
        ...prev.marketsEnabled,
        [market]: enabled,
      },
    }));
  }, []);

  const presetModerado = useCallback(() => {
    setThresholds((prev) => applyPresetModerado(prev));
  }, []);

  const presetAgresivo = useCallback(() => {
    setThresholds((prev) => applyPresetAgresivo(prev));
  }, []);

  const thresholdsKey = useMemo(() => JSON.stringify({
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
  })), [thresholds]);

  return {
    thresholds,
    setThresholds,
    thresholdsKey,
    updatePriceRange,
    updateLiquidityMin,
    toggleMarket,
    presetModerado,
    presetAgresivo,
  };
};
