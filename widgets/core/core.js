// Unlawful Laws widget core: the base class every widget extends.
// Handles the boring-but-essential parts once: lazy start, pausing when
// off-screen or in a hidden tab, theme changes, resizing, reduced motion,
// and a readable fallback if a widget crashes.

export class ULWidget extends HTMLElement {
  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this.classList.add('ul-widget');
    this._visible = false;
    this._running = false;   // what the widget wants (e.g. Play pressed)
    this._raf = 0;
    this._last = 0;

    this._io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        this._visible = e.isIntersecting;
        if (this._visible && !this._mounted) this._mount();
        this._sync();
      }
    }, { rootMargin: '200px 0px' });
    this._io.observe(this);

    this._onVisibility = () => this._sync();
    document.addEventListener('visibilitychange', this._onVisibility);

    // Quarto marks dark mode with a class on <body>.
    this._mo = new MutationObserver(() => this._mounted && this.themeChanged?.());
    this._mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  disconnectedCallback() {
    this._io?.disconnect();
    this._ro?.disconnect();
    this._mo?.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibility);
    cancelAnimationFrame(this._raf);
    this._connected = false;
  }

  _mount() {
    try {
      this.mount();
      this._mounted = true;
      this._ro = new ResizeObserver(([e]) => this._guard(() => this.resize?.(e.contentRect.width)));
      this._ro.observe(this);
    } catch (err) {
      this._fail(err);
    }
  }

  // ----- animation loop: runs only when wanted AND visible AND tab shown
  play() { this._running = true; this._sync(); this.stateChanged?.(); }
  pause() { this._running = false; this._sync(); this.stateChanged?.(); }
  get playing() { return this._running; }

  _sync() {
    const go = this._running && this._visible && !document.hidden && this._mounted;
    if (go && !this._raf) {
      this._last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        this._guard(() => this.frame(dt));
        this._raf = this._running && this._visible && !document.hidden ? requestAnimationFrame(tick) : 0;
      };
      this._raf = requestAnimationFrame(tick);
    } else if (!go && this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  _guard(fn) { try { fn(); } catch (err) { this._fail(err); } }

  _fail(err) {
    console.error(`[${this.localName}]`, err);
    cancelAnimationFrame(this._raf);
    this._running = false;
    this.innerHTML = '<p class="ul-fallback">This interactive figure could not start in your browser. The text around it still makes the point.</p>';
  }

  // ----- helpers
  get reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  get dark() { return document.body.classList.contains('quarto-dark'); }
  num(name, fallback) {
    const v = parseFloat(this.getAttribute(name));
    return Number.isFinite(v) ? v : fallback;
  }
}

// Load a stylesheet once per page (modules run once per URL, styles too).
export function useStyles(url) {
  const href = String(url);
  if (document.querySelector(`link[data-ul-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href; link.dataset.ulCss = href;
  document.head.appendChild(link);
}
useStyles(new URL('./tokens.css', import.meta.url));

export function token(name, el = document.body) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function define(tag, cls) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
}

// Small seeded random generator (mulberry32), for reproducible randomness.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build SVG elements without innerHTML.
const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}
