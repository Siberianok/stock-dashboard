const metrics = [];
const listeners = new Set();
const MAX_METRICS = 200;

const notify = () => {
  const snapshot = metrics.slice();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Metric listener error', error);
    }
  });
};

export const recordMetric = (entry) => {
  const metric = {
    id: `${entry.timestamp || new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    ...entry,
  };
  metrics.push(metric);
  if (metrics.length > MAX_METRICS) {
    metrics.splice(0, metrics.length - MAX_METRICS);
  }
  notify();
  return metric;
};

export const getMetrics = () => metrics.slice();

export const subscribeToMetrics = (listener) => {
  listeners.add(listener);
  listener(getMetrics());
  return () => {
    listeners.delete(listener);
  };
};
