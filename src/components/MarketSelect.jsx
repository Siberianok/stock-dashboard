import React, { useCallback, useId, useMemo, useState } from 'react';
import { COLORS } from '../utils/constants.js';

const matchesQuery = (query, key, info = {}) => {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return (
    key.toLowerCase().includes(normalized) ||
    info.label?.toLowerCase().includes(normalized) ||
    info.currency?.toLowerCase().includes(normalized)
  );
};

export function MarketSelect({
  markets,
  selected = {},
  onToggle,
  legend = 'Mercados',
  legendId,
  className = '',
  searchPlaceholder = 'Buscar mercado...',
  optionClassName = '',
  columns = 2,
  showSearch = true,
}) {
  const fieldId = useId();
  const resolvedLegendId = legendId || `${fieldId}-legend`;
  const searchId = `${fieldId}-search`;
  const [query, setQuery] = useState('');

  const marketEntries = useMemo(() => Object.entries(markets || {}), [markets]);
  const filteredEntries = useMemo(
    () => marketEntries.filter(([key, info]) => matchesQuery(query, key, info)),
    [marketEntries, query],
  );

  const handleToggle = useCallback(
    (key) => (event) => {
      onToggle?.(key, event.target.checked);
    },
    [onToggle],
  );

  const gridColumns = useMemo(() => {
    switch (columns) {
      case 1:
        return 'grid-cols-1';
      case 3:
        return 'grid-cols-3';
      case 4:
        return 'grid-cols-4';
      default:
        return 'grid-cols-2';
    }
  }, [columns]);

  return (
    <fieldset
      className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl ${className}`}
      aria-labelledby={resolvedLegendId}
    >
      <legend
        id={resolvedLegendId}
        className="font-semibold mb-4 text-center text-lg tracking-wide"
      >
        {legend}
      </legend>

      {showSearch ? (
        <div className="mb-3">
          <label className="sr-only" htmlFor={searchId}>
            Buscar mercado
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-sky-500/80"
          />
        </div>
      ) : null}

      <div className={`grid ${gridColumns} gap-3 text-sm max-h-72 overflow-auto pr-1`}>
        {filteredEntries.map(([key, info]) => (
          <label
            key={key}
            className={`flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl ${optionClassName}`}
          >
            <span className="font-medium flex-1">{info.label || key}</span>
            <input
              type="checkbox"
              aria-label={`Habilitar mercado ${info.label || key}`}
              checked={!!selected?.[key]}
              onChange={handleToggle(key)}
            />
          </label>
        ))}
        {!filteredEntries.length ? (
          <div className="col-span-full text-center text-white/60 text-sm py-2">
            No se encontraron mercados
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

export default MarketSelect;
