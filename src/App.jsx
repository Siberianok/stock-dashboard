import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
} from 'recharts';
import { COLORS, MARKETS } from './utils/constants.js';
import { fmt, safeInteger, safeNumber, safePct, toNum } from './utils/format.js';
import { uid } from './utils/misc.js';
import { extractQuoteFields } from './utils/quotes.js';
import { createCalc } from './utils/calc.js';
import { fetchQuotes } from './services/yahooFinance.js';
import { useThresholds } from './hooks/useThresholds.js';
import { useScanner } from './hooks/useScanner.js';
import { TickerTable } from './components/TickerTable.jsx';
import { ScoreBar } from './components/ScoreBar.jsx';

const parseNumberInput = (event) => {
  const { value } = event.target;
  return value === '' ? undefined : Number(value);
};

const Badge = ({ ok, label }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ok ? COLORS.badgeOK : COLORS.badgeNO}`}>
    {label}
  </span>
);

const Stat = ({ label, value, sub, icon }) => (
  <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-lg flex flex-col items-center text-center gap-2`}>
    <div className="p-3 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">{icon}</div>
    <div>
      <div className="text-3xl font-semibold text-white leading-tight">{value}</div>
      <div className="text-sm text-white/80">{label}</div>
      {sub ? <div className="text-xs text-white/60 mt-1">{sub}</div> : null}
    </div>
  </div>
);

const createRow = (overrides = {}) => ({
  id: uid(),
  ticker: '',
  market: 'US',
  open: undefined,
  close: undefined,
  bid: undefined,
  ask: undefined,
  avgPrice: undefined,
  volToday: undefined,
  volAvg20: undefined,
  floatM: undefined,
  shortPct: undefined,
  dtc: undefined,
  atr14: undefined,
  ema9: undefined,
  ema200: undefined,
  spreadPct: undefined,
  liqM: undefined,
  catalyst: false,
  intradiaOK: false,
  comments: '',
  lastUpdate: null,
  ...overrides,
});

const useTickerRows = () => {
  const [rows, setRowsInternal] = useState([createRow()]);
  const setRows = useCallback((updater) => {
    setRowsInternal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return Array.isArray(next) && next.length ? next : [createRow()];
    });
  }, []);
  const addRow = useCallback(() => setRows((prev) => [...prev, createRow()]), [setRows]);
  const clearRows = useCallback(() => setRows([createRow()]), [setRows]);
  const updateRow = useCallback((id, key, value) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }, [setRows]);
  return { rows, setRows, addRow, clearRows, updateRow };
};

