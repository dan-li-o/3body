// House-style controls, shared by every widget. Quiet, but they look like
// controls: 44 px touch areas, keyboard support, visible focus (design.md).
import { el } from './core.js';

let uid = 0;
const nextId = (p) => `ul-${p}-${++uid}`;

// A real button. kind: 'primary' (outlined) or 'quiet' (underlined text).
export function button(label, onClick, { kind = 'primary', hidden = false } = {}) {
  const b = el('button', { type: 'button', className: kind === 'quiet' ? 'ul-btn ul-btn-quiet' : 'ul-btn', textContent: label });
  b.hidden = hidden;
  b.addEventListener('click', onClick);
  return b;
}

// A labelled slider with a live value: slider({ label, min, max, step, value, format, onInput })
export function slider({ label, min, max, step = 1, value, format = String, onInput }) {
  const id = nextId('range');
  const wrap = el('div', { className: 'ul-field' });
  el('label', { htmlFor: id, textContent: label }, wrap);
  const input = el('input', { id, type: 'range', min, max, step, value, className: 'ul-range' }, wrap);
  const out = el('output', { htmlFor: id, textContent: format(value) }, wrap);
  input.setAttribute('aria-valuetext', format(value));
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    out.textContent = format(v); input.setAttribute('aria-valuetext', format(v));
    onInput?.(v);
  });
  return wrap;
}

// A row to hold controls.
export function row(...children) {
  const r = el('div', { className: 'ul-controls' });
  r.append(...children);
  return r;
}

// The status line: one sentence that narrates what the figure is doing,
// announced to screen readers. Two kinds of message:
//   set(msg)     the standing state ("Drifting.")
//   remark(msg)  a passing event ("A near collision."), shown for `hold`
//                seconds; at most one remark per `gap` seconds, so the
//                line never flickers.
// Times are in the widget's own clock (seconds), passed in by the caller.
export class StatusLine {
  constructor({ gap = 6, hold = 1.5 } = {}) {
    this.el = el('p', { className: 'ul-status' });
    this.el.setAttribute('aria-live', 'polite');
    this.gap = gap; this.hold = hold;
    this.reset();
  }
  reset() { this._remark = null; this._standing = ''; this._show(''); }
  set(msg, now) { this._standing = msg; this._render(now); }
  remark(msg, now, { hold = this.hold, force = false } = {}) {
    if (!force && this._remark && now - this._remark.at < this.gap) return;
    this._remark = { msg, at: now, hold };
    this._render(now);
  }
  // The remark currently on show, if any.
  current(now) { return this._remark && now - this._remark.at < this._remark.hold ? this._remark.msg : null; }
  _render(now) { this._show(this.current(now) ?? this._standing); }
  _show(msg) { if (this.el.textContent !== msg) this.el.textContent = msg; }
}
