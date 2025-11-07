import React, { useMemo, useId } from 'react';
import { COLORS } from '../utils/constants.js';
import { safeNumber } from '../utils/format.js';

const formatDuration = (ms) => {
  if (!Number.isFinite(ms)) return '—';
  if (ms >= 1000) {
    return `${safeNumber(ms / 1000, 2)} s`;
  }
  return `${safeNumber(ms, 0)} ms`;
};

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes >= 1_048_576) {
    return `${safeNumber(bytes / 1_048_576, 2)} MB`;
  }
  if (bytes >= 1024) {
    return `${safeNumber(bytes / 1024, 1)} KB`;
  }
  return `${safeNumber(bytes, 0)} B`;
};

const formatTimestamp = (value) => {
  if (!value) return 'Hora desconocida';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Hora desconocida';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const DiagnosticsPanel = ({ metrics = [], logs = [], regionId }) => {
  const generatedId = useId();
  const baseId = regionId ?? generatedId;
  const headingId = `${baseId}-heading`;
  const metricsHeadingId = `${baseId}-metrics`;
  const logsHeadingId = `${baseId}-logs`;
  const latestMetrics = useMemo(() => metrics.slice(-5).reverse(), [metrics]);
  const latestLogs = useMemo(() => logs.slice(-5).reverse(), [logs]);

  if (!latestMetrics.length && !latestLogs.length) {
    return null;
  }

  return (
    <section
      className={`rounded-2xl ${COLORS.glass} mt-6 p-4 shadow-xl`}
      id={baseId}
      aria-labelledby={headingId}
      role="region"
    >
      <h3 id={headingId} className="text-sm font-semibold text-white/80 mb-3">
        Diagnóstico de consultas
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 id={metricsHeadingId} className="text-xs uppercase tracking-wide text-white/60 mb-2">
            Métricas recientes
          </h4>
          <ul
            aria-labelledby={metricsHeadingId}
            className="space-y-1.5 text-[11px] text-white/70"
            aria-live="polite"
          >
            {latestMetrics.length ? (
              latestMetrics.map((metric, index) => (
                <li key={metric.id || `${metric.requestKey}-${index}`} className="flex justify-between gap-2">
                  <span className="font-medium text-white/80">{metric.requestKey || 'Consulta'}</span>
                  <span>{metric.fetchedSymbols ?? 0}/{metric.totalSymbols ?? 0} símbolos</span>
                  <span>{formatDuration(metric.durationMs)}</span>
                  <span>{formatSize(metric.payloadSize)}</span>
                  <span className={metric.success ? 'text-emerald-300' : 'text-amber-300'}>
                    {metric.success ? 'OK' : 'Atención'}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-white/50">Sin métricas registradas.</li>
            )}
          </ul>
        </div>
        <div>
          <h4 id={logsHeadingId} className="text-xs uppercase tracking-wide text-white/60 mb-2">
            Errores recientes
          </h4>
          <ul
            aria-labelledby={logsHeadingId}
            className="space-y-1.5 text-[11px] text-white/70"
            aria-live="assertive"
          >
            {latestLogs.length ? (
              latestLogs.map((log, index) => (
                <li key={log.id || `${log.context}-${index}`}>
                  <div className="font-medium text-rose-200">{log.context || 'Evento'}</div>
                  <div>{log.message || 'Sin detalle adicional.'}</div>
                  {log.extra?.symbols ? (
                    <div className="text-white/50">Símbolos: {log.extra.symbols.join(', ')}</div>
                  ) : null}
                  <div className="text-white/40">{formatTimestamp(log.timestamp)}</div>
                </li>
              ))
            ) : (
              <li className="text-white/50">Sin errores recientes.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
};
