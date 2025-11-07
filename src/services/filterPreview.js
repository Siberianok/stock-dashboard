import { PREVIEW_SAMPLE_TICKERS } from './previewSample.js';
import { createCalc } from '../utils/calc.js';
import { cloneThresholds, normalizeThresholds } from '../utils/thresholds.js';
import { evaluateTicker, summarizeEvaluations } from './evaluator.js';

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
    const appliedEval = evaluateTicker({ calc: calcApplied, thresholds: applied, data: ticker });
    const draftEval = evaluateTicker({ calc: calcDraft, thresholds: draft, data: ticker });
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

  const summary = summarizeEvaluations(entries);

  return {
    entries,
    summary,
    evaluatedAt: new Date().toISOString(),
    appliedThresholds: cloneThresholds(applied),
    draftThresholds: cloneThresholds(draft),
  };
};
