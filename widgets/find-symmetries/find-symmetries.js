// <ul-find-symmetries>  Ch1 "Three Names, One Bet", Widget 1.4. "Find the symmetries."
// One shape per round: a flower in a pot, an equilateral triangle, a circle. Turn it (drag around
// it) and flip it; let go to check it against its dashed outline. A ring records every result
// found. Counts climb 2 → 6 → endless: the flower's and triangle's symmetries come in jumps, the
// circle's are continuous. Moves count by result (0°, 360°, 720° are one symmetry).
// Spec: ./spec.md. Model: ./model.js (tests/widgets/find-symmetries.test.mjs).
import { ULWidget, define, el, reducedMotion, useStyles } from '../core/core.js';
import { button, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { SHAPES, ORDER, mod, fit, flip, labelFor } from './model.js';
import { drawFigure, drawGhost, drawDial, drawRingNames, drawPointer, drawHint, drawCompare } from './draw.js';

useStyles(new URL('./find-symmetries.css', import.meta.url));
const INF_AFTER = 4;       // new circle results before the tally reads "of ∞"
const THUMBS = 6;          // results shown in the strip (one row on a phone)
const ease = (t) => 1 - (1 - t) ** 3;

class FindSymmetries extends ULWidget {
  // status messages (at most 80 characters each; tests/widgets/strings.test.mjs)
  static status = ['introFlower', 'introTriangle', 'introCircle', 'doneFlower', 'doneTriangle', 'doneCircle',
    'miss', 'hit', 'hitCircle', 'dup', 'dupOther', 'another', 'compareSay'];
  static buttons = ['flip', 'next', 'compare', 'again', 'playAgain'];
  static strings = { en: {
    invite: 'Turn it, flip it. Find every move that leaves it unchanged.',
    label: 'A shape to turn and flip, with a dashed outline of where it started and a ring that records every move that fits.',
    introFlower: 'Drag around the flower to turn it, or tap Flip. Let go to check.',
    introTriangle: 'A triangle with equal sides. The numbers show where each corner lands.',
    introCircle: 'Last, a circle. The two numbers on its rim show how far it has turned.',
    doneFlower: 'That’s all of them: 2. Any other move spoils the flower.',
    doneTriangle: 'All 6. Turn it by anything in between, and it no longer fits.',
    doneCircle: 'Every turn fits: a half, a tenth, a hair. You will never find them all.',
    miss: 'Not the same: the {noun} no longer fits its outline.',
    hit: 'Same {noun}! A new one.',
    hitCircle: 'Same circle! Try another turn, any turn.',
    dup: 'Same, but you have found that one already.',
    dupOther: 'Same, but not new: it lands every point just as “{label}” does.',
    another: 'Another. There is no end to them.',
    compareSay: 'The flower and the triangle fit in jumps. The circle fits at every turn.',
    flip: 'Flip', next: 'Next shape →', compare: 'Compare →', again: 'Start over', playAgain: 'Play again',
    flower: 'a flower in a pot', triangle: 'a triangle', circle: 'a circle',
    flowerNoun: 'flower', triangleNoun: 'triangle', circleNoun: 'circle',
    round: '{i} of 3 · {name}', all: 'all three', found: 'found <b>{n}</b> of {of}',
    turned: 'turned', flipped: 'flipped', readout: 'turned {deg}°', readoutF: 'flipped, turned {deg}°',
    hint: 'drag to turn', jumps: 'in jumps', continuous: 'continuous', results: 'Moves found so far',
  } };

  mount() {
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    this.head = el('div', { className: 'fs-head ul-readout' });
    this.roundEl = el('span', {}, this.head);
    this.tally = el('span', {}, this.head); this.tally.setAttribute('aria-live', 'polite');
    const frag = document.createDocumentFragment();
    this.stage = createStage(frag, { aspect: '16 / 10', phoneAspect: '10 / 9', label: this.t('label') });
    this.status = new StatusLine({ gap: 0, hold: 0 });
    const nouns = ORDER.map((n) => this.t(n + 'Noun'));
    this.status.reserve(this.constructor.status.flatMap((k) => (/\{noun\}/.test(this.t(k)) ? nouns.map((n) => this.t(k).replace('{noun}', n)) : [this.t(k)])));
    this.status.reserve([this.t('dupOther').replace('{label}', 'flip + 240°')]);
    this.btn = {
      flip: button(this.t('flip'), () => this.doFlip()),
      next: button(this.t('next'), () => this.startRound(this.ri + 1), { hidden: true }),
      compare: button(this.t('compare'), () => this.showCompare(), { hidden: true }),
      again: button(this.t('again'), () => this.startRound(0), { kind: 'quiet', labels: [this.t('playAgain')] }),
    };
    this.strip = el('div', { className: 'fs-found' }); this.strip.setAttribute('aria-label', this.t('results'));
    const b = this.btn;
    this.replaceChildren(invite, this.head, this.stage.box, this.status.el, row(b.flip, b.next, b.compare, b.again), this.strip);
    this.gesture(this.stage.canvas);
    this.c = this.colors();
    this.startRound(0);
  }

  // ----- hooks
  resize() { this.stage.fit(); this.draw(); this.renderStrip(); }
  retune() { this.c = this.colors(); this.draw(); this.renderStrip(); }
  frame(dt) {   // runs only while an animation is on (a snap, a flip, the orange flash)
    const a = this.anim;
    if (a) { a.t = Math.min(1, a.t + dt / a.dur); a.step(ease(a.t)); if (a.t >= 1) { this.anim = null; a.done?.(); } }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.7);
    this.draw();
    if (!this.anim && !this.flash) this.pause();
  }

  // ----- rounds
  get name() { return ORDER[this.ri]; }
  startRound(i) {
    this.ri = i; this.view = 'round';
    this.theta = 0; this.flipped = false; this.squash = 1; this.anim = null; this.flash = 0;
    this.found = new Map(); this.order = []; this.infinite = false; this.hint = i === 0;
    this.add(fit(this.name, 0, false));
    this.roundEl.textContent = this.t('round').replace('{i}', i + 1).replace('{name}', this.t(this.name));
    Object.assign(this.btn.flip, { hidden: false }); this.btn.next.hidden = true; this.btn.compare.hidden = true;
    this.btn.again.label = this.t('again');
    this.say(this.t('intro' + this.name[0].toUpperCase() + this.name.slice(1)));
    this.updateTally(); this.renderStrip(); this.pause(); this.draw();
  }
  showCompare() {
    this.view = 'compare'; this.anim = null;
    this.roundEl.textContent = this.t('all'); this.tally.textContent = '';
    this.btn.flip.hidden = true; this.btn.compare.hidden = true; this.btn.again.label = this.t('playAgain');
    this.say(this.t('compareSay')); this.renderStrip(); this.draw();
  }

  // ----- moves
  doFlip() {
    if (this.view !== 'round' || this.anim) return;
    this.hint = false;
    const done = () => { ({ theta: this.theta, flipped: this.flipped } = flip(this.theta, this.flipped)); this.squash = 1; this.check(); };
    if (reducedMotion()) { done(); this.draw(); return; }
    this.animate(0.38, (e) => { this.squash = Math.cos(Math.PI * e); }, done);   // the squash ends at −1: the flip, drawn
  }
  check() {
    const r = fit(this.name, this.theta, this.flipped), noun = this.t(this.name + 'Noun');
    if (!r) { this.say(this.t('miss').replace('{noun}', noun)); this.draw(); return; }
    const from = this.theta;
    if (reducedMotion() || Math.abs(r.exact - from) < 0.01) this.theta = r.exact;
    else this.animate(0.16, (e) => { this.theta = from + (r.exact - from) * e; }, () => { this.theta = r.exact; });
    this.flash = 1; this.play();
    if (this.found.has(r.key)) {
      const same = !this.flipped && Math.round(r.exact) === r.angle;
      this.say(same ? this.t('dup') : this.t('dupOther').replace('{label}', this.found.get(r.key).label));
      return;
    }
    this.add(r);
    const n = this.order.length, total = SHAPES[this.name].total;
    if (n === total) { this.say(this.t(this.name === 'flower' ? 'doneFlower' : 'doneTriangle')); this.btn.next.hidden = false; }
    else if (this.name !== 'circle') this.say(this.t('hit').replace('{noun}', noun));
    else if (!this.infinite && n - 1 >= INF_AFTER) { this.infinite = true; this.say(this.t('doneCircle')); this.btn.compare.hidden = false; }
    else this.say(this.t(this.infinite ? 'another' : 'hitCircle'));
    this.updateTally(); this.renderStrip(true);
  }
  add(r) { const f = { ...r, label: labelFor(r.flipped, r.angle) }; this.found.set(f.key, f); this.order.push(f); }
  animate(dur, step, done) { this.anim = { t: 0, dur, step, done }; this.play(); }

  // ----- input: drag around the shape to turn it; arrow keys turn, F flips
  gesture(cv) {
    const angle = (e) => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180 / Math.PI; };
    cv.addEventListener('pointerdown', (e) => {
      if (this.view !== 'round' || this.anim) return;
      e.preventDefault(); cv.setPointerCapture(e.pointerId); this.drag = { last: angle(e), moved: 0 };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const a = angle(e), d = mod(a - this.drag.last + 180, 360) - 180;
      this.drag.last = a; this.drag.moved += Math.abs(d); this.theta += d;
      if (this.drag.moved > 4) this.hint = false;
      this.draw();
    });
    const end = () => { if (!this.drag) return; const moved = this.drag.moved; this.drag = null; if (moved > 1) this.check(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', (e) => {
      if (this.view !== 'round' || this.anim) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); this.hint = false;
        this.theta += (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 15); this.draw();
        clearTimeout(this.kt); this.kt = setTimeout(() => this.check(), 450);
      } else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.doFlip(); }
    });
    cv.style.touchAction = 'none';
  }

  // ----- words
  say(msg) { this.status.set(msg, 0); }
  updateTally() {
    const of = Number.isFinite(SHAPES[this.name].total) ? SHAPES[this.name].total : (this.infinite ? '∞' : '?');
    this.tally.innerHTML = this.t('found').replace('{n}', this.order.length).replace('{of}', of);
  }

  // ----- drawing
  renderStrip(withNew) {
    this.strip.replaceChildren();
    if (this.view !== 'round' || !this.c) return;
    const list = this.order.length > THUMBS ? this.order.slice(-(THUMBS - 1)) : this.order;
    if (list !== this.order) el('span', { className: 'fs-more', textContent: `+${this.order.length - list.length}` }, this.strip);
    const dpr = Math.min(2, devicePixelRatio || 1);
    list.forEach((f, i) => {
      const fig = el('figure', {}, this.strip);
      const cv = el('canvas', { width: 42 * dpr, height: 42 * dpr }, fig);
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      drawFigure(ctx, { ...this.c, line: 1.1 }, this.name, 21, 21, 17.5, f.angle, f.flipped, { markPx: 8 });
      el('figcaption', { textContent: f.label }, fig);
      if (withNew && i === list.length - 1 && !reducedMotion()) cv.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 400, easing: 'ease-out' });
    });
  }
  draw() {
    if (!this.c || !this.stage.w) return;
    const { ctx, w, h } = this.stage, c = this.c;
    this.stage.clear();
    if (this.view === 'compare') { drawCompare(ctx, c, w, h, { jumps: this.t('jumps'), continuous: this.t('continuous') }); return; }
    const S = Math.min(w, h), cx = w / 2, cy = h / 2, U = S * 0.30, rOut = S * 0.455, rIn = S * 0.415;
    const solidIn = this.infinite && this.order.some((f) => f.flipped);
    drawDial(ctx, c, cx, cy, rOut, rIn, this.order, { solidOut: this.infinite, solidIn });
    drawRingNames(ctx, c, cx, cy, rOut, rIn, S, { turned: this.t('turned'), flipped: this.t('flipped') });
    drawPointer(ctx, c, cx, cy, this.flipped ? rIn : rOut, mod(this.theta, 360), S);
    drawGhost(ctx, c, this.name, cx, cy, U);
    drawFigure(ctx, c, this.name, cx, cy, U, this.theta, this.flipped, {
      squash: this.squash, stroke: this.flash > 0 ? c.accent : c.ink, lw: c.line * (1 + 0.5 * this.flash), markPx: Math.max(11, S / 36),
    });
    if (this.hint) drawHint(ctx, c, cx, cy, S, this.t('hint'));
    ctx.save(); ctx.fillStyle = c.grey; ctx.textAlign = 'right'; ctx.font = `${Math.max(13, S / 34)}px "Source Sans 3", system-ui, sans-serif`;
    const deg = String(Math.round(this.theta)).replace('-', '−');
    ctx.fillText(this.t(this.flipped ? 'readoutF' : 'readout').replace('{deg}', deg), w - 4, h - 6); ctx.restore();
  }
}

define('ul-find-symmetries', FindSymmetries);
