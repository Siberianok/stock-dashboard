import {
  loadThresholdState,
  persistThresholdState,
  createSnapshot,
  MAX_THRESHOLD_HISTORY,
  pushSnapshot as persistSnapshot,
} from '../services/storage/thresholdStorage.js';
import { DEFAULT_THRESHOLDS } from '../hooks/thresholdConfig.js';
import {
  normalizeThresholds,
  areThresholdsEqual,
  cloneThresholds,
} from '../utils/thresholds.js';

const cloneState = (state) => ({
  thresholds: normalizeThresholds(state.thresholds),
  history: Array.isArray(state.history) ? [...state.history] : [],
});

const createPreviewState = () => ({
  status: 'idle',
  result: null,
  error: null,
  startedAt: null,
  completedAt: null,
});

const initialApplied = cloneState(loadThresholdState());

let storeState = {
  applied: initialApplied,
  draft: {
    thresholds: cloneThresholds(initialApplied.thresholds),
    dirty: false,
  },
  preview: createPreviewState(),
};

const listeners = new Set();

const notify = () => {
  for (const listener of listeners) {
    listener(storeState);
  }
};

const setState = (updater) => {
  const nextState = typeof updater === 'function' ? updater(storeState) : updater;
  if (nextState === storeState) return;
  storeState = nextState;
  notify();
};

const resetPreview = (prev) => ({
  ...prev,
  preview: createPreviewState(),
});

const syncDraftWithApplied = (prev, nextApplied) => ({
  applied: nextApplied,
  draft: {
    thresholds: cloneThresholds(nextApplied.thresholds),
    dirty: false,
  },
  preview: createPreviewState(),
});

export const filtersStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState() {
    return storeState;
  },
  updateDraft(updater) {
    setState((prev) => {
      const currentDraft = prev.draft.thresholds;
      const nextCandidate = typeof updater === 'function' ? updater(currentDraft) : updater;
      const normalized = normalizeThresholds(nextCandidate);
      if (areThresholdsEqual(currentDraft, normalized)) {
        return prev;
      }
      const dirty = !areThresholdsEqual(normalized, prev.applied.thresholds);
      return {
        applied: prev.applied,
        draft: {
          thresholds: normalized,
          dirty,
        },
        preview: createPreviewState(),
      };
    });
  },
  resetDraft() {
    setState((prev) => resetPreview({
      applied: prev.applied,
      draft: {
        thresholds: cloneThresholds(prev.applied.thresholds),
        dirty: false,
      },
      preview: prev.preview,
    }));
  },
  applyDraft({ snapshot = true, label } = {}) {
    setState((prev) => {
      const nextThresholds = normalizeThresholds(prev.draft.thresholds);
      if (areThresholdsEqual(prev.applied.thresholds, nextThresholds)) {
        return {
          applied: prev.applied,
          draft: {
            thresholds: cloneThresholds(nextThresholds),
            dirty: false,
          },
          preview: createPreviewState(),
        };
      }
      const nextHistory = snapshot
        ? [...prev.applied.history, createSnapshot(prev.applied.thresholds, { label })].slice(-MAX_THRESHOLD_HISTORY)
        : [...prev.applied.history];
      const appliedState = persistThresholdState({
        thresholds: nextThresholds,
        history: nextHistory,
      });
      return syncDraftWithApplied(prev, appliedState);
    });
  },
  undo() {
    setState((prev) => {
      if (!prev.applied.history.length) {
        return prev;
      }
      const history = prev.applied.history.slice(0, -1);
      const lastSnapshot = prev.applied.history[prev.applied.history.length - 1];
      const restored = normalizeThresholds(lastSnapshot.thresholds);
      const appliedState = persistThresholdState({
        thresholds: restored,
        history,
      });
      return syncDraftWithApplied(prev, appliedState);
    });
  },
  pushSnapshot(label) {
    setState((prev) => {
      const nextApplied = persistSnapshot(prev.applied, { label });
      return {
        applied: nextApplied,
        draft: prev.draft,
        preview: prev.preview,
      };
    });
  },
  startPreview() {
    setState((prev) => ({
      applied: prev.applied,
      draft: prev.draft,
      preview: {
        status: 'running',
        result: null,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
    }));
  },
  completePreview(result) {
    setState((prev) => ({
      applied: prev.applied,
      draft: prev.draft,
      preview: {
        status: 'ready',
        result,
        error: null,
        startedAt: prev.preview.startedAt,
        completedAt: new Date().toISOString(),
      },
    }));
  },
  failPreview(message) {
    const error = typeof message === 'string' && message.trim() ? message : 'No se pudo generar la vista previa';
    setState((prev) => ({
      applied: prev.applied,
      draft: prev.draft,
      preview: {
        status: 'error',
        result: null,
        error,
        startedAt: prev.preview.startedAt,
        completedAt: new Date().toISOString(),
      },
    }));
  },
  clearPreview() {
    setState((prev) => resetPreview(prev));
  },
  __resetForTests() {
    const defaultApplied = persistThresholdState({
      thresholds: normalizeThresholds(DEFAULT_THRESHOLDS),
      history: [],
    });
    storeState = {
      applied: cloneState(defaultApplied),
      draft: {
        thresholds: cloneThresholds(defaultApplied.thresholds),
        dirty: false,
      },
      preview: createPreviewState(),
    };
    notify();
  },
};
