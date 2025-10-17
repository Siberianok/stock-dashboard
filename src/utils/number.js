/** @param {number} value */
export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const toNum = (value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : undefined;
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const fmt = (n, d = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(d) : "");

export const safeNumber = (value, digits = 2) => {
  const n = toNum(value);
  if (typeof n === "number" && Number.isFinite(n)) {
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return "—";
};

export const safeInteger = (value) => {
  const n = toNum(value);
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.round(n).toLocaleString("es-AR");
  }
  return "—";
};

export const safePct = (value, digits = 2) => {
  const n = toNum(value);
  if (typeof n === "number" && Number.isFinite(n)) {
    return `${n.toLocaleString("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}%`;
  }
  return "—";
};
