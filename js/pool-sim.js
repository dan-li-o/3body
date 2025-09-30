// js/pool-sim.js
(function () {
  const {
    autosizeCanvas, clamp, onPointerDrag, linkRangeNumber, announce, hoverCursor,
    themeVar, onColorSchemeChange, currentColorScheme, canvasDefaults
  } = window.Widgets || {};

  function initOne(root, opts = {}) {
    if (!autosizeCanvas) {
      console.error("widgets-core.js not loaded before pool-sim.js");
      return;
    }

    // ---- Config ----
    const baseCanvas = typeof canvasDefaults === 'function'
      ? canvasDefaults()
      : { aspect: 16 / 9, min: 320, max: 720 };

    const cfg = {
      directionDeg: 0,           // fixed cue direction (global)
      speedPxPerFrame: 3.0,      // post-impact speed if no friction
      ballRadius: 10,
      cueLength: 120,
      cueGap: 14,
      cueAnimFrames: 18,
      aspect: baseCanvas.aspect, // standardized canvas aspect
      minWidth: baseCanvas.min,
      maxWidth: baseCanvas.max,
      frictionFactor: 1.000,     // 1.000 = no friction (multiplier per frame)
      ...opts
    };

    const schemeState = { mode: null, colors: {} };
    function getScheme(){
      return currentColorScheme ? currentColorScheme() :
        (document.body?.classList?.contains('quarto-dark') || document.documentElement?.classList?.contains('quarto-dark') ? 'dark' : 'light');
    }
    function readColors(force = false){
      const mode = force ? null : schemeState.mode;
      const scheme = mode ?? getScheme();
      if (!force && scheme === schemeState.mode && schemeState.colors && Object.keys(schemeState.colors).length) {
        return schemeState.colors;
      }
      const read = (name, fallback) => themeVar ? themeVar(name, fallback) : fallback;
      schemeState.mode = scheme;
      schemeState.colors = {
        felt: read('--wgt-pool-felt', '#35654d'),
        rail: read('--wgt-pool-rail', '#1f3a2c'),
        ball: read('--wgt-pool-ball', '#f7f7f7'),
        cueLight: read('--wgt-pool-cue-light', '#b88955'),
        cueDark: read('--wgt-pool-cue-dark', '#7a5c3a')
      };
      return schemeState.colors;
    }

    readColors(true);

    // ---- DOM (scoped to this widget) ----
    const canvas = root.querySelector('canvas');
    const posEl  = root.querySelector('[data-role="pos"]');
    const velEl  = root.querySelector('[data-role="vel"]');
    const accEl  = root.querySelector('[data-role="acc"]');
    const rEl    = root.querySelector('[data-role="fric-range"]');
    const nEl    = root.querySelector('[data-role="fric-num"]');
    const reset  = root.querySelector('[data-role="reset"]');
    const outPanel = root.querySelector('.wgt__output') || root;

    // Dedicated live region (child) so we don't overwrite panel content
    let liveEl = root.querySelector('[data-role="live"]');
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.setAttribute('data-role', 'live');
      liveEl.setAttribute('aria-live', 'polite');
      liveEl.className = 'visually-hidden';
      // visually hidden fallback if no CSS utility is present:
      Object.assign(liveEl.style, {
        position: 'absolute', width: '1px', height: '1px', padding: '0',
        margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap'
      });
      outPanel.appendChild(liveEl);
    }

    // ---- Layout & HiDPI via house helper ----
    const layout = autosizeCanvas(canvas, { aspect: cfg.aspect, min: cfg.minWidth, max: cfg.maxWidth });
    const ctx = () => layout.ctx;

    // ---- State ----
    const theta = (cfg.directionDeg * Math.PI) / 180;
    const dir = { x: Math.cos(theta), y: -Math.sin(theta) }; // screen y down
    const state = {
      x: 0, y: 0, r: cfg.ballRadius,
      vx: 0, vy: 0,
      dragging: false, hitting: false, hitFrame: 0,
      frictionFactor: cfg.frictionFactor,
      get frictionOn() { return this.frictionFactor < 1.0; }
    };

    function placeCenter(force = false) {
      if (force || state.x === 0 && state.y === 0) {
        state.x = layout.width * 0.5;
        state.y = layout.height * 0.5;
      } else {
        state.x = clamp(state.x, state.r, layout.width  - state.r);
        state.y = clamp(state.y, state.r, layout.height - state.r);
      }
    }
    placeCenter(true);

    // ---- Inputs: link slider <-> number (house helper) ----
    const link = linkRangeNumber(rEl, nEl, {
      // UI gives [0..0.100] "friction amount"; map to multiplier [0.90..1.00]
      toModel: (ui) => clamp(1.0 - Number(ui), 0.90, 1.00),
      fromModel: (mul) => (1.0 - mul).toFixed(3),
      onChange: (mul) => { state.frictionFactor = mul; }
    });
    link && link.set(state.frictionFactor);

    // ---- Reset ----
    function hardReset() {
      state.vx = state.vy = 0;
      state.dragging = state.hitting = false;
      state.hitFrame = 0;
      placeCenter(true);
      draw();
      updateUI(0, 0); // zeros immediately
    }
    reset && reset.addEventListener('click', hardReset);

    // Reusable hit test (ball under pointer?)
    const hitTest = (p) => {
      const dx = p.x - state.x, dy = p.y - state.y;
      return dx*dx + dy*dy <= state.r*state.r;
    };

    // House-level hover cursor (open hand over the ball)
    hoverCursor && hoverCursor(canvas, { hitTest, hover: 'grab', normal: '', isDragging: () => state.dragging });


    // ---- Pointer drag (mouse/touch/pen) via house helper ----
    onPointerDrag(canvas, {
      hitTest,
      onStart: () => { state.dragging = true; state.vx = state.vy = 0; state.hitting = false; canvas.style.cursor = 'grabbing'; },
      onMove:  (p) => {
        if (!state.dragging) return;
        state.x = clamp(p.x, state.r, layout.width  - state.r);
        state.y = clamp(p.y, state.r, layout.height - state.r);
        draw();
        updateUI(0, 0); //while grabbing, velocity/accel
      },
      onEnd:   () => { if (state.dragging) { state.dragging = false; state.hitting = true; state.hitFrame = 0; } canvas.style.cursor=''; }
    });

    // ---- Update UI helper ----
    function updateUI(ax = 0, ay = 0){
      posEl && (posEl.textContent = `(${state.x.toFixed(1)}, ${state.y.toFixed(1)})`);
      velEl && (velEl.textContent = `(${state.vx.toFixed(2)}, ${state.vy.toFixed(2)})`);
      accEl && (accEl.textContent = `(${ax.toFixed(2)}, ${ay.toFixed(2)})`);
      announce(liveEl, `Position ${state.x.toFixed(0)}, ${state.y.toFixed(0)}; Velocity ${state.vx.toFixed(1)}, ${state.vy.toFixed(1)}`);
    }

    // ---- Physics ----
    function step() {
      if (state.hitting) {
        state.hitFrame++;
        if (state.hitFrame >= cfg.cueAnimFrames) {
          state.hitting = false;
          state.vx = cfg.speedPxPerFrame * dir.x;
          state.vy = cfg.speedPxPerFrame * dir.y;
        }
      }
      if (!state.dragging) {
        state.x += state.vx; state.y += state.vy;

        // Cushions (perfectly elastic)
        if (state.x - state.r < 0) { state.x = state.r;              state.vx =  Math.abs(state.vx); }
        else if (state.x + state.r > layout.width)  { state.x = layout.width  - state.r; state.vx = -Math.abs(state.vx); }
        if (state.y - state.r < 0) { state.y = state.r;              state.vy =  Math.abs(state.vy); }
        else if (state.y + state.r > layout.height) { state.y = layout.height - state.r; state.vy = -Math.abs(state.vy); }

        // Friction (exponential decay)
        if (state.frictionOn) {
          state.vx *= state.frictionFactor;
          state.vy *= state.frictionFactor;
          if (Math.hypot(state.vx, state.vy) < 0.01) { state.vx = 0; state.vy = 0; }
        }
      }
    }

    // ---- Draw ----
    function drawTable() {
      const c = ctx(), w = layout.width, h = layout.height;
      const colors = readColors();
      c.fillStyle = colors.felt; c.fillRect(0,0,w,h);
      const rail = 8; c.fillStyle = colors.rail;
      c.fillRect(0,0,w,rail); c.fillRect(0,h-rail,w,rail);
      c.fillRect(0,0,rail,h); c.fillRect(w-rail,0,rail,h);
    }
    function drawBall() {
      const c = ctx();
      c.beginPath(); c.arc(state.x, state.y, state.r, 0, Math.PI*2);
      c.fillStyle = readColors().ball; c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 4; c.fill(); c.shadowBlur = 0;
    }
    function drawCue() {
      if (!state.hitting) return;
      const c = ctx();
      const startTipX = state.x - dir.x * (cfg.cueLength + cfg.cueGap);
      const startTipY = state.y - dir.y * (cfg.cueLength + cfg.cueGap);
      const endTipX   = state.x - dir.x * cfg.cueGap;
      const endTipY   = state.y - dir.y * cfg.cueGap;
      const t = Math.min(1, state.hitFrame / cfg.cueAnimFrames);
      const tipX = startTipX + (endTipX - startTipX) * t;
      const tipY = startTipY + (endTipY - startTipY) * t;
      const buttX = tipX - dir.x * cfg.cueLength;
      const buttY = tipY - dir.y * cfg.cueLength;

      c.lineCap = "round";
      const colors = readColors();
      c.lineWidth = 6; c.strokeStyle = colors.cueLight;
      c.beginPath(); c.moveTo(buttX, buttY); c.lineTo(tipX, tipY); c.stroke();

      c.lineWidth = 10; c.strokeStyle = colors.cueDark;
      c.beginPath(); c.moveTo(buttX, buttY); c.lineTo(buttX + dir.x*18, buttY + dir.y*18); c.stroke();
    }
    function draw() {
      const c = ctx(); c.clearRect(0, 0, layout.width, layout.height);
      drawTable(); drawBall(); drawCue();
    }

    onColorSchemeChange && onColorSchemeChange(() => {
      schemeState.mode = null;
      readColors(true);
      draw();
    });

    // ---- Loop with acceleration readout ----
    let lastT = performance.now();
    function loop() {
      const now = performance.now();
      const dt = Math.max(1e-3, Math.min(0.05, (now - lastT) / 1000));
      const pvx = state.vx, pvy = state.vy;

      step(); draw();

      const ax = (state.vx - pvx) / dt, ay = (state.vy - pvy) / dt;
      updateUI(ax, ay);

      lastT = now; requestAnimationFrame(loop);
    }
    loop();
  }

  // Auto-init all `.wgt[data-widget="pool-sim"]`
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.wgt[data-widget="pool-sim"]').forEach(el => initOne(el));
  });

  // Optional manual init for backwards compat (accepts id or element)
  window.PoolSimInit = function(idOrEl, opts){
    const el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (el) initOne(el, opts);
  };
})();
// ---------- end js/pool-sim.js ----------
