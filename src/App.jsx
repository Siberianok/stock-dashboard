import React, { useEffect, useMemo, useState, useCallback, useRef, useId } from 'react';
import { COLORS, MARKETS } from './utils/constants.js';
import { fmt, safeNumber, safePct, toNum } from './utils/format.js';
import { uid } from './utils/misc.js';
import { extractQuoteFields } from './utils/quotes.js';
import { createCalc } from './utils/calc.js';
import { fetchQuotes, clearCache } from './services/yahooFinance.js';
import { DATA_SOURCE_FALLBACK_MESSAGE } from './services/dataSourceStatus.js';
import { computeFilterPreview } from './services/filterPreview.js';
import { useThresholds } from './hooks/useThresholds.js';
import { useScanner } from './hooks/useScanner.js';
import { useDashboardMetrics } from './hooks/useDashboardMetrics.js';
import { useHistoricalBenchmarks } from './hooks/useHistoricalBenchmarks.js';
import { useTheme } from './hooks/useTheme.js';
import { useChartExport } from './hooks/useChartExport.js';
import { TickerTable } from './components/TickerTable.jsx';
import { ScoreBar } from './components/ScoreBar.jsx';
import { Badge } from './components/Badge.jsx';
import { subscribeToMetrics } from './utils/metrics.js';
import { subscribeToLogs, logError } from './utils/logger.js';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.jsx';
import { PreviewDialog } from './components/PreviewDialog.jsx';
import { ScoreDistributionCard } from './components/ScoreDistributionCard.jsx';
import { FlowSankeyCard } from './components/FlowSankeyCard.jsx';
import { PerformanceRadarCard } from './components/PerformanceRadarCard.jsx';
import { DashboardStatsSection } from './components/DashboardStatsSection.jsx';
import { useRadarChartData } from './hooks/useRadarChartData.js';
import { parseNumberInput } from './utils/forms.js';
import { DATA_MODES, persistDataMode, readStoredDataMode } from './utils/dataMode.js';
import { readLastSelectedMarket } from './utils/markets.js';

const TIME_RANGE_OPTIONS = [
  { key: '1D', label: '24h' },
  { key: '5D', label: '5 días' },
  { key: '1M', label: '1 mes' },
  { key: '3M', label: '3 meses' },
  { key: 'ALL', label: 'Todo' },
];

const TIME_RANGE_LABELS = {
  '1D': 'últimas 24h',
  '5D': 'últimos 5 días',
  '1M': 'último mes',
  '3M': 'últimos 3 meses',
  ALL: 'todo el historial',
};



const ROWS_STORAGE_KEY = 'selector.rows.v1';
const SELECTED_ROW_STORAGE_KEY = 'selector.selectedRowId.v1';
const isBrowser = typeof window !== 'undefined';

const getInitialMarket = () => {
  if (!isBrowser) return 'US';
  return readLastSelectedMarket();
};

const createRow = (overrides = {}) => ({
  id: uid(),
  ticker: '',
  market: getInitialMarket(),
  open: undefined,
  close: undefined,
  bid: undefined,
  ask: undefined,
  avgPrice: undefined,
  volToday: undefined,
  volAvg10: undefined,
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
  isStale: false,
  ...overrides,
});

const loadStoredRows = () => {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(ROWS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((entry) => (entry && typeof entry === 'object' ? createRow({ ...entry, id: entry.id || uid() }) : null))
      .filter(Boolean);
    } catch (error) {
      logError('rows.storage.load', error);
      return null;
    }
};

