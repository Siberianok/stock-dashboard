const safeNumber = (value, fallback = 0) => {
  if (Number.isFinite(value)) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const pickValue = (source, path) => {
  if (!source) return 0;
  if (!path || !path.length) {
    return safeNumber(source);
  }
  let current = source;
  for (const key of path) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      current = current[key];
    } else {
      return 0;
    }
  }
  return safeNumber(current);
};

const METRIC_DESCRIPTORS = [
  { id: 'averageScore', label: 'Score promedio', path: ['averageScore'], decimals: 1 },
  { id: 'inPlay', label: 'En juego', path: ['kpis', 'inPlay'], decimals: 0 },
  { id: 'ready70', label: 'Listos ≥70', path: ['kpis', 'ready70'], decimals: 0 },
  { id: 'top', label: 'Score máximo', path: ['kpis', 'top'], decimals: 0 },
];

const roundTo = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const buildHistoricalComparisonDataset = ({ current, benchmark }) => {
  if (!current || !benchmark) {
    return { rows: [], chartData: [], hasData: false };
  }

  const rows = METRIC_DESCRIPTORS.map((descriptor) => {
    const currentValue = pickValue(current, descriptor.path);
    const baselineValue = pickValue(benchmark, descriptor.path);
    const delta = currentValue - baselineValue;
    const deltaPct = baselineValue ? (delta / baselineValue) * 100 : null;
    return {
      id: descriptor.id,
      label: descriptor.label,
      decimals: descriptor.decimals,
      currentValue,
      baselineValue,
      delta,
      deltaPct,
    };
  });

  const chartData = rows.map((row) => ({
    metric: row.label,
    actual: roundTo(row.currentValue, 2),
    historical: roundTo(row.baselineValue, 2),
  }));

  return { rows, chartData, hasData: true };
};

export const formatDelta = (value, decimals = 0) => {
  if (!Number.isFinite(value) || value === 0) {
    return { text: value === 0 ? '0' : '—', tone: 'neutral' };
  }
  const tone = value > 0 ? 'positive' : 'negative';
  const rounded = roundTo(Math.abs(value), decimals);
  return { text: `${value > 0 ? '+' : '−'}${rounded.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`, tone };
};

export const formatDeltaPct = (value) => {
  if (!Number.isFinite(value)) {
    return { text: '—', tone: 'neutral' };
  }
  const decimals = Math.abs(value) >= 10 ? 0 : 1;
  const rounded = roundTo(Math.abs(value), decimals).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const tone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return { text: `${sign}${rounded}%`, tone };
};

export const __testing = {
  pickValue,
  roundTo,
};
