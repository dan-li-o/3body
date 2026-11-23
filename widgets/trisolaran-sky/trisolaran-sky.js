// <ul-trisolaran-sky>  Welcome page. "Tame the Trisolaran sky."
// Two suns circle calmly; the reader places a third with one drag and the
// order falls apart. "Show me one that works" plays the figure-eight.
// Spec: ./spec.md. Engine: ../engines/nbody.js (all physics claims tested).
import { ULWidget, define, el, useStyles, rng } from '../core/core.js';
import { button, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import * as nb from '../engines/nbody.js';
import { view, drawTrail, drawBall, drawArrow } from './draw.js';

useStyles(new URL('./trisolaran-sky.css', import.meta.url));

const SPEED = 1.4;          // sim time per second of real time
const LIFE = 6.3;           // trail lifetime (sim time): about one figure-eight loop
const WORLD = 3.6;          // world units across the shorter side of the stage
const MAX_PUSH = 1.2;       // cap on launch speed (world units)
const NUDGE = 0.01;         // tested in tests/engines/nbody.test.mjs

class TrisolaranSky extends ULWidget {
  // status messages (at most 80 characters each; tests/widgets/strings.test.mjs)
  static status = ['calm', 'aiming', 'notYet', 'drifting', 'chaotic', 'ejected', 'looksGone', 'orNot', 'near', 'bounced', 'repeats', 'nudged'];
  static buttons = ['works', 'reset', 'random', 'nudge', 'play'];
  static strings = { en: {
    invite: 'Two suns circle each other. Place a third and give it a push. Can you make the system repeat itself?',
    label: 'Animated diagram of three suns moving under each other’s gravity, drawn with their trails.',
    calm: 'Two suns, one steady orbit. Touch the sky and drag to launch a third.',
    aiming: 'Release to let it go.',
    notYet: 'Repeating? Not yet.', drifting: 'Drifting.', chaotic: 'Chaotic era.',
    ejected: 'One sun has been thrown out of the system. It will never come back.',
    looksGone: 'That sun looks gone for good.', orNot: '…Or not.',
    near: 'A near collision.', bounced: 'Two suns bounced off each other.',
    repeats: 'This one repeats. Solutions like it are rare.',
    nudged: 'Nudged by a hair: it wobbles, but holds. A bigger push would break it.',
    works: 'One that works', reset: 'Reset', random: 'Random launch', nudge: 'Nudge it', play: 'Play',
    closing: 'Scientists have been trying since Newton.',
  } };

  mount() {
    this.random = rng(this.num('seed', Date.now() % 1e9));
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    this.stage = createStage(document.createDocumentFragment(), { aspect: '16 / 9', phoneAspect: '1 / 1', label: this.t('label') });
    this.status = new StatusLine({ gap: 6, hold: 1.5 });
    this.status.reserve(this.constructor.status.map((k) => this.t(k)));   // room for every message: nothing below moves
    this.btn = {
      works: button(this.t('works'), () => this.showWorking()),
      nudge: button(this.t('nudge'), () => this.nudge(), { hidden: true }),
      reset: button(this.t('reset'), () => this.calm(), { kind: 'quiet' }),
      random: button(this.t('random'), () => this.randomLaunch(), { kind: 'quiet' }),
      play: button(this.t('play'), () => this.play(), { kind: 'quiet', hidden: true }),
    };
    this.closing = el('p', { className: 'ul-closing', textContent: this.t('closing') });
    this.closing.hidden = true;
    const b = this.btn;
    this.replaceChildren(invite, this.stage.box, this.status.el, row(b.works, b.nudge, b.random, b.reset, b.play), this.closing);
    this.bindInput();
    this.retune();
    this.calm();
    this.autoplay();
  }

  // ----- hooks
  resize() { this.stage.fit(); this.scale = Math.min(this.stage.w, this.stage.h) / WORLD; this.draw(); }
  retune() { this.c = this.colors(); this.draw(); }
  stateChanged() { this.btn.play.hidden = this.playing; }
  frame(dt) { if (!this.aim) this.step(dt * SPEED); this.draw(); }

  // ----- scenes
  load(sys, mode) {
    this.sys = sys; this.mode = mode; this.time = 0; this.mine = -1;
    this.trails = Array.from({ length: sys.m.length }, () => []);
    this.cam = { x: 0, y: 0 };
    this.escaped = -1; this.gone = -1; this.near = {};
    this.btn.nudge.hidden = true;
    this.btn.works.hidden = mode === 'eight';   // it is on show: Nudge takes its place (one row of buttons)
    this.status.reset();
    this.updateStatus();
    this.draw();
  }
  calm() { this.closing.hidden = true; this.load(nb.calmPair(), 'calm'); }
  showWorking() { this.load(nb.figureEight(), 'eight'); this.closing.hidden = false; }
  nudge() { this.sys.s[0] += NUDGE; this.mode = 'nudged'; this.btn.nudge.hidden = true; this.updateStatus(); }
  launch(x, y, vx, vy) {
    const p = nb.calmPair();
    this.load(nb.toRestFrame(nb.system([...p.s, x, y, vx, vy])), 'free');
    this.mine = 2; this.closing.hidden = false;
    if (!this.playing) this.play();
  }
  randomLaunch() {
    const r = this.random, a = r() * 2 * Math.PI, d = 0.9 + r() * 0.6, sp = 0.3 + r() * 0.6, b = r() * 2 * Math.PI;
    this.launch(d * Math.cos(a), d * Math.sin(a), sp * Math.cos(b), sp * Math.sin(b));
  }

  // ----- input: one gesture. Press to place, drag to aim, release to launch.
  bindInput() {
    const cv = this.stage.canvas;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this.aim = { x0: e.offsetX, y0: e.offsetY, x1: e.offsetX, y1: e.offsetY };
      this.closing.hidden = true;
      this.load(nb.calmPair(), 'aim');
    });
    cv.addEventListener('pointermove', (e) => { if (this.aim) { this.aim.x1 = e.offsetX; this.aim.y1 = e.offsetY; this.draw(); } });
    cv.addEventListener('pointerup', () => {
      const a = this.aim; if (!a) return; this.aim = null;
      const p = this.view().world(a.x0, a.y0);
      let vx = (a.x1 - a.x0) / this.scale, vy = -(a.y1 - a.y0) / this.scale;
      const len = Math.hypot(vx, vy); if (len > MAX_PUSH) { vx *= MAX_PUSH / len; vy *= MAX_PUSH / len; }
      this.launch(p.x, p.y, vx, vy);
    });
    cv.addEventListener('pointercancel', () => { this.aim = null; this.calm(); });
    cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.randomLaunch(); } });
  }

  // ----- simulation
  step(T) {
    if (T <= 0 || !this.scale) return;
    const exact = this.mode === 'eight' || this.mode === 'nudged' || this.mode === 'calm';
    nb.advance(this.sys, T, exact ? { eps: 0 } : {});
    this.time += T;
    if (this.mode === 'free') { this.contacts(); this.escapes(); this.follow(); }
    if (this.mode === 'eight' && this.time >= nb.FIGURE_EIGHT_PERIOD) this.btn.nudge.hidden = false;
    this.recordTrails();
    this.updateStatus();
  }

  radius(i) { return this.c.bob * Math.sqrt(this.sys.m[i]); }   // px; area grows with mass

  // Touching suns bounce. A close pass that never touches is "a near collision",
  // reported once the pair starts to separate again.
  contacts() {
    const n = this.sys.m.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const gap = nb.distance(this.sys, i, j) * this.scale - this.radius(i) - this.radius(j);
      if (gap <= 0 && nb.bounce(this.sys, i, j)) this.remark('bounced');
      const pr = this.near[i * n + j] ??= { last: gap, min: gap, touched: false, closing: false };
      if (gap < pr.last) {
        if (!pr.closing) Object.assign(pr, { closing: true, min: gap, touched: false });
        pr.min = Math.min(pr.min, gap);
      } else if (pr.closing) {
        pr.closing = false;
        if (!pr.touched && pr.min > 0 && pr.min < 2 * this.c.bob) this.remark('near');
      }
      if (gap <= 0) pr.touched = true;
      pr.last = gap;
    }
  }

  // Lost for good (strict test), or only looking gone (the joke).
  escapes() {
    if (this.escaped >= 0) return;
    for (let i = 0; i < 3; i++) {
      if (nb.hasEscaped(this.sys, i)) { this.escaped = i; this.gone = -1; return; }
      if (this.gone < 0 && nb.looksGone(this.sys, i)) this.gone = i;
      else if (this.gone === i && nb.distanceFromPair(this.sys, i) < 1.5) {
        this.gone = -1; this.status.remark(this.t('orNot'), this.time, { hold: 3, force: true });
      }
    }
  }

  // The camera follows the system; once a sun has escaped, the pair that stays.
  follow() {
    const others = this.escaped >= 0 ? [0, 1, 2].filter((q) => q !== this.escaped) : undefined;
    const c = nb.centerOfMass(this.sys, others);
    this.cam.x += (c.x - this.cam.x) * 0.05; this.cam.y += (c.y - this.cam.y) * 0.05;
  }

  recordTrails() {
    const s = this.sys.s;
    for (let i = 0; i < this.trails.length; i++) this.trails[i].push(s[4 * i], s[4 * i + 1], this.time);
    for (const tr of this.trails) {
      let k = 0; while (k < tr.length && this.time - tr[k + 2] > LIFE) k += 3;
      if (k) tr.splice(0, k);
    }
  }

  remark(key) { if (this.escaped < 0) this.status.remark(this.t(key), this.time); }

  updateStatus() {
    const st = (key) => this.status.set(this.t(key), this.time);
    switch (this.mode) {
      case 'calm': return st('calm');
      case 'aim': return st('aiming');
      case 'eight': return st('repeats');
      case 'nudged': return st('nudged');
    }
    if (this.escaped >= 0) return st('ejected');
    if (this.gone >= 0) return st('looksGone');
    st(this.time < 3 ? 'notYet' : this.time < 9 ? 'drifting' : 'chaotic');
  }

  // ----- drawing
  view() { return view(this.stage.w / 2, this.stage.h / 2, this.scale, this.cam.x, this.cam.y); }

  draw() {
    if (!this.stage?.w || !this.sys) return;
    const { ctx } = this.stage, c = this.c, v = this.view();
    const accent = (i) => (i === this.mine ? c.accent : c.ink);
    this.stage.clear();
    this.trails.forEach((tr, i) => drawTrail(ctx, tr, { now: this.time, life: LIFE, v, color: accent(i), alpha: c.trail, line: c.line }));
    for (let i = 0; i < this.sys.m.length; i++) {
      const [x, y] = v.px(this.sys.s[4 * i], this.sys.s[4 * i + 1]);
      drawBall(ctx, x, y, this.radius(i), accent(i));
    }
    if (this.aim) {
      const a = this.aim;
      drawBall(ctx, a.x0, a.y0, c.bob, c.accent);
      drawArrow(ctx, a.x0, a.y0, a.x1, a.y1, c.accent, c.line);
    }
  }
}

define('ul-trisolaran-sky', TrisolaranSky);
