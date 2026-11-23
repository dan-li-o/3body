// <ul-groove>  Ch1 "Three Names, One Bet", Widget 1.5. "The groove."
// A marble in a circular groove, seen from above, sweeping thin slices of pie in equal times.
// Round groove: equal slices (steady pace around), however the groove is turned. Bend it: the
// groove is no longer a perfect circle (a dashed perfect circle stays as the reference), and out on
// the bend the marble goes around more slowly. Make it round: equal slices again.
// Spec: ./spec.md. Engine: ../engines/groove.js (tests/engines/groove.test.mjs).
import { ULWidget, define, el, reducedMotion } from '../core/core.js';
import { button, row, StatusLine } from '../core/controls.js';
import { createStage } from '../core/stage.js';
import { PARAMS, wrap, createGroove, step, flick, radius, isBent } from '../engines/groove.js';
import { drawGroove, FADE } from './draw.js';

const H = 1 / 480;          // physics step (s)
const AGAIN_S = 4;          // how long "That push came from outside" stays

class Groove extends ULWidget {
  // status messages (at most 80 characters each; tests/widgets/strings.test.mjs)
  static status = ['start', 'flicked', 'turned', 'bent', 'turnedBent', 'round', 'again'];
  static buttons = ['flick', 'unbend', 'reset', 'play', 'pause'];
  static strings = { en: {
    invite: 'Flick the marble. Then turn the groove, and bend it.',
    label: 'A marble in a groove seen from above, cutting thin slices of pie in equal times. A dashed perfect circle runs along the groove.',
    keys: 'Keys: Enter flicks, arrows turn the groove, B bends it.',
    start: 'Press on the marble and drag along the groove. Longer drag, faster flick.',
    flicked: 'Equal times, equal slices. Now drag anywhere else to turn the groove.',
    turned: 'You turned the groove, and nothing changed. Now tap to bend it.',
    bent: 'No longer a perfect circle. Out on the bend the marble goes around more slowly.',
    turnedBent: 'Turn it now, and the bend and the odd slices turn with it.',
    round: 'Round again. Turn it any way: the same groove, the same slices.',
    again: 'That push came from outside. Only a push like that changes the slices for good.',
    flick: 'Flick', unbend: 'Make it round', reset: 'Reset', play: 'Play', pause: 'Pause',
    hint: 'drag to turn', readout: 'groove turned {deg}°', slices: 'Last slices: {list}.',
  } };

