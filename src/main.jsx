import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import RootErrorBoundary from './components/RootErrorBoundary.jsx';
import { forceSimulatedMode } from './utils/dataMode.js';
import './styles.css';

const FATAL_OVERLAY_ID = 'runtime-fatal-overlay';

const normalizeError = (value) => {
  if (value instanceof Error) return value;
  if (value && value.reason instanceof Error) return value.reason;
  if (value && value.error instanceof Error) return value.error;
  if (value && typeof value === 'object') {
    const message = value.message || value.toString?.() || 'Error inesperado';
    const error = new Error(message);
    if (value.stack) {
      error.stack = value.stack;
    }
    return error;
  }
  return new Error(typeof value === 'string' ? value : 'Error inesperado');
};

const isExternalDataError = (error) => {
  if (!error) return false;
  if (error.name === 'RateLimitError') return true;
  const text = `${error.message || ''} ${error.name || ''}`.toLowerCase();
  return /failed to fetch|networkerror|yahoo|fetchquotes|http\s+4\d{2}/i.test(text);
};

const showFatalErrorOverlay = (error) => {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(FATAL_OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
  const overlay = document.createElement('div');
  overlay.id = FATAL_OVERLAY_ID;
  overlay.setAttribute('role', 'alert');
  overlay.setAttribute('aria-live', 'assertive');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '2rem';
  overlay.style.background = 'radial-gradient(circle at top, rgba(15,23,42,0.97), rgba(2,6,23,0.98))';
  overlay.style.color = '#f8fafc';
  overlay.style.textAlign = 'center';
  overlay.style.zIndex = '2147483647';
  overlay.style.gap = '1.5rem';

  const wrapper = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'La app no pudo inicializar';
  title.style.fontSize = '1.75rem';
  title.style.marginBottom = '0.5rem';
  const description = document.createElement('p');
  description.textContent = 'Reintentá cargarla. Revisá la consola para más información.';
  description.style.maxWidth = '32rem';
  description.style.margin = '0 auto';
  description.style.fontSize = '0.95rem';
  description.style.lineHeight = '1.5';
  description.style.color = 'rgba(226,232,240,0.85)';

  wrapper.appendChild(title);
  wrapper.appendChild(description);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reintentar';
  button.style.padding = '0.75rem 1.5rem';
  button.style.borderRadius = '9999px';
  button.style.border = 'none';
  button.style.background = 'linear-gradient(135deg, #10b981, #0ea5e9)';
  button.style.color = '#0f172a';
  button.style.fontWeight = '600';
  button.style.fontSize = '1rem';
  button.style.cursor = 'pointer';
  button.addEventListener('click', () => {
    overlay.remove();
    window.location.reload();
  });

  overlay.appendChild(wrapper);
  overlay.appendChild(button);

  if (error) {
    const detail = document.createElement('pre');
    detail.textContent = error.message || String(error);
    detail.style.background = 'rgba(15,23,42,0.6)';
    detail.style.padding = '1rem';
    detail.style.borderRadius = '0.75rem';
    detail.style.maxWidth = '32rem';
    detail.style.color = 'rgba(226,232,240,0.75)';
    detail.style.fontSize = '0.8rem';
    detail.style.lineHeight = '1.4';
    detail.style.overflowX = 'auto';
    overlay.appendChild(detail);
  }

  document.body.appendChild(overlay);
};

const handleRuntimeFailure = (source, value) => {
  const error = normalizeError(value);
  console.error(`[runtime] ${source}`, error);
  if (isExternalDataError(error)) {
    forceSimulatedMode();
  }
  showFatalErrorOverlay(error);
};

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event?.error || event?.message) {
      handleRuntimeFailure('error no capturado', event.error || event.message);
    } else {
      handleRuntimeFailure('error no capturado', event);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    handleRuntimeFailure('promesa rechazada no capturada', event?.reason ?? event);
  });
}

const container = document.getElementById('root');

if (!container) {
  handleRuntimeFailure('inicio', new Error('No se encontró el contenedor raíz para montar la app.'));
} else {
  const root = ReactDOM.createRoot(container);

  const renderApp = () => {
    root.render(
      <React.StrictMode>
        <RootErrorBoundary onReset={renderApp}>
          <App />
        </RootErrorBoundary>
      </React.StrictMode>,
    );
  };

  renderApp();
}
