const DEFAULT_TIMEOUT = 12000;

const mergeSignals = (signals) => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signals.filter(Boolean).forEach((signal) => {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  if (controller.signal.aborted) {
    signals.filter(Boolean).forEach((signal) => signal?.removeEventListener?.("abort", onAbort));
  }
  return controller;
};

export const fetchJson = async (url, { signal, timeout = DEFAULT_TIMEOUT } = {}) => {
  const timeoutController = new AbortController();
  const timer = window.setTimeout(() => timeoutController.abort(), timeout);
  const controller = signal ? mergeSignals([signal, timeoutController.signal]) : timeoutController;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
};
