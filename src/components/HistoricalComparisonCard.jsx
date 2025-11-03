import React, { forwardRef, memo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { COLORS } from '../utils/constants.js';
import { fmt } from '../utils/format.js';
import { buildHistoricalComparisonDataset, formatDelta, formatDeltaPct } from '../utils/historicalBenchmarks.js';

const ComparisonTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const [current, baseline] = payload;
  return (
    <div className={`rounded-lg ${COLORS.glass} p-2 text-xs text-white/80 min-w-[160px]`}>
      <div className="font-semibold text-white mb-1">{current?.payload?.metric}</div>
      <div className="flex items-center justify-between">
        <span>Actual</span>
        <span className="font-semibold text-white">{fmt(current?.value, 1)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span>Histórico</span>
        <span className="font-semibold text-white">{fmt(baseline?.value, 1)}</span>
      </div>
    </div>
  );
};

const toneToClass = (tone) => {
  if (tone === 'positive') return 'text-emerald-300';
  if (tone === 'negative') return 'text-rose-300';
  return 'text-white/70';
};

export const HistoricalComparisonCard = memo(
  forwardRef(function HistoricalComparisonCard(
    {
      benchmark,
      current,
      timeRangeLabel,
      loading,
      error,
      theme,
      palette,
      onExport,
    },
    ref,
  ) {
    const comparison = buildHistoricalComparisonDataset({ current, benchmark: benchmark?.metrics });
    const rows = comparison.rows;
    const chartData = comparison.chartData;

    const accentColor = palette?.accent || '#38bdf8';
    const baselineColor = theme === 'dark' ? '#94a3b8' : '#64748b';

    return (
      <div
        ref={ref}
        className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px] flex flex-col gap-4`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-base">Benchmark histórico</h3>
            {benchmark ? (
              <p className="text-xs text-white/70 leading-snug">
                {benchmark.label} · {timeRangeLabel}
              </p>
            ) : null}
            {benchmark?.description ? (
              <p className="text-[11px] text-white/60 leading-snug max-w-xs">{benchmark.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/15 transition"
            onClick={() => onExport(ref?.current, {
              filename: 'benchmark-comparison.png',
              backgroundColor: theme === 'dark' ? '#0c1427' : '#ffffff',
            })}
            disabled={loading}
            aria-disabled={loading}
          >
            Exportar
          </button>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          {loading ? (
            <div className="text-sm text-white/60" aria-live="polite">
              Cargando benchmarks históricos…
            </div>
          ) : null}
          {error ? (
            <div className="text-sm text-rose-300" role="alert">
              {error}
            </div>
          ) : null}
          {!loading && !error && !comparison.hasData ? (
            <div className="text-sm text-white/60">Sin datos históricos disponibles.</div>
          ) : null}
          {comparison.hasData ? (
            <>
              <div className="h-40">
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                    <XAxis dataKey="metric" stroke={theme === 'dark' ? '#cbd5f5' : '#1e293b'} tick={{ fontSize: 11 }} />
                    <YAxis stroke={theme === 'dark' ? '#cbd5f5' : '#1e293b'} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ComparisonTooltip />} wrapperStyle={{ outline: 'none' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="actual" name="Actual" fill={accentColor} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="historical" name="Histórico" fill={baselineColor} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left" aria-label="Comparación de métricas actuales vs históricas">
                  <caption className="sr-only">
                    Comparación entre métricas actuales y valores históricos de referencia
                  </caption>
                  <thead className="text-white/70">
                    <tr>
                      <th scope="col" className="py-2 pr-4">Métrica</th>
                      <th scope="col" className="py-2 pr-4 text-right">Actual</th>
                      <th scope="col" className="py-2 pr-4 text-right">Histórico</th>
                      <th scope="col" className="py-2 pr-4 text-right">Δ</th>
                      <th scope="col" className="py-2 pr-2 text-right">Δ%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {rows.map((row) => {
                      const deltaLabel = formatDelta(row.delta, row.decimals);
                      const deltaPctLabel = formatDeltaPct(row.deltaPct);
                      return (
                        <tr key={row.id} className="text-white/80">
                          <th scope="row" className="py-2 pr-4 font-medium text-white">
                            {row.label}
                          </th>
                          <td className="py-2 pr-4 text-right">{fmt(row.currentValue, row.decimals)}</td>
                          <td className="py-2 pr-4 text-right text-white/70">
                            {fmt(row.baselineValue, row.decimals)}
                          </td>
                          <td className={`py-2 pr-4 text-right font-semibold ${toneToClass(deltaLabel.tone)}`}>
                            {deltaLabel.text}
                          </td>
                          <td className={`py-2 pr-2 text-right font-semibold ${toneToClass(deltaPctLabel.tone)}`}>
                            {deltaPctLabel.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }),
);

export default HistoricalComparisonCard;
