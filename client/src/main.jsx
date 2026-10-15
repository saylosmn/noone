import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/unbounded/600.css';
import '@fontsource/unbounded/700.css';
import './styles.css';
import App from './App.jsx';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    window.__nooneSwError = true;
    window.dispatchEvent(new Event('noone:sw-error'));
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'noone:open-chat') window.dispatchEvent(new CustomEvent('noone:open-chat'));
  });
}

createRoot(document.getElementById('root')).render(<App />);
