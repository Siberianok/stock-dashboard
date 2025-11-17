import React, { useEffect, useMemo, useState, useId } from 'react';
import { COLORS, MARKETS } from '../utils/constants.js';
import { safeNumber, safePct } from '../utils/format.js';
import { createCalc } from '../utils/calc.js';
import { ScoreBar } from './ScoreBar.jsx';
import { Badge } from './Badge.jsx';

const DEFAULT_MARKET = 'US';
const UNKNOWN_OPTION_VALUE = 'UNKNOWN';

const normalizeMarketKey = (marketKey) => (marketKey && MARKETS[marketKey] ? marketKey : DEFAULT_MARKET);

export const TableRow = ({ row, calcResult, isSelected, onSelect, onUpdate }) => {
  const rawMarket = row.market;
  const isKnownMarket = rawMarket ? !!MARKETS[rawMarket] : true;
  const normalizedMarket = isKnownMarket ? rawMarket || DEFAULT_MARKET : DEFAULT_MARKET;
  const selectValue = isKnownMarket ? normalizedMarket : UNKNOWN_OPTION_VALUE;
  const info = MARKETS[normalizedMarket] || MARKETS[DEFAULT_MARKET];
  const { rvol, atrPct, chgPct, rotation, score, flags } = calcResult;
  const stale = !!row.isStale;

  const handleMarketChange = (event) => {
    const nextMarket = normalizeMarketKey(event.target.value);
    onUpdate(row.id, 'market', nextMarket);
  };

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
          className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-sm"
          value={row.ticker || ''}
          onChange={(e) => onUpdate(row.id, 'ticker', e.target.value.toUpperCase())}
          placeholder="Ticker"
          aria-label="Ticker"
        />
        {stale ? <div className="text-[10px] text-amber-300 mt-1">Cache</div> : null}
      </td>
      <td className="px-3 py-2 w-28">
        <select
          className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-sm"
          value={selectValue}
          onChange={handleMarketChange}
          disabled={stale}
          aria-label="Mercado"
        >
          {Object.entries(MARKETS).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
          {isKnownMarket ? null : <option value={UNKNOWN_OPTION_VALUE}>Desconocido</option>}
        </select>
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
  const computedRows = useMemo(() => rows.map((row) => ({ row, calcResult: calc(row, row.market || 'US') })), [rows, calc]);
  const titleId = useId();
  const statusId = useId();
  const keyboardHelpId = useId();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

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
                onUpdate={onUpdate}
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
              className="border border-white/20 bg-white/10 text-white rounded px-2 py-1"
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
