import React, { forwardRef, memo, useId } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { COLORS } from '../utils/constants.js';
import { fmt } from '../utils/format.js';

/**
 * @typedef {{ k: string, v: number, raw: number }} RadarDatum
 */

/**
 * Tarjeta que resume el perfil del ticker seleccionado mediante un gráfico radar.
 *
 * @param {Object} props
 * @param {RadarDatum[]} props.data Datos a mostrar.
 * @param {{ ticker?: string, market?: string } | null} props.selectedRow Fila seleccionada en la tabla.
 * @param {(node: HTMLElement | null, options: { filename: string, backgroundColor: string }) => void} props.onExport Acción de exportar.
 * @param {'light'|'dark'} props.theme Tema visual actual.
 * @param {string} props.accentColor Color principal del gráfico.
 * @param {() => void} [props.onOpenPreview] Acción para abrir la vista previa de filtros.
 * @param {string} [props.previewDialogId] Identificador del diálogo de preview.
 * @param {React.Ref<HTMLDivElement>} ref
 * @returns {JSX.Element}
 */
export const PerformanceRadarCard = memo(
  forwardRef(function PerformanceRadarCard(
    { data, selectedRow, onExport, theme, accentColor, onOpenPreview, previewDialogId },
    ref,
  ) {
    const label = selectedRow?.ticker ? `${selectedRow.ticker} · ${selectedRow.market || ''}` : 'Sin selección';
    const headingId = useId();
    const descriptionId = useId();

    return (
      <div ref={ref} className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 id={headingId} className="font-semibold text-base">Perfil del ticker</h3>
            <p id={descriptionId} className="text-xs text-white/60">{label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onOpenPreview?.()}
              disabled={!selectedRow}
              aria-haspopup="dialog"
              aria-controls={previewDialogId || undefined}
            >
              Abrir previsualización
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/15 transition"
              onClick={() => onExport(ref?.current, {
                filename: 'perfil-ticker.png',
                backgroundColor: theme === 'dark' ? '#0c1427' : '#ffffff',
              })}
              aria-label="Exportar gráfico de radar"
            >
              Exportar
            </button>
          </div>
        </div>
        <div role="img" aria-labelledby={headingId} aria-describedby={descriptionId}>
          <ResponsiveContainer height={220}>
            <RadarChart data={data} outerRadius={80}>
              <PolarGrid />
              <PolarAngleAxis dataKey="k" tick={{ fill: '#e2e8f0', fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickCount={5} angle={30} domain={[0, 100]} />
              <Radar dataKey="v" stroke={accentColor} fill={accentColor} fillOpacity={0.3} />
              <Tooltip content={<RadarTooltip />} wrapperStyle={{ outline: 'none' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-white/70 text-center">Click en una fila para actualizar el radar.</div>
      </div>
    );
  }),
);

const RadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div className={`rounded-xl ${COLORS.glass} p-3 text-xs space-y-1 min-w-[140px]`}>
      <div className="font-semibold text-white">{item.k}</div>
      <div className="space-y-1 text-white/80">
        <div className="flex items-center justify-between">
          <span>Puntaje</span>
          <span className="font-semibold text-white">{fmt(item.v, 0)}%</span>
        </div>
        {item.raw !== undefined ? (
          <div className="flex items-center justify-between">
            <span>Valor</span>
            <span className="font-semibold text-white">{fmt(item.raw, 2)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
