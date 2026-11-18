// Pendulum engine: pure math, no drawing. Units: metres, seconds, radians.
// Three dynamics for Ch3's "tale of two pendulums":
//  - nature: the true pendulum (RK4, small steps; conserves energy)
//  - newton: a model learned in Newton's terms. Its learning error is an
//    arbitrary small error in the force, which need not respect energy;
//    here, a small push along the motion, so energy creeps up.
//  - energy: a model learned in energy terms. Its learning error is an error
//    in the energy function itself (gravity off by `err`), so it still
//    conserves its own energy: slightly wrong rhythm, but bounded forever.
// This models how the trained networks behave (Greydanus et al. 2019);
// it does not train networks.

export const G = 9.81;

export function energy([th, w], L = 1, g = G) {
  return 0.5 * w * w * L * L + g * L * (1 - Math.cos(th));
}

function rk4(s, h, f) {
  const [a, b] = s;
  const k1 = f(a, b);
  const k2 = f(a + h / 2 * k1[0], b + h / 2 * k1[1]);
  const k3 = f(a + h / 2 * k2[0], b + h / 2 * k2[1]);
  const k4 = f(a + h * k3[0], b + h * k3[1]);
  return [a + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
          b + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
}

const SUB = 1 / 480; // internal step size, seconds

function advance(s, dt, stepFn) {
  let t = 0, st = s;
  while (t < dt - 1e-12) { const h = Math.min(SUB, dt - t); st = stepFn(st, h); t += h; }
  return st;
}

export function stepNature(s, dt, { L = 1, g = G } = {}) {
  return advance(s, dt, (st, h) => rk4(st, h, (th, w) => [w, -g / L * Math.sin(th)]));
}

// err: learning error as a fraction (0.03 = 3%). Push strength scales with it.
export function stepNewton(s, dt, { err = 0.03, L = 1, g = G } = {}) {
  const c = 3.6 * err; // per second; ~3x energy after 10 s at 3%
  return advance(s, dt, (st, h) => rk4(st, h, (th, w) => [w, -g / L * Math.sin(th) + c * w]));
}

export function stepEnergy(s, dt, { err = 0.03, L = 1, g = G } = {}) {
  const ge = g * (1 + err); // learned energy function is slightly off
  return advance(s, dt, ([th, w], h) => {
    // leapfrog (symplectic): conserves its own energy over long runs
    const w1 = w - h / 2 * ge / L * Math.sin(th);
    const th1 = th + h * w1;
    const w2 = w1 - h / 2 * ge / L * Math.sin(th1);
    return [th1, w2];
  });
}
