import { useMemo, useState, useCallback } from 'react';

const DEFAULT_THRESHOLDS = {
  marketsEnabled: { US: true, AR: true, BR: true, EU: true, CN: true },
  priceRange: {
    US: { min: 1.5, max: 20 },
    AR: { min: 500, max: 8000 },
    BR: { min: 2, max: 60 },
    EU: { min: 2, max: 60 },
    CN: { min: 3, max: 80 },
  },
  liquidityMin: {
    US: 5,
    AR: 150,
    BR: 20,
    EU: 10,
    CN: 15,
  },
  rvolMin: 2,
  rvolIdeal: 5,
  atrMin: 0.5,
  atrPctMin: 3,
  chgMin: 10,
  parabolic50: false,
  needEMA200: true,
  float50: 50,
  float10: 10,
  rotationMin: 1,
  rotationIdeal: 3,
  shortMin: 15,
  spreadMaxPct: 1,
};

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
    setThresholds((prev) => ({
      ...prev,
      rvolMin: 2,
      rvolIdeal: 5,
      chgMin: 10,
      parabolic50: false,
      atrMin: 0.5,
      atrPctMin: 3,
      needEMA200: true,
    }));
  }, []);

  const presetAgresivo = useCallback(() => {
    setThresholds((prev) => ({
      ...prev,
      rvolMin: 3,
      rvolIdeal: 6,
      chgMin: 20,
      parabolic50: true,
      atrMin: 0.6,
      atrPctMin: 4,
      needEMA200: true,
    }));
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
