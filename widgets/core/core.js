// Unlawful Laws widget core: the base class every widget extends.
//
// A widget is a custom element (<ul-name>) that extends ULWidget and fills in
// a few hooks. The base class does the boring-but-essential parts once:
//   - mounts lazily, just before the widget scrolls into view
//   - runs frame(dt) only while playing AND on screen AND the tab is visible
//   - calls resize(width) on size changes and retune() on theme/token changes
//   - respects prefers-reduced-motion (autoplay() starts paused instead)
//   - if anything throws, shows the poster (if the page has one) and a note
//
// Hooks a widget may define:
//   mount()        build the DOM; called once, on first view
//   frame(dt)      advance and draw; dt in seconds, capped at 0.05
//   resize(width)  layout changed
//   retune()       theme or design tokens changed: re-read colors, redraw
//   stateChanged() play/pause changed (e.g. to relabel a Play button)
//
// Strings: set `static strings = { en: {...} }` and read them with this.t('key').

export class ULWidget extends HTMLElement {
  static strings = { en: {} };

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this.classList.add('ul-widget');
    // Whatever the page put inside the tag (the poster images) is kept for
    // the crash fallback; it is shown until the widget mounts.
    this._poster = [...this.children].filter((el) => el.classList.contains('ul-poster'));
    this._visible = false;
    this._running = false;   // what the widget wants (e.g. Play pressed)
    this._raf = 0;

    this._io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        this._visible = e.isIntersecting;
        if (this._visible && !this._mounted && !this._failed) this._mount();
        this._sync();
      }
    }, { rootMargin: '200px 0px' });
    this._io.observe(this);

    this._onVisibility = () => this._sync();
    document.addEventListener('visibilitychange', this._onVisibility);

    // Quarto marks dark mode with a class on <body>.
    this._mo = new MutationObserver(() => this._mounted && this._guard(() => this.retune?.()));
    this._mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  disconnectedCallback() {
    this._io?.disconnect();
    this._ro?.disconnect();
    this._mo?.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibility);
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._connected = false;
  }

  _mount() {
    try {
      this.mount();
      this._mounted = true;
      this._ro = new ResizeObserver(([e]) => this._guard(() => this.resize?.(e.contentRect.width)));
      this._ro.observe(this);
      this._sync();
    } catch (err) {
      this._fail(err);
    }
  }

  // ----- animation loop: runs only when wanted AND visible AND tab shown
  play() { this._running = true; this._sync(); this.stateChanged?.(); }
  pause() { this._running = false; this._sync(); this.stateChanged?.(); }
  get playing() { return this._running; }

  // Start playing unless the reader prefers reduced motion. Returns whether it plays.
  autoplay() {
    if (reducedMotion()) { this.pause(); return false; }
    this.play(); return true;
  }

  _sync() {
    const go = this._running && this._visible && !document.hidden && this._mounted;
    if (go && !this._raf) {
      let last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this._raf = 0;
        this._guard(() => this.frame?.(dt));
        if (this._running && this._visible && !document.hidden && !this._failed) this._raf = requestAnimationFrame(tick);
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
    this._raf = 0; this._running = false; this._failed = true;
    const note = document.createElement('p');
    note.className = 'ul-fallback';
    note.textContent = 'This interactive figure could not start in your browser. The text around it still makes the point.';
    this.replaceChildren(...this._poster, note);
  }

  // ----- helpers
  t(key) {
    const lang = (document.documentElement.lang || 'en').slice(0, 2);
    const table = this.constructor.strings;
    return (table[lang] && table[lang][key]) ?? table.en[key] ?? key;
  }
  get dark() { return isDark(); }
  num(name, fallback) {
    const v = parseFloat(this.getAttribute(name));
    return Number.isFinite(v) ? v : fallback;
  }
  // Current design tokens as plain values, for drawing on canvas.
  colors() { return readColors(this); }
}

// ----- page-level helpers -------------------------------------------------

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isDark = () => document.body.classList.contains('quarto-dark');

// Load a stylesheet once per page.
export function useStyles(url) {
  const href = String(url);
  if (document.querySelector(`link[data-ul-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href; link.dataset.ulCss = href;
  // Canvas widgets read colours from the tokens; if they mounted before this
  // stylesheet arrived, let them re-read.
  link.addEventListener('load', retuneAll);
  document.head.appendChild(link);
}
useStyles(new URL('./tokens.css', import.meta.url));
// Canvas text does not redraw by itself when a web font arrives: a widget that drew before
// EB Garamond loaded would keep the fallback font. Redraw when fonts finish loading.
document.fonts?.addEventListener?.('loadingdone', retuneAll);
function retuneAll() {
  document.querySelectorAll('.ul-widget').forEach((w) => w._mounted && !w._failed && w._guard(() => w.retune?.()));
}

export function token(name, el = document.body) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function readColors(el = document.body) {
  const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
  return {
    ink: v('--ul-ink'), grey: v('--ul-grey'), ghost: v('--ul-ghost'), rule: v('--ul-rule'),
    accent: v('--ul-accent'), paper: v('--ul-paper'),
    line: parseFloat(v('--ul-line')) || 1.75,
    bob: parseFloat(v('--ul-bob')) || 6.5,
    trail: parseFloat(v('--ul-trail')) || 0.55,
  };
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

// Build an HTML element: el('p', { className: 'ul-invite', textContent: '…' }, parent)
export function el(tag, props = {}, parent) {
  const node = Object.assign(document.createElement(tag), props);
  if (parent) parent.appendChild(node);
  return node;
}
