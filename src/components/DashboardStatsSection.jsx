import React from 'react';
import { COLORS } from '../utils/constants.js';
import { safeInteger } from '../utils/format.js';

/**
 * @typedef {Object} DashboardStats
 * @property {number} total
 * @property {number} totalAll
 * @property {number} ready70
 * @property {number} inPlay
 * @property {number} top
 */

/**
 * Bloque de KPIs agregados con selector de rango temporal.
 *
 * @param {Object} props
 * @param {string} props.timeRange Rango seleccionado actualmente.
 * @param {(nextRange: string) => void} props.onTimeRangeChange Handler para actualizar el rango temporal.
 * @param {Array<{ key: string, label: string }>} props.rangeOptions Opciones disponibles de rango temporal.
 * @param {DashboardStats} props.kpis KPIs agregados del dashboard.
 * @param {number|null} props.lastSnapshotTimestamp Marca temporal del último snapshot disponible.
 * @param {boolean} props.hasSnapshots Indica si hay historial de snapshots.
 * @param {() => void} props.onClearHistory Callback para limpiar el historial de snapshots.
 * @returns {JSX.Element}
 */
export function DashboardStatsSection({
  timeRange,
  onTimeRangeChange,
  rangeOptions,
  kpis,
  lastSnapshotTimestamp,
  hasSnapshots,
  onClearHistory,
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">KPIs agregados</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/60">Rango:</span>
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onTimeRangeChange(option.key)}
              className={`px-2.5 py-1 rounded-full border ${
                timeRange === option.key ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10'
              } transition`}
              aria-pressed={timeRange === option.key}
            >
              {option.label}
            </button>
          ))}
          {hasSnapshots ? (
            <button
              type="button"
              className="ml-2 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 transition"
              onClick={onClearHistory}
            >
              Limpiar historial
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <Stat label="Tickers activos" value={safeInteger(kpis.total)} sub={`Total tabla: ${safeInteger(kpis.totalAll)}`} icon="📈" />
        <Stat label="Ready ≥70" value={safeInteger(kpis.ready70)} sub="Listos para ejecución" icon="🚀" />
        <Stat label="En juego" value={safeInteger(kpis.inPlay)} sub="RVOL + Precio + EMA" icon="🔥" />
        <Stat label="Score máximo" value={safeInteger(kpis.top)} sub="Mejor setup" icon="🏆" />
      </div>
      <div className="text-xs text-white/50">
        {lastSnapshotTimestamp
          ? `Último registro: ${new Date(lastSnapshotTimestamp).toLocaleString()}`
          : 'Sin historial almacenado aún.'}
      </div>
    </section>
  );
}

/**
 * Tarjeta individual de KPI.
 *
 * @param {Object} props
 * @param {string} props.label Etiqueta principal del KPI.
 * @param {string|number} props.value Valor principal.
 * @param {string} props.sub Texto auxiliar.
 * @param {React.ReactNode} props.icon Ícono representativo.
 * @returns {JSX.Element}
 */
function Stat({ label, value, sub, icon }) {
  return (
    <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-lg flex flex-col items-center text-center gap-2`}>
      <div className="p-3 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">{icon}</div>
      <div>
        <div className="text-3xl font-semibold text-white leading-tight">{value}</div>
        <div className="text-sm text-white/80">{label}</div>
        {sub ? <div className="text-xs text-white/60 mt-1">{sub}</div> : null}
      </div>
    </div>
  );
}
