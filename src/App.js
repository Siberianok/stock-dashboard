import { useCallback, useEffect, useMemo, useState } from "./vendor/react.js";
import { html } from "./lib/html.js";
import { COLORS, MARKETS } from "./constants.js";
import { ChartFallback } from "./components/ChartFallback.js";
import { ScoreBar } from "./components/ScoreBar.js";
import { Badge } from "./components/Badge.js";
import { Stat } from "./components/Stat.js";
import { usePersistentReducer } from "./hooks/usePersistentReducer.js";
import {
  thresholdsReducer,
  THRESHOLDS_ACTIONS,
  initThresholds,
} from "./state/thresholds.js";
import {
  rowsReducer,
  ROWS_ACTIONS,
  createRow,
} from "./state/rows.js";
import { useQuotes } from "./hooks/useQuotes.js";
import { useScanner } from "./hooks/useScanner.js";
import { safeInteger, safeNumber, safePct } from "./utils/number.js";
import {
  buildCsv,
  buildRadarData,
  buildSankeyData,
  buildScoreBuckets,
  calcScore,
  getKpis,
} from "./utils/calc.js";
import { buildDemoRows } from "./utils/demo.js";
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Sankey,
} from "./vendor/recharts.js";

const SCORE_COLORS = [COLORS.scoreHi, COLORS.scoreMid, COLORS.scoreLo];
const identity = (value) => value;

const useStableCallbacks = (dispatch) => {
  const setValue = useCallback((key, value) => dispatch({ type: THRESHOLDS_ACTIONS.SET_VALUE, key, value }), [dispatch]);
  const toggleMarket = useCallback((market, enabled) => dispatch({
    type: THRESHOLDS_ACTIONS.TOGGLE_MARKET,
    market,
    enabled,
  }), [dispatch]);
  const updatePriceRange = useCallback((market, field, value) => dispatch({
    type: THRESHOLDS_ACTIONS.UPDATE_PRICE_RANGE,
    market,
    field,
    value,
  }), [dispatch]);
  const updateLiquidityMin = useCallback((market, value) => dispatch({
    type: THRESHOLDS_ACTIONS.UPDATE_LIQUIDITY_MIN,
    market,
    value,
  }), [dispatch]);
  const reset = useCallback(() => dispatch({ type: THRESHOLDS_ACTIONS.RESET }), [dispatch]);
  return { setValue, toggleMarket, updatePriceRange, updateLiquidityMin, reset };
};

