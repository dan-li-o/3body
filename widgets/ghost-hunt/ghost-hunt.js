// <ul-ghost-hunt>  Ch1 "The Ghost Particle". "The ghost hunt."
// A to-scale timeline, 1910–1960: the beta-decay puzzle, Bohr and Pauli around 1930, Fermi,
// then twenty-six empty years until Cowan and Reines catch the neutrino in 1956. The empty
// stretch is the point: the law was saved by a bet, not a measurement.
// Wide screens: the whole plate; tap a date to read it, tap a photo to open it (swipe through
// in date order, tap to zoom). Phones: folded to a one-line strip, with the whole story on request.
// Spec: ./spec.md. Data: ./model.js (tests/widgets/ghost-hunt.test.mjs).
import { ULWidget, define, el, svg, reducedMotion, useStyles } from '../core/core.js';
import { button, row } from '../core/controls.js';
import { EVENTS, GAP, MILESTONES, START, END, x01, gapYears } from './model.js';

useStyles(new URL('./ghost-hunt.css', import.meta.url));
const WIDE = 560;
// Text with *italics*: build it as nodes, never as HTML.
function rich(tag, className, text) {
  const node = el(tag, { className });
  text.split('*').forEach((part, i) => node.append(i % 2 ? el('em', { textContent: part }) : part));
  return node;
}   // px of widget width: below this the timeline folds

class GhostHunt extends ULWidget {
  static buttons = ['open', 'close', 'photo', 'earlier', 'later', 'shut'];
  static strings = { en: {
    invite: 'Tap a date to read what happened.',
    invitePhotos: 'Tap a date to read it; tap a photo to open it.',
    inviteFolded: 'Fifty years at a glance. Open it for the whole story.',
    label: 'A timeline from 1910 to 1960, drawn to scale.',
    gap: 'Twenty-six years: no one sees it',
    gapShort: '26 years: no one sees it',
    open: 'Whole story', close: 'Fold it up', photo: 'Open photo',
    earlier: '← Earlier', later: 'Later →', shut: 'Close',
    photoOf: 'Photo: {credit}', count: '{i} of {n}', zoom: 'Tap the photo to zoom',
  } };

