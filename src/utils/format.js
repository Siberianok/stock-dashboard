export const toNum = (value) => {
  if (value === '' || value === undefined || value === null) return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

export const fmt = (n, digits = 2) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '');

export const safeNumber = (value, digits = 2) => {
  const n = toNum(value);
  if (typeof n === 'number' && Number.isFinite(n)) {
    return n.toLocaleString('es-AR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return '—';
};

export const safeInteger = (value) => {
  const n = toNum(value);
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.round(n).toLocaleString('es-AR');
  }
  return '—';
};

export const safePct = (value, digits = 2) => {
  const n = toNum(value);
  if (typeof n === 'number' && Number.isFinite(n)) {
    return `${n.toLocaleString('es-AR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}%`;
  }
  return '—';
};