const useTickerRows = () => {
  const [rows, setRowsInternal] = useState(() => {
    const stored = loadStoredRows();
    if (stored && stored.length) {
      return stored;
    }
    return [createRow()];
  });
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
  useEffect(() => {
    if (!isBrowser) return;
    try {
      const serializable = rows.map((row) => ({ ...row }));
      window.localStorage.setItem(ROWS_STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      logError('rows.storage.save', error);
    }
  }, [rows]);
  return { rows, setRows, addRow, clearRows, updateRow };
};

const toCSVCell = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  const str = typeof value === 'string' ? value : String(value);
  const sanitized = str.replace(/\r?\n/g, '\n');
  if (/[",\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
};

const validateNumericValue = (value, options = {}) => {
  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    allowEmpty = true,
    allowZero = true,
    formatter = (val) => fmt(val, 2),
    validate,
  } = options;

  if (value === undefined || value === null || Number.isNaN(value)) {
    return allowEmpty
      ? { error: null, value: undefined }
      : { error: 'Requerido', value: undefined };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return { error: 'Valor inválido', value: undefined };
  }

  if (!allowZero && numericValue === 0) {
    return { error: 'No puede ser 0', value: undefined };
  }

  if (Number.isFinite(min) && numericValue < min) {
    return { error: `Debe ser ≥ ${formatter(min)}`, value: undefined };
  }

  if (Number.isFinite(max) && numericValue > max) {
    return { error: `Debe ser ≤ ${formatter(max)}`, value: undefined };
  }

  if (typeof validate === 'function') {
    const customError = validate(numericValue);
    if (typeof customError === 'string' && customError.trim()) {
      return { error: customError, value: undefined };
    }
  }

  return { error: null, value: numericValue };
};

const createInitialPreviewState = () => ({ status: 'idle', result: null, error: null });

const EMPTY_PREVIEW_SUMMARY = Object.freeze({
  total: 0,
  added: 0,
  removed: 0,
  improved: 0,
  regressed: 0,
  unchanged: 0,
  stillFailing: 0,
  draftPass: 0,
  appliedPass: 0,
});

const createEmptyPreviewGroups = () => ({
  added: [],
  removed: [],
  improved: [],
  regressed: [],
  unchanged: [],
  stillFailing: [],
});

function App({
  initialDataMode = 'live',
  initialDataSourceNotice = null,
  initialAutoFallback = false,
} = {}) {
  const {
    thresholds: draftThresholds,
    activeThresholds,
    history: thresholdsHistory,
    thresholdsKey: activeThresholdsKey,
    setThresholds,
    updatePriceRange,
    updateLiquidityMin,
    toggleMarket,
    presetModerado,
    presetAgresivo,
    undo: undoThresholds,
    pushSnapshot,
    saveDraft,
    applyDraft,
    discardDraft,
    resetThresholds,
    hasDraftChanges,
    hasUnsavedDraftChanges,
    draftMeta,
  } = useThresholds();
  const lastThresholdSnapshot = thresholdsHistory[thresholdsHistory.length - 1] || null;
  const activeCalc = useMemo(() => createCalc(activeThresholds), [activeThresholds]);
  const appliedThresholds = activeThresholds;
  const calc = useMemo(() => createCalc(draftThresholds), [draftThresholds]);
  const { rows, setRows, addRow, clearRows, updateRow } = useTickerRows();
  const [validationErrors, setValidationErrors] = useState({});
  const [draftNotice, setDraftNotice] = useState(null);
  const setFieldError = useCallback((key, message) => {
    setValidationErrors((prev) => {
      if (message) {
        if (prev[key] === message) {
          return prev;
        }
        return { ...prev, [key]: message };
      }
      if (!(key in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const applyNumericUpdate = useCallback((key, value, onValid, options = {}) => {
    const { error, value: nextValue } = validateNumericValue(value, options);
    if (error) {
      setFieldError(key, error);
      return;
    }

    setFieldError(key, null);
    onValid(nextValue);
  }, [setFieldError]);

  const getError = useCallback((key) => validationErrors[key] || null, [validationErrors]);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [previewState, setPreviewState] = useState(() => createInitialPreviewState());
  const startPreview = useCallback(() => {
    setPreviewState({ status: 'running', result: null, error: null });
  }, []);
  const completePreview = useCallback((result) => {
    setPreviewState({ status: 'ready', result: result || null, error: null });
  }, []);
  const failPreview = useCallback((message) => {
    const fallback = 'No se pudo generar la vista previa';
    const normalizedMessage = typeof message === 'string' && message.trim() ? message : fallback;
    setPreviewState({ status: 'error', result: null, error: normalizedMessage });
  }, []);
  const clearPreview = useCallback(() => {
    setPreviewState(createInitialPreviewState());
  }, []);
  const previewResult = previewState.result;
  const previewLoading = previewState.status === 'running';
  const previewError = previewState.error;
  const previewSummary = previewResult?.summary || EMPTY_PREVIEW_SUMMARY;
  const previewEntries = previewResult?.entries || [];
  const previewEvaluatedAt = previewResult?.evaluatedAt || null;
  const previewGroups = useMemo(() => {
    const groups = createEmptyPreviewGroups();
    previewEntries.forEach((entry) => {
      const status = entry?.status;
      if (status && groups[status]) {
        groups[status].push(entry);
      } else {
        groups.unchanged.push(entry);
      }
    });
    return groups;
  }, [previewEntries]);
  const previewReady = previewState.status === 'ready';
  const applyDisabled = previewLoading || !!previewError || !previewReady || !hasDraftChanges;
  const hasValidationErrors = useMemo(() => Object.keys(validationErrors).length > 0, [validationErrors]);
  const previewDisabled = hasValidationErrors;
  const previewHelperMessage = hasValidationErrors
    ? 'Corregí los campos con error para habilitar la vista previa.'
    : !hasDraftChanges
      ? 'No hay diferencias entre el borrador y los umbrales aplicados.'
      : null;
  const [selectedId, setSelectedId] = useState(() => {
    if (!isBrowser) return null;
    const stored = window.localStorage.getItem(SELECTED_ROW_STORAGE_KEY);
    return stored || null;
  });
  const handleSaveDraft = useCallback(() => {
    const savedAt = saveDraft();
    setDraftNotice({ type: 'saved', timestamp: savedAt });
  }, [saveDraft]);
  const handleApplyDraft = useCallback(() => {
    const { applied, appliedAt } = applyDraft({ label: 'Aplicar borrador' });
    setDraftNotice({ type: applied ? 'applied' : 'noop', timestamp: appliedAt });
  }, [applyDraft]);
  const handleDiscardDraft = useCallback(() => {
    const discardedAt = discardDraft();
    setDraftNotice({ type: 'discarded', timestamp: discardedAt });
  }, [discardDraft]);
  const handleResetThresholds = useCallback(() => {
    if (isBrowser) {
      const confirmed = window.confirm(
        'Esto borrará el borrador, el historial y restablecerá los valores por defecto. ¿Querés continuar?',
      );
      if (!confirmed) {
        return;
      }
    }
    resetThresholds();
    setValidationErrors({});
    setDraftNotice({ type: 'reset', timestamp: new Date().toISOString() });
  }, [resetThresholds, setValidationErrors]);
  const resetDraft = useCallback(() => {
    discardDraft();
    setDraftNotice(null);
  }, [discardDraft]);
  const draftStatusLabel = useMemo(() => {
    if (!draftNotice) return null;
    const { type, timestamp } = draftNotice;
    const parsed = timestamp ? new Date(timestamp) : null;
    const timeLabel = parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : null;
    switch (type) {
      case 'saved':
        return `Borrador guardado${timeLabel ? ` · ${timeLabel}` : ''}`;
      case 'applied':
        return `Borrador aplicado${timeLabel ? ` · ${timeLabel}` : ''}`;
      case 'discarded':
        return `Cambios descartados${timeLabel ? ` · ${timeLabel}` : ''}`;
      case 'noop':
        return 'No hay cambios para aplicar.';
      case 'reset':
        return `Umbrales restablecidos${timeLabel ? ` · ${timeLabel}` : ''}`;
      default:
        return null;
    }
  }, [draftNotice]);
  const draftSavedAtLabel = useMemo(() => {
    if (!draftMeta?.savedAt) return 'Nunca';
    const parsed = new Date(draftMeta.savedAt);
    if (Number.isNaN(parsed.getTime())) return 'Desconocido';
    return parsed.toLocaleString();
  }, [draftMeta?.savedAt]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [dataMode, setDataMode] = useState(() => readStoredDataMode());
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const quotesAbortRef = useRef(null);
  const modeInitRef = useRef(true);
  const previewDialogId = useId();
  const marketsLegendId = useId();
  const priceLegendId = useId();
  const volumeLegendId = useId();
  const technicalLegendId = useId();

  useEffect(() => {
    if (!rows.length) return;
    setSelectedId((prev) => {
      if (prev && rows.some((row) => row.id === prev)) {
        return prev;
      }
      return rows[0].id;
    });
  }, [rows]);

  useEffect(() => {
    persistDataMode(dataMode);
  }, [dataMode]);

  useEffect(() => {
    if (!isBrowser) return;
    try {
      if (!selectedId) {
        window.localStorage.removeItem(SELECTED_ROW_STORAGE_KEY);
      } else {
        window.localStorage.setItem(SELECTED_ROW_STORAGE_KEY, selectedId);
      }
    } catch (error) {
      logError('rows.selection.save', error);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setPreviewOpen(false);
    }
  }, [selectedId]);

  const tickers = useMemo(() => rows.map((r) => r.ticker).filter(Boolean), [rows]);
  const tickersKey = tickers.join(',');
  const marketByTicker = useMemo(() => {
    const map = {};
    rows.forEach((row) => {
      if (!row?.ticker) return;
      map[row.ticker.toUpperCase()] = row.market || 'US';
    });
    return map;
  }, [rows]);
  const isSimulatedMode = dataMode === DATA_MODES.MOCK;

  useEffect(() => {
    if (!tickersKey) {
      setFetchError(null);
      setLoadingQuotes(false);
      if (quotesAbortRef.current) {
        quotesAbortRef.current.abort();
        quotesAbortRef.current = null;
      }
      return () => {};
    }
    let active = true;
    const load = async (force) => {
      if (!active) return;
      if (quotesAbortRef.current) {
        quotesAbortRef.current.abort();
        quotesAbortRef.current = null;
      }
      const controller = new AbortController();
      quotesAbortRef.current = controller;
      try {
        setLoadingQuotes(true);
        setFetchError(null);
        const { quotes, error: quotesError, staleSymbols } = await fetchQuotes(tickers, {
          force,
          signal: controller.signal,
          marketBySymbol: marketByTicker,
          mode: dataMode,
        });
        if (!active || quotesAbortRef.current !== controller || controller.signal.aborted) {
          return;
        }
        const staleSet = new Set((staleSymbols || []).map((symbol) => symbol.toUpperCase()));
        setRows((prev) => prev.map((row) => {
          const symbolKey = row.ticker ? row.ticker.toUpperCase() : row.ticker;
          const quote = symbolKey ? quotes[symbolKey] : undefined;
          if (!quote) return row;
          const fields = extractQuoteFields(quote);
          const nextLastUpdate = staleSet.has(symbolKey) ? row.lastUpdate : new Date().toISOString();
          return { ...row, ...fields, lastUpdate: nextLastUpdate, isStale: staleSet.has(symbolKey) };
        }));
        setFetchError(quotesError || null);
      } catch (error) {
        if (!active || quotesAbortRef.current !== controller || error?.name === 'AbortError') {
          return;
        }
        logError('quotes.fetch', error);
        if (dataMode !== DATA_MODES.MOCK) {
          setFetchError('No se pudo obtener datos en vivo. Se activó el modo simulado automáticamente.');
          setDataMode(DATA_MODES.MOCK);
        } else {
          setFetchError(error?.message || 'Error al actualizar datos');
        }
      } finally {
        if (!active) return;
        if (quotesAbortRef.current === controller) {
          quotesAbortRef.current = null;
          setLoadingQuotes(false);
        }
      }
    };
    load(refreshToken !== 0);
    const interval = window.setInterval(() => load(false), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      if (quotesAbortRef.current) {
        quotesAbortRef.current.abort();
        quotesAbortRef.current = null;
      }
    };
  }, [tickersKey, refreshToken, tickers, setRows, marketByTicker, dataMode]);

  const refreshQuotes = useCallback(() => setRefreshToken(Date.now()), []);

  useEffect(() => {
    clearCache();
    if (modeInitRef.current) {
      modeInitRef.current = false;
      return;
    }
    setRefreshToken(Date.now());
  }, [dataMode]);

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

  const [timeReference, setTimeReference] = useState(() => Date.now());
  useEffect(() => {
    if (!isBrowser) return undefined;
    const update = () => setTimeReference(Date.now());
    update();
    const intervalId = window.setInterval(update, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const staleInfo = useMemo(() => {
    if (!lastUpdated) {
      return { isStale: false, ageSeconds: null };
    }
    const ageMs = Math.max(0, timeReference - new Date(lastUpdated).getTime());
    return { isStale: ageMs > 60_000, ageSeconds: Math.floor(ageMs / 1000) };
  }, [lastUpdated, timeReference]);

  const [metrics, setMetrics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const diagnosticsRegionId = useId();

  useEffect(() => {
    const unsubscribeMetrics = subscribeToMetrics(setMetrics);
    const unsubscribeLogs = subscribeToLogs(setLogs);
    return () => {
      unsubscribeMetrics();
      unsubscribeLogs();
    };
  }, []);

  const hasDiagnosticsData = metrics.length > 0 || logs.length > 0;

  useEffect(() => {
    if (hasDiagnosticsData) {
      setShowDiagnostics((prev) => (prev ? prev : true));
    }
  }, [hasDiagnosticsData]);

  const toggleDiagnosticsPanel = useCallback(() => {
    setShowDiagnostics((prev) => !prev);
  }, []);

  const computedRows = useMemo(
    () =>
      rows.map((row) => ({
        row,
        computed: calc(row, row.market || 'US'),
        isActive: appliedThresholds.marketsEnabled?.[row.market || 'US'] !== false,
      })),
    [rows, calc, appliedThresholds.marketsEnabled],
  );

  const activeComputed = useMemo(() => computedRows.filter((entry) => entry.isActive), [computedRows]);

  const visibleRows = useMemo(
    () => rows.filter((row) => appliedThresholds.marketsEnabled?.[row.market || 'US'] !== false),
    [rows, appliedThresholds.marketsEnabled],
  );

  const { theme, toggleTheme, palette } = useTheme();
  const exportChart = useChartExport();

  const dashboardMetrics = useDashboardMetrics({
    activeComputed,
    totalRows: rows.length,
    lastUpdated,
    palette: palette.chart,
  });

  const {
    timeRange,
    setTimeRange,
    kpis,
    scoreDistribution,
    sankeyData,
    averageScore,
    lastSnapshotTimestamp,
    hasSnapshots,
    clearHistory,
  } = dashboardMetrics;

  const historicalBenchmarks = useHistoricalBenchmarks({ thresholds: draftThresholds, timeRange });
  const { benchmark: historicalBenchmark, loading: historicalLoading, error: historicalError } = historicalBenchmarks;
  const historicalCurrentMetrics = useMemo(() => ({ averageScore, kpis }), [averageScore, kpis]);

  const scoreChartRef = useRef(null);
  const sankeyChartRef = useRef(null);
  const radarChartRef = useRef(null);
  const historicalCardRef = useRef(null);

  const selectedRow = useMemo(() => {
    const found = rows.find((row) => row.id === selectedId);
    return found || rows[0];
  }, [rows, selectedId]);

  const selectedCalc = useMemo(() => (selectedRow ? calc(selectedRow, selectedRow.market) : null), [selectedRow, calc]);

  const radarData = useRadarChartData({
    selectedCalc,
    selectedRow,
    thresholds: appliedThresholds,
  });

  const { state: scannerState, triggerScan } = useScanner({
    thresholds: activeThresholds,
    calc: activeCalc,
    thresholdsKey: activeThresholdsKey,
    mode: dataMode,
    coverageThreshold: 0.8,
  });
  const scannerMatchesRaw = scannerState.matches || [];
  const scannerLoading = !!scannerState.loading;
  const scannerError = scannerState.error;
  const scannerResultsStale = !!(scannerState.lastThresholdsKey && scannerState.lastThresholdsKey !== activeThresholdsKey);
  const scannerMatches = scannerResultsStale ? [] : scannerMatchesRaw;

  const applyMatchesToTable = useCallback(() => {
    if (!scannerMatches.length) return;
    const next = scannerMatches.map(({ data }) =>
      createRow({ ...data, lastUpdate: scannerState.lastUpdated, isStale: false }),
    );
    setRows(next);
    setSelectedId(next[0]?.id || null);
    setRefreshToken(Date.now());
    setPreviewOpen(false);
  }, [scannerMatches, scannerState.lastUpdated, setRows]);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey && !event.shiftKey && event.key === 'Enter') {
        if (!scannerLoading && scannerMatches.length) {
          event.preventDefault();
          applyMatchesToTable();
        }
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        handleClearRows();
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'p') {
        if (selectedRow) {
          event.preventDefault();
          setPreviewOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [applyMatchesToTable, scannerLoading, scannerMatches.length, handleClearRows, selectedRow]);

  const scannerUpdatedLabel = useMemo(() => {
    if (!scannerState.lastUpdated) return 'Sin datos';
    const d = new Date(scannerState.lastUpdated);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [scannerState.lastUpdated]);

  const scannerCoverageLabel = useMemo(() => {
    const coverage = scannerState.coverage;
    if (!coverage) return 'Cobertura: —';
    const total = coverage.totalRequested || 0;
    if (!total) return 'Cobertura: 0/0';
    const pct = Math.round((coverage.ratio || 0) * 100);
    return `Cobertura: ${coverage.totalFetched}/${total} (${pct}%)`;
  }, [scannerState.coverage]);
  const scannerCoverageAlert = !!scannerState.coverage?.alert;

  const toggleDataMode = useCallback(() => {
    setDataMode((prev) => (prev === DATA_MODES.LIVE ? DATA_MODES.MOCK : DATA_MODES.LIVE));
  }, []);

  const openPreview = useCallback(async () => {
    if (previewDisabled) {
      return;
    }
    setPreviewOpen(true);
    startPreview();
    try {
      const result = await Promise.resolve(
        computeFilterPreview({
          appliedThresholds,
          draftThresholds,
        }),
      );
      completePreview(result);
    } catch (error) {
      logError('thresholds.preview', error);
      failPreview(error?.message || 'No se pudo calcular la vista previa');
    }
  }, [previewDisabled, startPreview, appliedThresholds, draftThresholds, completePreview, failPreview]);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    clearPreview();
  }, [clearPreview]);

  const handleApplyPreview = useCallback(() => {
    applyDraft({ label: 'Vista previa' });
    closePreview();
  }, [applyDraft, closePreview]);

  const handleCancelPreview = useCallback(() => {
    resetDraft();
    setValidationErrors({});
    closePreview();
  }, [resetDraft, closePreview, setValidationErrors]);

  const sortByScore = useCallback(() => {
    setRows((prev) => [...prev].sort((a, b) => (calc(b, b.market).score || 0) - (calc(a, a.market).score || 0)));
  }, [calc, setRows]);

  const handleClearRows = useCallback(() => {
    clearRows();
    setSelectedId(null);
    setPreviewOpen(false);
  }, [clearRows]);

  const handleOpenPreview = useCallback(() => {
    if (selectedRow) {
      setPreviewOpen(true);
    }
  }, [selectedRow]);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const volumeInputs = [
    {
      key: 'rvolMin',
      label: 'RVOL ≥',
      value: draftThresholds.rvolMin,
      step: '0.1',
      min: 0,
      allowZero: false,
      formatter: (val) => fmt(val, 1),
      onValid: (value) => setThresholds((prev) => ({ ...prev, rvolMin: value })),
    },
    {
      key: 'rvolIdeal',
      label: 'RVOL ideal ≥',
      value: draftThresholds.rvolIdeal,
      step: '0.1',
      min: draftThresholds.rvolMin || 0,
      allowZero: false,
      formatter: (val) => fmt(val, 1),
      validate: (value) => {
        const minVal = draftThresholds.rvolMin;
        if (Number.isFinite(minVal) && value < minVal) {
          return `Debe ser ≥ ${fmt(minVal, 1)}`;
        }
        return null;
      },
      onValid: (value) => setThresholds((prev) => ({ ...prev, rvolIdeal: value })),
    },
    {
      key: 'float50',
      label: 'Float < (M)',
      value: draftThresholds.float50,
      step: '1',
      min: 0.1,
      allowZero: false,
      formatter: (val) => fmt(val, 0),
      validate: (value) => {
        const pref = draftThresholds.float10;
        if (Number.isFinite(pref) && value < pref) {
          return `Debe ser ≥ pref (${fmt(pref, 0)})`;
        }
        return null;
      },
      onValid: (value) => setThresholds((prev) => ({ ...prev, float50: value })),
    },
    {
      key: 'float10',
      label: 'Pref. Float < (M)',
      value: draftThresholds.float10,
      step: '1',
      min: 0.1,
      allowZero: false,
      formatter: (val) => fmt(val, 0),
      max: draftThresholds.float50,
      validate: (value) => {
        const maxVal = draftThresholds.float50;
        if (Number.isFinite(maxVal) && value > maxVal) {
          return `Debe ser ≤ máx (${fmt(maxVal, 0)})`;
        }
        return null;
      },
      onValid: (value) => setThresholds((prev) => ({ ...prev, float10: value })),
    },
    {
      key: 'rotationMin',
      label: 'Rotación ≥',
      value: draftThresholds.rotationMin,
      step: '0.1',
      min: 0.1,
      allowZero: false,
      formatter: (val) => fmt(val, 1),
      onValid: (value) => setThresholds((prev) => ({ ...prev, rotationMin: value })),
    },
    {
      key: 'rotationIdeal',
      label: 'Rotación ideal ≥',
      value: draftThresholds.rotationIdeal,
      step: '0.1',
      min: draftThresholds.rotationMin || 0.1,
      allowZero: false,
      formatter: (val) => fmt(val, 1),
      validate: (value) => {
        const minVal = draftThresholds.rotationMin;
        if (Number.isFinite(minVal) && value < minVal) {
          return `Debe ser ≥ ${fmt(minVal, 1)}`;
        }
        return null;
      },
      onValid: (value) => setThresholds((prev) => ({ ...prev, rotationIdeal: value })),
    },
  ];

  const exportCSV = useCallback(() => {
    const headers = [
      'Ticker','Mercado','Moneda','Open','Close','Bid','Ask','Promedio','VolHoy','VolProm10','RVOL','Float(M)','Rotación','Short%','DTC','ATR14','ATR%','EMA9','EMA200','%día','Catal','IntradíaOK','Spread%','Liquidez(M)','SCORE','priceOK','emaOK','rvol2','rvol5','chgOK','atrOK','float<50','float<10','rot≥1','rot≥3','shortOK','spreadOK','liqOK',
    ];
    const lines = [headers.join(',')];
    rows.forEach((row) => {
      const market = row.market || 'US';
      const info = MARKETS[market] || MARKETS.US;
      const { rvol, atrPct, chgPct, rotation, score, flags } = calc(row, market);
      const cells = [
        row.ticker,
        info.label,
        info.currency,
        row.open,
        row.close,
        row.bid,
        row.ask,
        row.avgPrice,
        row.volToday,
        row.volAvg10,
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
      ];
      lines.push(cells.map(toCSVCell).join(','));
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
        volAvg10: 36000000,
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
        isStale: false,
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
        volAvg10: 27000000,
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
        isStale: false,
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
        volAvg10: 540000,
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
        isStale: false,
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
        volAvg10: 18000000,
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
        isStale: false,
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
        volAvg10: 2200000,
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
        isStale: false,
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
        volAvg10: 42000000,
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
        isStale: false,
      }),
    ];
    setRows(demoRows);
    setSelectedId(demoRows[0]?.id || null);
    setFetchError(null);
    setRefreshToken(Date.now());
  }, [setRows]);

  return (
    <>
      <div className={`min-h-screen ${COLORS.baseBg} text-slate-100`}>
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {autoFallbackActive && isSimulatedMode ? (
            <div
              className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true" className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-300" />
              <span>{fallbackNotice}</span>
            </div>
          ) : null}
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
            <div className={`rounded-2xl ${COLORS.glass} p-4 text-sm max-w-xs space-y-3`}>
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">Presets rápidos</div>
                <button className="mt-2 w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition" onClick={presetModerado}>Moderado (Momentum)</button>
                <button className="mt-2 w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition" onClick={presetAgresivo}>Agresivo (50%)</button>
              </div>
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="text-xs uppercase tracking-wide text-white/60">Historial de umbrales</div>
                <button
                  className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => pushSnapshot('Manual')}
                >
                  Guardar snapshot
                </button>
                <button
                  className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!thresholdsHistory.length}
                  onClick={undoThresholds}
                >
                  Deshacer último cambio
                </button>
                {lastThresholdSnapshot ? (
                  <p className="text-[11px] text-white/60 leading-snug">
                    Último snapshot: {lastThresholdSnapshot.label || 'Sin título'} ·{' '}
                    {new Date(lastThresholdSnapshot.savedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-[11px] text-white/50">Aún no guardaste snapshots.</p>
                )}
              </div>
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="text-xs uppercase tracking-wide text-white/60">Borradores de filtros</div>
                <button
                  className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveDraft}
                  disabled={!hasUnsavedDraftChanges}
                >
                  Guardar borrador
                </button>
                <button
                  className="w-full px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleApplyDraft}
                  disabled={!hasDraftChanges}
                >
                  Aplicar borrador
                </button>
                <button
                  className="w-full px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDiscardDraft}
                  disabled={!hasDraftChanges && !hasUnsavedDraftChanges}
                >
                  Descartar cambios
                </button>
                <div className="text-[11px] text-white/60 leading-snug space-y-1">
                  <p>{hasDraftChanges ? 'El borrador es diferente a los filtros activos.' : 'El borrador coincide con los filtros activos.'}</p>
                  <p className={hasUnsavedDraftChanges ? 'text-amber-300' : ''}>
                    {hasUnsavedDraftChanges ? 'Cambios pendientes de guardar.' : `Último guardado: ${draftSavedAtLabel}`}
                  </p>
                  {draftStatusLabel ? <p className="text-white/70">{draftStatusLabel}</p> : null}
                </div>
              </div>
            </div>
          </header>

        <DashboardStatsSection
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          rangeOptions={TIME_RANGE_OPTIONS}
          kpis={kpis}
          lastSnapshotTimestamp={lastSnapshotTimestamp}
          hasSnapshots={hasSnapshots}
          onClearHistory={clearHistory}
        />

        <section className={`rounded-2xl ${COLORS.glass} p-6 shadow-xl`}>
          <h2 className="text-xl font-semibold mb-4">Umbrales por mercado</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5 text-sm">
            <div>
              <div className="font-medium text-white/90">
                {hasDraftChanges ? 'Borrador con cambios sin aplicar' : 'Borrador sincronizado con los umbrales aplicados'}
              </div>
              {previewHelperMessage ? (
                <div className={`text-xs ${hasValidationErrors ? 'text-rose-300' : 'text-white/60'}`}>
                  {previewHelperMessage}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  resetDraft();
                  setValidationErrors({});
                }}
                disabled={!hasDraftChanges}
              >
                Descartar cambios
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-sky-500/90 text-white hover:bg-sky-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={openPreview}
                disabled={previewDisabled}
              >
                Vista previa
              </button>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <fieldset className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`} aria-labelledby={marketsLegendId}>
                <legend
                  id={marketsLegendId}
                  className="font-semibold mb-4 text-center text-lg tracking-wide"
                >
                  Mercados
                </legend>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(MARKETS).map(([key, info]) => (
                    <label key={key} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                      <span className="font-medium">{info.label}</span>
                      <input
                        type="checkbox"
                        aria-label={`Habilitar mercado ${info.label}`}
                        checked={!!draftThresholds.marketsEnabled?.[key]}
                        onChange={(e) => toggleMarket(key, e.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`} aria-labelledby={priceLegendId}>
                <legend
                  id={priceLegendId}
                  className="font-semibold mb-4 text-center text-lg tracking-wide"
                >
                  Precio
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {Object.entries(MARKETS).map(([key, info]) => {
                    const priceRange = draftThresholds.priceRange?.[key] || {};
                    const minKey = `price-${key}-min`;
                    const maxKey = `price-${key}-max`;
                    const minError = getError(minKey);
                    const maxError = getError(maxKey);
                    const formatNumber = (val) => fmt(val, 2);
                    const groupLabelId = `price-${key}-label`;
                    const minInputId = `${minKey}-input`;
                    const maxInputId = `${maxKey}-input`;
                    return (
                      <div
                        key={key}
                        className="space-y-2 bg-white/5 rounded-xl p-3"
                        role="group"
                        aria-labelledby={groupLabelId}
                      >
                        <div id={groupLabelId} className="text-center text-white/70 text-xs uppercase tracking-wide">
                          {info.label}
                        </div>
                        <label className="flex flex-col gap-1 text-xs" htmlFor={minInputId}>
                          <span className="text-white/80">Mínimo</span>
                          <input
                            id={minInputId}
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            value={priceRange.min ?? ''}
                            aria-describedby={minError ? `${minInputId}-error` : undefined}
                            onChange={(e) => {
                              const nextValue = parseNumberInput(e);
                              applyNumericUpdate(minKey, nextValue, (validValue) => updatePriceRange(key, 'min', validValue), {
                                min: 0,
                                allowEmpty: false,
                                formatter: formatNumber,
                                validate: (val) => {
                                  const maxVal = draftThresholds.priceRange?.[key]?.max;
                                  if (Number.isFinite(maxVal) && val > maxVal) {
                                    return `Debe ser ≤ ${formatNumber(maxVal)}`;
                                  }
                                  return null;
                                },
                              });
                            }}
                            className="border border-white/20 bg-white/10 text-white rounded px-2 py-1"
                          />
                          {minError ? (
                            <span id={`${minInputId}-error`} className="text-[10px] text-rose-300">
                              {minError}
                            </span>
                          ) : null}
                        </label>
                        <label className="flex flex-col gap-1 text-xs" htmlFor={maxInputId}>
                          <span className="text-white/80">Máximo</span>
                          <input
                            id={maxInputId}
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            value={priceRange.max ?? ''}
                            aria-describedby={maxError ? `${maxInputId}-error` : undefined}
                            onChange={(e) => {
                              const nextValue = parseNumberInput(e);
                              applyNumericUpdate(maxKey, nextValue, (validValue) => updatePriceRange(key, 'max', validValue), {
                                min: 0,
                                allowEmpty: false,
                                formatter: formatNumber,
                                validate: (val) => {
                                  const minVal = draftThresholds.priceRange?.[key]?.min;
                                  if (Number.isFinite(minVal) && val < minVal) {
                                    return `Debe ser ≥ ${formatNumber(minVal)}`;
                                  }
                                  return null;
                                },
                              });
                            }}
                            className="border border-white/20 bg-white/10 text-white rounded px-2 py-1"
                          />
                          {maxError ? (
                            <span id={`${maxInputId}-error`} className="text-[10px] text-rose-300">
                              {maxError}
                            </span>
                          ) : null}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="space-y-4">
              <fieldset className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`} aria-labelledby={volumeLegendId}>
                <legend
                  id={volumeLegendId}
                  className="font-semibold mb-4 text-center text-lg tracking-wide"
                >
                  Volumen & Float
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center items-start justify-items-center">
                  {volumeInputs.map((field) => {
                    const error = getError(field.key);
                    const inputId = `${field.key}-input`;
                    return (
                      <label key={field.key} className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2" htmlFor={inputId}>
                        <span className="text-white/80 font-medium">{field.label}</span>
                        <input
                          id={inputId}
                          type="number"
                          inputMode="decimal"
                          step={field.step}
                          min={field.min ?? 0}
                          value={field.value ?? ''}
                          aria-describedby={error ? `${inputId}-error` : undefined}
                          onChange={(e) => {
                            const nextValue = parseNumberInput(e);
                            applyNumericUpdate(
                              field.key,
                              nextValue,
                              (validValue) => field.onValid(validValue),
                              {
                                min: field.min ?? 0,
                                max: field.max ?? Number.POSITIVE_INFINITY,
                                allowEmpty: false,
                                allowZero: field.allowZero ?? true,
                                formatter: field.formatter || ((val) => fmt(val, 2)),
                                validate: field.validate,
                              },
                            );
                          }}
                          className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                        />
                        {error ? (
                          <span id={`${inputId}-error`} className="text-[10px] text-rose-300">
                            {error}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className={`rounded-2xl ${COLORS.glass} p-5 shadow-xl`} aria-labelledby={technicalLegendId}>
                <legend
                  id={technicalLegendId}
                  className="font-semibold mb-4 text-center text-lg tracking-wide"
                >
                  Técnico & Micro
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-center place-items-center">
                  {Object.entries(MARKETS).map(([key, info]) => {
                    const errorKey = `liq-${key}`;
                    const error = getError(errorKey);
                    const inputId = `${errorKey}-input`;
                    return (
                      <label key={key} className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2" htmlFor={inputId}>
                        <span className="text-white/80 font-medium">Liquidez mínima (M, {info.currency})</span>
                        <input
                          id={inputId}
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          value={draftThresholds.liquidityMin?.[key] ?? ''}
                          aria-describedby={error ? `${inputId}-error` : undefined}
                          onChange={(e) => {
                            const nextValue = parseNumberInput(e);
                            applyNumericUpdate(errorKey, nextValue, (validValue) => updateLiquidityMin(key, validValue), {
                              min: 0,
                              allowEmpty: false,
                              formatter: (val) => fmt(val, 1),
                            });
                          }}
                          className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                        />
                        {error ? (
                          <span id={`${inputId}-error`} className="text-[10px] text-rose-300">
                            {error}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                  <label className="w-full max-w-[18rem] mx-auto flex flex-col items-center gap-2" htmlFor="spread-max-input">
                    <span className="text-white/80 font-medium">Spread ≤ %</span>
                    <input
                      id="spread-max-input"
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      value={draftThresholds.spreadMaxPct ?? ''}
                      aria-describedby={getError('spreadMaxPct') ? 'spread-max-error' : undefined}
                      onChange={(e) => {
                        const nextValue = parseNumberInput(e);
                        applyNumericUpdate(
                          'spreadMaxPct',
                          nextValue,
                          (validValue) => setThresholds((prev) => ({ ...prev, spreadMaxPct: validValue })),
                          {
                            min: 0,
                            allowEmpty: false,
                            formatter: (val) => fmt(val, 2),
                          },
                        );
                      }}
                      className="w-full border border-white/20 bg-white/10 text-white rounded px-2 py-1 text-center"
                    />
                    {getError('spreadMaxPct') ? (
                      <span id="spread-max-error" className="text-[10px] text-rose-300">
                        {getError('spreadMaxPct')}
                      </span>
                    ) : null}
                  </label>
                  <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1" htmlFor="need-ema-200">
                    <input
                      id="need-ema-200"
                      type="checkbox"
                      checked={draftThresholds.needEMA200}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, needEMA200: e.target.checked }))}
                    />
                    <span id="need-ema-200-label">Requerir precio &gt; EMA200</span>
                  </label>
                  <label className="sm:col-span-2 w-full flex items-center justify-center gap-2 mt-1" htmlFor="mode-parabolic">
                    <input
                      id="mode-parabolic"
                      type="checkbox"
                      checked={draftThresholds.parabolic50}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, parabolic50: e.target.checked }))}
                    />
                    <span id="mode-parabolic-label">Modo parabólico (≥ 50%)</span>
                  </label>
                </div>
              </fieldset>
            </div>
          </div>
        </section>

        <section className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-4">
          <ScoreDistributionCard
            ref={scoreChartRef}
            data={scoreDistribution}
            total={kpis.total}
            averageScore={averageScore}
            timeRange={timeRange}
            onExport={exportChart}
            theme={theme}
          />
          <FlowSankeyCard
            ref={sankeyChartRef}
            data={sankeyData}
            timeRange={timeRange}
            onExport={exportChart}
            theme={theme}
            accentColor={palette.chart.accent}
          />
          <PerformanceRadarCard
            ref={radarChartRef}
            data={radarData}
            selectedRow={selectedRow}
            onExport={exportChart}
            theme={theme}
            accentColor={palette.chart.accent}
            onOpenPreview={handleOpenPreview}
            previewDialogId={previewDialogId}
          />
          <HistoricalComparisonCard
            ref={historicalCardRef}
            benchmark={historicalBenchmark}
            current={historicalCurrentMetrics}
            timeRangeLabel={TIME_RANGE_LABELS[timeRange] || ''}
            loading={historicalLoading}
            error={historicalError}
            onExport={exportChart}
            theme={theme}
            palette={palette.chart}
          />
        </section>

        <section className={`rounded-2xl ${COLORS.glass} mt-6 shadow-2xl`}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
            <div>
              <h3 className="font-semibold">Tickers activos (auto)</h3>
              <div className="text-xs text-white/60 mt-0.5">Universo predefinido filtrado en tiempo real según todos los criterios activos.</div>
            </div>
            <div className="flex flex-col gap-2 items-end sm:flex-row sm:items-center sm:gap-3">
              <div className="flex flex-col items-end gap-1 text-xs text-white/60">
                <div>
                  Actualizado: {scannerState.lastUpdated ? scannerUpdatedLabel : '—'}
                  {scannerLoading ? ' · escaneando' : ''}
                  {scannerResultsStale ? ' · filtros actualizados' : ''}
                </div>
                <div className={scannerCoverageAlert ? 'text-amber-200' : 'text-white/60'}>
                  {scannerCoverageLabel}
                  {scannerCoverageAlert ? ' · cobertura parcial' : ''}
                </div>
                {isSimulatedMode ? (
                  <div className="text-[11px] uppercase tracking-wide text-emerald-200">Modo simulado activo</div>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className={`px-3 py-1.5 rounded-xl border border-white/15 transition disabled:opacity-60 disabled:cursor-not-allowed hover:bg-white/20 ${
                    isSimulatedMode ? 'bg-white/20 text-white' : 'bg-white/10 text-white/90'
                  }`}
                  onClick={toggleDataMode}
                  disabled={scannerLoading}
                  type="button"
                >
                  {isSimulatedMode ? 'Usar datos reales' : 'Activar modo simulado'}
                </button>
                <button className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15 transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={triggerScan} disabled={scannerLoading} type="button">Escanear ahora</button>
                <button className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow hover:from-emerald-400 hover:to-teal-500 transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={applyMatchesToTable} disabled={scannerLoading || !scannerMatches.length} type="button">Cargar en tabla</button>
                <div className="basis-full text-right text-[11px] text-white/60">
                  Atajos: Ctrl+Enter aplica coincidencias, Ctrl+Shift+D limpia la tabla, Ctrl+P abre la previsualización.
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {scannerError ? <div className="text-xs text-rose-300">Error: {scannerError}</div> : null}
            {scannerCoverageAlert && !scannerError ? (
              <div className="text-xs text-amber-200">Cobertura inferior al 80%. Revisa la conexión o reduce el universo para evitar huecos en la actualización.</div>
            ) : null}
            {scannerResultsStale ? <div className="text-xs text-amber-200">Esperando resultados con los nuevos filtros…</div> : null}
            {scannerLoading && !scannerMatches.length ? <div className="text-sm text-white/70">Buscando coincidencias...</div> : null}
            {!scannerResultsStale && !scannerLoading && !scannerMatches.length && !scannerError ? <div className="text-sm text-white/60">Ningún ticker del universo cumple todos los filtros actualmente.</div> : null}
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
                      <div className="flex-1"><ScoreBar value={computed.score || 0} label={`Score ${data.ticker}`} /></div>
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
          thresholds={appliedThresholds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={updateRow}
          onAddRow={addRow}
          onClearRows={handleClearRows}
          onSortByScore={sortByScore}
          onExport={exportCSV}
          lastUpdatedLabel={lastUpdatedLabel}
          loading={loadingQuotes}
          fetchError={fetchError}
          stale={staleInfo.isStale}
          staleSeconds={staleInfo.ageSeconds}
        />

        {isPreviewOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={closePreview} />
            <div
              className="relative z-10 w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="preview-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 id="preview-title" className="text-xl font-semibold text-white">Vista previa de filtros</h3>
                  <p className="text-sm text-white/60 mt-1">Compará el borrador contra la versión aplicada sin persistir cambios.</p>
                  {previewEvaluatedAt ? (
                    <p className="text-xs text-white/50 mt-2">Generada {new Date(previewEvaluatedAt).toLocaleString()}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-white/60 hover:text-white"
                  onClick={closePreview}
                  aria-label="Cerrar vista previa"
                >
                  ✕
                </button>
              </div>
              <div className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {previewLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
                    Calculando vista previa...
                  </div>
                ) : previewError ? (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    No se pudo generar la vista previa: {previewError}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-wide text-white/60">Tickers evaluados</div>
                        <div className="text-2xl font-semibold text-white">{previewSummary.total}</div>
                      </div>
                      <div className="rounded-2xl bg-emerald-500/10 p-4">
                        <div className="text-xs uppercase tracking-wide text-emerald-200/80">Aprueban con borrador</div>
                        <div className="text-2xl font-semibold text-emerald-200">{previewSummary.draftPass}</div>
                        <div className="text-[11px] text-emerald-100/80">Aplicado: {previewSummary.appliedPass}</div>
                      </div>
                      <div className="rounded-2xl bg-cyan-500/10 p-4">
                        <div className="text-xs uppercase tracking-wide text-cyan-100/80">Cambios relevantes</div>
                        <div className="text-2xl font-semibold text-cyan-100">
                          {previewEntries.filter((entry) => entry.status !== 'unchanged' && entry.status !== 'stillFailing').length}
                        </div>
                        <div className="text-[11px] text-cyan-100/70">Nuevos: {previewSummary.added} · Salen: {previewSummary.removed}</div>
                      </div>
                    </div>
                    <div className="text-xs text-white/50">
                      Permanecen fuera del filtro: {previewSummary.stillFailing}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-emerald-100">Ingresan ({previewGroups.added.length})</h4>
                        {previewGroups.added.length ? (
                          <ul className="space-y-2 text-xs text-emerald-100/80">
                            {previewGroups.added.map((entry) => (
                              <li key={`add-${entry.ticker}`} className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="font-semibold uppercase tracking-wide text-emerald-100">{entry.ticker}</div>
                                    <div className="text-[11px] text-emerald-200/80">{entry.market}</div>
                                  </div>
                                  <div className="text-sm font-semibold text-emerald-100">SCORE {formatScore(entry.draft.score)}</div>
                                </div>
                                {entry.flagChanges.gained.length ? (
                                  <div className="mt-2 text-[11px] text-emerald-200">
                                    Flags nuevas: {entry.flagChanges.gained.join(', ')}
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-emerald-100/70">Sin ingresos nuevos.</p>
                        )}
                      </div>
                      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-rose-200">Salen ({previewGroups.removed.length})</h4>
                        {previewGroups.removed.length ? (
                          <ul className="space-y-2 text-xs text-rose-100/80">
                            {previewGroups.removed.map((entry) => (
                              <li key={`removed-${entry.ticker}`} className="rounded-lg border border-rose-400/30 bg-rose-500/15 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="font-semibold uppercase tracking-wide text-rose-200">{entry.ticker}</div>
                                    <div className="text-[11px] text-rose-200/70">{entry.market}</div>
                                  </div>
                                  <div className="text-sm font-semibold text-rose-200">SCORE {formatScore(entry.applied.score)}</div>
                                </div>
                                {entry.flagChanges.lost.length ? (
                                  <div className="mt-2 text-[11px] text-rose-200">
                                    Pierde: {entry.flagChanges.lost.join(', ')}
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-rose-100/70">No se eliminan candidatos actuales.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-white">Variaciones de SCORE ({previewGroups.improved.length + previewGroups.regressed.length})</h4>
                      {previewGroups.improved.length || previewGroups.regressed.length ? (
                        <ul className="space-y-2 text-xs text-white/80">
                          {[...previewGroups.improved, ...previewGroups.regressed].map((entry) => (
                            <li key={`delta-${entry.ticker}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2">
                              <div>
                                <div className="font-semibold text-white">{entry.ticker}</div>
                                <div className="text-[11px] text-white/60">
                                  {formatScore(entry.applied.score)} → {formatScore(entry.draft.score)}
                                </div>
                              </div>
                              <span className={`text-sm font-semibold ${entry.scoreDelta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {formatScoreDelta(entry.scoreDelta)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-white/60">Sin variaciones relevantes en SCORE.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm"
                  onClick={closePreview}
                >
                  Cerrar
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleCancelPreview}
                    disabled={previewLoading}
                  >
                    Descartar borrador
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/90 text-white hover:bg-emerald-500 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleApplyPreview}
                    disabled={applyDisabled}
                  >
                    Aplicar cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {hasDiagnosticsData ? (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 text-xs text-white/70">
            <span>
              Diagnósticos en vivo: {metrics.length} métricas · {logs.length} eventos
            </span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition"
              onClick={toggleDiagnosticsPanel}
              aria-expanded={showDiagnostics}
              aria-controls={diagnosticsRegionId}
            >
              {showDiagnostics ? 'Ocultar panel de diagnósticos' : 'Mostrar panel de diagnósticos'}
            </button>
          </div>
        ) : null}

        {hasDiagnosticsData && showDiagnostics ? (
          <DiagnosticsPanel metrics={metrics} logs={logs} regionId={diagnosticsRegionId} />
        ) : null}

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
      <PreviewDialog
        open={isPreviewOpen}
        onClose={handleClosePreview}
        row={selectedRow}
        calcResult={selectedCalc}
        dialogId={previewDialogId}
      />
    </>
  );
}

export default App;
