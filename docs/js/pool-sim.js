// js/pool-sim.js
(function () {
  function setupHiDPICanvas(canvas, widthCssPx, heightCssPx) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = widthCssPx + "px";
    canvas.style.height = heightCssPx + "px";
    canvas.width = Math.round(widthCssPx * dpr);
    canvas.height = Math.round(heightCssPx * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: widthCssPx, height: heightCssPx, dpr };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function PoolSimInit(containerId, opts = {}) {
    const cfg = {
      directionDeg: 0,           // fixed cue direction (global)
      speedPxPerFrame: 3.0,      // constant post-impact speed when no friction
      ballRadius: 10,
      cueLength: 120,
      cueGap: 14,
      cueAnimFrames: 18,
      // Responsive options
      aspect: 12 / 7,            // width : height (tweak as you like)
      minWidth: 320,
      maxWidth: 720,
      frictionFactor: 1.000,     // per-frame multiplier when friction is ON
      ...opts
    };

    const container = document.getElementById(containerId);
    if (!container) return console.error(`PoolSim: container #${containerId} not found`);

    const canvas = container.querySelector("canvas");
    const posEl = container.querySelector(`#${containerId}-pos`);
    const velEl = container.querySelector(`#${containerId}-vel`);
    const accEl = container.querySelector(`#${containerId}-acc`);
    const frictionRange = container.querySelector(`#${containerId}-friction-range`);
    const frictionNum   = container.querySelector(`#${containerId}-friction-num`);
    const resetBtn      = container.querySelector(`#${containerId}-reset`);

    if (!canvas || !posEl || !velEl || !resetBtn) {
      return console.error(`PoolSim: missing one or more UI elements in #${containerId}`);
    }


    // Compute fixed global cue direction
    const theta = (cfg.directionDeg * Math.PI) / 180;
    const dir = { x: Math.cos(theta), y: -Math.sin(theta) }; // screen y is downward

    // These will be updated on first layout()
    let ctx, width, height;

    const state = {
      x: 0, y: 0, r: cfg.ballRadius,
      vx: 0, vy: 0,
      dragging: false,
      hitting: false,
      hitFrame: 0,
      frictionFactor: cfg.frictionFactor,          // 1.000 = none
      get frictionOn() { return this.frictionFactor < 1.0; }
    };

    // For acceleration (per second): track time between frames
    let lastT = performance.now();

    function layout() {
      // Pick a canvas width based on container width
      const host = container.querySelector(`.pool-canvas-wrap`) || container;
      const hostWidth = host.clientWidth || canvas.parentElement.clientWidth || cfg.maxWidth;
      const w = clamp(hostWidth, cfg.minWidth, cfg.maxWidth);
      const h = Math.round(w / cfg.aspect);
      const result = setupHiDPICanvas(canvas, w, h);
      ctx = result.ctx; width = result.width; height = result.height;

      // If ball has never been positioned, center it
      if (state.x === 0 && state.y === 0) {
        state.x = width * 0.5;
        state.y = height * 0.5;
      } else {
        // Keep ball inside after resize
        state.x = clamp(state.x, state.r, width - state.r);
        state.y = clamp(state.y, state.r, height - state.r);
      }
    }

    // UI events
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.x = width * 0.5;
        state.y = height * 0.5;
        state.vx = 0; state.vy = 0;
        state.dragging = false;
        state.hitting = false;
        state.hitFrame = 0;
      });
    }

    function setFriction(val) {
      // UI gives "friction amount" in [0.000, 0.100]; map to multiplier = 1 - amount
      const userVal = Number(val);
      const v = clamp(1.0 - userVal, 0.90, 1.00);
      state.frictionFactor = v;
      if (frictionRange) frictionRange.value = userVal.toFixed(3);
      if (frictionNum)   frictionNum.value   = userVal.toFixed(3);
    }
    if (frictionRange) frictionRange.addEventListener('input', e => setFriction(e.target.value));
    if (frictionNum)   frictionNum.addEventListener('input',   e => setFriction(e.target.value));


    // Pointer handling
    function inBall(mx, my) {
      const dx = mx - state.x, dy = my - state.y;
      return dx * dx + dy * dy <= state.r * state.r;
    }
    function getMouse(e) {
      // Canvas has no CSS transforms; offsetX/Y are fine.
      return { x: e.offsetX, y: e.offsetY };
    }
    function setCursor(style) {
      canvas.style.cursor = style;
    } 

    canvas.addEventListener("mousedown", (e) => {
      const m = getMouse(e);
      if (inBall(m.x, m.y)) {
        e.preventDefault(); // prevent text selection
        state.dragging = true;
        state.vx = 0; state.vy = 0;
        state.hitting = false;
        setCursor("grabbing");
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      const m = getMouse(e);
      if (state.dragging) {
        state.x = clamp(m.x, state.r, width - state.r);
        state.y = clamp(m.y, state.r, height - state.r);
        setCursor("grabbing");
      } else if (inBall(m.x, m.y)) {
        // hover over ball -> pointer hand
        setCursor("pointer");
      } else {
        //elsewhere -> default cursor
        setCursor("default");
      }
      //state.x = clamp(m.x, state.r, width - state.r);
      //state.y = clamp(m.y, state.r, height - state.r);
    });
    window.addEventListener("mouseup", () => {
      if (!state.dragging) return;
      state.dragging = false;
      state.hitting = true;
      state.hitFrame = 0;
      setCursor("default");
    });
    canvas.addEventListener("mouseleave", () => {
      if (!state.dragging) setCursor("default");
    });

    // Physics
    function step() {
      // Cue animation
      if (state.hitting) {
        state.hitFrame++;
        if (state.hitFrame >= cfg.cueAnimFrames) {
          state.hitting = false;
          state.vx = cfg.speedPxPerFrame * dir.x;
          state.vy = cfg.speedPxPerFrame * dir.y;
        }
      }

      if (!state.dragging) {
        state.x += state.vx;
        state.y += state.vy;

        // Cushions (perfectly elastic)
        if (state.x - state.r < 0) {
          state.x = state.r; state.vx = Math.abs(state.vx);
        } else if (state.x + state.r > width) {
          state.x = width - state.r; state.vx = -Math.abs(state.vx);
        }
        if (state.y - state.r < 0) {
          state.y = state.r; state.vy = Math.abs(state.vy);
        } else if (state.y + state.r > height) {
          state.y = height - state.r; state.vy = -Math.abs(state.vy);
        }

        // Optional friction (simple exponential decay)
        if (state.frictionOn) {
          state.vx *= state.frictionFactor;
          state.vy *= state.frictionFactor;
          // Avoid “forever crawling” at tiny speeds
          if (Math.hypot(state.vx, state.vy) < 0.01) {
            state.vx = 0; state.vy = 0;
          }
        }
      }
    }

    // Drawing
    function drawTable() {
      // Felt background
      ctx.fillStyle = "#35654d";
      ctx.fillRect(0, 0, width, height);
      // Rails
      const rail = 8;
      ctx.fillStyle = "#1f3a2c";
      ctx.fillRect(0, 0, width, rail);
      ctx.fillRect(0, height - rail, width, rail);
      ctx.fillRect(0, 0, rail, height);
      ctx.fillRect(width - rail, 0, rail, height);
    }

    function drawBall() {
      ctx.beginPath();
      ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
      ctx.fillStyle = "#f7f7f7";
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawCue() {
      if (!state.hitting) return;
      const startTipX = state.x - dir.x * (cfg.cueLength + cfg.cueGap);
      const startTipY = state.y - dir.y * (cfg.cueLength + cfg.cueGap);
      const endTipX = state.x - dir.x * cfg.cueGap;
      const endTipY = state.y - dir.y * cfg.cueGap;
      const t = Math.min(1, state.hitFrame / cfg.cueAnimFrames);
      const tipX = startTipX + (endTipX - startTipX) * t;
      const tipY = startTipY + (endTipY - startTipY) * t;
      const buttX = tipX - dir.x * cfg.cueLength;
      const buttY = tipY - dir.y * cfg.cueLength;

      ctx.lineCap = "round";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#b88955";
      ctx.beginPath();
      ctx.moveTo(buttX, buttY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.lineWidth = 10;
      ctx.strokeStyle = "#7a5c3a";
      ctx.beginPath();
      ctx.moveTo(buttX, buttY);
      ctx.lineTo(buttX + dir.x * 18, buttY + dir.y * 18);
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawTable();
      drawBall();
      drawCue();
    }

    function updateTelemetry(ax, ay) {
      if (posEl) posEl.textContent = `(${state.x.toFixed(1)}, ${state.y.toFixed(1)})`;
      if (velEl) velEl.textContent = `(${state.vx.toFixed(2)}, ${state.vy.toFixed(2)})`;
      if (accEl) accEl.textContent = `(${(ax ?? 0).toFixed(2)}, ${(ay ?? 0).toFixed(2)})`;
    }

    // Main loop with accleration dv/dt (px/s^2)
    function loop() {
      const now = performance.now();
      // dt in seconds; clamp to avoid huge spikes (tab backgrounded, etc.)
      const dt = Math.max(1e-3, Math.min(0.05, (now-lastT) / 1000));

      const prevVx = state.vx;
      const prevVy = state.vy;

      step();
      draw();

      // Acceleration (px/s^2)
      const ax = (state.vx - prevVx) / dt;
      const ay = (state.vy - prevVy) / dt;

      updateTelemetry(ax, ay);

      lastT = now;
      requestAnimationFrame(loop);
    }

    layout();
    // Initialize friction UI from current inputs if present; else from cfg
    const initialUIVal =
      (frictionRange && frictionRange.value) ||
      (frictionNum && frictionNum.value) ||
      (1.0 - cfg.frictionFactor).toFixed(3); // inverse mapping
    setFriction(initialUIVal);

    loop();

    // Re-layout on resize for responsiveness
    const ro = new ResizeObserver(layout);
    ro.observe(container);
  }

  window.PoolSimInit = PoolSimInit;
})();
