const logs = [];
const listeners = new Set();
const MAX_LOGS = 200;

const createErrorObject = (error) => {
  if (!error) {
    return { message: 'Unknown error' };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === 'object') {
    return {
      message: error.message || JSON.stringify(error),
      stack: error.stack || null,
    };
  }
  return { message: String(error) };
};

const notify = () => {
  const snapshot = logs.slice();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (listenerError) {
      // eslint-disable-next-line no-console
      console.error('Listener error', listenerError);
    }
  });
};

export const logError = (context, error, extra = {}) => {
  const timestamp = new Date().toISOString();
  const normalized = createErrorObject(error);
  const entry = {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    level: 'error',
    context,
    timestamp,
    message: normalized.message,
    stack: normalized.stack,
    extra,
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }
  // eslint-disable-next-line no-console
  console.error(`[${timestamp}] [${context}]`, {
    message: entry.message,
    extra,
  });
  notify();
  return entry;
};

export const getLogs = () => logs.slice();

export const subscribeToLogs = (listener) => {
  listeners.add(listener);
  listener(getLogs());
  return () => {
    listeners.delete(listener);
  };
};
