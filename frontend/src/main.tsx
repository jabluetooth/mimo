import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Self-hosted variable fonts (no external CDN / CORS / privacy concerns).
// Fraunces: a warm, soft-serif display face for the brand and headings.
// Work Sans: a humanist sans for body copy that keeps things readable at
// small sizes without reading as another generic system-font substitute.
import '@fontsource-variable/fraunces';
import '@fontsource-variable/work-sans';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
