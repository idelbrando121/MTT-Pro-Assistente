import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safety check for window.fetch assignment issues
(function() {
  try {
    const originalFetch = window.fetch;
    Object.defineProperty(window, '_fetch_backup', { value: originalFetch, writable: false });
  } catch (e) {
    console.warn("Could not backup fetch");
  }
})();

// Polyfill for process for libraries that expect it in the browser
if (typeof window !== 'undefined') {
  try {
    if (!(window as any).process) {
      (window as any).process = { env: {} };
    } else if (!(window as any).process.env) {
      (window as any).process.env = {};
    }
  } catch (e) {
    console.error("Failed to polyfill process:", e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
