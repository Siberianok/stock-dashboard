import { test } from 'vitest';
import assert from 'node:assert/strict';

import { filtersStore } from '../src/store/filters.js';
import { computeFilterPreview } from '../src/services/filterPreview.js';
import { PREVIEW_SAMPLE_TICKERS } from '../src/services/previewSample.js';

const getSummary = (applied, draft, sample = PREVIEW_SAMPLE_TICKERS) =>
  computeFilterPreview({ appliedThresholds: applied, draftThresholds: draft, sampleTickers: sample });

test('disabling a market marks tickers as removed and persists on apply', () => {
  filtersStore.__resetForTests();
  const initial = filtersStore.getState();

  const basePreview = getSummary(initial.applied.thresholds, initial.draft.thresholds);
  assert.equal(basePreview.summary.total, PREVIEW_SAMPLE_TICKERS.length);
  assert.equal(basePreview.summary.removed, 0);
  assert.equal(basePreview.summary.added, 0);

  filtersStore.updateDraft((prev) => ({
    ...prev,
    marketsEnabled: { ...prev.marketsEnabled, AR: false },
  }));
  const draftState = filtersStore.getState();
  assert.ok(draftState.draft.dirty, 'draft should be dirty after market toggle');

  const removalPreview = getSummary(initial.applied.thresholds, draftState.draft.thresholds);
  assert.equal(removalPreview.summary.removed, 1);
  const removedEntry = removalPreview.entries.find((entry) => entry.status === 'removed');
  assert.ok(removedEntry, 'expected a removed ticker');
  assert.equal(removedEntry.ticker, 'ANDES');

  const historyBeforeApply = initial.applied.history.length;
  filtersStore.applyDraft();
  const afterApply = filtersStore.getState();
  assert.equal(afterApply.applied.thresholds.marketsEnabled.AR, false, 'applied thresholds should reflect draft change');
  assert.equal(afterApply.applied.history.length, historyBeforeApply + 1, 'applying should push a snapshot into history');
  assert.equal(afterApply.draft.dirty, false, 'draft should be clean after apply');

  const postApplyPreview = getSummary(afterApply.applied.thresholds, afterApply.draft.thresholds);
  assert.equal(postApplyPreview.summary.removed, 0);
});

test('relaxing thresholds adds new tickers and reset discards draft changes', () => {
  filtersStore.__resetForTests();
  const initial = filtersStore.getState();

  filtersStore.updateDraft((prev) => ({
    ...prev,
    priceRange: { ...prev.priceRange, US: { ...prev.priceRange.US, min: 1 } },
    liquidityMin: { ...prev.liquidityMin, US: 0 },
    rotationMin: 0,
    rotationIdeal: 0,
    chgMin: 5,
    spreadMaxPct: 2,
  }));

  const withDraft = filtersStore.getState();
  const relaxedPreview = getSummary(initial.applied.thresholds, withDraft.draft.thresholds);
  assert.equal(relaxedPreview.summary.added, 1);
  const added = relaxedPreview.entries.find((entry) => entry.status === 'added');
  assert.ok(added, 'expected an added ticker');
  assert.equal(added.ticker, 'CHEAP');
  assert.equal(relaxedPreview.summary.draftPass, 3);

  filtersStore.resetDraft();
  const afterReset = filtersStore.getState();
  assert.deepEqual(afterReset.draft.thresholds, afterReset.applied.thresholds, 'reset should restore applied thresholds');
  assert.equal(afterReset.draft.dirty, false, 'reset clears draft dirty flag');
});
