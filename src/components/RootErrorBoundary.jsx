import React from 'react';

const fallbackStyles = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  background: 'radial-gradient(circle at top, rgba(15,23,42,0.95), rgba(2,6,23,0.98))',
  color: '#f8fafc',
  textAlign: 'center',
  gap: '1.5rem',
};

const buttonStyles = {
  padding: '0.75rem 1.5rem',
  borderRadius: '9999px',
  border: 'none',
  background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
  color: '#0f172a',
  fontWeight: 600,
  fontSize: '1rem',
  cursor: 'pointer',
};

const detailStyles = {
  fontSize: '0.85rem',
  maxWidth: '32rem',
  lineHeight: 1.5,
  color: 'rgba(226,232,240,0.85)',
};

export class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[runtime] Error rendering app', error, info);
  }

  handleRetry = () => {
    try {
      this.setState({ hasError: false, error: null });
      if (typeof this.props.onReset === 'function') {
        this.props.onReset();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('[runtime] Falló el reinicio del ErrorBoundary, recargando', err);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      return (
        <div role="alert" style={fallbackStyles}>
          <div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>La app no pudo inicializar</h1>
            <p style={detailStyles}>
              Intentá recargarla. Si el problema persiste, activá el modo simulado o revisá la consola del navegador para más detalles.
            </p>
          </div>
          <button type="button" style={buttonStyles} onClick={this.handleRetry}>
            Reintentar
          </button>
          {error ? (
            <pre style={{ ...detailStyles, background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '0.75rem', overflowX: 'auto' }}>
              {error?.message || String(error)}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
