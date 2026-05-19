import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill for process for libraries that expect it in the browser
if (typeof window !== 'undefined') {
  if (!(window as any).process) {
    (window as any).process = { env: {} };
  } else if (!(window as any).process.env) {
    (window as any).process.env = {};
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
