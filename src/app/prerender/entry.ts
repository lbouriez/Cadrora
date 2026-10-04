import '../styles/base.css';
import '../public/public.css';
import '@site-theme';

const root = document.documentElement;
if (root.dataset.marketingRender === 'true') {
  // The Worker supplied this validated policy; resolve only the visitor's local
  // color preference before the identity paints. React still hydrates matching
  // server markup, then adopts this preference before exposing the page.
  const policy = root.dataset.themePolicy;
  const system = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let preferred: 'dark' | 'light' = system;
  try {
    const saved = localStorage.getItem('cadrora-theme');
    if (saved === 'dark' || saved === 'light') preferred = saved;
  } catch { /* Preference storage is optional. */ }
  if (policy === 'both') root.dataset.theme = preferred;
  else if (policy === 'system') root.dataset.theme = system;
}

// Let the styled identity paint before parsing/hydrating the interactive app.
// This entry is selected only for the experimental preview build.
let started = false;
const start = () => {
  if (started) return;
  started = true;
  document.removeEventListener('visibilitychange', startWhenHidden);
  void import('../main');
};
function startWhenHidden() { if (document.hidden) start(); }
const stylesReady = Promise.all([...document.querySelectorAll<HTMLLinkElement>('link[data-marketing-styles]')].map((link) =>
  new Promise<void>((resolve, reject) => {
    const apply = () => { link.media = 'all'; resolve(); };
    if (link.sheet) apply();
    else {
      link.addEventListener('load', apply, { once: true });
      link.addEventListener('error', () => reject(new Error('Styles unavailable')), { once: true });
    }
  })));
void stylesReady.then(() => {
  if (document.hidden || root.dataset.marketingRender !== 'true') start();
  else {
    document.addEventListener('visibilitychange', startWhenHidden);
    requestAnimationFrame(() => { setTimeout(start, 0); });
  }
}).catch(() => { /* The inline styled identity and native fallback links remain usable. */ });
