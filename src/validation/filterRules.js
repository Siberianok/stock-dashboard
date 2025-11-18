import { DEFAULT_THRESHOLDS } from '../hooks/thresholdConfig.js';
import { normalizeThresholds } from '../utils/thresholds.js';
import { z } from './zod-lite.js';

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

const recordWithStringKeys = (valueSchema) => z.record(z.string(), valueSchema);

const collectMarketKeys = (data) => {
  const buckets = [data?.priceRange, data?.liquidityMin, data?.marketsEnabled];
  const keys = new Set();
  buckets.forEach((bucket) => {
    if (!bucket || typeof bucket !== 'object') return;
    Object.keys(bucket).forEach((key) => keys.add(key));
  });
  return Array.from(keys);
};

const scalarFieldConstraints = {
  rvolMin: { min: 0, messageMin: numericMessages.minZero },
  rvolIdeal: { min: 0, messageMin: numericMessages.minZero },
  atrMin: { min: 0, messageMin: numericMessages.minZero },
  atrPctMin: { min: 0, messageMin: numericMessages.minZero },
  chgMin: { min: 0, messageMin: numericMessages.minZero },
  float50: { min: 0, messageMin: numericMessages.minZero },
  float10: { min: 0, messageMin: numericMessages.minZero },
  rotationMin: { min: 0, messageMin: numericMessages.minZero },
  rotationIdeal: { min: 0, messageMin: numericMessages.minZero },
  shortMin: { min: 0, max: 100, messageMin: numericMessages.minZero, messageMax: numericMessages.maxHundred },
  spreadMaxPct: { min: 0, messageMin: numericMessages.minZero },
};

export const THRESHOLD_FIELD_VALIDATIONS = {
  marketsEnabled: {
    path: ['marketsEnabled', ':market'],
    type: 'boolean',
    description: 'Interruptor que habilita o deshabilita un mercado concreto.',
  },
  priceRangeMin: {
    path: ['priceRange', ':market', 'min'],
    type: 'number',
    constraints: { min: 0, messageMin: numericMessages.minZero },
    relations: [
      {
        type: 'lte',
        field: 'priceRangeMax',
        message: 'Debe ser ≤ máximo',
        scope: 'market',
      },
    ],
  },
  priceRangeMax: {
    path: ['priceRange', ':market', 'max'],
    type: 'number',
    constraints: { min: 0, messageMin: numericMessages.minZero },
    relations: [
      {
        type: 'gte',
        field: 'priceRangeMin',
        message: 'Debe ser ≥ mínimo',
        scope: 'market',
      },
    ],
  },
  liquidityMin: {
    path: ['liquidityMin', ':market'],
    type: 'number',
    constraints: { min: 0, messageMin: numericMessages.minZero },
  },
  parabolic50: {
    path: ['parabolic50'],
    type: 'boolean',
    description: 'Alterna el modo parabólico basado en el 50%.',
  },
  needEMA200: {
    path: ['needEMA200'],
    type: 'boolean',
    description: 'Requiere que el precio cotice por encima de la EMA200.',
  },
  ...Object.fromEntries(
    Object.entries(scalarFieldConstraints).map(([field, constraints]) => [
      field,
      {
        path: [field],
        type: 'number',
        constraints,
        relations:
          field === 'rvolIdeal'
            ? [
                {
                  type: 'gte',
                  field: 'rvolMin',
                  message: 'Debe ser ≥ rvolMin',
                },
              ]
            : field === 'float10'
              ? [
                  {
                    type: 'lte',
                    field: 'float50',
                    message: 'Debe ser ≤ float50',
                  },
                ]
              : field === 'rotationIdeal'
                ? [
                    {
                      type: 'gte',
                      field: 'rotationMin',
                      message: 'Debe ser ≥ rotationMin',
                    },
                  ]
                : undefined,
      },
    ]),
  ),
};

const priceRangeMinMessage = THRESHOLD_FIELD_VALIDATIONS.priceRangeMin.relations?.[0]?.message || 'Debe ser ≤ máximo';
const priceRangeMaxMessage = THRESHOLD_FIELD_VALIDATIONS.priceRangeMax.relations?.[0]?.message || 'Debe ser ≥ mínimo';

const priceRangeSchema = z
  .object({
    min: numberField(THRESHOLD_FIELD_VALIDATIONS.priceRangeMin.constraints),
    max: numberField(THRESHOLD_FIELD_VALIDATIONS.priceRangeMax.constraints),
  })
  .superRefine((value, ctx) => {
    if (typeof value.min === 'number' && typeof value.max === 'number' && value.min > value.max) {
      ctx.addIssue({ path: ['min'], message: priceRangeMinMessage });
      ctx.addIssue({ path: ['max'], message: priceRangeMaxMessage });
    }
  });

const marketsEnabledSchema = recordWithStringKeys(z.boolean());
const priceRangeRecordSchema = recordWithStringKeys(priceRangeSchema);
const liquiditySchema = recordWithStringKeys(numberField({ min: 0, messageMin: numericMessages.minZero }));

export const filterThresholdSchema = z
  .object({
    marketsEnabled: marketsEnabledSchema,
    priceRange: priceRangeRecordSchema,
    liquidityMin: liquiditySchema,
    ...Object.fromEntries(
      Object.entries(scalarFieldConstraints).map(([field, constraints]) => [field, numberField(constraints)]),
    ),
    parabolic50: z.boolean(),
    needEMA200: z.boolean(),
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
    collectMarketKeys(data).forEach((market) => {
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
