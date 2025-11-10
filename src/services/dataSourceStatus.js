import { logError } from '../utils/logger.js';

export const DATA_SOURCE_FALLBACK_MESSAGE = 'Fuente real caída, estás viendo datos simulados';

const TEST_SYMBOL = 'AAPL';
const DEFAULT_TIMEOUT_MS = 5000;

const getAbortController = () => {
  if (typeof AbortController === 'undefined') {
    return null;
  }
  try {
    return new AbortController();
  } catch (error) {
    logError('dataSource.detect.abort', error);
    return null;
  }
};

const createTimeoutError = () => {
  const error = new Error('Request timed out');
  error.name = 'AbortError';
  return error;
};

export const detectDataSourceStatus = async ({
  fetcher = typeof fetch === 'function' ? fetch : null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  symbol = TEST_SYMBOL,
} = {}) => {
  if (!fetcher) {
    return {
      mode: 'mock',
      autoFallback: true,
      notice: DATA_SOURCE_FALLBACK_MESSAGE,
      reason: 'fetch-unavailable',
    };
  }

  const controller = getAbortController();
  let timeoutId;
  let timeoutPromise = null;
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  try {
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      } else {
        timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(createTimeoutError());
          }, timeoutMs);
        });
      }
    }
    const fetchPromise = fetcher(url, {
      method: 'GET',
      signal: controller?.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const response = timeoutPromise ? await Promise.race([fetchPromise, timeoutPromise]) : await fetchPromise;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (!response || typeof response.ok !== 'boolean') {
      throw new Error('Respuesta inválida de Yahoo');
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return {
      mode: 'live',
      autoFallback: false,
      notice: null,
    };
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const reason = error?.name === 'AbortError' ? 'timeout' : error?.message || 'network-error';
    if (error && error?.name !== 'AbortError') {
      logError('dataSource.detect', error, { url });
    }
    return {
      mode: 'mock',
      autoFallback: true,
      notice: DATA_SOURCE_FALLBACK_MESSAGE,
      reason,
    };
  }
};
