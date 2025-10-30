import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from './thresholdConfig.js';

const STORAGE_KEY = 'selector.thresholds.v1';
const isBrowser = typeof window !== 'undefined';

const sanitizeNumber = (value, { min = -Infinity, max = Infinity } = {}) => {
  if (!Number.isFinite(value)) return undefined;
  const clamped = Math.min(Math.max(value, min), max);
  return clamped;
};

const sanitizeThresholds = (raw) => {
  const next = {
    ...DEFAULT_THRESHOLDS,
    marketsEnabled: { ...DEFAULT_THRESHOLDS.marketsEnabled },
    priceRange: { ...DEFAULT_THRESHOLDS.priceRange },
    liquidityMin: { ...DEFAULT_THRESHOLDS.liquidityMin },
  };

  if (!raw || typeof raw !== 'object') {
    return next;
  }

  if (raw.marketsEnabled && typeof raw.marketsEnabled === 'object') {
    Object.entries(raw.marketsEnabled).forEach(([market, enabled]) => {
      next.marketsEnabled[market] = Boolean(enabled);
    });
  }

  if (raw.priceRange && typeof raw.priceRange === 'object') {
    Object.entries(raw.priceRange).forEach(([market, value]) => {
      if (!value || typeof value !== 'object') return;
      const min = sanitizeNumber(value.min, { min: 0 });
      const max = sanitizeNumber(value.max, { min: 0 });
      next.priceRange[market] = {
        ...(next.priceRange[market] || {}),
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      };
    });
  }

  if (raw.liquidityMin && typeof raw.liquidityMin === 'object') {
    Object.entries(raw.liquidityMin).forEach(([market, value]) => {
      const sanitized = sanitizeNumber(value, { min: 0 });
      if (sanitized === undefined) return;
      next.liquidityMin[market] = sanitized;
    });
  }

  const numericKeys = [
    'rvolMin',
    'rvolIdeal',
    'atrMin',
    'atrPctMin',
    'chgMin',
    'float50',
    'float10',
    'rotationMin',
    'rotationIdeal',
    'shortMin',
    'spreadMaxPct',
  ];

  numericKeys.forEach((key) => {
    const sanitized = sanitizeNumber(raw[key], { min: 0 });
    if (sanitized !== undefined) {
      next[key] = sanitized;
    }
  });

  if (typeof raw.parabolic50 === 'boolean') {
    next.parabolic50 = raw.parabolic50;
  }
  if (typeof raw.needEMA200 === 'boolean') {
    next.needEMA200 = raw.needEMA200;
  }

  return next;
};

const loadStoredThresholds = () => {
  if (!isBrowser) {
    return DEFAULT_THRESHOLDS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_THRESHOLDS;
    }
    const parsed = JSON.parse(raw);
    return sanitizeThresholds(parsed);
  } catch (error) {
    console.error('No se pudieron leer umbrales guardados', error);
    return DEFAULT_THRESHOLDS;
  }
};

export function useThresholds() {
  const [thresholds, setThresholds] = useState(loadStoredThresholds);

  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
    } catch (error) {
      console.error('No se pudieron guardar los umbrales', error);
    }
  }, [thresholds]);

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
}
