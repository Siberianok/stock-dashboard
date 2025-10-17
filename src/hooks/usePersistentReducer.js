import { useEffect, useReducer, useRef } from "../vendor/react.js";
import { loadState, persistState } from "../utils/storage.js";

export const usePersistentReducer = (
  key,
  reducer,
  initializerArg,
  initializer,
  { loadAction, serialize = (value) => value } = {},
) => {
  const loadedRef = useRef(false);
  const [state, dispatch] = useReducer(reducer, initializerArg, initializer);

  useEffect(() => {
    if (loadedRef.current) return;
    const stored = loadState(key, null);
    if (stored && typeof loadAction === "function") {
      dispatch(loadAction(stored));
    }
    loadedRef.current = true;
  }, [key, loadAction]);

  useEffect(() => {
    if (!loadedRef.current) return;
    persistState(key, serialize(state));
  }, [key, state, serialize]);

  return [state, dispatch];
};
