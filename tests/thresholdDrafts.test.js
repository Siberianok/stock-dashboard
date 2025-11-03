import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadThresholdState,
  persistThresholdState,
} from '../src/services/storage/thresholdStorage.js';
import {
  withDraftUpdate,
  withDraftSave,
  withDraftApply,
} from '../src/hooks/useThresholds.js';
import { DEFAULT_THRESHOLDS } from '../src/hooks/thresholdConfig.js';
import { cloneThresholds } from '../src/utils/thresholds.js';

const resetState = () => {
  persistThresholdState({
    thresholds: cloneThresholds(DEFAULT_THRESHOLDS),
    history: [],
    draft: {
      thresholds: cloneThresholds(DEFAULT_THRESHOLDS),
      savedAt: null,
      updatedAt: null,
    },
  });
};

test.beforeEach(resetState);

test('draft updates do not mutate active thresholds', () => {
  const initial = loadThresholdState();
  const original = initial.thresholds.chgMin;
  const { state: updated } = withDraftUpdate(initial, (draft) => ({
    ...draft,
    chgMin: (draft.chgMin || 0) + 5,
  }));
  assert.equal(updated.thresholds.chgMin, original);
  assert.equal(updated.draft.thresholds.chgMin, (original || 0) + 5);
  assert.notEqual(updated.draft.updatedAt, updated.draft.savedAt);
});

test('saved draft persists across reloads', () => {
  let state = loadThresholdState();
  const nextValue = (state.draft.thresholds.rvolMin || 0) + 1;
  state = withDraftUpdate(state, (draft) => ({
    ...draft,
    rvolMin: nextValue,
  })).state;
  const { state: saved } = withDraftSave(state, { timestamp: '2024-01-01T00:00:00.000Z' });
  persistThresholdState(saved);
  const reloaded = loadThresholdState();
  assert.equal(reloaded.draft.thresholds.rvolMin, nextValue);
  assert.equal(reloaded.draft.savedAt, '2024-01-01T00:00:00.000Z');
  assert.equal(reloaded.draft.updatedAt, '2024-01-01T00:00:00.000Z');
});

test('applying draft promotes configuration and records history', () => {
  let state = loadThresholdState();
  const originalChg = state.thresholds.chgMin || 0;
  state = withDraftUpdate(state, (draft) => ({
    ...draft,
    chgMin: originalChg + 10,
  })).state;
  const result = withDraftApply(state, { label: 'Test apply', timestamp: '2024-01-02T00:00:00.000Z' });
  state = result.state;
  assert.equal(state.thresholds.chgMin, originalChg + 10);
  assert.equal(state.draft.thresholds.chgMin, originalChg + 10);
  assert.equal(state.draft.savedAt, '2024-01-02T00:00:00.000Z');
  assert.equal(state.history[state.history.length - 1]?.label, 'Test apply');
  assert.ok(result.applied);
  persistThresholdState(state);
  const reloaded = loadThresholdState();
  assert.equal(reloaded.thresholds.chgMin, originalChg + 10);
});
