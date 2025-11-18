import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { COLORS, MARKETS } from '../utils/constants.js';
import { safeNumber, safePct } from '../utils/format.js';
import { createCalc } from '../utils/calc.js';
import { ScoreBar } from './ScoreBar.jsx';
import { Badge } from './Badge.jsx';
import {
  MARKET_VIEW_MODES,
  getMarketGroups,
  getMarketTooltip,
  isMarketFavorite,
  normalizeMarketKey,
  persistFavoriteMarkets,
  persistLastSelectedMarket,
  persistMarketFilterPreference,
  persistMarketViewMode,
  readFavoriteMarkets,
  readMarketFilterPreference,
  readMarketViewMode,
} from '../utils/markets.js';

const controlBaseClasses =
  'h-9 rounded border border-white/20 bg-white/10 text-white text-sm px-3 transition ' +
  'hover:border-cyan-300/70 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-0 ' +
  'focus-visible:shadow-[0_0_0_4px_rgba(56,189,248,0.25)]';

const MarketChip = ({
  marketKey,
  isSelected,
  disabled,
  onSelect,
  onToggleFavorite,
  isFavorite,
  onArrowNav,
  index,
  focusRef,
}) => {
  const info = MARKETS[marketKey] || MARKETS.UNKNOWN;
  const tooltip = getMarketTooltip(marketKey);
  return (
    <div
      ref={focusRef}
      role="radio"
      aria-checked={isSelected}
      aria-label={tooltip}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (disabled) return;
        onSelect(marketKey);
      }}
      onKeyDown={(event) => {
        if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
          onArrowNav(event, index);
          return;
        }
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(marketKey);
        }
      }}
      className={`market-chip ${isSelected ? 'market-chip--active' : ''} ${disabled ? 'market-chip--disabled' : ''}`}
      title={tooltip}
      data-market-key={marketKey}
    >
      <span className="text-lg" aria-hidden="true">{info.flag}</span>
      <div className="flex flex-col text-left leading-tight">
        <span className="text-xs font-semibold">{info.label}</span>
        <span className="text-[10px] text-white/70">{info.currency} · {info.session || info.note}</span>
      </div>
      <span
        role="button"
        tabIndex={-1}
        className={`market-chip__fav ${isFavorite ? 'market-chip__fav--on' : ''}`}
        aria-label={`${isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'} ${info.label}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(marketKey);
        }}
        title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
      >
        ★
      </span>
    </div>
  );
};

const MarketSelector = ({
  value,
  disabled,
  viewMode,
  onViewModeChange,
  favorites,
  onToggleFavorite,
  favoriteOnly,
  onToggleFavoriteFilter,
  onChange,
}) => {
  const normalized = normalizeMarketKey(value, { allowUnknown: true });
  const groups = getMarketGroups();
  const visibleMarkets = groups.flatMap((group) =>
    group.markets.filter((key) => (!favoriteOnly ? true : isMarketFavorite(favorites, key))),
  );
  const chipRefs = useRef([]);

  const handleArrowNav = useCallback(
    (event, index) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
      if (!visibleMarkets.length) return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (index + delta + visibleMarkets.length) % visibleMarkets.length;
      const nextButton = chipRefs.current[nextIndex];
      if (nextButton) {
        nextButton.focus();
      }
    },
    [visibleMarkets.length],
  );

  const renderChips = () => (
    <div className="space-y-2" role="radiogroup" aria-label="Mercado">
      {groups.map((group) => {
        const markets = group.markets.filter((key) => (!favoriteOnly ? true : isMarketFavorite(favorites, key)));
        if (!markets.length) return null;
        return (
          <div key={group.region} className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-white/60">{group.label}</div>
            <div className="flex flex-wrap gap-2">
              {markets.map((key) => {
                const idx = visibleMarkets.indexOf(key);
                return (
                  <MarketChip
                    key={key}
                    marketKey={key}
                    isSelected={normalized === key}
                    disabled={disabled}
                    onSelect={onChange}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={isMarketFavorite(favorites, key)}
                    onArrowNav={handleArrowNav}
                    index={idx}
                    focusRef={(element) => {
                      chipRefs.current[idx] = element;
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {!visibleMarkets.length ? (
        <div className="text-[11px] text-amber-200">No hay mercados favoritos seleccionados.</div>
      ) : null}
    </div>
  );

  const renderDropdown = () => (
    <select
      className={`${controlBaseClasses} w-full pr-8`}
      value={normalized}
      onChange={(event) => onChange(normalizeMarketKey(event.target.value))}
      aria-label="Mercado"
      disabled={disabled}
    >
      {groups.map((group) => (
        <optgroup key={group.region} label={group.label}>
          {group.markets.map((key) => {
            const info = MARKETS[key];
            if (!info || (favoriteOnly && !isMarketFavorite(favorites, key))) return null;
            const optionLabel = getMarketTooltip(key);
            return (
              <option key={key} value={key} title={optionLabel}>
                {optionLabel}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div className="market-selector-cell">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-[11px] text-white/70">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">⚡</span> Vista {viewMode === MARKET_VIEW_MODES.DROPDOWN ? 'compacta' : 'expandida'}
          </span>
          <button
            type="button"
            className="market-view-toggle"
            onClick={() => onViewModeChange(viewMode === MARKET_VIEW_MODES.DROPDOWN ? MARKET_VIEW_MODES.CHIPS : MARKET_VIEW_MODES.DROPDOWN)}
            aria-label="Alternar vista del selector de mercado"
          >
            {viewMode === MARKET_VIEW_MODES.DROPDOWN ? 'Chips' : 'Lista'}
          </button>
        </div>
        <label className="flex items-center gap-1 text-[11px] text-white/80">
          <input
            type="checkbox"
            className="accent-cyan-400"
            checked={favoriteOnly}
            onChange={(event) => onToggleFavoriteFilter(event.target.checked)}
          />
          <span>Solo favoritos</span>
        </label>
      </div>
      {viewMode === MARKET_VIEW_MODES.DROPDOWN ? renderDropdown() : renderChips()}
      {disabled ? <div className="text-[10px] text-amber-300 mt-1">Selector bloqueado por datos en caché.</div> : null}
    </div>
  );
};

const TableRow = ({
  row,
  calcResult,
  isSelected,
  onSelect,
  onUpdate,
  selectorViewMode,
  onSelectorModeChange,
  favoriteMarkets,
  onToggleFavorite,
  favoriteOnly,
  onToggleFavoriteFilter,
}) => {
  const market = normalizeMarketKey(row.market, { allowUnknown: true });
  const info = MARKETS[market] || MARKETS.UNKNOWN;
  const { rvol, atrPct, chgPct, rotation, score, flags } = calcResult;
  const stale = !!row.isStale;
  const viewMode = selectorViewMode || MARKET_VIEW_MODES.CHIPS;
  const safeFavorites = favoriteMarkets || new Set();
  const handleModeChange = onSelectorModeChange || (() => {});
  const handleToggleFavorite = onToggleFavorite || (() => {});
  const handleFavoriteFilter = onToggleFavoriteFilter || (() => {});

  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(row.id);
    }
  };
  const rowLabel = row.ticker ? `Fila ${row.ticker}` : 'Fila sin ticker';

  return (
    <tr
      className={`border-b border-white/10 text-xs ${isSelected ? 'bg-white/15' : 'bg-transparent'} hover:bg-white/10 transition ${
        stale ? 'opacity-80' : ''
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-300`}
      onClick={() => onSelect(row.id)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`${rowLabel}${stale ? ' (datos en caché)' : ''}`}
    >
      <td className="px-3 py-2 w-32">
        <input
          className={`${controlBaseClasses} w-full`}
          value={row.ticker || ''}
          onChange={(e) => onUpdate(row.id, 'ticker', e.target.value.toUpperCase())}
          placeholder="Ticker"
          aria-label="Ticker"
        />
        {stale ? <div className="text-[10px] text-amber-300 mt-1">Cache</div> : null}
      </td>
      <td className="px-3 py-2 min-w-[220px]">
        <MarketSelector
          value={market}
          disabled={stale}
          viewMode={viewMode}
          onViewModeChange={handleModeChange}
          favorites={safeFavorites}
          onToggleFavorite={(key) => handleToggleFavorite(key)}
          favoriteOnly={favoriteOnly}
          onToggleFavoriteFilter={handleFavoriteFilter}
          onChange={(next) => onUpdate(row.id, 'market', normalizeMarketKey(next))}
        />
      </td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.open)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.close)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.bid)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.ask)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.avgPrice)}</td>
      <td className="px-3 py-2 w-24 text-right tabular-nums">{safeNumber(row.volToday, 0)}</td>
      <td className="px-3 py-2 w-24 text-right tabular-nums">{safeNumber(row.volAvg10, 0)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(rvol)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(row.floatM)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(rotation)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safePct(row.shortPct)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(row.dtc)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(row.atr14)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safePct(atrPct)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(row.ema9)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safeNumber(row.ema200)}</td>
      <td className="px-3 py-2 w-16 text-right tabular-nums">{safePct(chgPct)}</td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label="Catalizador presente"
          checked={!!row.catalyst}
          onChange={(e) => onUpdate(row.id, 'catalyst', e.target.checked)}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          aria-label="Apto intradía"
          checked={!!row.intradiaOK}
          onChange={(e) => onUpdate(row.id, 'intradiaOK', e.target.checked)}
        />
      </td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safePct(row.spreadPct)}</td>
      <td className="px-3 py-2 w-24">
        <div className="flex flex-col items-end gap-1">
          <span className="tabular-nums">{safeNumber(row.liqM, 1)}</span>
          <span className="text-[10px] text-white/60">{info.currency}</span>
        </div>
      </td>
      <td className="px-3 py-2 w-[360px]">
        <div className="flex flex-wrap gap-1">
          <Badge ok={flags.priceOK} label="Precio" />
          <Badge ok={flags.emaOK} label=">EMA" />
          <Badge ok={flags.rvol2} label="RVOL≥2" />
          <Badge ok={flags.rvol5} label="RVOL≥5" />
          <Badge ok={flags.chgOK} label="%día" />
          <Badge ok={flags.atrOK} label="ATR" />
          <Badge ok={flags.float50} label="Float<50" />
          <Badge ok={flags.float10} label="Float<10" />
          <Badge ok={flags.rot1} label="Rot≥1x" />
          <Badge ok={flags.rot3} label="Rot≥3x" />
          <Badge ok={flags.shortOK} label="Short%" />
          <Badge ok={flags.spreadOK} label="Spread" />
          <Badge ok={flags.liqOK} label={`Liq ${info.currency}`} />
        </div>
      </td>
      <td className="px-2 py-1.5 w-44">
        <div className="flex items-center gap-2">
          <span className="w-12 text-right font-semibold tabular-nums">{safeNumber(score, 0)}</span>
          <div className="flex-1"><ScoreBar value={score || 0} label={`Score para ${row.ticker || 'fila'}`} /></div>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <textarea
          value={row.comments || ''}
          onChange={(e) => onUpdate(row.id, 'comments', e.target.value)}
          rows={2}
          className="w-36 border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-xs"
          placeholder="Notas"
          aria-label="Notas"
        />
      </td>
    </tr>
  );
};

export const TickerTable = ({
  rows,
  thresholds,
  selectedId,
  onSelect,
  onUpdate,
  onAddRow,
  onClearRows,
  onSortByScore,
  onExport,
  lastUpdatedLabel,
  loading,
  fetchError,
  stale,
  staleSeconds,
}) => {
  const calc = useMemo(() => createCalc(thresholds), [thresholds]);
  const computedRows = useMemo(
    () => rows.map((row) => ({ row, calcResult: calc(row, normalizeMarketKey(row.market)) })),
    [rows, calc],
  );
  const titleId = useId();
  const statusId = useId();
  const keyboardHelpId = useId();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectorViewMode, setSelectorViewMode] = useState(readMarketViewMode);
  const [favoriteMarkets, setFavoriteMarkets] = useState(readFavoriteMarkets);
  const [favoriteOnly, setFavoriteOnly] = useState(readMarketFilterPreference);

  const totalRows = computedRows.length;
  const maxPage = Math.max(0, Math.ceil(totalRows / pageSize) - 1);

  useEffect(() => {
    setPage((prev) => Math.min(prev, maxPage));
  }, [maxPage]);

  useEffect(() => {
    if (!selectedId) return;
    const index = computedRows.findIndex(({ row }) => row.id === selectedId);
    if (index === -1) return;
    const targetPage = Math.floor(index / pageSize);
    setPage((prev) => (prev === targetPage ? prev : targetPage));
  }, [selectedId, computedRows, pageSize]);

  const currentPage = Math.min(page, maxPage);
  const pageStart = currentPage * pageSize;
  const paginatedRows = useMemo(
    () => computedRows.slice(pageStart, pageStart + pageSize),
    [computedRows, pageStart, pageSize],
  );

  useEffect(() => {
    persistMarketViewMode(selectorViewMode);
  }, [selectorViewMode]);

  useEffect(() => {
    persistFavoriteMarkets(favoriteMarkets);
  }, [favoriteMarkets]);

  useEffect(() => {
    persistMarketFilterPreference(favoriteOnly);
  }, [favoriteOnly]);

  const handleSelectorModeChange = useCallback((mode) => {
    setSelectorViewMode(mode === MARKET_VIEW_MODES.DROPDOWN ? MARKET_VIEW_MODES.DROPDOWN : MARKET_VIEW_MODES.CHIPS);
  }, []);

  const handleToggleFavorite = useCallback((marketKey) => {
    setFavoriteMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(marketKey)) {
        next.delete(marketKey);
      } else {
        next.add(marketKey);
      }
      return next;
    });
  }, []);

  const handleFavoriteFilter = useCallback((value) => {
    setFavoriteOnly(value);
  }, []);

  const handleUpdate = useCallback(
    (id, key, value) => {
      if (key === 'market') {
        const normalized = normalizeMarketKey(value);
        persistLastSelectedMarket(normalized);
        onUpdate(id, key, normalized);
        return;
      }
      onUpdate(id, key, value);
    },
    [onUpdate],
  );

  const pageCount = Math.max(1, Math.ceil(Math.max(totalRows, 1) / pageSize));
  const startLabel = totalRows ? pageStart + 1 : 0;
  const endLabel = totalRows ? Math.min(totalRows, pageStart + pageSize) : 0;

  return (
    <div className={`rounded-2xl ${COLORS.glass} mt-6 shadow-2xl overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div>
          <h3 id={titleId} className="font-semibold">Tickers</h3>
          <div className="text-xs text-white/60 mt-0.5">
            Última actualización: {lastUpdatedLabel}
            {loading ? ' · actualizando' : ''}
          </div>
          <div id={statusId} className="text-xs mt-1 space-y-1" role="status" aria-live="polite">
            {stale ? (
              <div className="text-amber-300">
                Datos en caché · {staleSeconds != null ? `${staleSeconds}s sin refrescar` : 'edad desconocida'}
              </div>
            ) : null}
            {fetchError ? <div className="text-rose-300">Error: {fetchError}</div> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick={onAddRow}>+ Agregar fila</button>
          <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick={onClearRows}>Limpiar</button>
          <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick={onSortByScore}>Ordenar SCORE</button>
          <button className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow hover:from-sky-400 hover:to-cyan-500 transition" onClick={onExport}>Exportar CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table
          className="min-w-full text-left"
          aria-labelledby={titleId}
          aria-describedby={`${keyboardHelpId} ${statusId}`.trim()}
        >
          <caption id={keyboardHelpId} className="visualmente-oculto">
            Usa las flechas o la tecla Tab para moverte por los campos. Con la fila enfocada presiona Enter o espacio para
            seleccionarla.
          </caption>
          <thead className="text-[11px] uppercase tracking-wide text-white/60 bg-white/5">
            <tr>
              <th className="px-3 py-2" scope="col">Ticker</th>
              <th className="px-3 py-2" scope="col">Mercado</th>
              <th className="px-3 py-2" scope="col">Open</th>
              <th className="px-3 py-2" scope="col">Close</th>
              <th className="px-3 py-2" scope="col">Bid</th>
              <th className="px-3 py-2" scope="col">Ask</th>
              <th className="px-3 py-2" scope="col">Promedio</th>
              <th className="px-3 py-2" scope="col">Vol hoy</th>
              <th className="px-3 py-2" scope="col">Vol prom 10</th>
              <th className="px-3 py-2" scope="col">RVOL</th>
              <th className="px-3 py-2" scope="col">Float (M)</th>
              <th className="px-3 py-2" scope="col">Rotación</th>
              <th className="px-3 py-2" scope="col">Short%</th>
              <th className="px-3 py-2" scope="col">DTC</th>
              <th className="px-3 py-2" scope="col">ATR14</th>
              <th className="px-3 py-2" scope="col">ATR%</th>
              <th className="px-3 py-2" scope="col">EMA9</th>
              <th className="px-3 py-2" scope="col">EMA200</th>
              <th className="px-3 py-2" scope="col">%día</th>
              <th className="px-3 py-2" scope="col">Catal</th>
              <th className="px-3 py-2" scope="col">Intra</th>
              <th className="px-3 py-2" scope="col">Spread%</th>
              <th className="px-3 py-2" scope="col">Liquidez</th>
              <th className="px-3 py-2" scope="col">Flags</th>
              <th className="px-3 py-2" scope="col">Score</th>
              <th className="px-3 py-2" scope="col">Notas</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map(({ row, calcResult }) => (
              <TableRow
                key={row.id}
                row={row}
                calcResult={calcResult}
                isSelected={selectedId === row.id}
                onSelect={onSelect}
                onUpdate={handleUpdate}
                selectorViewMode={selectorViewMode}
                onSelectorModeChange={handleSelectorModeChange}
                favoriteMarkets={favoriteMarkets}
                onToggleFavorite={handleToggleFavorite}
                favoriteOnly={favoriteOnly}
                onToggleFavoriteFilter={handleFavoriteFilter}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/10 text-xs text-white/70">
        <div>
          Mostrando {startLabel}-{endLabel} de {totalRows}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1">
            <span>Filas por página</span>
            <select
              className={`${controlBaseClasses} w-24 pr-8`}
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPageSize(next);
                setPage(0);
              }}
              aria-label="Filas por página"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={currentPage === 0}
              aria-label="Página anterior"
            >
              Anterior
            </button>
            <span>Página {pageCount ? currentPage + 1 : 0} / {pageCount}</span>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setPage((prev) => Math.min(prev + 1, maxPage))}
              disabled={currentPage >= maxPage}
              aria-label="Página siguiente"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { TableRow };
