import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Self-hosted fonts (no external CDN / CORS / privacy concerns).
// Instrument Serif: a thin, editorial display face with a distinctive
// italic — used sparingly for headings so the brand doesn't read as another
// generic bold-sans AI product.
// Plus Jakarta Sans: a warm, slightly rounded humanist sans for body copy.
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
