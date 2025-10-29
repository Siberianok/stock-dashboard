import React, { useMemo } from 'react';
import { COLORS, MARKETS } from '../utils/constants.js';
import { safeNumber, safePct } from '../utils/format.js';
import { createCalc } from '../utils/calc.js';
import { ScoreBar } from './ScoreBar.jsx';

const Badge = ({ ok, label }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ok ? COLORS.badgeOK : COLORS.badgeNO}`}>
    {label}
  </span>
);

const TableRow = ({ row, calcResult, isSelected, onSelect, onUpdate }) => {
  const market = row.market || 'US';
  const info = MARKETS[market] || MARKETS.US;
  const { rvol, atrPct, chgPct, rotation, score, flags } = calcResult;

  return (
    <tr
      className={`border-b border-white/10 text-xs ${isSelected ? 'bg-white/10' : 'bg-transparent'} hover:bg-white/10 transition`}
      onClick={() => onSelect(row.id)}
    >
      <td className="px-3 py-2 w-32">
        <input
          className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-sm"
          value={row.ticker || ''}
          onChange={(e) => onUpdate(row.id, 'ticker', e.target.value.toUpperCase())}
          placeholder="Ticker"
        />
      </td>
      <td className="px-3 py-2 w-28">
        <select
          className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-sm"
          value={row.market || 'US'}
          onChange={(e) => onUpdate(row.id, 'market', e.target.value)}
        >
          {Object.entries(MARKETS).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.open)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.close)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.bid)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.ask)}</td>
      <td className="px-3 py-2 w-20 text-right tabular-nums">{safeNumber(row.avgPrice)}</td>
      <td className="px-3 py-2 w-24 text-right tabular-nums">{safeNumber(row.volToday, 0)}</td>
      <td className="px-3 py-2 w-24 text-right tabular-nums">{safeNumber(row.volAvg20, 0)}</td>
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
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.catalyst} onChange={(e) => onUpdate(row.id, 'catalyst', e.target.checked)} /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.intradiaOK} onChange={(e) => onUpdate(row.id, 'intradiaOK', e.target.checked)} /></td>
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
          <div className="flex-1"><ScoreBar value={score || 0} /></div>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <textarea
          value={row.comments || ''}
          onChange={(e) => onUpdate(row.id, 'comments', e.target.value)}
          rows={2}
          className="w-36 border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-xs"
          placeholder="Notas"
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
}) => {
  const calc = useMemo(() => createCalc(thresholds), [thresholds]);
  const computedRows = useMemo(() => rows.map((row) => ({ row, calcResult: calc(row, row.market || 'US') })), [rows, calc]);

  return (
    <div className={`rounded-2xl ${COLORS.glass} mt-6 shadow-2xl overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="font-semibold">Tickers</h3>
          <div className="text-xs text-white/60 mt-0.5">Última actualización: {lastUpdatedLabel}{loading ? ' · actualizando' : ''}</div>
          {fetchError ? <div className="text-xs text-rose-300 mt-1">Error: {fetchError}</div> : null}
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick={onAddRow}>+ Agregar fila</button>
          <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick={onClearRows}>Limpiar</button>
          <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick={onSortByScore}>Ordenar SCORE</button>
          <button className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow hover:from-sky-400 hover:to-cyan-500 transition" onClick={onExport}>Exportar CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="text-[11px] uppercase tracking-wide text-white/60 bg-white/5">
            <tr>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Mercado</th>
              <th className="px-3 py-2">Open</th>
              <th className="px-3 py-2">Close</th>
              <th className="px-3 py-2">Bid</th>
              <th className="px-3 py-2">Ask</th>
              <th className="px-3 py-2">Promedio</th>
              <th className="px-3 py-2">Vol hoy</th>
              <th className="px-3 py-2">Vol prom 20</th>
              <th className="px-3 py-2">RVOL</th>
              <th className="px-3 py-2">Float (M)</th>
              <th className="px-3 py-2">Rotación</th>
              <th className="px-3 py-2">Short%</th>
              <th className="px-3 py-2">DTC</th>
              <th className="px-3 py-2">ATR14</th>
              <th className="px-3 py-2">ATR%</th>
              <th className="px-3 py-2">EMA9</th>
              <th className="px-3 py-2">EMA200</th>
              <th className="px-3 py-2">%día</th>
              <th className="px-3 py-2">Catal</th>
              <th className="px-3 py-2">Intra</th>
              <th className="px-3 py-2">Spread%</th>
              <th className="px-3 py-2">Liquidez</th>
              <th className="px-3 py-2">Flags</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {computedRows.map(({ row, calcResult }) => (
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
    </div>
  );
};
