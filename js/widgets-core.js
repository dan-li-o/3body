// ---------- widgets-core.js : House utils for all widgets ----------
// Exposes: Widgets.setupHiDPI, Widgets.autosizeCanvas, Widgets.clamp,
//          Widgets.onPointerDrag, Widgets.linkRangeNumber, Widgets.announce,
//          Widgets.hoverCursor, Widgets.ensurePanelFigure, Widgets.renderLatex

/**
 * House Widget Core (v0.3)
 * API:
 *  - clamp(v, lo, hi) -> number
 *  - setupHiDPI(canvas, cssW, cssH [, dpr]) -> {ctx,width,height,dpr}
 *  - autosizeCanvas(canvas, {aspect=16/9, min=320, max=900})
 *      -> { get ctx(), get width(), get height(), relayout(), ro }
 *  - onPointerDrag(target, {hitTest(pt), onStart(pt,e), onMove(pt,e), onEnd(e)})
 *  - linkRangeNumber(rangeEl, numberEl, {toModel, fromModel, onChange}) -> {set(val)}
 *  - hoverCursor(target, {hitTest(pt), hover='grab', normal='', isDragging:()=>bool})
 *  - announce(liveNode, text)
 *  - ensurePanelFigure(outPanel, { role='figure', wrapClass='wgt__chartwrap',
 *        ensureLegend=true, ensureEq=true }) -> { wrap, canvas, legend, eq }
 *  - renderLatex(el, tex, {displayMode=false})
 */