function App() {
  const { thresholds, thresholdsKey, updatePriceRange, updateLiquidityMin, toggleMarket, presetModerado, presetAgresivo, setThresholds } = useThresholds();
  const calc = useMemo(() => createCalc(thresholds), [thresholds]);
  const { rows, setRows, addRow, clearRows, updateRow } = useTickerRows();
  const [selectedId, setSelectedId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const tickers = useMemo(() => rows.map((r) => r.ticker).filter(Boolean), [rows]);
  const tickersKey = tickers.join(',');

  useEffect(() => {
    if (!tickersKey) {
      setFetchError(null);
      setLoadingQuotes(false);
      return undefined;
    }
    let active = true;
    const load = async (force) => {
      try {
        if (!active) return;
        setLoadingQuotes(true);
        setFetchError(null);
        const { quotes, error: quotesError, staleSymbols } = await fetchQuotes(tickers, { force });
        if (!active) return;
        const staleSet = new Set((staleSymbols || []).map((symbol) => symbol.toUpperCase()));
        setRows((prev) => prev.map((row) => {
          const symbolKey = row.ticker ? row.ticker.toUpperCase() : row.ticker;
          const quote = symbolKey ? quotes[symbolKey] : undefined;
          if (!quote) return row;
          const fields = extractQuoteFields(quote);
          const nextLastUpdate = staleSet.has(symbolKey) ? row.lastUpdate : new Date().toISOString();
          return { ...row, ...fields, lastUpdate: nextLastUpdate };
        }));
        setFetchError(quotesError || null);
      } catch (error) {
        console.error(error);
        if (!active) return;
        setFetchError(error?.message || 'Error al actualizar datos');
      } finally {
        if (!active) return;
        setLoadingQuotes(false);
      }
    };
    load(refreshToken !== 0);
    const interval = window.setInterval(() => load(false), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [tickersKey, refreshToken, tickers, setRows]);

  const refreshQuotes = useCallback(() => setRefreshToken(Date.now()), []);

  const lastUpdated = useMemo(() => {
    const stamps = rows.map((r) => r.lastUpdate).filter(Boolean);
    if (!stamps.length) return null;
    return stamps.reduce((max, cur) => (cur > max ? cur : max), stamps[0]);
  }, [rows]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return 'Sin datos';
    const d = new Date(lastUpdated);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [lastUpdated]);

  const computedRows = useMemo(
    () =>
      rows.map((row) => ({
        row,
        computed: calc(row, row.market || 'US'),
        isActive: thresholds.marketsEnabled?.[row.market || 'US'] !== false,
      })),
    [rows, calc, thresholds.marketsEnabled],
  );

  const activeComputed = useMemo(() => computedRows.filter((entry) => entry.isActive), [computedRows]);

  const visibleRows = useMemo(
    () => rows.filter((row) => thresholds.marketsEnabled?.[row.market || 'US'] !== false),
    [rows, thresholds.marketsEnabled],
  );

  const kpis = useMemo(() => {
    const scores = activeComputed.map((entry) => entry.computed?.score || 0);
    const top = scores.length ? Math.max(...scores) : 0;
    const inPlay = activeComputed.filter((entry) => {
      const flags = entry.computed?.flags || {};
      return flags.rvol2 && flags.priceOK && flags.emaOK;
    }).length;
    const ready70 = activeComputed.filter((entry) => (entry.computed?.score || 0) >= 70).length;
    return { top, inPlay, ready70, total: activeComputed.length, totalAll: rows.length };
  }, [activeComputed, rows.length]);

  const scoreBuckets = useMemo(() => {
    const hi = activeComputed.filter((entry) => (entry.computed?.score || 0) >= 70).length;
    const mid = activeComputed.filter((entry) => {
      const score = entry.computed?.score || 0;
      return score >= 40 && score < 70;
    }).length;
    const lo = Math.max(0, (activeComputed.length || 0) - hi - mid);
    return [
      { name: '>=70', value: hi, color: COLORS.scoreHi },
      { name: '40–69', value: mid, color: COLORS.scoreMid },
      { name: '<40', value: lo, color: COLORS.scoreLo },
    ];
  }, [activeComputed]);

  const sankeyData = useMemo(() => {
    const nUniverse = activeComputed.length;
    const price = activeComputed.filter((entry) => entry.computed?.flags?.priceOK);
    const ema = price.filter((entry) => entry.computed?.flags?.emaOK);
    const rvol2 = ema.filter((entry) => entry.computed?.flags?.rvol2);
    const ready = rvol2.filter((entry) => (entry.computed?.score || 0) >= 70);
    return {
      nodes: [
        { name: `Universe (${nUniverse})` },
        { name: `PrecioOK (${price.length})` },
        { name: `EMAOK (${ema.length})` },
        { name: `RVOL≥2 (${rvol2.length})` },
        { name: `SCORE≥70 (${ready.length})` },
      ],
      links: [
        { source: 0, target: 1, value: price.length },
        { source: 1, target: 2, value: ema.length },
        { source: 2, target: 3, value: rvol2.length },
        { source: 3, target: 4, value: ready.length },
      ],
    };
  }, [activeComputed]);

  const selectedRow = useMemo(() => {
    const found = rows.find((row) => row.id === selectedId);
    return found || rows[0];
  }, [rows, selectedId]);

  const selectedCalc = useMemo(() => (selectedRow ? calc(selectedRow, selectedRow.market) : null), [selectedRow, calc]);

  const radarData = useMemo(() => {
    if (!selectedCalc) return [];
    const r = selectedCalc;
    const scale = (val, thr) => {
      if (val === undefined || thr === 0 || thr === undefined) return 0;
      return Math.max(0, Math.min(100, (val / thr) * 100));
    };
    const rvolScore = scale(r.rvol, thresholds.rvolIdeal);
    const chgScore = scale(r.chgPct, thresholds.parabolic50 ? 50 : thresholds.chgMin);
    const atrScore = scale(r.atrPct, thresholds.atrPctMin * 2);
    const rotScore = scale(r.rotation, thresholds.rotationIdeal);
    const shortScore = scale(toNum(selectedRow?.shortPct), thresholds.shortMin);
    const scoreScore = Math.max(0, Math.min(100, r.score || 0));
    return [
      { k: 'RVOL', v: rvolScore },
      { k: '%día', v: chgScore },
      { k: 'ATR%', v: atrScore },
      { k: 'Rot', v: rotScore },
      { k: 'Short%', v: shortScore },
      { k: 'SCORE', v: scoreScore },
    ];
  }, [selectedCalc, selectedRow, thresholds]);

  const { state: scannerState, triggerScan } = useScanner({ thresholds, calc, thresholdsKey });
  const scannerMatches = scannerState.matches || [];
  const scannerLoading = !!scannerState.loading;
  const scannerError = scannerState.error;

  const applyMatchesToTable = useCallback(() => {
    if (!scannerMatches.length) return;
    const next = scannerMatches.map(({ data }) => createRow({ ...data, lastUpdate: scannerState.lastUpdated }));
    setRows(next);
    setSelectedId(next[0]?.id || null);
    setRefreshToken(Date.now());
  }, [scannerMatches, scannerState.lastUpdated, setRows]);

  const scannerUpdatedLabel = useMemo(() => {
    if (!scannerState.lastUpdated) return 'Sin datos';
    const d = new Date(scannerState.lastUpdated);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [scannerState.lastUpdated]);

  const sortByScore = useCallback(() => {
    setRows((prev) => [...prev].sort((a, b) => (calc(b, b.market).score || 0) - (calc(a, a.market).score || 0)));
  }, [calc, setRows]);

  const exportCSV = useCallback(() => {
    const headers = [
      'Ticker','Mercado','Moneda','Open','Close','Bid','Ask','Promedio','VolHoy','VolProm20','RVOL','Float(M)','Rotación','Short%','DTC','ATR14','ATR%','EMA9','EMA200','%día','Catal','IntradíaOK','Spread%','Liquidez(M)','SCORE','priceOK','emaOK','rvol2','rvol5','chgOK','atrOK','float<50','float<10','rot≥1','rot≥3','shortOK','spreadOK','liqOK',
    ];
    const lines = [headers.join(',')];
    rows.forEach((row) => {
      const market = row.market || 'US';
      const info = MARKETS[market] || MARKETS.US;
      const { rvol, atrPct, chgPct, rotation, score, flags } = calc(row, market);
      lines.push([
        row.ticker,
        info.label,
        info.currency,
        row.open,
        row.close,
        row.bid,
        row.ask,
        row.avgPrice,
        row.volToday,
        row.volAvg20,
        fmt(rvol),
        row.floatM,
        fmt(rotation, 2),
        row.shortPct,
        row.dtc,
        row.atr14,
        fmt(atrPct),
        row.ema9,
        row.ema200,
        fmt(chgPct),
        row.catalyst,
        row.intradiaOK,
        row.spreadPct,
        row.liqM,
        Math.round(score || 0),
        flags.priceOK,
        flags.emaOK,
        flags.rvol2,
        flags.rvol5,
        flags.chgOK,
        flags.atrOK,
        flags.float50,
        flags.float10,
        flags.rot1,
        flags.rot3,
        flags.shortOK,
        flags.spreadOK,
        flags.liqOK,
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selector_parabolicas.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, calc]);

  const seedDemo = useCallback(() => {
    const now = new Date().toISOString();
    const demoRows = [
      createRow({
        ticker: 'MARA',
        market: 'US',
        open: 18.2,
        close: 23.4,
        bid: 23.3,
        ask: 23.5,
        avgPrice: 21.8,
        volToday: 128000000,
        volAvg20: 36000000,
        floatM: 25,
        shortPct: 22,
        dtc: 2.4,
        atr14: 2.3,
        ema9: 20.9,
        ema200: 15.8,
        spreadPct: 0.7,
        liqM: 2995,
        catalyst: true,
        intradiaOK: true,
        comments: 'Gap + volumen explosivo',
        lastUpdate: now,
      }),
      createRow({
        ticker: 'PLTR',
        market: 'US',
        open: 17.6,
        close: 19.9,
        bid: 19.8,
        ask: 20.0,
        avgPrice: 18.7,
        volToday: 82000000,
        volAvg20: 27000000,
        floatM: 48,
        shortPct: 12,
        dtc: 1.6,
        atr14: 1.4,
        ema9: 18.4,
        ema200: 15.1,
        spreadPct: 0.4,
        liqM: 1630,
        catalyst: false,
        intradiaOK: true,
        comments: 'Rompió consolidación diaria',
        lastUpdate: now,
      }),
      createRow({
        ticker: 'GGAL.BA',
        market: 'AR',
        open: 1480,
        close: 1660,
        bid: 1655,
        ask: 1670,
        avgPrice: 1570,
        volToday: 1800000,
        volAvg20: 540000,
        floatM: 1.5,
        shortPct: 8,
        dtc: 1.2,
        atr14: 130,
        ema9: 1520,
        ema200: 1260,
        spreadPct: 0.9,
        liqM: 2980,
        catalyst: true,
        intradiaOK: false,
        comments: 'Impulso tras resultados trimestrales',
        lastUpdate: now,
      }),
      createRow({
        ticker: 'PETR4.SA',
        market: 'BR',
        open: 28.2,
        close: 31.6,
        bid: 31.5,
        ask: 31.7,
        avgPrice: 29.9,
        volToday: 54000000,
        volAvg20: 18000000,
        floatM: 35,
        shortPct: 6,
        dtc: 1.1,
        atr14: 1.9,
        ema9: 30.2,
        ema200: 25.4,
        spreadPct: 0.6,
        liqM: 1706,
        catalyst: false,
        intradiaOK: true,
        comments: 'Reacción a datos de producción',
        lastUpdate: now,
      }),
      createRow({
        ticker: 'AIR.PA',
        market: 'EU',
        open: 149,
        close: 164,
        bid: 163.8,
        ask: 164.2,
        avgPrice: 156.5,
        volToday: 6200000,
        volAvg20: 2200000,
        floatM: 4.5,
        shortPct: 4,
        dtc: 0.8,
        atr14: 5.4,
        ema9: 154,
        ema200: 138,
        spreadPct: 0.3,
        liqM: 1017,
        catalyst: true,
        intradiaOK: true,
        comments: 'Pedidos récord en cartera',
        lastUpdate: now,
      }),
      createRow({
        ticker: 'TSLA',
        market: 'US',
        open: 186,
        close: 205,
        bid: 204.8,
        ask: 205.2,
        avgPrice: 195.5,
        volToday: 102000000,
        volAvg20: 42000000,
        floatM: 30,
        shortPct: 14,
        dtc: 2.1,
        atr14: 8.6,
        ema9: 198,
        ema200: 182,
        spreadPct: 0.5,
        liqM: 2091,
        catalyst: false,
        intradiaOK: false,
        comments: 'Rumores de nuevo modelo',
        lastUpdate: now,
      }),
    ];
    setRows(demoRows);
    setSelectedId(demoRows[0]?.id || null);
    setFetchError(null);
    setRefreshToken(Date.now());
  }, [setRows]);

  return (
    <div className={`min-h-screen ${COLORS.baseBg} text-slate-100`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Selector de acciones parabólicas</h1>
            <p className="text-sm text-white/70 max-w-2xl mt-2">
              Checklist momentum + scoring + charts para monitorear plays parabólicos. Ajustá umbrales por mercado, escaneá el universo automático y filtrá los tickers más explosivos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
              <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition" onClick={seedDemo}>Cargar demo</button>
              <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition" onClick={refreshQuotes}>Refrescar precios</button>
            </div>
          </div>
          <div className={`rounded-2xl ${COLORS.glass} p-4 text-sm max-w-xs space-y-2`}>
            <div className="text-xs uppercase tracking-wide text-white/60">Presets rápidos</div>
            <button className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition" onClick={presetModerado}>Moderado (Momentum)</button>
            <button className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition" onClick={presetAgresivo}>Agresivo (50%)</button>
          </div>
        </header>

        <section className="grid md:grid-cols-4 gap-4">
          <Stat label="Tickers activos" value={safeInteger(kpis.total)} sub={`Total tabla: ${safeInteger(kpis.totalAll)}`} icon="📈" />
          <Stat label="Ready ≥70" value={safeInteger(kpis.ready70)} sub="Listos para ejecución" icon="🚀" />
          <Stat label="En juego" value={safeInteger(kpis.inPlay)} sub="RVOL + Precio + EMA" icon="🔥" />
          <Stat label="Score máximo" value={safeInteger(kpis.top)} sub="Mejor setup actual" icon="🏆" />
        </section>

        <section className={`rounded-2xl ${COLORS.glass} p-6 shadow-xl`}>
          <h2 className="text-xl font-semibold mb-4">Umbrales por mercado</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
                <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Mercados</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(MARKETS).map(([key, info]) => (
                    <label key={key} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                      <span className="font-medium">{info.label}</span>
                      <input type="checkbox" checked={!!thresholds.marketsEnabled?.[key]} onChange={(e) => toggleMarket(key, e.target.checked)} />
                    </label>
                  ))}
                </div>
              </div>

              <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
                <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Precio</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {Object.entries(MARKETS).map(([key, info]) => (
                    <div key={key} className="space-y-2 bg-white/5 rounded-xl p-3">
                      <div className="text-center text-white/70 text-xs uppercase tracking-wide">{info.label}</div>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-white/80">Mínimo</span>
                        <input type="number" step="0.1" value={thresholds.priceRange?.[key]?.min ?? ''} onChange={(e) => updatePriceRange(key, 'min', parseNumberInput(e))} className="border border-white/20 bg-white/10 text-white rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-white/80">Máximo</span>
                        <input type="number" step="0.1" value={thresholds.priceRange?.[key]?.max ?? ''} onChange={(e) => updatePriceRange(key, 'max', parseNumberInput(e))} className="border border-white/20 bg-white/10 text-white rounded px-2 py-1" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
                <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Volumen & Float</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center items-start justify-items-center">
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">RVOL ≥</span>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds.rvolMin ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.rvolMin;
                            return next;
                          }
                          return { ...prev, rvolMin: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">RVOL ideal ≥</span>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds.rvolIdeal ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.rvolIdeal;
                            return next;
                          }
                          return { ...prev, rvolIdeal: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">Float &lt; (M)</span>
                    <input
                      type="number"
                      step="1"
                      value={thresholds.float50 ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.float50;
                            return next;
                          }
                          return { ...prev, float50: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">Pref. Float &lt; (M)</span>
                    <input
                      type="number"
                      step="1"
                      value={thresholds.float10 ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.float10;
                            return next;
                          }
                          return { ...prev, float10: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">Rotación ≥</span>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds.rotationMin ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.rotationMin;
                            return next;
                          }
                          return { ...prev, rotationMin: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">Rotación ideal ≥</span>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds.rotationIdeal ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.rotationIdeal;
                            return next;
                          }
                          return { ...prev, rotationIdeal: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                </div>
              </div>

              <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`}>
                <h3 className="font-semibold mb-4 text-center text-lg tracking-wide">Técnico & Micro</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center place-items-center">
                  {Object.entries(MARKETS).map(([key, info]) => (
                    <label key={key} className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                      <span className="text-white/80 font-medium">Liquidez mínima (M, {info.currency})</span>
                      <input type="number" step="0.5" value={thresholds.liquidityMin?.[key] ?? ''} onChange={(e) => updateLiquidityMin(key, parseNumberInput(e))} className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center" />
                    </label>
                  ))}
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2">
                    <span className="text-white/80 font-medium">Spread ≤ %</span>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholds.spreadMaxPct ?? ''}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        setThresholds((prev) => {
                          if (nextValue === undefined) {
                            const next = { ...prev };
                            delete next.spreadMaxPct;
                            return next;
                          }
                          return { ...prev, spreadMaxPct: nextValue };
                        });
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                  </label>
                  <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1">
                    <input type="checkbox" checked={thresholds.needEMA200} onChange={(e) => setThresholds((prev) => ({ ...prev, needEMA200: e.target.checked }))} />
                    <span>Requerir precio &gt; EMA200</span>
                  </label>
                  <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1">
                    <input type="checkbox" checked={thresholds.parabolic50} onChange={(e) => setThresholds((prev) => ({ ...prev, parabolic50: e.target.checked }))} />
                    <span>Modo parabólico (≥ 50%)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-6">
          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px] relative`}>
            <h3 className="font-semibold text-center mb-3">Distribución de SCORE</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Pie data={scoreBuckets} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {scoreBuckets.map((entry, i) => <Cell key={`c-${i}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold">{kpis.total}</div>
                <div className="text-xs text-white/70">tickers</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-white/70 text-center">Nota: el centro muestra los tickers activos.</div>
          </div>

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
            <h3 className="font-semibold text-center mb-3">Embudo de filtros</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey data={sankeyData} nodePadding={24} nodeWidth={12} linkCurvature={0.5} margin={{ left: 10, right: 10, top: 10, bottom: 10 }} />
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-white/70 text-center">Flujo: Universe → PrecioOK → EMAOK → RVOL≥2 → SCORE≥70.</div>
          </div>

          <div className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl min-h-[280px]`}>
            <h3 className="font-semibold text-center mb-3">Perfil del ticker (Radar)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius={80}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="k" tick={{ fill: '#e2e8f0', fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickCount={5} angle={30} domain={[0, 100]} />
                  <Radar dataKey="v" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} />
                  <Tooltip formatter={(value, name) => [fmt(value, 0), name]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-white/70 text-center">Click en una fila para seleccionarlo.</div>
          </div>
        </section>

        <section className={`rounded-2xl ${COLORS.glass} mt-6 shadow-2xl`}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
            <div>
              <h3 className="font-semibold">Tickers activos (auto)</h3>
              <div className="text-xs text-white/60 mt-0.5">Universo predefinido filtrado en tiempo real según todos los criterios activos.</div>
            </div>
            <div className="flex flex-col gap-2 items-end sm:flex-row sm:items-center sm:gap-3">
              <div className="text-xs text-white/60">Actualizado: {scannerState.lastUpdated ? scannerUpdatedLabel : '—'}{scannerLoading ? ' · escaneando' : ''}</div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={triggerScan} disabled={scannerLoading}>Escanear ahora</button>
                <button className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow hover:from-emerald-400 hover:to-teal-500 transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={applyMatchesToTable} disabled={scannerLoading || !scannerMatches.length}>Cargar en tabla</button>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {scannerError ? <div className="text-xs text-rose-300">Error: {scannerError}</div> : null}
            {scannerLoading && !scannerMatches.length ? <div className="text-sm text-white/70">Buscando coincidencias...</div> : null}
            {!scannerLoading && !scannerMatches.length && !scannerError ? <div className="text-sm text-white/60">Ningún ticker del universo cumple todos los filtros actualmente.</div> : null}
            {scannerMatches.length ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scannerMatches.map(({ data, computed }) => (
                  <div key={`${data.ticker}-${data.market}`} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{data.ticker}</div>
                        <div className="text-[11px] text-white/60">{MARKETS[data.market]?.label || data.market}</div>
                      </div>
                      <div className="text-right text-[11px] text-white/60">{MARKETS[data.market]?.currency || ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-semibold tabular-nums">{safeNumber(computed.score, 0)}</span>
                      <div className="flex-1"><ScoreBar value={computed.score || 0} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-white/70">
                      <div>
                        <div className="text-white/80 font-medium">Close</div>
                        <div className="tabular-nums">{safeNumber(data.close)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">%día</div>
                        <div className="tabular-nums">{safePct(computed.chgPct)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">ATR%</div>
                        <div className="tabular-nums">{safePct(computed.atrPct)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">RVOL</div>
                        <div className="tabular-nums">{safeNumber(computed.rvol)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Rotación</div>
                        <div className="tabular-nums">{safeNumber(computed.rotation)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Float (M)</div>
                        <div className="tabular-nums">{safeNumber(data.floatM)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Short%</div>
                        <div className="tabular-nums">{safePct(data.shortPct)}</div>
                      </div>
                      <div>
                        <div className="text-white/80 font-medium">Liquidez (M)</div>
                        <div className="tabular-nums">{safeNumber(data.liqM, 1)} {MARKETS[data.market]?.currency || ''}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge ok={computed.flags.priceOK} label="Precio" />
                      <Badge ok={computed.flags.emaOK} label=">EMA" />
                      <Badge ok={computed.flags.rvol2} label="RVOL≥2" />
                      <Badge ok={computed.flags.rvol5} label="RVOL≥5" />
                      <Badge ok={computed.flags.chgOK} label="%día" />
                      <Badge ok={computed.flags.atrOK} label="ATR" />
                      <Badge ok={computed.flags.float50} label="Float<50" />
                      <Badge ok={computed.flags.float10} label="Float<10" />
                      <Badge ok={computed.flags.rot1} label="Rot≥1x" />
                      <Badge ok={computed.flags.rot3} label="Rot≥3x" />
                      <Badge ok={computed.flags.shortOK} label="Short%" />
                      <Badge ok={computed.flags.spreadOK} label="Spread" />
                      <Badge ok={computed.flags.liqOK} label={`Liq ${MARKETS[data.market]?.currency || ''}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <TickerTable
          rows={visibleRows}
          thresholds={thresholds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={updateRow}
          onAddRow={addRow}
          onClearRows={() => {
            clearRows();
            setSelectedId(null);
          }}
          onSortByScore={sortByScore}
          onExport={exportCSV}
          lastUpdatedLabel={lastUpdatedLabel}
          loading={loadingQuotes}
          fetchError={fetchError}
        />

        <div className="mt-4 text-xs text-white/70 text-center">
          <p>Tips: Seleccioná el mercado para aplicar los umbrales correctos. Rotación = VolHoy / (Float * 1e6). ATR% = ATR14 / Close * 100. %día = (Close - Open)/Open*100.</p>
        </div>

        <section className={`rounded-2xl ${COLORS.glass} mt-6 p-6 shadow-xl`}>
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
                <li><span className="text-white">Preset Moderado:</span> configura umbrales equilibrados (RVOL≥2, %día≥10, ATR%≥3, etc.).</li>
                <li><span className="text-white">Preset Agresivo:</span> sube las exigencias (RVOL≥3, %día≥20, ATR%≥4, float preferido &lt;50M) apuntando a plays parabólicos de alta convicción.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
