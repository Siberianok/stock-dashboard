import { describe, expect, it, vi } from 'vitest';
import { detectDataSourceStatus, DATA_SOURCE_FALLBACK_MESSAGE } from '../src/services/dataSourceStatus.js';

describe('detectDataSourceStatus', () => {
  it('returns live mode when fetch succeeds', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const status = await detectDataSourceStatus({ fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(status).toEqual({ mode: 'live', autoFallback: false, notice: null });
  });

  it('falls back to mock mode when response is not ok', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const status = await detectDataSourceStatus({ fetcher });
    expect(status.mode).toBe('mock');
    expect(status.autoFallback).toBe(true);
    expect(status.notice).toBe(DATA_SOURCE_FALLBACK_MESSAGE);
    expect(status.reason).toBe('HTTP 503');
  });

  it('falls back when the request times out', async () => {
    const createAbortError = () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return error;
    };
    const fetcher = vi.fn((_, { signal }) =>
      new Promise((_, reject) => {
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(createAbortError());
        });
      }),
    );
    const status = await detectDataSourceStatus({ fetcher, timeoutMs: 5 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(status.mode).toBe('mock');
    expect(status.autoFallback).toBe(true);
    expect(status.notice).toBe(DATA_SOURCE_FALLBACK_MESSAGE);
    expect(status.reason).toBe('timeout');
  });
});
