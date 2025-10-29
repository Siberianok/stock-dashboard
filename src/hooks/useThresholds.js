import { useMemo, useState, useCallback } from 'react';
import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from './thresholdConfig.js';

export const useThresholds = () => {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);

  const updatePriceRange = useCallback((market, field, value) => {
    setThresholds((prev) => {
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
  }, []);

  const updateLiquidityMin = useCallback((market, value) => {
    setThresholds((prev) => {
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

  const thresholdsKey = useMemo(
    () => JSON.stringify({
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
    }),
    [thresholds],
  );

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
