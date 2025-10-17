import { uid } from "../utils/number.js";

export const createRow = (overrides = {}) => ({
  id: uid(),
  ticker: "",
  market: "US",
  open: undefined,
  close: undefined,
  bid: undefined,
  ask: undefined,
  avgPrice: undefined,
  volToday: undefined,
  volAvg20: undefined,
  floatM: undefined,
  shortPct: undefined,
  dtc: undefined,
  atr14: undefined,
  ema9: undefined,
  ema200: undefined,
  spreadPct: undefined,
  liqM: undefined,
  catalyst: false,
  intradiaOK: false,
  comments: "",
  lastUpdate: null,
  ...overrides,
});

export const ROWS_ACTIONS = {
  LOAD: "LOAD",
  ADD: "ADD",
  UPDATE: "UPDATE",
  REMOVE: "REMOVE",
  SET_ALL: "SET_ALL",
  CLEAR: "CLEAR",
  BULK_MERGE_BY_TICKER: "BULK_MERGE_BY_TICKER",
};

export const rowsReducer = (state, action) => {
  switch (action.type) {
    case ROWS_ACTIONS.LOAD:
      return action.rows?.length ? action.rows.map((row) => ({ ...createRow(), ...row })) : state;
    case ROWS_ACTIONS.ADD:
      return [...state, createRow(action.overrides)];
    case ROWS_ACTIONS.UPDATE:
      return state.map((row) => (row.id === action.id ? { ...row, [action.key]: action.value } : row));
    case ROWS_ACTIONS.REMOVE:
      return state.filter((row) => row.id !== action.id);
    case ROWS_ACTIONS.SET_ALL:
      return action.rows?.length ? action.rows.map((row) => createRow(row)) : state;
    case ROWS_ACTIONS.CLEAR:
      return [createRow()];
    case ROWS_ACTIONS.BULK_MERGE_BY_TICKER:
      return state.map((row) => {
        const ticker = row.ticker?.toUpperCase();
        const patch = ticker ? action.map?.[ticker] : null;
        return patch ? { ...row, ...patch } : row;
      });
    default:
      return state;
  }
};

/** @typedef {ReturnType<typeof createRow>} Row */
