import { MARKETS } from "../constants.js";

export const DEFAULT_THRESHOLDS = {
  marketsEnabled: Object.keys(MARKETS).reduce((acc, market) => {
    acc[market] = true;
    return acc;
  }, {}),
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
  spreadMaxPct: 1.0,
};

export const THRESHOLDS_ACTIONS = {
  LOAD: "LOAD",
  SET_VALUE: "SET_VALUE",
  TOGGLE_MARKET: "TOGGLE_MARKET",
  UPDATE_PRICE_RANGE: "UPDATE_PRICE_RANGE",
  UPDATE_LIQUIDITY_MIN: "UPDATE_LIQUIDITY_MIN",
  RESET: "RESET",
};

export const thresholdsReducer = (state, action) => {
  switch (action.type) {
    case THRESHOLDS_ACTIONS.LOAD:
      return { ...state, ...action.payload };
    case THRESHOLDS_ACTIONS.SET_VALUE:
      return { ...state, [action.key]: action.value };
    case THRESHOLDS_ACTIONS.TOGGLE_MARKET:
      return {
        ...state,
        marketsEnabled: {
          ...state.marketsEnabled,
          [action.market]: action.enabled,
        },
      };
    case THRESHOLDS_ACTIONS.UPDATE_PRICE_RANGE:
      return {
        ...state,
        priceRange: {
          ...state.priceRange,
          [action.market]: {
            ...(state.priceRange?.[action.market] || {}),
            [action.field]: action.value,
          },
        },
      };
    case THRESHOLDS_ACTIONS.UPDATE_LIQUIDITY_MIN:
      return {
        ...state,
        liquidityMin: {
          ...state.liquidityMin,
          [action.market]: action.value,
        },
      };
    case THRESHOLDS_ACTIONS.RESET:
      return { ...DEFAULT_THRESHOLDS };
    default:
      return state;
  }
};

/** @typedef {ReturnType<typeof initThresholds>} Thresholds */
export const initThresholds = (base) => ({ ...DEFAULT_THRESHOLDS, ...(base || {}) });
