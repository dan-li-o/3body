// Simple color scheme toggle with Quarto integration if available
(function(){
  function getStored(){ try { return localStorage.getItem('color-scheme'); } catch { return null; } }
  function setStored(v){ try { if (v) localStorage.setItem('color-scheme', v); else localStorage.removeItem('color-scheme'); } catch {} }

  function applyScheme(s){
    if (s === 'dark' || s === 'light') {
      document.documentElement.setAttribute('data-color-scheme', s);
    } else {
      document.documentElement.removeAttribute('data-color-scheme');
    }
    // Notify widgets to repaint
    window.dispatchEvent(new Event('color-scheme-changed'));
  }

  function currentOS(){
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch { return 'light'; }
  }

  function toggle(){
    // Prefer Quarto’s built-in toggle if available
    if (typeof window.quartoToggleColorScheme === 'function') {
      window.quartoToggleColorScheme();
      // Derive current from body classes Quarto sets
      const isDark = document.body.classList.contains('quarto-dark');
      setStored(isDark ? 'dark' : 'light');
      window.dispatchEvent(new Event('color-scheme-changed'));
      return;
    }
    const cur = document.documentElement.getAttribute('data-color-scheme') || getStored() || currentOS();
    const next = (cur === 'dark') ? 'light' : 'dark';
    setStored(next); applyScheme(next);
  }

  // Initialize from stored preference if present
  const stored = getStored();
  if (stored === 'dark' || stored === 'light') applyScheme(stored);

  // Add a small floating toggle button
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.className = 'wgt-theme-toggle';
    btn.type = 'button';
    btn.title = 'Toggle color scheme';
    btn.setAttribute('aria-label', 'Toggle color scheme');
    function setIcon(){
      const isDark = (document.body.classList.contains('quarto-dark') || document.documentElement.getAttribute('data-color-scheme') === 'dark');
      btn.textContent = isDark ? '☀️' : '🌙';
    }
    setIcon();
    btn.addEventListener('click', () => { toggle(); setIcon(); });
    window.addEventListener('color-scheme-changed', setIcon);
    document.body.appendChild(btn);
  });
})();
// end theme-toggle.js
