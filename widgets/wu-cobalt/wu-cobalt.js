// <ul-wu-cobalt>  Ch1 §8 "Through the Looking-Glass", Widget 1.7. "Wu's cobalt."
// A simplified Wu experiment, as a game (Dan, 2026-11-25). Cool the crystal, switch on the magnet,
// then catch electrons before the crystal warms up again; or Run, and a detector counts them all.
// The layout follows Ch1 §5 (core/strip.js): an instrument on top, its record below on the same
// scale (Dan, 2026-11-25). The instrument is a tray: detector plates stand on the two ends of the
// scale; each counted electron lights its plate and sends a pulse along the scale that nudges the
// orange pointer, which is the share flying right. The record traces that share, against the
// bands a fair coin gives. Reversing the magnet turns the spins round, and the lean crosses over.
// A record belongs to one setup: a new one starts with each Run, and when the setup changes
// (lined up or not, the magnet's direction, each cold spell); earlier records stay, faint.
// Spec: ./spec.md. Model: ../engines/cobalt.js (tests/engines/cobalt.test.mjs).
import { ULWidget, define, el, rng } from '../core/core.js';
import { button, slider, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { valueAxis, Zoom, drawStrip, drawGuide } from '../core/strip.js';
import { band } from '../engines/coins.js';
import { PARAMS, tempAt, sliderFor, isCold, jiggle, alignTarget, ranks, linedUp, pAwayOne, awaySide, verdict, warmStep } from '../engines/cobalt.js';
import { COLS, ROWS, layout, drawInstrument } from './draw.js';

const HIT = 36;          // px: how close a tap must land to an electron's head
const POP = 0.5;         // s: a catch's ring
const FLASH = 0.3;       // s: a plate's flash
const PULSE = 0.45;      // s: a pulse's trip from the plate to the pointer
const SPIN = 2.2;        // rad/s: how fast the arrowheads ride round the rings
const SAY_EVERY = 3;     // s: how often screen readers hear the counts
const ZOOM = [10, 100, 1000, 10000];
const POINTS = 600;      // the record keeps every count up to this, then thins to about this many points
const KEEP = 3;          // earlier records kept, faint

class WuCobalt extends ULWidget {
  // status messages (at most 80 characters each; tests/widgets/strings.test.mjs)
  static status = ['start', 'warm', 'cooler', 'quick', 'lining', 'wait', 'tap', 'keep', 'running', 'lean', 'reversed', 'crossed', 'runN', 'even', 'warmRun', 'cut', 'warming'];
  static buttons = ['magnet', 'reverse', 'run', 'reset'];
  static strings = { en: {
    invite: 'Cool the crystal. Line up the nuclei. Catch the electrons.',
    label: 'Cobalt nuclei, drawn as balls with turning rings, between two detector plates that stand on a scale from 0 to 1. Electrons fly left or right; an orange pointer on the scale shows the share flying right.',
    chart: 'The share flying right, traced as electrons are counted: {n} so far, latest share {s}.',
    keys: 'Keys: Enter catches an electron.',
    start: 'Drag the slider to cool the crystal.',
    warm: 'Too warm: the nuclei jiggle every which way. Keep cooling.',
    cooler: 'Colder… almost there.',
    quick: "Quick, we can't stay near absolute zero for long! Switch on the magnet.",
    lining: 'The magnet pulls, and the nuclei swing round…',
    tap: 'Most of the nuclei now spin the same way. Catch electrons, or press Run.',
    keep: 'Each catch lights a plate and nudges the pointer. Keep going, or Run.',
    running: 'The detector counts thousands of electrons; only a few are drawn.',
    lean: 'More fly away from the spin than a fair coin allows.',
    reversed: 'Magnet reversed: the spins turn round. Which way will the lean go now?',
    crossed: 'The lean crossed over with the spins: away from the spin, as before.',
    runN: 'A new run, the same shape. Each decay is random; the lean is lawful.',
    even: 'Inside the fair-coin range: nothing picks out an end.',
    warmRun: 'Warm: the nuclei point every which way, and it comes out like a fair coin.',
    wait: 'Wait for the magnet: the nuclei are still swinging round.',
    cut: 'The cold ran out mid-run. Cool it again, and run again.',
    warming: 'Warming up. The nuclei scatter. Cool it again to keep counting.',
    magnet: 'Magnet', reverse: 'Reverse', run: 'Run', reset: 'Reset',
    temp: 'Temperature', cold: '{s} s of cold', counts: 'Left {left}, right {right}.',
    share: 'share flying right', axisCount: 'electrons', fair: 'fair coin',
  } };

  mount() {
    this.random = rng(this.num('seed', Date.now() % 1e9));
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    const frag = document.createDocumentFragment();
    this.top = createStage(frag, { aspect: '9 / 4', phoneAspect: '3 / 2', label: `${this.t('label')} ${this.t('keys')}`, focusable: true });
    this.bottom = createStage(frag, { aspect: '16 / 9', phoneAspect: '16 / 10', label: '' });
    this.temp = slider({ label: this.t('temp'), min: 0, max: 100, step: 1, value: 0, format: (v) => fmtK(tempAt(v)),
      onInput: (v) => { this.warming = false; this.coldFor = 0; this.T = tempAt(v); this.go(); } });   // the reader's drag takes over, even mid warm-up
    this.tempInput = this.temp.querySelector('input'); this.tempOut = this.temp.querySelector('output');
    this.status = new StatusLine({ gap: 0, hold: 0 });
    this.status.reserve(this.constructor.status.map((k) => this.t(k)));
    this.sr = el('p', { className: 'ul-sr' }); this.sr.setAttribute('aria-live', 'polite');
    Object.assign(this.sr.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' });
    this.btn = {
      magnet: button(this.t('magnet'), () => this.pressMagnet(), { labels: [this.t('reverse')] }),
      run: button(this.t('run'), () => this.startRun()),
      reset: button(this.t('reset'), () => this.reset(), { kind: 'quiet' }),
    };
    const cv = this.top.canvas;
    cv.addEventListener('pointerdown', (e) => this.tap(e));
    cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.catchOldest(); } });
    this.replaceChildren(invite, this.top.box, this.bottom.box, this.temp, this.status.el, row(this.btn.magnet, this.btn.run, this.btn.reset), this.sr);
    this.zoom = new Zoom(ZOOM);
    this.c = this.colors();
    this.reset();
  }

  // ----- hooks
  resize() {
    this.top.fit(); this.bottom.fit();
    this.axis = valueAxis(this.top.w); this.L = layout(this.top.w, this.top.h, this.axis);
    this.draw();
  }
  retune() { this.c = this.colors(); this.draw(); }
  frame(dt) {
    dt = Math.max(0, dt);   // the first frame's dt can come out a hair below zero (core.js)
    if (!this.L) return;    // not measured yet (resize() comes from a ResizeObserver)
    this.time += dt;
    // the cold window, then the warm-up
    const cold = isCold(this.T);
    if (cold && !this.wasCold) this.serial++;   // each cold spell starts a new record
    this.wasCold = cold;
    if (cold && !this.warming) {
      this.coldFor += dt;
      if (this.coldFor >= PARAMS.coldSeconds) { this.warming = true; this.serial++; if (this.running) this.rec.cut = true; this.running = false; this.pending = false; }
    }
    if (this.warming) {
      this.T = warmStep(this.T, dt); this.setSlider(sliderFor(this.T));
      if (this.T >= PARAMS.rewarmK) { this.warming = false; this.coldFor = 0; }
    }
    // the nuclei: lined-up ones turn so the spin points along the field; the rest drift to their
    // own tilt; heat jiggles all; every ring turns
    const jig = jiggle(this.T), k = Math.min(1, dt * 2.5), aim = this.field >= 0 ? -Math.PI / 2 : Math.PI / 2;
    this.align += (alignTarget(this.T, this.field !== 0) - this.align) * Math.min(1, dt * 2);
    for (const n of this.nuclei) {
      const target = linedUp(n.rank, this.align) ? aim : n.home;
      n.base += wrapAngle(target - n.base) * k;
      n.wob = ou(n.wob, jig * 1.6, dt, this.random); n.jx = ou(n.jx, jig, dt, this.random); n.jy = ou(n.jy, jig, dt, this.random);
      n.phase -= SPIN * dt;
    }
    // electrons: drawn ones are emitted and flown; by hand they count when caught and they reach a
    // plate. During a Run the detector counts thousands; only a few of them are drawn.
    if (this.random() < dt * (this.running ? PARAMS.drawnRate : PARAMS.handRate)) this.emit();
    if (this.running && !this.warming) {
      this.owed += dt * PARAMS.detectorRate;
      for (; this.owed >= 1 && this.rec.n < PARAMS.runCount; this.owed--) this.countOne(this.electronDir(this.nuclei[Math.floor(this.random() * this.nuclei.length)]));
    }
    const speed = this.L.sky / (this.running ? PARAMS.flightDetector : PARAMS.flightHand);
    for (const s of this.shots) s.l += dt * speed;
    this.shots = this.shots.filter((s) => {
      const hx = s.x + s.d * s.l, plate = s.d > 0 ? this.L.x1 : this.L.x0;
      if ((hx - plate) * s.d < 0) return true;
      if (!this.warming && (s.mine || this.running)) this.arrive(s);
      return false;
    });
    // flashes, pops, pulses; the pointer follows the pulses
    this.flashes = this.flashes.filter((f) => (f.t += dt) < FLASH);
    this.pops = this.pops.filter((p) => (p.t += dt) < POP);
    this.pulses = this.pulses.filter((p) => { p.t += dt; if (p.t >= PULSE) { this.ptrTarget = p.share; return false; } return true; });
    if (this.ptrTarget != null) this.ptr = this.ptr == null ? this.ptrTarget : this.ptr + (this.ptrTarget - this.ptr) * Math.min(1, dt * 8);
    if (this.running && this.rec.n >= PARAMS.runCount) this.running = false;
    if (this.pending && this.aligned) this.startRun();
    this.zoom.step(dt);
    if (this.time - this.saidAt > SAY_EVERY && this.rec.n !== this.saidN) this.speakCounts();
    this.say(); this.draw();
  }

  // ----- actions
  reset() {
    this.T = tempAt(0); this.time = 0; this.coldFor = 0; this.warming = false; this.wasCold = false;
    this.align = 0; this.serial = 0; this.field = 0; this.running = false; this.owed = 0; this.pending = false;
    this.shots = []; this.pops = []; this.flashes = []; this.pulses = [];
    this.old = []; this.leans = []; this.rec = null; this.rec = this.newRecord(null); this.ptr = null; this.ptrTarget = null;
    this.saidAt = 0; this.saidN = 0; this.bandAt = null; this.reversedAt = null;
    this.btn.magnet.label = this.t('magnet'); this.btn.magnet.setAttribute('aria-pressed', 'false');
    this.setSlider(0); this.zoom.reset();
    const r = ranks(COLS * ROWS, this.random);
    this.nuclei = [];
    for (let k = 0; k < ROWS; k++) for (let c = 0; c < COLS; c++) {
      const home = (this.random() - 0.5) * 2 * Math.PI;
      this.nuclei.push({ c, k, rank: r[k * COLS + c], home, base: home, wob: 0, jx: 0, jy: 0, phase: this.random() * 6.28 });
    }
    this.status.reset(); this.say(); this.draw();
    this.autoplay();   // under reduced motion it waits; the reader's first move starts it (go)
  }
  pressMagnet() {   // first press: on. After that: reverse it.
    if (this.field === 0) { this.field = 1; this.btn.magnet.label = this.t('reverse'); this.btn.magnet.setAttribute('aria-pressed', 'true'); }
    else { this.field = -this.field; this.reversedAt = this.time; }
    this.go();
  }
  startRun() {
    if (isCold(this.T) && this.field !== 0 && !this.aligned && !this.warming) { this.pending = true; return this.go(); }   // wait for the magnet
    this.pending = false; this.running = true; this.owed = 0; this.rec = this.newRecord(this.setup()); this.rec.run = true; this.go();
  }
  go() { this.play(); this.say(); this.draw(); }
  setSlider(v) {   // move the slider without it calling back (the crystal warming by itself)
    this.tempInput.value = String(v);
    const txt = fmtK(tempAt(v)); this.tempOut.textContent = txt; this.tempInput.setAttribute('aria-valuetext', txt);
  }

  // the setup a record belongs to: this cold spell, lined up or not, which way the magnet points
  get aligned() { return this.align >= PARAMS.maxAlign / 2; }
  setup() { return `${this.serial}:${this.aligned ? this.field : 0}`; }
  newRecord(key) {
    if (this.rec && this.rec.data.length >= 4) { this.old.push(this.rec.data); if (this.old.length > KEEP) this.old.shift(); }
    this.zoom?.reset();
    return { key, left: 0, right: 0, n: 0, data: [], leaned: false, field: this.aligned ? this.field : 0 };
  }

  electronDir(n) {   // +1 right, -1 left
    const lined = linedUp(n.rank, this.align) && this.field !== 0;
    if (!lined) return this.random() < 0.5 ? 1 : -1;
    return (this.random() < pAwayOne(true) ? 1 : -1) * awaySide(this.field);
  }
  emit() {
    const n = this.nuclei[Math.floor(this.random() * this.nuclei.length)], p = this.place(n);
    this.shots.push({ x: p.x, y: p.y, d: this.electronDir(n), l: this.L.r * 1.3, mine: false });
  }
  countOne(d) {   // one electron counted at the plate on side d; returns the new share
    const key = this.setup();
    if (key !== this.rec.key) this.rec = this.newRecord(key);
    const rec = this.rec;
    d > 0 ? rec.right++ : rec.left++; rec.n++;
    const share = rec.right / rec.n;
    if (rec.n <= POINTS || rec.n % Math.ceil(rec.n / POINTS) === 0) rec.data.push(rec.n, share);
    this.zoom.need(rec.n);
    if (this.running) this.ptrTarget = share;   // the detector: the pointer follows the count
    return share;
  }
  arrive(s) {   // a drawn electron reaches its plate: the plate lights up
    this.flashes.push({ side: s.d, y: s.y, t: 0 });
    if (this.running) return;   // a Run's drawn electrons are a sample: already counted
    const share = this.countOne(s.d);
    this.pulses.push({ side: s.d, y: s.y, t: 0, share });   // a catch: the pulse carries it to the pointer
  }
  catchIt(s) { s.mine = true; this.pops.push({ x: s.x + s.d * s.l, y: s.y, t: 0 }); this.go(); }
  tap(e) {
    if (this.running || !this.L) return this.go();
    const b = this.top.canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, bd = HIT;
    for (const s of this.shots) {
      if (s.mine || this.warming) continue;
      const dd = Math.hypot(s.x + s.d * s.l - x, s.y - y);
      if (dd < bd) { bd = dd; best = s; }
    }
    if (best) this.catchIt(best); else this.go();
  }
  catchOldest() {   // keyboard: catch the electron that has flown furthest
    const free = this.shots.filter((s) => !s.mine);
    if (this.running || this.warming || !free.length) return this.go();
    this.catchIt(free.reduce((a, s) => (s.l > a.l ? s : a)));
  }

  // ----- words
  standing() {
    if (this.warming || (this.rec.cut && this.rec.key !== this.setup() && !isCold(this.T))) return this.rec.cut ? 'cut' : 'warming';
    if (this.pending) return 'wait';
    const rec = this.rec, mine = rec.key === this.setup(), f = rec.field;
    const v = mine && f ? verdict(f > 0 ? rec.left : rec.right, f > 0 ? rec.right : rec.left) : null;   // field +1: spin points left, so 'away' is right
    if (this.aligned) {
      if (mine && (rec.leaned || v === 'lean')) {
        if (!rec.leaned) { rec.leaned = true; rec.before = this.leans[this.leans.length - 1] ?? 0; this.leans.push(f); }
        return rec.before === -f ? 'crossed' : rec.before === f ? 'runN' : 'lean';   // compared with the last record that leaned
      }
      if (this.reversedAt != null && this.time - this.reversedAt < 6) return 'reversed';
      if (this.running) return 'running';
      return mine && rec.n >= 3 ? 'keep' : 'tap';
    }
    const n = mine ? rec.n : 0, u = n >= PARAMS.minCount ? verdict(rec.left, rec.right) : null;
    if (isCold(this.T) && this.field !== 0) return 'lining';
    if (u === 'even') return isCold(this.T) ? 'even' : 'warmRun';
    if (isCold(this.T)) return 'quick';
    if (this.tempInput.value === '0' && !this.running) return 'start';
    return this.T > 1 ? 'warm' : 'cooler';
  }
  say() { this.status.set(this.t(this.standing()), this.time); }
  speakCounts() {
    this.saidAt = this.time; this.saidN = this.rec.n;
    this.sr.textContent = this.t('counts').replace('{left}', this.rec.left).replace('{right}', this.rec.right);
    this.bottom.canvas.setAttribute('aria-label', this.t('chart').replace('{n}', this.rec.n).replace('{s}', this.rec.n ? `${Math.round(100 * this.rec.right / this.rec.n)}%` : '–'));
  }

  // ----- drawing
  place(n) {
    const p = this.L.at(n.c, n.k), j = this.L.r * 0.5;
    return { x: p.x + n.jx * j, y: p.y + n.jy * j };
  }
  pulseAt(p) {   // down the plate, then along the scale to the pointer
    const L = this.L, px = L.x0 + (this.ptr ?? 0.5) * (L.x1 - L.x0), plate = p.side > 0 ? L.x1 : L.x0;
    const a = L.scaleY - p.y, b = Math.abs(px - plate), u = (p.t / PULSE) * (a + b);
    return u < a ? { x: plate, y: p.y + u } : { x: plate + Math.sign(px - plate) * (u - a), y: L.scaleY };
  }
  draw() {
    if (!this.c || !this.L || !this.top.w) return;
    const c = this.c, cold = isCold(this.T) && !this.warming, rec = this.rec;
    this.top.clear();
    drawInstrument(this.top.ctx, c, this.L, {
      nuclei: this.nuclei.map((n) => ({ ...this.place(n), tilt: n.base + n.wob, phase: n.phase })),
      shots: this.shots, flashes: this.flashes, pops: this.pops, pulses: this.pulses.map((p) => this.pulseAt(p)),
      left: rec.left, right: rec.right, pointer: this.ptr, frozen: this.warming,
      clock: cold ? this.t('cold').replace('{s}', Math.max(0, Math.ceil(PARAMS.coldSeconds - this.coldFor))) : null,
    });
    if (this.ptr != null) drawGuide(this.top.ctx, c, this.axis.V(this.ptr), this.L.scaleY + 13, this.top.h);
    // the record, with the fair coin's bands once there is enough to judge
    if (rec.n >= PARAMS.minCount && this.bandAt == null) this.bandAt = this.time;
    this.bottom.clear();
    drawStrip(this.bottom.ctx, c, this.bottom.w, this.bottom.h, {
      axis: this.axis, xMax: this.zoom.x,
      traces: [...this.old.map((d) => ({ data: d, alpha: 0.25 })), { data: rec.data, alpha: 0.85 }],
      pen: rec.n ? { n: rec.n, f: rec.right / rec.n } : null, pointer: this.ptr, mean: 0.5,
      bands: (n) => ({ inner: band(n, 1), outer: band(n, 2) }),
      bandFade: this.bandAt == null ? 0 : Math.min(1, (this.time - this.bandAt) / 0.9),
      valueName: this.t('share'), countName: this.t('axisCount'), meanLabel: this.t('fair'),
    });
  }
}

// a small random wander that stays near 0, with spread s (Ornstein–Uhlenbeck, relaxing in ~0.4 s)
const ou = (x, s, dt, random) => x + (-x / 0.4) * dt + s * Math.sqrt(2 * dt / 0.4) * (random() + random() + random() - 1.5) * 2;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fmtK = (t) => (t >= 1 ? `${Math.round(t)} K` : t >= 0.1 ? `${t.toFixed(1)} K` : `${t.toFixed(3)} K`);

define('ul-wu-cobalt', WuCobalt);
