import React, { forwardRef, memo, useId } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { COLORS } from '../utils/constants.js';

const TIME_RANGE_LABELS = {
  '1D': 'últimas 24h',
  '5D': 'últimos 5 días',
  '1M': 'último mes',
  '3M': 'últimos 3 meses',
  ALL: 'todo el historial',
};

/**
 * Representa el embudo de confirmaciones mediante un diagrama de Sankey.
 *
 * @param {Object} props
 * @param {{ nodes: Array, links: Array }} props.data Datos del diagrama.
 * @param {(node: HTMLElement | null, options: { filename: string, backgroundColor: string }) => void} props.onExport Función de exportación.
 * @param {'light'|'dark'} props.theme Tema activo.
 * @param {string} props.timeRange Rango temporal activo.
 * @param {string} props.accentColor Color principal para nodos y enlaces.
 * @param {React.Ref<HTMLDivElement>} ref
 * @returns {JSX.Element}
 */
export const FlowSankeyCard = memo(
  forwardRef(function FlowSankeyCard({ data, onExport, theme, timeRange, accentColor }, ref) {
    const nodeStroke = theme === 'dark' ? '#1e293b' : '#cbd5f5';
    const headingId = useId();
    const descriptionId = useId();

    return (
      <div ref={ref} className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 id={headingId} className="font-semibold text-base">Embudo de confirmaciones</h3>
            <p id={descriptionId} className="text-xs text-white/60">Pasos promedio · {TIME_RANGE_LABELS[timeRange]}</p>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/15 transition"
            onClick={() => onExport(ref?.current, {
              filename: 'flujo-confirmaciones.png',
              backgroundColor: theme === 'dark' ? '#0c1427' : '#ffffff',
            })}
            aria-label="Exportar gráfico de embudo"
          >
            Exportar
          </button>
        </div>
        <div role="img" aria-labelledby={headingId} aria-describedby={descriptionId}>
          <ResponsiveContainer height={220}>
            <Sankey
              data={data}
              nodePadding={24}
              nodeWidth={18}
              margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
              link={{ stroke: accentColor, strokeWidth: 1.2 }}
              node={{ stroke: nodeStroke, fill: accentColor }}
            >
              <Tooltip content={<SankeyTooltip timeRange={timeRange} />} wrapperStyle={{ outline: 'none' }} />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }),
);

const SankeyTooltip = ({ active, payload, timeRange }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const link = item?.payload;
  if (!link) return null;
  const source = link.source?.name || '';
  const target = link.target?.name || '';
  return (
    <div className={`rounded-xl ${COLORS.glass} p-3 text-xs space-y-1 min-w-[160px]`}>
      <div className="font-semibold text-white">{`${source} → ${target}`}</div>
      <div className="text-[11px] text-white/60">{TIME_RANGE_LABELS[timeRange] || ''}</div>
      <div className="space-y-1 text-white/80">
        <div className="flex items-center justify-between">
          <span>Tickers</span>
          <span className="font-semibold text-white">{item.value}</span>
        </div>
      </div>
    </div>
  );
};
