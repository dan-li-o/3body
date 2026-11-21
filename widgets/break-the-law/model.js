// The state behind Try to Break the Law, shared by the widget and its poster.
// The engine (../engines/pool-table.js) keeps the books; this file only records where the warmth went,
// from the engine's own events, so the felt track and the dents are drawn from the energy actually lost.
import { createTable, addBall, step } from '../engines/pool-table.js';
import { TABLE, TRAIL_LIFE, addDent } from './draw.js';

export const FELT = 0.35;    // the felt's drag (speed lost per second)
export const SOFT = 0.7;     // a soft cushion's bounce (share of speed kept)

export function createState() {
  const T = createTable(TABLE.W, TABLE.H, TABLE.R);
  return { T, ball: addBall(T, 0.55, 0.62), trail: [], scars: [], dents: [], warmF: 0, warmC: 0, clock: 0 };
}
export function setSurface(st, { felt, soft }) { st.T.mu = felt ? FELT : 0; st.T.e = soft ? SOFT : 1; }
export const moving = (st) => !!(st.ball.vx || st.ball.vy);

export function advance(st, dt) {
  const { T, ball } = st, px = ball.x, py = ball.y;
  st.clock += dt; T.events.length = 0; step(T, dt);
  let f = 0;
  for (const ev of T.events) { if (ev.type === 'felt') f += ev.amt; else if (ev.type === 'cushion') { st.warmC += ev.amt; addDent(st.dents, ev); } }
  st.warmF += f; if (f > 0) st.scars.push(px, py, ball.x, ball.y);
  if (moving(st)) st.trail.push(ball.x, ball.y, st.clock);
  let drop = 0; while (drop < st.trail.length && st.clock - st.trail[drop + 2] > TRAIL_LIFE) drop += 3;
  if (drop) st.trail.splice(0, drop);
}
