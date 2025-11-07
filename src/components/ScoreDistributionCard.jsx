import React, { forwardRef, memo, useId } from 'react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { COLORS } from '../utils/constants.js';
import { fmt } from '../utils/format.js';

const TIME_RANGE_LABELS = {
  '1D': 'últimas 24h',
  '5D': 'últimos 5 días',
  '1M': 'último mes',
  '3M': 'últimos 3 meses',
  ALL: 'todo el historial',
};

/**
 * @typedef {Object} ScoreDistributionDatum
 * @property {string} name
 * @property {number} value
 * @property {string} color
 */

/**
 * Tarjeta que muestra la distribución del SCORE mediante un gráfico de torta.
 *
 * @param {Object} props
 * @param {ScoreDistributionDatum[]} props.data Datos del gráfico.
 * @param {number} props.total Total de tickers contemplados.
 * @param {number} props.averageScore Promedio ponderado del SCORE.
 * @param {string} props.timeRange Rango temporal seleccionado.
 * @param {(node: HTMLElement | null, options: { filename: string, backgroundColor: string }) => void} props.onExport Función para exportar el gráfico.
 * @param {'light'|'dark'} props.theme Tema activo para definir colores de exportación.
 * @param {React.Ref<HTMLDivElement>} ref
 * @returns {JSX.Element}
 */
export const ScoreDistributionCard = memo(
  forwardRef(function ScoreDistributionCard(
    { data, total, averageScore, timeRange, onExport, theme },
    ref,
  ) {
    const headingId = useId();
    const descriptionId = useId();

    return (
      <div ref={ref} className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 id={headingId} className="font-semibold text-base">Distribución de SCORE</h3>
            <p id={descriptionId} className="text-xs text-white/60">
              Promedio ponderado: {fmt(averageScore, 1)} · {TIME_RANGE_LABELS[timeRange]}
            </p>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/15 transition"
            onClick={() => onExport(ref?.current, {
              filename: 'score-distribution.png',
              backgroundColor: theme === 'dark' ? '#0c1427' : '#ffffff',
            })}
            aria-label="Exportar gráfico de distribución"
          >
            Exportar
          </button>
        </div>
        <div role="img" aria-labelledby={headingId} aria-describedby={descriptionId}>
          <ResponsiveContainer height={220}>
            <PieChart>
              <Tooltip content={<ScoreDistributionTooltip total={total} timeRange={timeRange} />} wrapperStyle={{ outline: 'none' }} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-xs text-white/70 text-center">Tickers promedio activos: {Math.round(total || 0)}</div>
      </div>
    );
  }),
);

const ScoreDistributionTooltip = ({ active, payload, total, timeRange }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  const share = total ? Math.round(((item.value || 0) / total) * 1000) / 10 : 0;
  return (
    <TooltipCard title={item.name} subtitle={TIME_RANGE_LABELS[timeRange] || ''}>
      <div className="flex items-center justify-between">
        <span>Tickers</span>
        <span className="font-semibold text-white">{item.value}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Participación</span>
        <span className="font-semibold text-white">{share.toFixed(1)}%</span>
      </div>
    </TooltipCard>
  );
};

const TooltipCard = ({ title, subtitle, children }) => (
  <div className={`rounded-xl ${COLORS.glass} p-3 text-xs space-y-1 min-w-[160px]`}>
    {title ? <div className="font-semibold text-white">{title}</div> : null}
    {subtitle ? <div className="text-[11px] text-white/60">{subtitle}</div> : null}
    <div className="space-y-1 text-white/80">{children}</div>
  </div>
);
