import { MARKETS } from './constants.js';

const DEFAULT_MARKET = 'US';
const STORAGE_KEYS = {
  LAST: 'selector.lastMarket.v1',
  FAVORITES: 'selector.favoriteMarkets.v1',
  VIEW: 'selector.marketViewMode.v1',
  FILTER: 'selector.marketViewFilter.v1',
};

const getStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
};

export const normalizeMarketKey = (value, options = {}) => {
  const { allowUnknown = false } = options;
  if (!value) return DEFAULT_MARKET;
  const key = String(value).trim().toUpperCase();
  if (MARKETS[key]) return key;
  if (allowUnknown) return 'UNKNOWN';
  return DEFAULT_MARKET;
};

export const readLastSelectedMarket = () => {
  const storage = getStorage();
  if (!storage) return DEFAULT_MARKET;
  try {
    const stored = storage.getItem(STORAGE_KEYS.LAST);
    return normalizeMarketKey(stored);
  } catch (error) {
    console.error('[runtime] No se pudo leer el último mercado seleccionado', error);
    return DEFAULT_MARKET;
  }
};

export const persistLastSelectedMarket = (marketKey) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.LAST, normalizeMarketKey(marketKey));
  } catch (error) {
    console.error('[runtime] No se pudo guardar el último mercado seleccionado', error);
  }
};

export const readFavoriteMarkets = () => {
  const storage = getStorage();
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(STORAGE_KEYS.FAVORITES);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((item) => normalizeMarketKey(item)).filter(Boolean));
  } catch (error) {
    console.error('[runtime] No se pudieron leer los favoritos de mercado', error);
    return new Set();
  }
};

export const persistFavoriteMarkets = (favoriteSet) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const serialized = JSON.stringify(Array.from(favoriteSet));
    storage.setItem(STORAGE_KEYS.FAVORITES, serialized);
  } catch (error) {
    console.error('[runtime] No se pudieron guardar los favoritos de mercado', error);
  }
};

export const readMarketViewMode = () => {
  const storage = getStorage();
  if (!storage) return 'chips';
  try {
    const stored = storage.getItem(STORAGE_KEYS.VIEW);
    return stored === 'dropdown' ? 'dropdown' : 'chips';
  } catch (error) {
    console.error('[runtime] No se pudo leer la vista del selector de mercado', error);
    return 'chips';
  }
};

export const persistMarketViewMode = (mode) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.VIEW, mode === 'dropdown' ? 'dropdown' : 'chips');
  } catch (error) {
    console.error('[runtime] No se pudo guardar la vista del selector de mercado', error);
  }
};

export const readMarketFilterPreference = () => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(STORAGE_KEYS.FILTER) === 'favorites';
  } catch (error) {
    console.error('[runtime] No se pudo leer el filtro de mercado', error);
    return false;
  }
};

export const persistMarketFilterPreference = (favoriteOnly) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.FILTER, favoriteOnly ? 'favorites' : 'all');
  } catch (error) {
    console.error('[runtime] No se pudo guardar el filtro de mercado', error);
  }
};

export const MARKET_VIEW_MODES = Object.freeze({
  CHIPS: 'chips',
  DROPDOWN: 'dropdown',
});

export const getMarketGroups = () => {
  return [
    { label: 'Américas', region: 'AMER', markets: ['US', 'AR', 'BR'] },
    { label: 'Europa', region: 'EU', markets: ['EU'] },
    { label: 'Asia', region: 'APAC', markets: ['CN'] },
    { label: 'Otros', region: 'MISC', markets: ['UNKNOWN'] },
  ];
};

export const getMarketTooltip = (marketKey) => {
  const info = MARKETS[marketKey];
  if (!info) return '';
  const parts = [info.label];
  if (info.currency) parts.push(info.currency);
  if (info.session) parts.push(`Horario: ${info.session}`);
  if (info.timezone) parts.push(`Zona: ${info.timezone}`);
  return parts.join(' · ');
};

export const isMarketFavorite = (favorites, key) => favorites.has(key);
