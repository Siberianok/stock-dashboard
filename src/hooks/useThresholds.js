import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  DEFAULT_THRESHOLDS,
  applyPresetModerado,
  applyPresetAgresivo,
} from './thresholdConfig.js';
import {
  normalizeThresholds,
  areThresholdsEqual,
  cloneThresholds,
} from '../utils/thresholds.js';
import {
  loadThresholdState,
  persistThresholdState,
  createSnapshot,
  MAX_THRESHOLD_HISTORY,
} from '../services/storage/thresholdStorage.js';

const now = () => new Date().toISOString();

const sanitizeHistory = (entries) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      const label = typeof entry?.label === 'string' ? entry.label : undefined;
      const savedAt = typeof entry?.savedAt === 'string' ? entry.savedAt : undefined;
      const source = entry?.thresholds ?? entry?.data ?? entry;
      try {
        return createSnapshot(source, { label, savedAt });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-MAX_THRESHOLD_HISTORY);
};

const cloneState = (rawState) => {
  const thresholds = normalizeThresholds(rawState?.thresholds ?? DEFAULT_THRESHOLDS);
  const history = sanitizeHistory(rawState?.history);
  const draftSource = rawState?.draft ?? {};
  const draftThresholds = normalizeThresholds(draftSource.thresholds ?? thresholds);
  const savedAt = typeof draftSource.savedAt === 'string' ? draftSource.savedAt : null;
  const updatedAtRaw = typeof draftSource.updatedAt === 'string' ? draftSource.updatedAt : null;
  const timestamp = now();
  const updatedAt = updatedAtRaw || savedAt || timestamp;
  return {
    thresholds: cloneThresholds(thresholds),
    history,
    draft: {
      thresholds: cloneThresholds(draftThresholds),
      savedAt,
      updatedAt,
    },
  };
};

