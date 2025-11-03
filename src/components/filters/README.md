# Filters module overview

The filter experience is split between a reusable store hook and presentational
components.

- `useFilterForm` (see `src/store/filterStore.js`) exposes the live
  `thresholds` draft used by the dashboard. The shape mirrors the persisted
  state from `useThresholds`:
  - `marketsEnabled`: record keyed by market code with boolean flags.
  - `priceRange`: record keyed by market code with `{ min, max }` numbers.
  - `liquidityMin`: record keyed by market code with numeric millions.
  - Scalar numeric rules (`rvolMin`, `rvolIdeal`, `atrMin`, `atrPctMin`,
    `chgMin`, `float50`, `float10`, `rotationMin`, `rotationIdeal`, `shortMin`,
    `spreadMaxPct`).
  - Boolean switches (`needEMA200`, `parabolic50`).
- Every public setter (`updateMarket`, `updatePriceRange`, `updateLiquidity`,
  `updateScalar`, `updateBoolean`) pushes mutations through the shared
  validation schema before committing the change. Draft updates happen
  immediately while the persisted thresholds are debounced (160 ms) to reduce
  downstream renders.
- `FiltersPanel` reads the draft via the hook and renders the form. It never
  mutates state directly: it relies entirely on the helpers above, ensuring that
  all flows stay aligned with the validation schema and debounced persistence.

This structure keeps the source of truth documented and provides a single
choke-point for future rules (e.g. new numeric constraints or additional market
fields).
