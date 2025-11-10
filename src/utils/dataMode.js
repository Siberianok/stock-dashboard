const DATA_MODE_STORAGE_KEY = 'selector.dataMode.v1';

const getStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
};

export const readStoredDataMode = () => {
  const storage = getStorage();
  if (!storage) return 'live';
  try {
    const stored = storage.getItem(DATA_MODE_STORAGE_KEY);
    return stored === 'mock' ? 'mock' : 'live';
  } catch (error) {
    console.error('[runtime] No se pudo leer el modo de datos almacenado', error);
    return 'live';
  }
};

export const persistDataMode = (mode) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (mode) {
      storage.setItem(DATA_MODE_STORAGE_KEY, mode);
    } else {
      storage.removeItem(DATA_MODE_STORAGE_KEY);
    }
  } catch (error) {
    console.error('[runtime] No se pudo guardar el modo de datos', error);
  }
};

export const forceSimulatedMode = () => {
  persistDataMode('mock');
};

export const DATA_MODES = Object.freeze({
  LIVE: 'live',
  MOCK: 'mock',
});