  mount() {
    this.sel = 'pauli';
    this.photos = EVENTS.filter((e) => e.photo);
    this.invite = el('p', { className: 'ul-invite' });
    // wide: the plate and a card for the chosen date
    this.plate = el('div', { className: 'gh-plate' });
    this.svg = svg('svg', { role: 'img', 'aria-label': this.t('label') }, this.plate);
    this.card = el('div', { className: 'gh-card' }); this.card.setAttribute('aria-live', 'polite');
    // folded: the strip, a button, and the story as a list
    this.mini = el('div', { className: 'gh-mini' });
    this.miniSvg = svg('svg', { role: 'img', 'aria-label': this.t('label') }, this.mini);
    this.toggle = button(this.t('open'), () => this.setOpen(!this.open), { labels: [this.t('close')] });
    this.list = el('ol', { className: 'gh-list' }); this.list.hidden = true;
    this.open = false;
    this.replaceChildren(this.invite, this.plate, this.card, this.mini, row(this.toggle), this.list);
    this.toggle.parentElement.classList.add('gh-toggle');
    this.buildList();
    this.svg.addEventListener('click', (ev) => this.hit(ev));
    this.svg.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.hit(ev); } });
    this.card.addEventListener('click', (ev) => { const b = ev.target.closest('[data-photo]'); if (b) this.openPhoto(+b.dataset.photo); });
    this.list.addEventListener('click', (ev) => { const b = ev.target.closest('[data-photo]'); if (b) this.openPhoto(+b.dataset.photo); });
    if (this.photos.length) this.buildViewer();
    this.resize(this.clientWidth);
  }

  // ----- hooks
  resize(width) {
    this.wide = (width || this.clientWidth) >= WIDE;
    this.classList.toggle('gh-wide', this.wide);
    this.invite.textContent = this.wide ? this.t(this.photos.length ? 'invitePhotos' : 'invite') : this.t('inviteFolded');
    if (this.wide) { this.drawPlate(); this.showCard(); } else this.drawMini();
  }
  retune() { this.resize(this.clientWidth); }

  // ----- wide: the plate
  drawPlate() {
    const s = this.svg, W = this.plate.clientWidth; if (!W) return;
    const H = 300, Y = 214, pad = 22, X = (y) => pad + x01(y) * (W - 2 * pad), L = (l) => Y - 30 * l - 14;
    s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.height = H + 'px';
    s.replaceChildren();
    svg('line', { x1: X(START), x2: X(END), y1: Y, y2: Y, class: 'gh-axis' }, s);
    for (let t = START; t <= END; t += 10) {
      svg('line', { x1: X(t), x2: X(t), y1: Y, y2: Y + 6, class: 'gh-axis' }, s);
      svg('text', { x: X(t), y: Y + 24, class: 'gh-tick', 'text-anchor': 'middle' }, s).textContent = t;
    }
    svg('rect', { x: X(GAP[0]), y: Y - 7, width: X(GAP[1]) - X(GAP[0]), height: 14, rx: 7, class: 'gh-gap' }, s);
    svg('text', { x: (X(GAP[0]) + X(GAP[1])) / 2, y: Y + 52, class: 'gh-gaplab', 'text-anchor': 'middle' }, s).textContent = this.t('gap');
    // dates of the puzzle: dots on the axis, labels on stems
    for (const e of EVENTS.filter((v) => !v.hunt)) {
      const cx = X(e.y), ly = L(e.lvl);
      const g = this.hitGroup(s, e, `${e.date}, ${e.who}: ${e.title}`);
      svg('line', { x1: cx, x2: cx, y1: Y - 7, y2: ly + 5, class: 'gh-stem' }, g);
      const w = e.who.length * 8 + 20;
      svg('rect', { x: e.end ? cx - w + 8 : cx - 8, y: ly - 18, width: w, height: Y - ly + 26, class: 'gh-hitbox' }, g);
      svg('circle', { cx, cy: Y, r: 5, class: 'gh-dot gh-ring' }, g);
      svg('text', { x: e.end ? cx - 5 : cx + 5, y: ly, class: 'gh-lab', 'text-anchor': e.end ? 'end' : 'start' }, g).textContent = e.who;
    }
    // the hunt: a row above, each card tied to its date by a leader line
    const hunt = EVENTS.filter((v) => v.hunt), n = hunt.length, gap = 12, right = W - pad;
    const tw = Math.max(70, Math.min(150, (right - X(1937)) / n - gap)), th = Math.round(tw * 0.68), top = 14;
    const left = right - n * tw - (n - 1) * gap;
    hunt.forEach((e, i) => {
      const tx = left + i * (tw + gap), cx = X(e.y), pi = this.photos.indexOf(e);
      const g = this.hitGroup(s, e, pi >= 0 ? `${e.date}: ${e.title}. Open the photo.` : `${e.date}: ${e.title}`);
      if (pi >= 0) g.dataset.photo = pi;
      svg('path', { d: `M${tx + tw / 2},${top + th + 22} L${cx},${Y - 7}`, class: 'gh-stem' }, g);
      if (pi >= 0) {
        const clip = `gh-clip-${e.id}-${this.uid ??= Math.random().toString(36).slice(2, 7)}`;
        svg('rect', { x: tx, y: top, width: tw, height: th, rx: 2 }, svg('clipPath', { id: clip }, g));
        svg('image', { href: new URL(`./photos/${e.photo}-thumb.jpg`, import.meta.url), x: tx, y: top, width: tw, height: th,
          preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clip})` }, g);
        svg('rect', { x: tx, y: top, width: tw, height: th, rx: 2, class: 'gh-frame gh-ring' }, g);
      } else {
        svg('rect', { x: tx, y: top, width: tw, height: th, rx: 2, class: 'gh-chip gh-ring' }, g);
        svg('text', { x: tx + tw / 2, y: top + th / 2 + 6, class: 'gh-chiplab', 'text-anchor': 'middle' }, g).textContent = e.short;
      }
      svg('text', { x: tx + tw / 2, y: top + th + 15, class: 'gh-stamp', 'text-anchor': 'middle' }, g).textContent = e.date;
      svg('circle', { cx, cy: Y, r: 4.5, class: 'gh-dot' }, g);
    });
  }
  hitGroup(parent, e, label) {
    const g = svg('g', { class: 'gh-hit' + (e.id === this.sel ? ' gh-sel' : ''), tabindex: 0, role: 'button', 'aria-label': label }, parent);
    g.dataset.id = e.id;
    return g;
  }
  hit(ev) {
    const g = ev.target.closest('.gh-hit'); if (!g) return;
    this.sel = g.dataset.id; this.drawPlate(); this.showCard();
    this.svg.querySelector(`.gh-hit[data-id="${this.sel}"]`)?.focus({ preventScroll: true });
    if (g.dataset.photo != null) this.openPhoto(+g.dataset.photo);
  }
  showCard() {
    const e = EVENTS.find((v) => v.id === this.sel), pi = this.photos.indexOf(e);
    this.card.replaceChildren(
      el('div', { className: 'gh-date', textContent: e.date }),
      el('h4', { className: 'gh-title', textContent: e.title }),
      rich('p', 'gh-text', e.text));
    if (pi >= 0) { const b = button(this.t('photo'), () => {}, {}); b.dataset.photo = pi; this.card.append(b); }
  }

  // ----- folded: one line, then the whole story on request
  drawMini() {
    const s = this.miniSvg, W = this.mini.clientWidth; if (!W) return;
    const H = 96, Y = 50, pad = 14, X = (y) => pad + x01(y) * (W - 2 * pad);
    s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.style.height = H + 'px';
    s.replaceChildren();
    svg('line', { x1: X(START), x2: X(END), y1: Y, y2: Y, class: 'gh-axis' }, s);
    svg('rect', { x: X(GAP[0]), y: Y - 6, width: X(GAP[1]) - X(GAP[0]), height: 12, rx: 6, class: 'gh-gap' }, s);
    svg('text', { x: (X(GAP[0]) + X(GAP[1])) / 2, y: Y - 15, class: 'gh-gaplab', 'text-anchor': 'middle' }, s).textContent = this.t('gapShort');
    for (const e of EVENTS) svg('circle', { cx: X(e.y), cy: Y, r: 3.5, class: 'gh-dot' }, s);
    for (const [y, yr, word] of MILESTONES) {
      const anchor = y > 1950 ? 'end' : 'middle', x = y > 1950 ? X(y) + 6 : X(y);
      svg('text', { x, y: Y + 24, class: 'gh-tick', 'text-anchor': anchor }, s).textContent = yr;
      svg('text', { x, y: Y + 40, class: 'gh-stamp', 'text-anchor': anchor }, s).textContent = word;
    }
  }
  buildList() {
    const k = 9; let prev = null;
    this.list.replaceChildren();
    for (const e of EVENTS) {
      if (prev?.id === 'fermi') {
        const g = el('li', { className: 'gh-li-gap', textContent: this.t('gapShort') }, this.list);
        g.style.height = Math.round((e.y - prev.y) * k) + 'px';
      }
      const li = el('li', {}, this.list); li.dataset.id = e.id;
      if (prev && prev.id !== 'fermi') li.style.marginTop = Math.max(14, Math.min(110, Math.round((e.y - prev.y) * k))) + 'px';
      el('span', { className: 'gh-yr', textContent: e.date }, li);
      const body = el('div', { className: 'gh-row' }, li), pi = this.photos.indexOf(e);
      if (pi >= 0) {
        const b = el('button', { type: 'button', className: 'gh-thumb' }, body);
        b.dataset.photo = pi; b.setAttribute('aria-label', `${this.t('photo')}: ${e.title}`);
        el('img', { src: new URL(`./photos/${e.photo}-thumb.jpg`, import.meta.url), alt: '', loading: 'lazy' }, b);
      }
      const t = el('div', {}, body);
      el('h4', { className: 'gh-title', textContent: e.title }, t);
      t.append(rich('p', 'gh-text', e.text));
      prev = e;
    }
    this.band = el('div', { className: 'gh-band' }, this.list);
  }
  setOpen(v) {
    this.open = v; this.list.hidden = !v;
    this.toggle.label = this.t(v ? 'close' : 'open');
    this.toggle.setAttribute('aria-expanded', v);
    if (v) requestAnimationFrame(() => this.placeBand());
  }
  placeBand() {
    const a = this.list.querySelector('[data-id="pauli"]'), b = this.list.querySelector('[data-id="caught"]');
    if (!a || !b) return;
    this.band.style.top = (a.offsetTop + 4) + 'px';
    this.band.style.height = (b.offsetTop - a.offsetTop + 14) + 'px';
  }

  // ----- photos: swipe through in date order, tap to zoom
  buildViewer() {
    this.lb = el('div', { className: 'gh-lb' }); this.lb.hidden = true;
    this.lb.setAttribute('role', 'dialog'); this.lb.setAttribute('aria-modal', 'true'); this.lb.setAttribute('aria-label', this.t('label'));
    const bar = el('div', { className: 'gh-lb-bar' }, this.lb);
    this.lbCount = el('span', {}, bar);
    this.shut = button(this.t('shut'), () => this.closePhoto(), { kind: 'quiet' }); bar.append(this.shut);
    this.track = el('div', { className: 'gh-track' }, this.lb);
    this.photos.forEach((e) => {
      const slide = el('figure', { className: 'gh-slide' }, this.track);
      const frame = el('div', { className: 'gh-frame-big' }, slide);
      el('img', { src: new URL(`./photos/${e.photo}.jpg`, import.meta.url), alt: e.photoAlt, loading: 'lazy' }, frame);
      const cap = el('figcaption', {}, slide);
      el('div', { className: 'gh-date', textContent: e.date }, cap);
      el('h4', { className: 'gh-title', textContent: e.title }, cap);
      cap.append(rich('p', 'gh-text', e.text));
      el('p', { className: 'gh-credit', textContent: this.t('photoOf').replace('{credit}', e.credit) }, cap);
    });
    this.prev = button(this.t('earlier'), () => this.go(this.cur - 1));
    this.next = button(this.t('later'), () => this.go(this.cur + 1));
    const nav = row(this.prev, this.next); nav.classList.add('gh-lb-nav'); this.lb.append(nav);
    this.append(this.lb);
    this.track.addEventListener('scroll', () => {
      const i = Math.round(this.track.scrollLeft / this.track.clientWidth);
      if (i !== this.cur && i >= 0 && i < this.photos.length) { this.cur = i; this.unzoom(); this.count(); }
    }, { passive: true });
    this.track.addEventListener('click', (ev) => {
      const f = ev.target.closest('.gh-frame-big'); if (!f) return;
      if (f.classList.contains('gh-zoom')) { this.unzoom(); return; }
      const r = f.getBoundingClientRect(), img = f.firstElementChild;
      img.style.transformOrigin = `${((ev.clientX - r.left) / r.width) * 100}% ${((ev.clientY - r.top) / r.height) * 100}%`;
      f.classList.add('gh-zoom'); this.track.classList.add('gh-lock');
    });
    this.lb.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.closePhoto();
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); this.go(this.cur + 1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); this.go(this.cur - 1); }
    });
  }
  openPhoto(i) {
    if (!this.lb) return;
    this.back = document.activeElement; this.lb.hidden = false; document.documentElement.classList.add('gh-noscroll');
    requestAnimationFrame(() => { this.go(i, false); this.shut.focus(); });
  }
  closePhoto() {
    this.lb.hidden = true; this.unzoom(); document.documentElement.classList.remove('gh-noscroll');
    this.back?.focus?.({ preventScroll: true });
  }
  go(i, smooth = true) {
    this.cur = Math.max(0, Math.min(this.photos.length - 1, i)); this.unzoom();
    this.track.scrollTo({ left: this.cur * this.track.clientWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    this.count();
  }
  count() {
    this.lbCount.textContent = `${this.photos[this.cur].date} · ` + this.t('count').replace('{i}', this.cur + 1).replace('{n}', this.photos.length);
    this.prev.disabled = this.cur === 0; this.next.disabled = this.cur === this.photos.length - 1;
  }
  unzoom() { this.track?.querySelectorAll('.gh-zoom').forEach((f) => f.classList.remove('gh-zoom')); this.track?.classList.remove('gh-lock'); }
}

export { gapYears };
define('ul-ghost-hunt', GhostHunt);