window.Widgets = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const CANVAS_DEFAULTS = Object.freeze({
    width: 640,
    height: 360,
    aspect: 16 / 9,
    min: 320,
    max: 720
  });

  function canvasDefaults(overrides = {}){
    return {
      width: overrides.width ?? CANVAS_DEFAULTS.width,
      height: overrides.height ?? CANVAS_DEFAULTS.height,
      aspect: overrides.aspect ?? CANVAS_DEFAULTS.aspect,
      min: overrides.min ?? CANVAS_DEFAULTS.min,
      max: overrides.max ?? CANVAS_DEFAULTS.max
    };
  }

  // HiDPI canvas setup (keeps your drawing code in CSS pixels)
  function setupHiDPI(canvas, cssW, cssH, dpr = window.devicePixelRatio || 1){
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: cssW, height: cssH, dpr };
  }

  // Auto-size canvas to parent width with fixed aspect, min/max
  function autosizeCanvas(canvas, {aspect=CANVAS_DEFAULTS.aspect, min=CANVAS_DEFAULTS.min, max=CANVAS_DEFAULTS.max} = {}){
    let ctx, width, height;
    function layout(){
      const host = canvas.parentElement;
      const hostW = host?.clientWidth || max;
      const w = clamp(hostW, min, max);
      const h = Math.round(w / aspect);
      ({ctx, width, height} = setupHiDPI(canvas, w, h));
    }
    const ro = new ResizeObserver(layout);
    ro.observe(canvas.parentElement);
    layout();
    return { get ctx(){return ctx;}, get width(){return width;}, get height(){return height;}, relayout: layout, ro };
  }

  // Range <-> Number twin inputs with optional transform
  function linkRangeNumber(rangeEl, numberEl, {toModel=(x)=>+x, fromModel=(x)=>x, onChange} = {}){
    if(!rangeEl && !numberEl) return;
    const setBoth = (val) => {
      const show = fromModel(val);
      if(rangeEl)  rangeEl.value  = show;
      if(numberEl) numberEl.value = show;
      onChange && onChange(val);
    };
    rangeEl && rangeEl.addEventListener('input', e => setBoth(toModel(e.target.value)));
    numberEl && numberEl.addEventListener('input', e => setBoth(toModel(e.target.value)));
    return { set: setBoth };
  }

  // Pointer drag (mouse/touch/pen), with setPointerCapture and proper cleanup
  function onPointerDrag(target, {hitTest=()=>true, onStart=()=>{}, onMove=()=>{}, onEnd=()=>{}} = {}){
    target.addEventListener('pointerdown', (e) => {
      const rect = target.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: e.pointerId };
      if(!hitTest(pt)) return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      onStart(pt, e);

      function move(ev){
        const r = target.getBoundingClientRect();
        onMove({ x: ev.clientX - r.left, y: ev.clientY - r.top, id: ev.pointerId }, ev);
      }
      function up(ev){
        onEnd(ev);
        try { target.releasePointerCapture(e.pointerId); } catch {}
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        target.style.cursor = '';
      }
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
  }

  // Hover cursor helper: shows a cursor when hitTest is true and not dragging
  function hoverCursor(target, { hitTest, hover='grab', normal='', isDragging=()=>false } = {}){
    if (typeof hitTest !== 'function') return;
    target.addEventListener('pointermove', (e) => {
      if (isDragging()) return;
      const r = target.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      target.style.cursor = hitTest(p) ? hover : normal;
    });
    target.addEventListener('pointerleave', () => {
      if (!isDragging()) target.style.cursor = normal;
    });
  }

  // Announce text to an aria-live region (for telemetry)
  function announce(liveNode, text){
    if(!liveNode) return;
    liveNode.textContent = text;
  }

  // ----- Theming helpers -----
  const schemeState = {
    mode: 'light',
    listeners: new Set(),
    observer: null,
    media: null,
    ready: false
  };

  function detectColorScheme(){
    const el = document.documentElement;
    const body = document.body;
    const attrSources = [
      el?.dataset?.bsTheme,
      el?.getAttribute('data-bs-theme'),
      el?.dataset?.theme,
      el?.getAttribute('data-theme'),
      body?.dataset?.bsTheme,
      body?.getAttribute('data-bs-theme'),
      body?.dataset?.theme,
      body?.getAttribute('data-theme')
    ].filter(Boolean).map(s => String(s).toLowerCase());

    if (el?.classList?.contains('quarto-dark') || body?.classList?.contains('quarto-dark')) {
      return 'dark';
    }
    if (attrSources.some(a => a.includes('dark'))) {
      return 'dark';
    }
    if (attrSources.some(a => a.includes('light'))) {
      return 'light';
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function emitColorScheme(next){
    const mode = next || detectColorScheme();
    if (mode === schemeState.mode && schemeState.ready) return;
    schemeState.mode = mode;
    schemeState.ready = true;
    schemeState.listeners.forEach(fn => {
      try { fn(mode); }
      catch(err){ console.error(err); }
    });
  }

  function ensureSchemeMonitor(){
    if (schemeState.observer) {
      emitColorScheme();
      return;
    }

    const observer = new MutationObserver(() => emitColorScheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-bs-theme', 'data-theme']
    });

    const watchBody = () => {
      if (!document.body) {
        requestAnimationFrame(watchBody);
        return;
      }
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-bs-theme', 'data-theme']
      });
    };
    watchBody();

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', () => emitColorScheme());
      schemeState.media = media;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => emitColorScheme(), { once: true });
    }

    schemeState.observer = observer;
    emitColorScheme();
  }

  function onColorSchemeChange(cb){
    if (typeof cb !== 'function') return () => {};
    ensureSchemeMonitor();
    schemeState.listeners.add(cb);
    cb(schemeState.mode);
    return () => schemeState.listeners.delete(cb);
  }

  function currentColorScheme(){
    ensureSchemeMonitor();
    return schemeState.mode;
  }

  function themeVar(name, fallback){
    const styles = getComputedStyle(document.documentElement);
    const value = styles.getPropertyValue(name);
    if (value && value.trim()) return value.trim();
    return fallback !== undefined ? fallback : '';
  }

  /**
   * ensurePanelFigure(outPanel, opts)
   * Creates (or reuses) a tight wrapper directly under the panel title and above generic hints,
   * and ensures a canvas (data-role=role), a legend node, and an equation node exist inside it.
   *
   * @param {HTMLElement} outPanel - The '.wgt__output' element (or any panel).
   * @param {object} opts
   *    - role:        string data-role to assign to the canvas (default 'figure')
   *    - wrapClass:   class name for the wrapper (default 'wgt__chartwrap')
   *    - ensureLegend:boolean create legend node if missing (default true)
   *    - ensureEq:    boolean create equation node if missing (default true)
   * @returns {object} { wrap, canvas, legend, eq }
   */
  function ensurePanelFigure(outPanel, {
    role = 'figure',
    wrapClass = 'wgt__chartwrap',
    ensureLegend = true,
    ensureEq = true
  } = {}){
    if (!outPanel) throw new Error('ensurePanelFigure: outPanel is required');

    // 1) Find or create the wrapper
    let wrap = outPanel.querySelector(`.${wrapClass}`);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = wrapClass;
      Object.assign(wrap.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%'
      });
    }

    // Insert wrapper right after the panel title, but before any generic hints
    const titleEl = outPanel.querySelector(':scope > .wgt__title');
    const firstNonEqHint = outPanel.querySelector('.wgt__hint:not([data-role="eq"])');
    
    if (!wrap.parentNode) {
      if (firstNonEqHint && firstNonEqHint.parentNode === outPanel) {
        outPanel.insertBefore(wrap, firstNonEqHint);
      }
      else if (titleEl && titleEl.parentNode === outPanel) {
        titleEl.insertAdjacentElement('afterend', wrap);
      }
      else {
        outPanel.prepend(wrap);
      } 
    } else {
      if (firstNonEqHint && firstNonEqHint.parentNode === outPanel && wrap.nextElementSibling !== firstNonEqHint) {
        outPanel.insertBefore(wrap, firstNonEqHint);
      }
    }

    // 2) Ensure canvas with data-role=role exists inside wrapper (move if needed)
    let canvas = wrap.querySelector(`canvas[data-role="${role}"]`)
             || outPanel.querySelector(`canvas[data-role="${role}"]`);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('data-role', role);
    }
    const widthAttr = Number(canvas.getAttribute('width')) || 0;
    if (!canvas.hasAttribute('width') || widthAttr === 300) {
      canvas.setAttribute('width', CANVAS_DEFAULTS.width);
    }
    const heightAttr = Number(canvas.getAttribute('height')) || 0;
    if (!canvas.hasAttribute('height') || heightAttr === 150) {
      canvas.setAttribute('height', CANVAS_DEFAULTS.height);
    }
    if (canvas.parentNode !== wrap) wrap.appendChild(canvas);
    Object.assign(canvas.style, {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: 'var(--wgt-radius)',
      touchAction: 'none',
      userSelect: 'none'
    });

    // 3) Legend (optional)
    let legend = wrap.querySelector('[data-role="legend"]');
    if (!legend && ensureLegend) {
      legend = document.createElement('div');
      legend.setAttribute('data-role', 'legend');
      legend.className = 'wgt__hint';
      Object.assign(legend.style, { display: 'flex', alignItems: 'center', gap: '14px' });
      wrap.appendChild(legend);
    }

    // 4) Equation (optional) — sits after legend
    let eq = wrap.querySelector('[data-role="eq"]') || outPanel.querySelector('[data-role="eq"]');
    if (!eq && ensureEq) {
      eq = document.createElement('div');
      eq.setAttribute('data-role', 'eq');
      eq.className = 'wgt__hint';
      wrap.appendChild(eq);
    }
    if (eq && eq.parentNode !== wrap) wrap.appendChild(eq);
    if (eq) eq.style.marginTop = '0';

    return { wrap, canvas, legend, eq };
  }

  /**
   * renderLatex(el, tex, {displayMode=false})
   * Minimal helper to typeset LaTeX using whichever engine is available.
   * - KaTeX (fast), or Quarto helper, or MathJax v3; fallback = plain text.
   */
  function renderLatex(el, tex, {displayMode=false} = {}){
    if (!el) return;
    // KaTeX
    if (window.katex && typeof window.katex.render === 'function') {
      window.katex.render(tex, el, { throwOnError: false, displayMode });
      return;
    }
    // Quarto helper (works with either engine)
    if (window.Quarto && typeof window.Quarto.typesetMath === 'function') {
      el.innerHTML = displayMode ? `$$${tex}$$` : `$${tex}$`;
      window.Quarto.typesetMath(el);
      return;
    }
    // MathJax v3
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      el.innerHTML = displayMode ? `\\[${tex}\\]` : `\\(${tex}\\)`;
      window.MathJax.typesetPromise([el]);
      return;
    }
    // Fallback: plain text
    el.textContent = tex;
  }

  return {
    setupHiDPI, autosizeCanvas, clamp, onPointerDrag, linkRangeNumber,
    announce, hoverCursor, ensurePanelFigure, renderLatex,
    onColorSchemeChange, currentColorScheme, themeVar,
    canvasDefaults
  };
})();
// ---------- end widgets-core.js ----------
