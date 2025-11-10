import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { detectDataSourceStatus } from './services/dataSourceStatus.js';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

const renderApp = (initialProps) => {
  root.render(
    <React.StrictMode>
      <App {...initialProps} />
    </React.StrictMode>,
  );
};

const bootstrap = async () => {
  try {
    const status = await detectDataSourceStatus();
    renderApp({
      initialDataMode: status.mode,
      initialAutoFallback: status.autoFallback,
      initialDataSourceNotice: status.notice,
    });
  } catch (error) {
    renderApp({ initialDataMode: 'mock', initialAutoFallback: true });
  }
};

bootstrap();
