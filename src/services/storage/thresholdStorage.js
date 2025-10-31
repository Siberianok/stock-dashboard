import { DEFAULT_THRESHOLDS } from '../../hooks/thresholdConfig.js';
import {
  normalizeThresholds,
  areThresholdsEqual,
  cloneThresholds,
} from '../../utils/thresholds.js';

const isBrowser = typeof window !== 'undefined';
const STORAGE_KEY = 'selector.thresholds';
const LEGACY_KEYS = ['selector.thresholds.v1'];
const CURRENT_VERSION = 2;
export const MAX_THRESHOLD_HISTORY = 10;

const memoryStore = new Map();

const safeParse = (raw) => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('No se pudo parsear la configuración guardada', error);
    return null;
  }
};

const safeGetItem = (key) => {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('localStorage no disponible, se usará almacenamiento en memoria', error);
    return null;
  }
};

const safeRemoveItem = (key) => {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`No se pudo limpiar la clave antigua ${key}`, error);
  }
};

const safeSetItem = (key, value) => {
  if (!isBrowser) {
    memoryStore.set(key, value);
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('No se pudieron persistir los umbrales en localStorage', error);
    memoryStore.set(key, value);
    return false;
  }
};

const readRawState = () => {
  const primary = safeGetItem(STORAGE_KEY);
  if (primary) {
    return { raw: primary, key: STORAGE_KEY };
  }

  for (const legacy of LEGACY_KEYS) {
    const legacyValue = safeGetItem(legacy);
    if (legacyValue) {
      return { raw: legacyValue, key: legacy };
    }
  }

  if (memoryStore.has(STORAGE_KEY)) {
    return { raw: memoryStore.get(STORAGE_KEY), key: STORAGE_KEY };
  }

  for (const legacy of LEGACY_KEYS) {
    if (memoryStore.has(legacy)) {
      return { raw: memoryStore.get(legacy), key: legacy };
    }
  }

  return { raw: null, key: STORAGE_KEY };
};

const writeState = (payload) => {
  const serialized = JSON.stringify(payload);
  const persisted = safeSetItem(STORAGE_KEY, serialized);
  if (persisted) {
    memoryStore.delete(STORAGE_KEY);
  }
  LEGACY_KEYS.forEach((legacy) => {
    safeRemoveItem(legacy);
    memoryStore.delete(legacy);
  });
};

export const createSnapshot = (thresholds, { label, savedAt } = {}) => {
  const normalized = normalizeThresholds(thresholds);
  const timestamp = typeof savedAt === 'string' ? savedAt : new Date().toISOString();
  const trimmedLabel = typeof label === 'string' ? label.trim() : '';
  return {
    savedAt: timestamp,
    label: trimmedLabel || null,
    thresholds: cloneThresholds(normalized),
  };
};

const normalizeHistory = (entries) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const label = typeof entry.label === 'string' ? entry.label : undefined;
      const savedAt = typeof entry.savedAt === 'string' ? entry.savedAt : undefined;
      const thresholds = entry.thresholds ?? entry.data ?? entry;
      try {
        return createSnapshot(thresholds, { label, savedAt });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-MAX_THRESHOLD_HISTORY);
};

const finalizeState = (state) => {
  const thresholds = normalizeThresholds(state?.thresholds);
  const history = normalizeHistory(state?.history);
  return {
    version: CURRENT_VERSION,
    thresholds,
    history,
  };
};

const migrateToV1 = (payload) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const legacyThresholds = source.thresholds ?? source.data ?? payload;
  return {
    version: 1,
    thresholds: normalizeThresholds(legacyThresholds ?? DEFAULT_THRESHOLDS),
    history: [],
  };
};

const migrateToV2 = (payload) => {
  const thresholds = normalizeThresholds(payload?.thresholds ?? DEFAULT_THRESHOLDS);
  const history = normalizeHistory(payload?.history);
  return {
    version: 2,
    thresholds,
    history,
  };
};

const applyMigrations = (payload) => {
  if (!payload) {
    return finalizeState({ thresholds: DEFAULT_THRESHOLDS, history: [] });
  }

  let version = typeof payload.version === 'number' ? payload.version : 0;
  let current = version === 0 ? { version: 0, thresholds: payload } : payload;

  if (version < 1) {
    current = migrateToV1(current);
    version = current.version;
  }
  if (version < 2) {
    current = migrateToV2(current);
    version = current.version;
  }

  return finalizeState(current);
};

export const loadThresholdState = () => {
  const { raw, key } = readRawState();
  if (!raw) {
    return {
      thresholds: normalizeThresholds(DEFAULT_THRESHOLDS),
      history: [],
    };
  }
  const parsed = safeParse(raw);
  if (!parsed) {
    return {
      thresholds: normalizeThresholds(DEFAULT_THRESHOLDS),
      history: [],
    };
  }
  const migrated = applyMigrations(parsed);
  if (key !== STORAGE_KEY) {
    writeState(migrated);
  }
  return {
    thresholds: migrated.thresholds,
    history: migrated.history,
  };
};

export const persistThresholdState = (state) => {
  const finalized = finalizeState(state);
  writeState(finalized);
  return finalized;
};

export const pushSnapshot = (state, { label } = {}) => {
  const snapshot = createSnapshot(state.thresholds, { label });
  const nextHistory = [...state.history, snapshot].slice(-MAX_THRESHOLD_HISTORY);
  const nextState = { ...state, history: nextHistory };
  return persistThresholdState(nextState);
};

export const shouldPersistUpdate = (previous, next) => {
  return !areThresholdsEqual(previous.thresholds, next.thresholds) ||
    previous.history.length !== next.history.length;
};
