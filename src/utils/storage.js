const PREFIX = "stock-dashboard";

export const loadState = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}:${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("No se pudo leer localStorage", err);
    return fallback;
  }
};

export const persistState = (key, value) => {
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn("No se pudo guardar localStorage", err);
  }
};
