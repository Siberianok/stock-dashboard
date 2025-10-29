export const DEFAULT_THRESHOLDS = {
  marketsEnabled: { US: true, AR: true, BR: true, EU: true, CN: true },
  priceRange: {
    US: { min: 1.5, max: 20 },
    AR: { min: 500, max: 8000 },
    BR: { min: 2, max: 60 },
    EU: { min: 2, max: 60 },
    CN: { min: 3, max: 80 },
  },
  liquidityMin: {
    US: 5,
    AR: 150,
    BR: 20,
    EU: 10,
    CN: 15,
  },
  rvolMin: 2,
  rvolIdeal: 5,
  atrMin: 0.5,
  atrPctMin: 3,
  chgMin: 10,
  parabolic50: false,
  needEMA200: true,
  float50: 50,
  float10: 10,
  rotationMin: 1,
  rotationIdeal: 3,
  shortMin: 15,
  spreadMaxPct: 1,
};

export const applyPresetModerado = (prev) => ({
  ...prev,
  rvolMin: 2,
  rvolIdeal: 5,
  chgMin: 10,
  parabolic50: false,
  atrMin: 0.5,
  atrPctMin: 3,
  needEMA200: true,
});

export const applyPresetAgresivo = (prev) => ({
  ...prev,
  rvolMin: 3,
  rvolIdeal: 6,
  chgMin: 20,
  parabolic50: true,
  atrMin: 0.6,
  atrPctMin: 4,
  needEMA200: true,
});
