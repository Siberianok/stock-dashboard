import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  loadThresholdState,
  persistThresholdState,
} from '../src/services/storage/thresholdStorage.js';
import {
  withDraftUpdate,
  withDraftSave,
  withDraftApply,
  withUndo,
} from '../src/hooks/useThresholds.js';
import { DEFAULT_THRESHOLDS, applyPresetAgresivo } from '../src/hooks/thresholdConfig.js';
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

test('editing, applying presets and undoing persists the expected state sequence', () => {
  let state = loadThresholdState();
  const original = cloneThresholds(state.thresholds);

  const editedValue = (state.thresholds.rvolMin || 0) + 2;
  state = withDraftUpdate(state, (draft) => ({
    ...draft,
    rvolMin: editedValue,
  })).state;
  persistThresholdState(state);

  let persisted = loadThresholdState();
  assert.equal(persisted.thresholds.rvolMin, original.rvolMin);
  assert.equal(persisted.draft.thresholds.rvolMin, editedValue);

  state = withDraftSave(state, { timestamp: '2024-02-01T00:00:00.000Z' }).state;
  persistThresholdState(state);
  persisted = loadThresholdState();
  assert.equal(persisted.draft.savedAt, '2024-02-01T00:00:00.000Z');

  state = withDraftUpdate(state, (draft) => applyPresetAgresivo(draft)).state;
  const applied = withDraftApply(state, { label: 'Preset agresivo', timestamp: '2024-02-02T00:00:00.000Z' });
  state = applied.state;
  persistThresholdState(state);

  persisted = loadThresholdState();
  assert.equal(persisted.thresholds.rvolMin, applyPresetAgresivo(original).rvolMin);
  assert.equal(persisted.history.length, 1);
  assert.equal(persisted.history[0].label, 'Preset agresivo');

  const undone = withUndo(state, { timestamp: '2024-02-03T00:00:00.000Z' });
  assert.equal(undone.undone, true);
  state = undone.state;
  persistThresholdState(state);

  persisted = loadThresholdState();
  assert.equal(persisted.thresholds.rvolMin, original.rvolMin);
  assert.equal(persisted.history.length, 0);
  assert.equal(persisted.draft.thresholds.rvolMin, original.rvolMin);
});