const buildKeyPayload = (thresholds) => ({
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

export const withDraftUpdate = (state, updater, { timestamp = now() } = {}) => {
  const previousDraft = state.draft?.thresholds ?? state.thresholds;
  const nextValue = typeof updater === 'function' ? updater(previousDraft) : updater;
  const normalized = normalizeThresholds(nextValue);
  if (areThresholdsEqual(previousDraft, normalized)) {
    return { state, changed: false };
  }
  return {
    state: {
      ...state,
      draft: {
        thresholds: cloneThresholds(normalized),
        savedAt: state.draft?.savedAt ?? null,
        updatedAt: timestamp,
      },
    },
    changed: true,
  };
};

export const withDraftSave = (state, { timestamp = now() } = {}) => {
  const draftThresholds = state.draft?.thresholds ?? state.thresholds;
  const nextDraft = {
    thresholds: cloneThresholds(draftThresholds),
    savedAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    state: { ...state, draft: nextDraft },
    savedAt: timestamp,
  };
};

export const withDraftDiscard = (state, { timestamp = now() } = {}) => {
  const nextDraft = {
    thresholds: cloneThresholds(state.thresholds),
    savedAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    state: { ...state, draft: nextDraft },
    discardedAt: timestamp,
  };
};

export const withDraftApply = (state, { label, timestamp = now() } = {}) => {
  const draftThresholds = state.draft?.thresholds ?? state.thresholds;
  const normalizedDraft = normalizeThresholds(draftThresholds);
  if (areThresholdsEqual(state.thresholds, normalizedDraft)) {
    const draft = {
      thresholds: cloneThresholds(normalizedDraft),
      savedAt: timestamp,
      updatedAt: timestamp,
    };
    return {
      state: {
        ...state,
        thresholds: cloneThresholds(state.thresholds),
        draft,
      },
      applied: false,
      appliedAt: timestamp,
    };
  }
  const nextHistory = [...state.history, createSnapshot(state.thresholds, { label })]
    .slice(-MAX_THRESHOLD_HISTORY);
  const nextThresholds = cloneThresholds(normalizedDraft);
  const draft = {
    thresholds: cloneThresholds(normalizedDraft),
    savedAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    state: {
      thresholds: nextThresholds,
      history: nextHistory,
      draft,
    },
    applied: true,
    appliedAt: timestamp,
  };
};

export const withUndo = (state, { timestamp = now() } = {}) => {
  if (!Array.isArray(state.history) || state.history.length === 0) {
    return { state, undone: false, restoredAt: timestamp };
  }
  const lastSnapshot = state.history[state.history.length - 1];
  if (!lastSnapshot) {
    return { state, undone: false, restoredAt: timestamp };
  }
  const restored = normalizeThresholds(lastSnapshot.thresholds);
  const nextHistory = state.history.slice(0, -1);
  const draft = {
    thresholds: cloneThresholds(restored),
    savedAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    state: {
      thresholds: cloneThresholds(restored),
      history: nextHistory,
      draft,
    },
    undone: true,
    restoredAt: timestamp,
  };
};

export function useThresholds() {
  const [state, setState] = useState(() => cloneState(loadThresholdState()));

  useEffect(() => {
    persistThresholdState(state);
  }, [state]);

  const setThresholds = useCallback((value) => {
    setState((prev) => withDraftUpdate(prev, value).state);
  }, []);

  const updatePriceRange = useCallback((market, field, value) => {
    setState((prev) => withDraftUpdate(prev, (draft) => {
      const prevMarket = draft.priceRange?.[market] || {};
      if (value === undefined) {
        if (!(field in prevMarket)) return draft;
        const nextMarket = { ...prevMarket };
        delete nextMarket[field];
        const nextPriceRange = { ...prev.priceRange };
        if (Object.keys(nextMarket).length) {
          nextPriceRange[market] = nextMarket;
        } else {
          delete nextPriceRange[market];
        }
        return {
          ...draft,
          priceRange: {
            ...draft.priceRange,
            [market]: nextMarket,
          },
        };
      }
      return {
        ...draft,
        priceRange: {
          ...draft.priceRange,
          [market]: { ...prevMarket, [field]: value },
        },
      };
    }).state);
  }, []);

  const updateLiquidityMin = useCallback((market, value) => {
    setState((prev) => withDraftUpdate(prev, (draft) => {
      const prevLiquidity = draft.liquidityMin || {};
      if (value === undefined) {
        if (!(market in prevLiquidity)) return draft;
        const nextLiquidity = { ...prevLiquidity };
        delete nextLiquidity[market];
        return {
          ...draft,
          liquidityMin: nextLiquidity,
        };
      }
      return {
        ...draft,
        liquidityMin: {
          ...prevLiquidity,
          [market]: value,
        },
      };
    }).state);
  }, []);

  const toggleMarket = useCallback((market, enabled) => {
    setState((prev) => withDraftUpdate(prev, (draft) => ({
      ...draft,
      marketsEnabled: {
        ...draft.marketsEnabled,
        [market]: enabled,
      },
    })).state);
  }, []);

  const presetModerado = useCallback(() => {
    setState((prev) => withDraftUpdate(prev, (draft) => applyPresetModerado(draft)).state);
  }, []);

  const presetAgresivo = useCallback(() => {
    setState((prev) => withDraftUpdate(prev, (draft) => applyPresetAgresivo(draft)).state);
  }, []);

  const undo = useCallback(() => {
    setState((prevState) => withUndo(prevState).state);
  }, []);

  const pushSnapshot = useCallback((label) => {
    setState((prevState) => {
      const nextHistory = [...prevState.history, createSnapshot(prevState.thresholds, { label })]
        .slice(-MAX_THRESHOLD_HISTORY);
      return { ...prevState, history: nextHistory };
    });
  }, []);

  const saveDraft = useCallback(() => {
    let savedAt = null;
    setState((prev) => {
      const result = withDraftSave(prev);
      savedAt = result.savedAt;
      return result.state;
    });
    return savedAt;
  }, []);

  const applyDraft = useCallback((options = {}) => {
    let applied = false;
    let appliedAt = null;
    setState((prev) => {
      const result = withDraftApply(prev, options);
      applied = result.applied;
      appliedAt = result.appliedAt;
      return result.state;
    });
    return { applied, appliedAt };
  }, []);

  const discardDraft = useCallback(() => {
    let discardedAt = null;
    setState((prev) => {
      const result = withDraftDiscard(prev);
      discardedAt = result.discardedAt;
      return result.state;
    });
    return discardedAt;
  }, []);

  const thresholds = state.draft?.thresholds ?? state.thresholds;
  const draftMeta = {
    savedAt: state.draft?.savedAt ?? null,
    updatedAt: state.draft?.updatedAt ?? null,
  };
  const hasDraftChanges = !areThresholdsEqual(state.thresholds, thresholds);
  const hasUnsavedDraftChanges = (draftMeta.updatedAt || null) !== (draftMeta.savedAt || null);

  const thresholdsKey = useMemo(
    () => JSON.stringify(buildKeyPayload(state.thresholds)),
    [state.thresholds],
  );

  const draftKey = useMemo(
    () => JSON.stringify(buildKeyPayload(thresholds)),
    [thresholds],
  );

  return {
    thresholds,
    activeThresholds: state.thresholds,
    history: state.history,
    thresholdsKey,
    draftKey,
    setThresholds,
    updatePriceRange,
    updateLiquidityMin,
    toggleMarket,
    presetModerado,
    presetAgresivo,
    undo,
    pushSnapshot,
    saveDraft,
    applyDraft,
    discardDraft,
    hasDraftChanges,
    hasUnsavedDraftChanges,
    draftMeta,
  };
}
