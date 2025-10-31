const activeControllers = new Map();

const createAbortError = (message) => {
  const error = new Error(message || 'Abortado');
  error.name = 'AbortError';
  return error;
};

const linkSignals = (controller, externalSignal) => {
  if (!externalSignal) return () => {};
  const abortHandler = () => {
    controller.abort(externalSignal.reason || createAbortError('Abortado por señal externa'));
  };
  if (externalSignal.aborted) {
    abortHandler();
    return () => {};
  }
  externalSignal.addEventListener('abort', abortHandler, { once: true });
  return () => {
    externalSignal.removeEventListener('abort', abortHandler);
  };
};

export const createSharedAbortController = (key, externalSignal) => {
  if (!key) {
    throw new Error('Se requiere una clave para coordinar abortos');
  }
  const existing = activeControllers.get(key);
  if (existing) {
    existing.abort(createAbortError('Abortado por nueva solicitud'));
  }
  const controller = new AbortController();
  activeControllers.set(key, controller);
  const unlink = linkSignals(controller, externalSignal);

  const cleanup = () => {
    const current = activeControllers.get(key);
    if (current === controller) {
      activeControllers.delete(key);
    }
    unlink();
  };

  controller.signal.addEventListener('abort', cleanup, { once: true });

  return {
    signal: controller.signal,
    abort: (reason) => controller.abort(reason || createAbortError('Abortado manualmente')),
    release: cleanup,
  };
};
