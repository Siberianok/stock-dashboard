import { PREVIEW_SAMPLE_TICKERS } from './previewSample.js';
import { createCalc } from '../utils/calc.js';
import { REQUIRED_FLAGS } from '../utils/constants.js';
import { cloneThresholds, normalizeThresholds } from '../utils/thresholds.js';

const evaluate = (calc, thresholds, ticker) => {
  const market = ticker.market || 'US';
  const computed = calc(ticker, market) || {};
  const flags = computed.flags || {};
  const passes = REQUIRED_FLAGS.every((flag) => {
    if (flag === 'shortOK' && flags.shortMissing) return true;
    return Boolean(flags[flag]);
  });
  const marketEnabled = thresholds?.marketsEnabled?.[market] !== false;
  return {
    passes: marketEnabled && passes,
    score: typeof computed.score === 'number' ? computed.score : 0,
    flags,
    marketEnabled,
  };
};

const diffFlags = (draftFlags, appliedFlags) => {
  const allKeys = new Set([
    ...Object.keys(draftFlags || {}),
    ...Object.keys(appliedFlags || {}),
  ]);
  const gained = [];
  const lost = [];
  allKeys.forEach((key) => {
    const prev = Boolean(appliedFlags?.[key]);
    const next = Boolean(draftFlags?.[key]);
    if (prev === next) return;
    if (next) {
      gained.push(key);
    } else {
      lost.push(key);
    }
  });
  return { gained, lost };
};

const summarize = (entries) => {
  return entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      if (entry.draft.passes) {
        acc.draftPass += 1;
      }
      if (entry.applied.passes) {
        acc.appliedPass += 1;
      }
      return acc;
    },
    {
      total: 0,
      added: 0,
      removed: 0,
      improved: 0,
      regressed: 0,
      unchanged: 0,
      stillFailing: 0,
      draftPass: 0,
      appliedPass: 0,
    },
  );
};

export const computeFilterPreview = ({
  appliedThresholds,
  draftThresholds,
  sampleTickers = PREVIEW_SAMPLE_TICKERS,
} = {}) => {
  const applied = normalizeThresholds(appliedThresholds);
  const draft = normalizeThresholds(draftThresholds);
  const calcApplied = createCalc(applied);
  const calcDraft = createCalc(draft);

  const entries = sampleTickers.map((ticker) => {
    const appliedEval = evaluate(calcApplied, applied, ticker);
    const draftEval = evaluate(calcDraft, draft, ticker);
    const scoreDelta = draftEval.score - appliedEval.score;

    let status = 'unchanged';
    if (draftEval.passes && !appliedEval.passes) {
      status = 'added';
    } else if (!draftEval.passes && appliedEval.passes) {
      status = 'removed';
    } else if (!draftEval.passes && !appliedEval.passes) {
      status = 'stillFailing';
    } else if (draftEval.passes && appliedEval.passes) {
      if (scoreDelta > 0.5) {
        status = 'improved';
      } else if (scoreDelta < -0.5) {
        status = 'regressed';
      }
    }

    const flagChanges = diffFlags(draftEval.flags, appliedEval.flags);

    return {
      ticker: ticker.ticker,
      market: ticker.market || 'US',
      applied: appliedEval,
      draft: draftEval,
      status,
      scoreDelta,
      flagChanges,
    };
  });

  const summary = summarize(entries);

  return {
    entries,
    summary,
    evaluatedAt: new Date().toISOString(),
    appliedThresholds: cloneThresholds(applied),
    draftThresholds: cloneThresholds(draft),
  };
};
