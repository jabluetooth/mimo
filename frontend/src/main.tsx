import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Self-hosted fonts (no external CDN / CORS / privacy concerns). Geist for
// prose and UI, Geist Mono for data: sources, scores, latencies, ids.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