export const App = () => {
  const [thresholds, dispatchThresholds] = usePersistentReducer(
    "thresholds",
    thresholdsReducer,
    undefined,
    initThresholds,
    {
      loadAction: (payload) => ({ type: THRESHOLDS_ACTIONS.LOAD, payload }),
      serialize: identity,
    },
  );

  const [rows, dispatchRows] = usePersistentReducer(
    "rows",
    rowsReducer,
    undefined,
    () => [createRow()],
    {
      loadAction: (payload) => ({ type: ROWS_ACTIONS.LOAD, rows: payload }),
      serialize: identity,
    },
  );

  const { setValue, toggleMarket, updatePriceRange, updateLiquidityMin, reset } = useStableCallbacks(dispatchThresholds);

  const [selectedId, setSelectedId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [scanToken, setScanToken] = useState(0);

  useEffect(() => {
    if (!rows.length) return;
    if (!selectedId || !rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [rows, selectedId]);

  const tickers = useMemo(() => rows.map((row) => row.ticker).filter(Boolean), [rows]);

  const { quotes, loading: loadingQuotes, error: fetchError, updatedAt: quotesUpdatedAt } = useQuotes(tickers, {
    enabled: tickers.length > 0,
    refreshToken,
  });

  useEffect(() => {
    if (!quotes || !quotesUpdatedAt) return;
    const map = Object.fromEntries(Object.entries(quotes).map(([ticker, fields]) => [ticker, { ...fields, lastUpdate: quotesUpdatedAt }]));
    dispatchRows({ type: ROWS_ACTIONS.BULK_MERGE_BY_TICKER, map });
  }, [quotes, quotesUpdatedAt, dispatchRows]);

  const scannerState = useScanner(thresholds, { enabled: true, token: scanToken });

  const computedRows = useMemo(() => rows.map((row) => {
    const computed = calcScore(row, thresholds, row.market);
    const isActive = !!(thresholds.marketsEnabled?.[computed.market]);
    return { row, computed, isActive };
  }), [rows, thresholds]);

  const activeItems = useMemo(() => computedRows.filter((item) => item.isActive), [computedRows]);
  const kpis = useMemo(() => {
    const metrics = getKpis(activeItems.map((item) => item.computed));
    return { ...metrics, totalAll: rows.length };
  }, [activeItems, rows.length]);

  const scoreBuckets = useMemo(() => buildScoreBuckets(activeItems.map((item) => item.computed))
    .map((bucket, index) => ({ ...bucket, color: SCORE_COLORS[index] })), [activeItems]);
  const sankeyData = useMemo(() => buildSankeyData(activeItems.map((item) => item.computed)), [activeItems]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) || rows[0] || null, [rows, selectedId]);
  const selectedComputed = useMemo(() => (selectedRow ? calcScore(selectedRow, thresholds, selectedRow.market) : null), [selectedRow, thresholds]);
  const radarData = useMemo(() => buildRadarData(selectedComputed, thresholds, selectedRow), [selectedComputed, thresholds, selectedRow]);

  const lastUpdated = useMemo(() => {
    const stamps = rows.map((row) => row.lastUpdate).filter(Boolean);
    if (!stamps.length) return null;
    return stamps.reduce((max, current) => (current > max ? current : max), stamps[0]);
  }, [rows]);
  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "Sin datos";
    const d = new Date(lastUpdated);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [lastUpdated]);

  const scannerUpdatedLabel = useMemo(() => {
    if (!scannerState.lastUpdated) return "Sin datos";
    const d = new Date(scannerState.lastUpdated);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [scannerState.lastUpdated]);

  const addRow = useCallback(() => dispatchRows({ type: ROWS_ACTIONS.ADD }), [dispatchRows]);
  const clearRows = useCallback(() => {
    dispatchRows({ type: ROWS_ACTIONS.CLEAR });
    setSelectedId(null);
  }, [dispatchRows]);
  const updateRow = useCallback((id, key, value) => dispatchRows({ type: ROWS_ACTIONS.UPDATE, id, key, value }), [dispatchRows]);

  const refreshQuotesNow = useCallback(() => setRefreshToken(Date.now()), []);
  const triggerScan = useCallback(() => setScanToken(Date.now()), []);

  const applyMatchesToTable = useCallback(() => {
    if (!scannerState.matches?.length) return;
    const nextRows = scannerState.matches.map(({ data }) => ({ ...data, lastUpdate: scannerState.lastUpdated }));
    dispatchRows({ type: ROWS_ACTIONS.SET_ALL, rows: nextRows });
    setSelectedId(null);
    setRefreshToken(Date.now());
  }, [dispatchRows, scannerState.matches, scannerState.lastUpdated]);

  const sortByScore = useCallback(() => {
    const sorted = [...rows].sort((a, b) => (calcScore(b, thresholds, b.market).score || 0) - (calcScore(a, thresholds, a.market).score || 0));
    dispatchRows({ type: ROWS_ACTIONS.SET_ALL, rows: sorted });
  }, [rows, thresholds, dispatchRows]);

  const exportCSV = useCallback(() => {
    const csv = buildCsv(rows, thresholds);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "selector_parabolicas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, thresholds]);

  const seedDemo = useCallback(() => {
    const demoRows = buildDemoRows();
    dispatchRows({ type: ROWS_ACTIONS.SET_ALL, rows: demoRows });
    setSelectedId(null);
    setRefreshToken(Date.now());
  }, [dispatchRows]);

  const applyPreset = useCallback((preset) => {
    Object.entries(preset).forEach(([key, value]) => setValue(key, value));
  }, [setValue]);

  const setPresetModerado = useCallback(() => applyPreset({
    rvolMin: 2,
    rvolIdeal: 5,
    chgMin: 10,
    parabolic50: false,
    atrMin: 0.5,
    atrPctMin: 3,
    needEMA200: true,
  }), [applyPreset]);

  const setPresetAgresivo = useCallback(() => applyPreset({
    rvolMin: 3,
    rvolIdeal: 6,
    chgMin: 20,
    parabolic50: true,
    atrMin: 0.6,
    atrPctMin: 4,
    needEMA200: true,
  }), [applyPreset]);

  const resetThresholds = useCallback(() => reset(), [reset]);

  return html`
    <div className={`min-h-screen ${COLORS.baseBg} text-slate-100`}>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30 bg-[radial-gradient(1000px_600px_at_10%_-20%,#22d3ee,transparent),radial-gradient(800px_400px_at_90%_-10%,#a78bfa,transparent)]" />
        <div className="max-w-[1200px] mx-auto px-4 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
              <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-7z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Selector de acciones</h1>
              <p className="text-white/70 text-sm md:text-base">Checklist visual gráfico para detectar acciones candidatas Momentum / parabólicas</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
            ${Stat({ label: "Tickers en tabla", value: kpis.total, sub: `de ${kpis.totalAll}`, icon: "📈" })}
            ${Stat({ label: "Auto activos", value: scannerState.matches.length, sub: scannerState.loading ? "Escaneando..." : (scannerState.lastUpdated ? `Act. ${scannerUpdatedLabel}` : "Sin datos"), icon: "🔎" })}
            ${Stat({ label: "Máximo", value: Math.round(kpis.top), icon: "🎯" })}
            ${Stat({ label: "En juego", value: kpis.inPlay, icon: "⚡" })}
            ${Stat({ label: "Listas 70+", value: kpis.ready70, icon: "🚀" })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <button onClick=${setPresetModerado} className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition">Preset: Moderado</button>
            <button onClick=${setPresetAgresivo} className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition">Preset: Agresivo</button>
            <button onClick=${sortByScore} className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow hover:from-emerald-400 hover:to-teal-500 transition">Ordenar por SCORE</button>
            <button onClick=${seedDemo} className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition">Test aleatorio</button>
            <button onClick=${exportCSV} className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow hover:from-sky-400 hover:to-indigo-500 transition">Exportar CSV</button>
            <button onClick=${resetThresholds} className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition">Reset defaults</button>
          </div>

          <div className="mt-6 text-center">
            <div className="text-sm font-medium text-white/80">Mercados a escanear</div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              ${Object.entries(MARKETS).map(([key, info]) => html`
                <label key=${key} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-sm">
                  <input type="checkbox" className="accent-emerald-400" checked=${!!thresholds.marketsEnabled?.[key]} onChange=${(event) => toggleMarket(key, event.target.checked)} />
                  <span>${info.label}</span>
                  <span className="text-xs text-white/60">(${info.currency})</span>
                </label>
              `)}
            </div>
            <div className="text-xs text-white/60 mt-2">Solo se computan los tickers de los mercados activos.</div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 pb-10">
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
            <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Precio &amp; Volatilidad</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center place-items-center">
              ${Object.entries(MARKETS).map(([key, info]) => {
                const cfg = thresholds.priceRange?.[key] || {};
                return html`
                  <div key=${key} className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-3">
                    <span className="text-white/80 font-medium">${info.label} (${info.currency})</span>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <label className="flex flex-col items-center gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-white/60">Mínimo</span>
                        <input type="number" step="0.05" value=${cfg.min ?? ""} onChange=${(event) => updatePriceRange(key, "min", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
                      </label>
                      <label className="flex flex-col items-center gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-white/60">Máximo</span>
                        <input type="number" step="0.05" value=${cfg.max ?? ""} onChange=${(event) => updatePriceRange(key, "max", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
                      </label>
                    </div>
                  </div>
                `;
              })}
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">ATR ≥ (moneda local)</span>
                <input type="number" step="0.05" value=${thresholds.atrMin} onChange=${(event) => setValue("atrMin", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">ATR% ≥</span>
                <input type="number" step="0.1" value=${thresholds.atrPctMin} onChange=${(event) => setValue("atrPctMin", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="sm:col-span-2 w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">%día ≥</span>
                <input type="number" step="1" value=${thresholds.chgMin} onChange=${(event) => setValue("chgMin", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1">
                <input type="checkbox" checked=${thresholds.parabolic50} onChange=${(event) => setValue("parabolic50", event.target.checked)} />
                <span>Modo parabólico (≥ 50%)</span>
              </label>
            </div>
          </div>

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
            <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Volumen &amp; Float</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center items-start justify-items-center">
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">RVOL ≥</span>
                <input type="number" step="0.1" value=${thresholds.rvolMin} onChange=${(event) => setValue("rvolMin", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">RVOL ideal ≥</span>
                <input type="number" step="0.1" value=${thresholds.rvolIdeal} onChange=${(event) => setValue("rvolIdeal", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Float &lt; (M)</span>
                <input type="number" step="1" value=${thresholds.float50} onChange=${(event) => setValue("float50", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Pref. Float &lt; (M)</span>
                <input type="number" step="1" value=${thresholds.float10} onChange=${(event) => setValue("float10", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Rotación ≥</span>
                <input type="number" step="0.1" value=${thresholds.rotationMin} onChange=${(event) => setValue("rotationMin", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Rotación ideal ≥</span>
                <input type="number" step="0.1" value=${thresholds.rotationIdeal} onChange=${(event) => setValue("rotationIdeal", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
            </div>
          </div>

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
            <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Técnico &amp; Micro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center place-items-center">
              ${Object.entries(MARKETS).map(([key, info]) => html`
                <label key=${key} className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                  <span className="text-white/80 font-medium">Liquidez mínima (M, ${info.currency})</span>
                  <input type="number" step="0.5" value=${thresholds.liquidityMin?.[key] ?? ""} onChange=${(event) => updateLiquidityMin(key, Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
                </label>
              `)}
              <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                <span className="text-white/80 font-medium">Spread ≤ %</span>
                <input type="number" step="0.1" value=${thresholds.spreadMaxPct} onChange=${(event) => setValue("spreadMaxPct", Number(event.target.value))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
              </label>
              <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1">
                <input type="checkbox" checked=${thresholds.needEMA200} onChange=${(event) => setValue("needEMA200", event.target.checked)} />
                <span>Requerir precio &gt; EMA200</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px] relative`}>
            <h3 className="font-semibold text-center mb-3">Distribución de SCORE</h3>
            <div className="h-56">
              ${scoreBuckets.length ? html`
                <${ResponsiveContainer} width="100%" height="100%">
                  <${PieChart}>
                    <${Tooltip} formatter=${(value, name) => [value, name]} />
                    <${Pie} data=${scoreBuckets} dataKey="value" nameKey="name" innerRadius=${50} outerRadius=${80} paddingAngle=${2}>
                      ${scoreBuckets.map((bucket, index) => html`<${Cell} key=${`c-${index}`} fill=${bucket.color} />`)}
                    </${Pie}>
                  </${PieChart}>
                </${ResponsiveContainer}>
              ` : ChartFallback({ label: "Distribución" })}
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold">${kpis.total}</div>
                <div className="text-xs text-white/70">tickers</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-white/70 text-center">Nota: el centro muestra los tickers activos.</div>
          </div>

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
            <h3 className="font-semibold text-center mb-3">Embudo de filtros</h3>
            <div className="h-56">
              ${activeItems.length ? html`
                <${ResponsiveContainer} width="100%" height="100%">
                  <${Sankey} data=${sankeyData} nodePadding=${24} nodeWidth=${12} linkCurvature=${0.5} margin=${{ left: 10, right: 10, top: 10, bottom: 10 }} />
                </${ResponsiveContainer}>
              ` : ChartFallback({ label: "Embudo" })}
            </div>
            <div className="mt-2 text-xs text-white/70 text-center">Flujo: Universe → PrecioOK → EMAOK → RVOL≥2 → SCORE≥70.</div>
          </div>

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
            <h3 className="font-semibold text-center mb-3">Perfil del ticker (Radar)</h3>
            <div className="h-56">
              ${radarData.length ? html`
                <${ResponsiveContainer} width="100%" height="100%">
                  <${RadarChart} data=${radarData} outerRadius=${80}>
                    <${PolarGrid} />
                    <${PolarAngleAxis} dataKey="k" tick=${{ fill: "#e2e8f0", fontSize: 11 }} />
                    <${PolarRadiusAxis} tick=${{ fill: "#94a3b8", fontSize: 10 }} tickCount=${5} angle=${30} domain=${[0, 100]} />
                    <${Radar} dataKey="v" stroke="#38bdf8" fill="#38bdf8" fillOpacity=${0.3} />
                    <${Tooltip} formatter=${(value, name) => [safeNumber(value, 0), name]} />
                  </${RadarChart}>
                </${ResponsiveContainer}>
              ` : ChartFallback({ label: "Radar" })}
            </div>
            <div className="mt-2 text-xs text-white/70 text-center">Click en una fila para seleccionarlo.</div>
          </div>
        </div>

        <div className={`rounded-2xl ${COLORS.glass} mt-6 shadow-2xl`}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
            <div>
              <h3 className="font-semibold">Tickers activos (auto)</h3>
              <div className="text-xs text-white/60 mt-0.5">Universo predefinido filtrado en tiempo real según todos los criterios activos.</div>
            </div>
            <div className="flex flex-col gap-2 items-end sm:flex-row sm:items-center sm:gap-3">
              <div className="text-xs text-white/60">Actualizado: ${scannerState.lastUpdated ? scannerUpdatedLabel : "—"}${scannerState.loading ? " · escaneando" : ""}</div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition disabled:opacity-60 disabled:cursor-not-allowed" onClick=${triggerScan} disabled=${scannerState.loading}>Escanear ahora</button>
                <button className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow hover:from-emerald-400 hover:to-teal-500 transition disabled:opacity-60 disabled:cursor-not-allowed" onClick=${applyMatchesToTable} disabled=${scannerState.loading || !scannerState.matches.length}>Cargar en tabla</button>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            ${scannerState.error ? html`<div className="text-xs text-rose-300">Error: ${scannerState.error}</div>` : null}
            ${scannerState.loading && !scannerState.matches.length ? html`<div className="text-sm text-white/70">Buscando coincidencias...</div>` : null}
            ${!scannerState.loading && !scannerState.matches.length && !scannerState.error ? html`<div className="text-sm text-white/60">Ningún ticker del universo cumple todos los filtros actualmente.</div>` : null}
            ${scannerState.matches.length ? html`
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${scannerState.matches.map(({ data, computed }) => html`
                  <div key=${`${data.ticker}-${data.market}`} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">${data.ticker}</div>
                        <div className="text-[11px] text-white/60">${MARKETS[data.market]?.label || data.market}</div>
                      </div>
                      <div className="text-right text-[11px] text-white/60">${MARKETS[data.market]?.currency || ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-semibold tabular-nums">${safeNumber(computed.score, 0)}</span>
                      <div className="flex-1">${ScoreBar({ value: computed.score || 0 })}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-white/70">
                      <div>
                        <div className="text-white/80 font-medium">Close</div>
                        <div className="tabular-nums">${safeNumber(data.close)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">%día</div>
                        <div className="tabular-nums">${safePct(computed.chgPct)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">ATR%</div>
                        <div className="tabular-nums">${safePct(computed.atrPct)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">RVOL</div>
                        <div className="tabular-nums">${safeNumber(computed.rvol)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Rotación</div>
                        <div className="tabular-nums">${safeNumber(computed.rotation)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Float (M)</div>
                        <div className="tabular-nums">${safeNumber(data.floatM)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Short%</div>
                        <div className="tabular-nums">${safePct(data.shortPct)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Liquidez (M)</div>
                        <div className="tabular-nums">${safeNumber(data.liqM, 1)} ${MARKETS[data.market]?.currency || ""}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      ${Badge({ ok: computed.flags.priceOK, label: "Precio" })}
                      ${Badge({ ok: computed.flags.emaOK, label: ">EMA" })}
                      ${Badge({ ok: computed.flags.rvol2, label: "RVOL≥2" })}
                      ${Badge({ ok: computed.flags.rvol5, label: "RVOL≥5" })}
                      ${Badge({ ok: computed.flags.chgOK, label: "%día" })}
                      ${Badge({ ok: computed.flags.atrOK, label: "ATR" })}
                      ${Badge({ ok: computed.flags.float50, label: "Float<50" })}
                      ${Badge({ ok: computed.flags.float10, label: "Float<10" })}
                      ${Badge({ ok: computed.flags.rot1, label: "Rot≥1x" })}
                      ${Badge({ ok: computed.flags.rot3, label: "Rot≥3x" })}
                      ${Badge({ ok: computed.flags.shortOK, label: "Short%" })}
                      ${Badge({ ok: computed.flags.spreadOK, label: "Spread" })}
                      ${Badge({ ok: computed.flags.liqOK, label: `Liq ${MARKETS[data.market]?.currency || ""}` })}
                    </div>
                  </div>
                `)}
              </div>
            ` : null}
          </div>
        </div>

        <div className={`rounded-2xl ${COLORS.glass} mt-6 shadow-2xl overflow-hidden`}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
            <div>
              <h3 className="font-semibold">Tickers</h3>
              <div className="text-xs text-white/60 mt-0.5">Última actualización: ${lastUpdatedLabel}${loadingQuotes ? " · actualizando" : ""}</div>
              ${fetchError ? html`<div className="text-xs text-rose-300 mt-1">Error: ${fetchError}</div>` : null}
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick=${addRow}>+ Agregar fila</button>
              <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick=${clearRows}>Limpiar</button>
              <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition" onClick=${refreshQuotesNow}>${loadingQuotes ? "Actualizando..." : "Actualizar ahora"}</button>
            </div>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-xs table-fixed">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur">
                  ${[
                    "Ticker/Mercado","Open","Close","Bid","Ask","Promedio","VolHoy","VolProm20","RVOL","Float(M)","Rotación","Short%","DTC (TTS)","ATR14","ATR%","EMA9","EMA200","%día","Catal","IntradíaOK","Spread%","Liquidez(M)","Flags","SCORE","Notas",
                  ].map((header, index) => html`<th key=${index} className="px-3 py-2 font-semibold text-left whitespace-nowrap text-white/90">${header}</th>`)}
                </tr>
              </thead>
              <tbody>
                ${computedRows.map(({ row, computed }) => {
                  const market = row.market || "US";
                  const info = MARKETS[market] || MARKETS.US;
                  const selected = row.id === selectedId;
                  return html`
                    <tr key=${row.id} onClick=${() => setSelectedId(row.id)} className={`border-b border-white/10 odd:bg-white/0 even:bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer ${selected ? "ring-1 ring-emerald-400/40" : ""}`}>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <input value=${row.ticker} onChange=${(event) => updateRow(row.id, "ticker", (event.target.value || "").toUpperCase())} className="w-24 border border-white/20 bg-white/10 text-white rounded px-2 py-1" placeholder="TICK" />
                          <select value=${market} onChange=${(event) => updateRow(row.id, "market", event.target.value)} className="w-24 border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-xs">
                            ${Object.entries(MARKETS).map(([key, m]) => html`<option key=${key} value=${key} className="bg-slate-900">${m.label}</option>`)}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2 w-24 text-right tabular-nums">${safeNumber(row.open)}</td>
                      <td className="px-3 py-2 w-24 text-right tabular-nums">${safeNumber(row.close)}</td>
                      <td className="px-3 py-2 w-24 text-right tabular-nums">${safeNumber(row.bid)}</td>
                      <td className="px-3 py-2 w-24 text-right tabular-nums">${safeNumber(row.ask)}</td>
                      <td className="px-3 py-2 w-24 text-right tabular-nums">${safeNumber(row.avgPrice)}</td>
                      <td className="px-3 py-2 w-28 text-right tabular-nums">${safeInteger(row.volToday)}</td>
                      <td className="px-3 py-2 w-28 text-right tabular-nums">${safeInteger(row.volAvg20)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safeNumber(computed.rvol)}</td>
                      <td className="px-3 py-2 w-24 text-right tabular-nums">${safeNumber(row.floatM)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safeNumber(computed.rotation)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safePct(row.shortPct)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safeNumber(row.dtc)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safeNumber(row.atr14)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safePct(computed.atrPct)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safeNumber(row.ema9)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safeNumber(row.ema200)}</td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safePct(computed.chgPct)}</td>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked=${!!row.catalyst} onChange=${(event) => updateRow(row.id, "catalyst", event.target.checked)} /></td>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked=${!!row.intradiaOK} onChange=${(event) => updateRow(row.id, "intradiaOK", event.target.checked)} /></td>
                      <td className="px-3 py-2 w-20 text-right tabular-nums">${safePct(row.spreadPct)}</td>
                      <td className="px-3 py-2 w-24">
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular-nums">${safeNumber(row.liqM, 1)}</span>
                          <span className="text-[10px] text-white/60">${info.currency}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 w-[360px]">
                        <div className="flex flex-wrap gap-1">
                          ${Badge({ ok: computed.flags.priceOK, label: "Precio" })}
                          ${Badge({ ok: computed.flags.emaOK, label: ">EMA" })}
                          ${Badge({ ok: computed.flags.rvol2, label: "RVOL≥2" })}
                          ${Badge({ ok: computed.flags.rvol5, label: "RVOL≥5" })}
                          ${Badge({ ok: computed.flags.chgOK, label: "%día" })}
                          ${Badge({ ok: computed.flags.atrOK, label: "ATR" })}
                          ${Badge({ ok: computed.flags.float50, label: "Float<50" })}
                          ${Badge({ ok: computed.flags.float10, label: "Float<10" })}
                          ${Badge({ ok: computed.flags.rot1, label: "Rot≥1x" })}
                          ${Badge({ ok: computed.flags.rot3, label: "Rot≥3x" })}
                          ${Badge({ ok: computed.flags.shortOK, label: "Short%" })}
                          ${Badge({ ok: computed.flags.spreadOK, label: "Spread" })}
                          ${Badge({ ok: computed.flags.liqOK, label: `Liq ${info.currency}` })}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 w-44">
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-right font-semibold tabular-nums">${safeNumber(computed.score, 0)}</span>
                          <div className="flex-1">${ScoreBar({ value: computed.score || 0 })}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <textarea value=${row.comments || ""} onChange=${(event) => updateRow(row.id, "comments", event.target.value)} rows=${2} className="w-36 border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-xs" placeholder="Notas"></textarea>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/70 text-center">
          <p>Tips: Seleccioná el mercado para aplicar los umbrales correctos. Rotación = VolHoy / (Float * 1e6). ATR% = ATR14 / Close * 100. %día = (Close - Open)/Open*100.</p>
        </div>

        <div className={`rounded-2xl ${COLORS.glass} mt-6 p-6 shadow-xl`}>
          <h3 className="text-lg font-semibold text-center">Guía rápida de métricas</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4 text-sm text-white/70">
            <div>
              <h4 className="text-white font-semibold text-base mb-2">Precio &amp; Volatilidad</h4>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><span className="text-white">Rango de precio:</span> controla los valores mínimo y máximo aceptados para cada mercado.</li>
                <li><span className="text-white">%día ≥:</span> porcentaje mínimo de variación respecto de la apertura; mide aceleración intradía del precio.</li>
                <li><span className="text-white">ATR ≥:</span> umbral de rango verdadero promedio en moneda local para asegurar amplitud de movimiento en términos absolutos.</li>
                <li><span className="text-white">ATR% ≥:</span> versión relativa del ATR sobre el precio de cierre, estandariza la volatilidad para comparar tickers distintos.</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-base mb-2">Volumen &amp; Float</h4>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><span className="text-white">RVOL ≥:</span> relación mínima entre el volumen actual y el promedio reciente; confirma que hay volumen anómalo entrando.</li>
                <li><span className="text-white">RVOL ideal ≥:</span> objetivo superior de participación respecto del promedio, referencia para los escenarios más fuertes.</li>
                <li><span className="text-white">Float &lt; (M):</span> límite máximo de acciones disponibles en millones para privilegiar floats reducidos y susceptibles de squeeze.</li>
                <li><span className="text-white">Pref. Float &lt; (M):</span> umbral preferido aún más exigente, típico para plays súper especulativos.</li>
                <li><span className="text-white">Rotación ≥:</span> rotación mínima (VolHoy / Float) que debe darse durante la sesión para validar interés genuino.</li>
                <li><span className="text-white">Rotación ideal ≥:</span> objetivo de rotación que marca un flujo excepcional sobre el float.</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-base mb-2">Técnico &amp; Micro</h4>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><span className="text-white">Liquidez mínima (M):</span> monto mínimo negociado por mercado para asegurar ejecuciones sin slippage excesivo.</li>
                <li><span className="text-white">Spread ≤ %:</span> tope de diferencia bid/ask permitido para evitar spreads amplios.</li>
                <li><span className="text-white">Requerir precio &gt; EMA200:</span> check que fuerza a que el precio esté sobre la media de 200 días antes de aprobar.</li>
                <li><span className="text-white">Stickers en tabla:</span> insignias verdes/rojas que muestran de un vistazo qué filtros superó cada ticker.</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-base mb-2">KPIs &amp; Presets clave</h4>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><span className="text-white">Auto activos:</span> cantidad de tickers que el escáner cargó automáticamente desde el universo con los filtros vigentes.</li>
                <li><span className="text-white">Máximo:</span> mejor SCORE registrado en la tabla; sirve como referencia del techo actual del setup.</li>
                <li><span className="text-white">En juego:</span> número de tickers con score intermedio que están cerca de cumplir todos los criterios.</li>
                <li><span className="text-white">Listas 70+:</span> tickers con SCORE ≥ 70, considerados listos para ejecutar según el checklist.</li>
                <li><span className="text-white">Preset Moderado:</span> configura umbrales equilibrados para escenarios momentum estándar.</li>
                <li><span className="text-white">Preset Agresivo:</span> sube las exigencias para plays parabólicos de alta convicción.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};