  mount() {
    const invite = el('p', { className: 'ul-invite', textContent: this.t('invite') });
    this.stage = createStage(document.createDocumentFragment(), { aspect: '16 / 10', phoneAspect: '1 / 1', label: `${this.t('label')} ${this.t('keys')}` });
    this.status = new StatusLine({ gap: 0, hold: AGAIN_S });
    this.status.reserve(this.constructor.status.map((k) => this.t(k)));
    this.sr = el('p', { className: 'ul-sr' }); this.sr.setAttribute('aria-live', 'polite');
    Object.assign(this.sr.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' });
    this.btn = {
      flick: button(this.t('flick'), () => this.doFlick(PARAMS.defaultLaps)),
      unbend: button(this.t('unbend'), () => this.makeRound(), { hidden: true }),
      play: button(this.t('play'), () => (this.playing ? this.pause() : this.play()), { kind: 'quiet', hidden: true, labels: [this.t('pause')] }),
      reset: button(this.t('reset'), () => this.reset(), { kind: 'quiet' }),
    };
    const b = this.btn;
    this.replaceChildren(invite, this.stage.box, this.status.el, row(b.flick, b.unbend, b.play, b.reset), this.sr);
    this.gesture(this.stage.canvas);
    this.c = this.colors();
    this.reset();
  }

  // ----- hooks
  resize() { this.stage.fit(); this.draw(); }
  retune() { this.c = this.colors(); this.draw(); }
  stateChanged() {
    const rm = reducedMotion();
    this.btn.play.hidden = !(rm && this.flicked);
    this.btn.play.label = this.t(this.playing ? 'pause' : 'play');
  }
  frame(dt) {
    this.acc += dt;
    while (this.acc >= H) {
      step(this.m, H); this.acc -= H;
      if (this.m.t - this.tickStart >= PARAMS.tick - 1e-9) {
        this.slices.push({ t: this.m.t, a0: this.tickTh, d: this.m.th - this.tickTh });
        while (this.slices.length && this.m.t - this.slices[0].t > FADE) this.slices.shift();
        this.tickStart = this.m.t; this.tickTh = this.m.th;
      }
    }
    this.draw();
  }

  // ----- actions
  reset() {
    this.m = createGroove(); this.slices = []; this.acc = 0; this.tickStart = 0; this.tickTh = this.m.th;
    this.flicked = false; this.smoothed = false; this.turnedSpan = 0; this.turnedBent = false; this.hint = false;
    this.status.reset(); this.pause(); this.say(); this.draw();
  }
  doFlick(laps) {
    const again = this.flicked && this.m.laps > 1;
    flick(this.m, Math.max(PARAMS.minLaps, Math.min(PARAMS.maxLaps, laps)));
    if (!this.flicked) this.hint = true;
    this.flicked = true; this.tickStart = this.m.t; this.tickTh = this.m.th;
    if (again) this.status.remark(this.t('again'), performance.now() / 1000, { force: true });
    if (!reducedMotion()) this.play(); else this.stateChanged();
    this.say(); this.draw();
    setTimeout(() => this.speakSlices(), 1500);
  }
  bendAt(a) {
    const m = this.m;
    if (isBent(m) && Math.abs(wrap(a - m.atTarget)) < 0.35) return this.makeRound();
    m.atTarget = a; m.bendTarget = 1; this.turnedBent = false;
    this.say(); this.draw(); setTimeout(() => this.speakSlices(), 2500);
  }
  makeRound() { this.m.bendTarget = 0; this.smoothed = true; this.turnedBent = false; this.say(); this.draw(); }
  turnBy(d) {
    this.m.rot += d; this.hint = false;
    this.turnedSpan += Math.abs(d) * 180 / Math.PI; if (isBent(this.m)) this.turnedBent = true;
    this.say(); this.draw();
  }

  // ----- input: drag the marble along the groove to flick it; drag anywhere else to turn the
  // groove; tap to bend it there (tap the bend again to make it round). Keys: Enter, arrows, B.
  gesture(cv) {
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };
    cv.addEventListener('pointerdown', (e) => {
      if (!this.geo) return;
      const [x, y] = pt(e), { mx, my, cx, cy } = this.geo, S = Math.min(this.stage.w, this.stage.h);
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      this.g = { x, y, a: Math.atan2(y, x), moved: false, onMarble: Math.hypot(x - (mx - cx), y - (my - cy)) < Math.max(30, S / 12) };
    });
    cv.addEventListener('pointermove', (e) => {
      const g = this.g; if (!g) return; const [x, y] = pt(e);
      if (!g.moved && Math.hypot(x - g.x, y - g.y) > 8) g.moved = true;
      if (g.onMarble) { g.dx = x - g.x; g.dy = y - g.y; return; }
      if (g.moved && Math.hypot(x, y) > 20) { const a = Math.atan2(y, x), d = wrap(a - g.a); g.a = a; this.turning = true; this.turnBy(d); }
    });
    cv.addEventListener('pointerup', (e) => {
      const g = this.g; if (!g) return; this.g = null;
      if (g.onMarble && g.moved) {
        const th = this.m.th, along = Math.abs((g.dx || 0) * -Math.sin(th) + (g.dy || 0) * Math.cos(th));
        const f = Math.min(1, along / (Math.min(this.stage.w, this.stage.h) * 0.5));
        this.doFlick(PARAMS.minLaps + (PARAMS.maxLaps - PARAMS.minLaps) * f); return;
      }
      this.turning = false;
      if (g.moved) { this.draw(); return; }
      const [x, y] = pt(e); this.bendAt(Math.atan2(y, x) - this.m.rot);
    });
    cv.addEventListener('pointercancel', () => { this.g = null; this.turning = false; });
    cv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.doFlick(PARAMS.defaultLaps); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); this.turnBy((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 15) * Math.PI / 180); }
      else if (e.key === 'b' || e.key === 'B') { e.preventDefault(); this.bendAt(this.m.th + Math.PI - this.m.rot); }
    });
    cv.style.touchAction = 'none';
  }

  // ----- words
  standing() {
    if (!this.flicked) return 'start';
    if (isBent(this.m)) return this.turnedBent ? 'turnedBent' : 'bent';
    if (this.smoothed) return 'round';
    return this.turnedSpan > 30 ? 'turned' : 'flicked';
  }
  say() { this.status.set(this.t(this.standing()), performance.now() / 1000); this.btn.unbend.hidden = !isBent(this.m); }
  speakSlices() {   // for screen readers: the last few slice angles
    const list = this.slices.slice(-4).map((s) => `${Math.round(Math.abs(s.d) * 180 / Math.PI)}°`);
    if (list.length) this.sr.textContent = this.t('slices').replace('{list}', list.join(', '));
  }

  // ----- drawing
  draw() {
    if (!this.c || !this.stage.w || !this.m) return;
    this.stage.clear();
    const m = this.m, turned = Math.abs(m.rot) > 0.01 || this.turning;
    const deg = Math.round(((m.rot * 180 / Math.PI) % 360 + 360) % 360);
    this.geo = drawGroove(this.stage.ctx, this.c, this.stage.w, this.stage.h, {
      m, slices: this.slices, tickTh: this.tickTh, sweeping: this.flicked && Math.abs(m.v) > 0.01,
      hint: this.hint ? this.t('hint') : null, readout: turned ? this.t('readout').replace('{deg}', deg) : null, invite: !this.flicked,
    });
    this.status.set(this.t(this.standing()), performance.now() / 1000);
  }
}

define('ul-groove', Groove);
