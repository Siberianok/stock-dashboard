import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThresholds } from '../hooks/useThresholds.js';
import { createThresholdSignature } from '../utils/thresholds.js';
import { validateThresholdDraft } from '../validation/filterRules.js';

/**
 * Maintains the live filter draft used by the dashboard. The draft mirrors the
 * committed threshold state stored in {@link useThresholds} but accepts local
 * edits that are validated with the shared schema before being debounced into
 * the persistent store. Consumers should always read {@link thresholds} for the
 * most up-to-date view and rely on the helper setters which guarantee schema
 * compliance before mutating the draft.
 */

const REQUIRED_MESSAGE = 'Requerido';

const pathToKey = (path) => path.join('.');

const cloneBranch = (value) => {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return { ...value };
  return {};
};

const setPath = (source, path, value) => {
  if (!Array.isArray(path) || !path.length) {
    return source;
  }
  const [head, ...tail] = path;
  const base = cloneBranch(source);
  if (!tail.length) {
    if (value === undefined) {
      delete base[head];
    } else {
      base[head] = value;
    }
    return base;
  }
  const current = source && typeof source === 'object' ? source[head] : undefined;
  base[head] = setPath(current, tail, value);
  return base;
};

export const useFilterForm = ({ debounceMs = 160 } = {}) => {
  const thresholdsApi = useThresholds();
  const [draft, setDraft] = useState(thresholdsApi.thresholds);
  const [errors, setErrors] = useState({});
  const timerRef = useRef(null);
  const lastValidRef = useRef(thresholdsApi.thresholds);

  useEffect(() => {
    setDraft(thresholdsApi.thresholds);
    setErrors({});
    lastValidRef.current = thresholdsApi.thresholds;
  }, [thresholdsApi.thresholds]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleCommit = useCallback(
    (nextValue) => {
      lastValidRef.current = nextValue;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        thresholdsApi.setThresholds(lastValidRef.current);
        timerRef.current = null;
      }, debounceMs);
    },
    [debounceMs, thresholdsApi.setThresholds],
  );

  const applyPatch = useCallback(
    (path, value) => {
      setDraft((prev) => {
        const nextCandidate = setPath(prev, path, value);
        const { success, value: normalized, errors: validationErrors } = validateThresholdDraft(nextCandidate);
        setErrors(validationErrors);
        if (success) {
          scheduleCommit(normalized);
        }
        return normalized;
      });
    },
    [scheduleCommit],
  );

  const setNumberField = useCallback(
    (path, value, { required = true } = {}) => {
      if (value === undefined || Number.isNaN(value)) {
        if (required) {
          const key = pathToKey(path);
          setErrors((prev) => ({ ...prev, [key]: REQUIRED_MESSAGE }));
        }
        return false;
      }
      applyPatch(path, value);
      return true;
    },
    [applyPatch],
  );

  const setBooleanField = useCallback(
    (path, value) => {
      applyPatch(path, Boolean(value));
    },
    [applyPatch],
  );

  const updateMarket = useCallback((market, enabled) => setBooleanField(['marketsEnabled', market], enabled), [setBooleanField]);

  const updatePriceRange = useCallback(
    (market, field, value) => setNumberField(['priceRange', market, field], value),
    [setNumberField],
  );

  const updateLiquidity = useCallback(
    (market, value) => setNumberField(['liquidityMin', market], value),
    [setNumberField],
  );

  const updateScalar = useCallback((field, value, options) => setNumberField([field], value, options), [setNumberField]);

  const updateBoolean = useCallback((field, value) => setBooleanField([field], value), [setBooleanField]);

  const getError = useCallback((path) => errors[path] || null, [errors]);

  const previewKey = useMemo(() => createThresholdSignature(draft), [draft]);

  return {
    thresholds: draft,
    thresholdsKey: previewKey,
    committedThresholds: thresholdsApi.thresholds,
    history: thresholdsApi.history,
    presetModerado: thresholdsApi.presetModerado,
    presetAgresivo: thresholdsApi.presetAgresivo,
    undo: thresholdsApi.undo,
    pushSnapshot: thresholdsApi.pushSnapshot,
    errors,
    getError,
    updateMarket,
    updatePriceRange,
    updateLiquidity,
    updateScalar,
    updateBoolean,
  };
};
