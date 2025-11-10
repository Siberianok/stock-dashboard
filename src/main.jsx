import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from './router/BrowserRouter.jsx';
import App from './App.jsx';
import RootErrorBoundary from './components/RootErrorBoundary.jsx';
import { forceSimulatedMode } from './utils/dataMode.js';
import './styles.css';

const basename = import.meta.env.BASE_URL ?? '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
