import { DEFAULT_THRESHOLDS } from '../hooks/thresholdConfig.js';
import { MARKETS } from '../utils/constants.js';
import { normalizeThresholds } from '../utils/thresholds.js';
import { z } from './zod-lite.js';

const marketKeys = Object.keys(MARKETS);

const numericMessages = {
  required: 'Requerido',
  invalid: 'Debe ser un número válido',
  minZero: 'Debe ser ≥ 0',
  maxHundred: 'Debe ser ≤ 100',
};

const numberField = ({ min, max, messageMin, messageMax } = {}) => {
  let schema = z.number({ required_error: numericMessages.required, invalid_type_error: numericMessages.invalid });
  if (typeof min === 'number') {
    schema = schema.min(min, messageMin || `Debe ser ≥ ${min}`);
  }
  if (typeof max === 'number') {
    schema = schema.max(max, messageMax || `Debe ser ≤ ${max}`);
  }
  return schema;
};

const priceRangeSchema = z
  .object({
    min: numberField({ min: 0, messageMin: numericMessages.minZero }),
    max: numberField({ min: 0, messageMin: numericMessages.minZero }),
  })
  .superRefine((value, ctx) => {
    if (typeof value.min === 'number' && typeof value.max === 'number' && value.min > value.max) {
      ctx.addIssue({ path: ['min'], message: 'Debe ser ≤ máximo' });
      ctx.addIssue({ path: ['max'], message: 'Debe ser ≥ mínimo' });
    }
  });

const marketKeySchema = z.enum(marketKeys);

const marketsEnabledSchema = z.record(marketKeySchema, z.boolean());
const priceRangeRecordSchema = z.record(marketKeySchema, priceRangeSchema);
const liquiditySchema = z.record(marketKeySchema, numberField({ min: 0, messageMin: numericMessages.minZero }));

export const filterThresholdSchema = z
  .object({
    marketsEnabled: marketsEnabledSchema,
    priceRange: priceRangeRecordSchema,
    liquidityMin: liquiditySchema,
    rvolMin: numberField({ min: 0, messageMin: numericMessages.minZero }),
    rvolIdeal: numberField({ min: 0, messageMin: numericMessages.minZero }),
    atrMin: numberField({ min: 0, messageMin: numericMessages.minZero }),
    atrPctMin: numberField({ min: 0, messageMin: numericMessages.minZero }),
    chgMin: numberField({ min: 0, messageMin: numericMessages.minZero }),
    parabolic50: z.boolean(),
    needEMA200: z.boolean(),
    float50: numberField({ min: 0, messageMin: numericMessages.minZero }),
    float10: numberField({ min: 0, messageMin: numericMessages.minZero }),
    rotationMin: numberField({ min: 0, messageMin: numericMessages.minZero }),
    rotationIdeal: numberField({ min: 0, messageMin: numericMessages.minZero }),
    shortMin: numberField({ min: 0, max: 100, messageMin: numericMessages.minZero, messageMax: numericMessages.maxHundred }),
    spreadMaxPct: numberField({ min: 0, messageMin: numericMessages.minZero }),
  })
  .superRefine((data, ctx) => {
    if (typeof data.rvolIdeal === 'number' && typeof data.rvolMin === 'number' && data.rvolIdeal < data.rvolMin) {
      ctx.addIssue({ path: ['rvolIdeal'], message: `Debe ser ≥ ${data.rvolMin}` });
    }
    if (typeof data.float10 === 'number' && typeof data.float50 === 'number' && data.float10 > data.float50) {
      ctx.addIssue({ path: ['float10'], message: `Debe ser ≤ ${data.float50}` });
    }
    if (typeof data.rotationIdeal === 'number' && typeof data.rotationMin === 'number' && data.rotationIdeal < data.rotationMin) {
      ctx.addIssue({ path: ['rotationIdeal'], message: `Debe ser ≥ ${data.rotationMin}` });
    }
    marketKeys.forEach((market) => {
      const range = data.priceRange?.[market];
      if (!range) return;
      if (typeof range.min === 'number' && typeof range.max === 'number' && range.min > range.max) {
        ctx.addIssue({ path: ['priceRange', market, 'max'], message: 'Debe ser ≥ mínimo' });
      }
    });
  });

const toErrorMap = (issues = []) => {
  const map = {};
  issues.forEach((issue) => {
    const path = Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'root';
    map[path] = issue.message || 'Valor inválido';
  });
  return map;
};

export const validateThresholdDraft = (candidate) => {
  const normalized = normalizeThresholds(candidate ?? DEFAULT_THRESHOLDS);
  const result = filterThresholdSchema.safeParse(normalized);
  if (result.success) {
    return { success: true, value: result.data, errors: {} };
  }
  return { success: false, value: normalized, errors: toErrorMap(result.error.issues) };
};

export const mergeWithDefaults = (patch) => normalizeThresholds({ ...DEFAULT_THRESHOLDS, ...patch });
