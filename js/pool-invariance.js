// ---------- js/pool-invariance.js ----------
(function () {
  // Pull in house helpers (requires widgets-core.js v0.3+)
  const {
    autosizeCanvas, clamp, onPointerDrag, linkRangeNumber, announce,
    hoverCursor, ensurePanelFigure, renderLatex,
    themeVar, onColorSchemeChange, currentColorScheme
  } = window.Widgets || {};

  function initOne(root, opts = {}) {
    if (!autosizeCanvas || !ensurePanelFigure) {
      console.error("widgets-core.js v0.3+ must load before pool-invariance.js");
      return;
    }

    // ---- Config ----
    const cfg = {
      // Layout
      aspect: 12 / 7,        // table canvas aspect
      chartAspect: 16 / 7,   // ledger aspect inside output panel
      minWidth: 320,
      maxWidth: 720,

      // Table + cue + ball visuals
      ballRadius: 10,
      cueLength: 140,
      cueGap: 14,
      cueAnimFrames: 18,
      pullBackMaxPx: 60,

      // Input → speed mapping (pull length → speed using sqrt curve)
      maxPull: 220,                // px
      maxSpeedPxPerFrame: 8,       // px/frame

      // Physics
      frictionFactor: 1.000,       // 1.000 = no friction (multiplier per frame)
      restitution: 1.000,          // 1.000 = perfectly elastic cushions

      // Energy ledger (rolling window)
      timeWindowSec: 3.0,          // width of the visible window (seconds)
      nowFrac: 2/3,                // “current time” anchored at 2/3 across the plot
      tickSec: 0.5,                // fixed x tick spacing (seconds)
      samplesMax: 2400,            // cap history to avoid unbounded growth

      ...opts
    };

    const schemeState = { mode: null, colors: {} };

    function getSchemeFallback(){
      return currentColorScheme ? currentColorScheme() :
        (document.body?.classList?.contains('quarto-dark') || document.documentElement?.classList?.contains('quarto-dark') ? 'dark' : 'light');
    }

    function readColors(force = false){
      const mode = force ? null : schemeState.mode;
      const scheme = mode ?? getSchemeFallback();
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
        cueDark: read('--wgt-pool-cue-dark', '#7a5c3a'),
        powerText: read('--wgt-pool-power-text', 'rgba(255,255,255,0.9)'),
        ledgerGrid: read('--wgt-ledger-grid', '#e6e6e6'),
        ledgerAxis: read('--wgt-ledger-axis', '#666'),
        ledgerAxisStrong: read('--wgt-ledger-axis-strong', '#444'),
        ledgerNowLine: read('--wgt-ledger-now-line', '#bbb'),
        ledgerTotalRef: read('--wgt-ledger-total-ref', 'rgba(70,70,70,0.8)'),
        ledgerMotionLine: read('--wgt-energy-motion-line', 'rgba(60,145,130,1.0)'),
        ledgerMotionFill: read('--wgt-energy-motion-fill', 'rgba(80,170,155,0.35)'),
        ledgerFrictionLine: read('--wgt-energy-friction-line', 'rgba(244,119,74,0.95)'),
        ledgerFrictionFill: read('--wgt-energy-friction-fill', 'rgba(244,119,74,0.30)'),
        ledgerInelasticLine: read('--wgt-energy-inelastic-line', 'rgba(231,188,79,0.95)'),
        ledgerInelasticFill: read('--wgt-energy-inelastic-fill', 'rgba(231,188,79,0.30)')
      };
      return schemeState.colors;
    }

    readColors(true);

    // ---- DOM: table canvas + output panel ----
    const tableCanvas = root.querySelector('canvas[data-role="table"]')
                      || root.querySelector('.wgt__canvas canvas');
    const outPanel    = root.querySelector('.wgt__output') || root;

    // Ensure the figure wrapper INSIDE the output panel, right below the title
    // and ABOVE any generic hints; get handles to canvas/legend/equation nodes.
    const { canvas: chartCanvas, legend: legendEl, eq: eqEl } =
      ensurePanelFigure(outPanel, { role: 'ledger', ensureLegend: true, ensureEq: true });

    // Populate legend once (if empty)
    if (legendEl && !legendEl.hasChildNodes()) {
      legendEl.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:var(--wgt-energy-motion-line);border-radius:2px;"></span> Motion
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:var(--wgt-energy-friction-line);border-radius:2px;"></span> Friction
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:var(--wgt-energy-inelastic-line);border-radius:2px;"></span> Inelastic
        </span>`;
    }

    // Typeset the invariance equation (uses KaTeX/Quarto/MathJax if present)
    function setEquation() {
      if (!eqEl) return;
      
      // If Quarto/KaTeX already typeset math here, do nothing.
      const alreadyTypeset = !!eqEl.querySelector('.katex');
      if (alreadyTypeset) return;
      
      // If author provided inline TeX in the HTML (e.g., $...$), let Quarto handle it.
      const hasInlineTex = /\$[^$]+\$|\\\(|\\\[/.test(eqEl.textContent || '');
      if (hasInlineTex) {
        if (window.Quarto?.typesetMath) window.Quarto.typesetMath(eqEl);
        return;
      }

      // Fallback: inject TeX (for pages without authored math)
      //renderLatex(eqEl, String.raw`K(t) + W_{\mathrm{fric}}(t) + W_{\mathrm{inel}}(t) = E_{\text{total}}`, { displayMode: false });
    }
    setEquation();

    // Live region (polite)
    let liveEl = outPanel.querySelector('[data-role="live"]');
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.setAttribute('data-role', 'live');
      liveEl.setAttribute('aria-live', 'polite');
      liveEl.className = 'visually-hidden';
      Object.assign(liveEl.style, {
        position:'absolute', width:'1px', height:'1px', padding:'0',
        margin:'-1px', overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap'
      });
      outPanel.appendChild(liveEl);
    }

    // Controls (all optional—safe if missing)
    const frRange = root.querySelector('[data-role="fric-range"]');
    const frNum   = root.querySelector('[data-role="fric-num"]');
    const reRange = root.querySelector('[data-role="rest-range"]');
    const reNum   = root.querySelector('[data-role="rest-num"]');
    const resetBtn= root.querySelector('[data-role="reset"]');

    // ---- Layout (HiDPI-safe) ----
    const layoutTable = autosizeCanvas(tableCanvas, { aspect: cfg.aspect,     min: cfg.minWidth, max: cfg.maxWidth });
    const layoutChart = autosizeCanvas(chartCanvas, { aspect: cfg.chartAspect, min: cfg.minWidth, max: cfg.maxWidth });
    const tctx = () => layoutTable.ctx;
    const cctx = () => layoutChart.ctx;

    // ---- State ----
    const state = {
      // Ball kinematics (m=1)
      x: 0, y: 0, r: cfg.ballRadius,
      vx: 0, vy: 0,

      // Modes: 'idle' | 'dragBall' | 'aim' | 'hitting' | 'moving'
      mode: 'idle',
      hitFrame: 0,

      // Pull/force vector (pointer → ball; i.e., toward the ball)
      aimVec: { x: 0, y: 0 },

      // Environment
      frictionFactor: cfg.frictionFactor,
      restitution: cfg.restitution,

      // Energies
      E0: 0, Etrans: 0, Wfric: 0, Winel: 0,

      // Time & samples for the ledger
      t: 0,                      // seconds since shot began
      samples: []                // { t, Etrans, Wfric, Winel }
    };

    function placeCenter(force=false){
      if (force || (state.x===0 && state.y===0)) {
        state.x = layoutTable.width * 0.5;
        state.y = layoutTable.height* 0.5;
      } else {
        state.x = clamp(state.x, state.r, layoutTable.width  - state.r);
        state.y = clamp(state.y, state.r, layoutTable.height - state.r);
      }
    }
    placeCenter(true);

    // ---- Bind sliders <-> numbers (optional) ----
    const linkFric = linkRangeNumber(frRange, frNum, {
      // UI range shows "friction amount" [0..0.100]; map to multiplier [0.90..1.00]
      toModel: (ui)=>clamp(1.0 - Number(ui), 0.90, 1.00),
      fromModel: (mul)=>(1.0 - mul).toFixed(3),
      onChange: (mul)=>{ state.frictionFactor = mul; }
    }); linkFric && linkFric.set(state.frictionFactor);

    const linkRest = linkRangeNumber(reRange, reNum, {
      toModel: (ui)=>clamp(Number(ui), 0.60, 1.00),
      fromModel: (val)=>Number(val).toFixed(2),
      onChange: (val)=>{ state.restitution = val; }
    }); linkRest && linkRest.set(state.restitution);

    function hardReset(){
      state.vx = state.vy = 0;
      state.mode='idle'; state.hitFrame=0;
      state.aimVec.x = state.aimVec.y = 0;

      state.E0 = state.Etrans = state.Wfric = state.Winel = 0;
      state.t = 0; state.samples = [];

      placeCenter(true);
      setEquation();
      drawAll();
      announce(liveEl, 'Reset. Drag the ball or pull to aim.');
    }
    resetBtn && resetBtn.addEventListener('click', hardReset);

    // ---- Pointer affordances ----
    const ballHitTest = (p) => { const dx=p.x-state.x, dy=p.y-state.y; return dx*dx + dy*dy <= state.r*state.r; };
    hoverCursor && hoverCursor(tableCanvas, { hitTest: ballHitTest, hover:'grab', normal:'', isDragging:()=>state.mode==='dragBall' });

    // Pull length → initial speed (smooth feel using sqrt)
    const pullToSpeed = (lenPx)=> cfg.maxSpeedPxPerFrame * Math.sqrt(clamp(lenPx/cfg.maxPull, 0, 1));

    // Unified drag handler: grab ball OR pull to aim
    onPointerDrag(tableCanvas, {
      hitTest: ()=>true,
      onStart: (p)=>{
        if (ballHitTest(p)) {
          // Grab-anytime: stop motion, drag the ball
          state.vx=state.vy=0; state.mode='dragBall'; state.hitFrame=0; tableCanvas.style.cursor='grabbing';
          return;
        }
        if (state.mode!=='hitting') {
          state.mode='aim';
          state.aimVec.x = state.x - p.x;  // pointer → ball (toward ball)
          state.aimVec.y = state.y - p.y;
        }
      },
      onMove: (p)=>{
        if (state.mode==='dragBall') {
          state.x = clamp(p.x, state.r, layoutTable.width  - state.r);
          state.y = clamp(p.y, state.r, layoutTable.height - state.r);
          drawAll(); return;
        }
        if (state.mode==='aim') {
          state.aimVec.x = state.x - p.x;
          state.aimVec.y = state.y - p.y;
          drawAll();
        }
      },
      onEnd: ()=>{
        if (state.mode==='dragBall') { state.mode='idle'; tableCanvas.style.cursor=''; drawAll(); return; }
        if (state.mode==='aim') {
          const L = Math.hypot(state.aimVec.x, state.aimVec.y);
          if (L>5){ state.mode='hitting'; state.hitFrame=0; announce(liveEl,'Shot armed.'); }
          else { state.mode='idle'; state.aimVec.x=state.aimVec.y=0; }
        }
      }
    });

    // ---- Physics helpers ----
    function beginMotionFromAim(){
      const L = Math.hypot(state.aimVec.x, state.aimVec.y);
      if (L<=0) return;
      const ux = state.aimVec.x / L, uy = state.aimVec.y / L; // unit vector toward ball
      const speed = pullToSpeed(L);

      state.vx = speed * ux;
      state.vy = speed * uy;
      state.aimVec.x = state.aimVec.y = 0;

      // Initialize energy ledger
      state.E0 = 0.5*(state.vx*state.vx + state.vy*state.vy);
      state.Etrans = state.E0; state.Wfric=0; state.Winel=0;
      state.t = 0; state.samples = [];
      sampleEnergy();

      setEquation();
      announce(liveEl, 'Shot! Force equals pull direction.');
    }

    function collideWallsAndTrackLoss(){
      const e = state.restitution;
      let bounced = false;
      const v2b = state.vx*state.vx + state.vy*state.vy;

      if (state.x - state.r < 0) { state.x = state.r;                         state.vx =  Math.abs(state.vx) * e; bounced = true; }
      else if (state.x + state.r > layoutTable.width)  { state.x = layoutTable.width  - state.r; state.vx = -Math.abs(state.vx) * e; bounced = true; }
      if (state.y - state.r < 0) { state.y = state.r;                         state.vy =  Math.abs(state.vy) * e; bounced = true; }
      else if (state.y + state.r > layoutTable.height) { state.y = layoutTable.height - state.r; state.vy = -Math.abs(state.vy) * e; bounced = true; }

      if (bounced && e<1.0){
        const v2a = state.vx*state.vx + state.vy*state.vy;
        const dE = 0.5*(v2b - v2a);
        if (dE>0) state.Winel += dE; // inelastic cushion loss
      }
    }

    function applyFrictionAndTrackLoss(){
      if (state.frictionFactor >= 1.0) return;
      const v2b = state.vx*state.vx + state.vy*state.vy;
      state.vx *= state.frictionFactor;
      state.vy *= state.frictionFactor;
      const v2a = state.vx*state.vx + state.vy*state.vy;
      const dE = 0.5*(v2b - v2a);
      if (dE>0) state.Wfric += dE; // work done by friction
    }

    function energyCorrection(){
      // Keep the sum pinned to E0 to minimize numeric drift
      state.Etrans = 0.5*(state.vx*state.vx + state.vy*state.vy);
      const sum = state.Etrans + state.Wfric + state.Winel;
      const corr = state.E0 - sum;
      if (Math.abs(corr)>1e-6) state.Wfric = Math.max(0, state.Wfric + corr);
    }

    function sampleEnergy(){
      state.samples.push({ t: state.t, Etrans: state.Etrans, Wfric: state.Wfric, Winel: state.Winel });
      if (state.samples.length > cfg.samplesMax) state.samples.shift();
    }

    // ---- Drawing: table, ball, cue, pull visuals ----
    function drawTable(){
      const c = tctx(), w = layoutTable.width, h = layoutTable.height;
      c.clearRect(0,0,w,h);
      const colors = readColors();

      // Felt + rails (palette consistent with Widget 1)
      c.fillStyle = colors.felt; c.fillRect(0,0,w,h);
      const rail=8; c.fillStyle=colors.rail;
      c.fillRect(0,0,w,rail); c.fillRect(0,h-rail,w,rail);
      c.fillRect(0,0,rail,h); c.fillRect(w-rail,0,rail,h);

      // Ball
      c.beginPath(); c.arc(state.x, state.y, state.r, 0, Math.PI*2);
      c.fillStyle=colors.ball; c.shadowColor="rgba(0,0,0,0.25)"; c.shadowBlur=4; c.fill(); c.shadowBlur=0;

      // Cue + pull line/chevrons
      const ax = state.aimVec.x, ay = state.aimVec.y;
      const L = Math.hypot(ax, ay);
      let ux=1, uy=0; if (L>0){ ux=ax/L; uy=ay/L; }

      const hasAim = (state.mode==='aim' || state.mode==='hitting' || state.mode==='idle');

      if (hasAim) {
        const retract = (state.mode==='aim')
          ? Math.min(L, cfg.pullBackMaxPx)
          : (state.mode==='hitting'
              ? Math.max(0, cfg.pullBackMaxPx * (1 - state.hitFrame / cfg.cueAnimFrames))
              : 0);

        // Cue retreats along the SAME pull line (tip sits behind the ball)
        const tipX  = state.x + ux * (-cfg.cueGap - retract);
        const tipY  = state.y + uy * (-cfg.cueGap - retract);
        const buttX = tipX - ux * cfg.cueLength;
        const buttY = tipY - uy * cfg.cueLength;

        c.lineCap="round";
        c.lineWidth=6;  c.strokeStyle=colors.cueLight; c.beginPath(); c.moveTo(buttX,buttY); c.lineTo(tipX,tipY); c.stroke();
        c.lineWidth=10; c.strokeStyle=colors.cueDark; c.beginPath(); c.moveTo(buttX,buttY); c.lineTo(buttX+ux*18,buttY+uy*18); c.stroke();
      }

      // Force line + moving chevrons toward the ball
      if (state.mode==='aim' && L>6){
        const farX = state.x + ux*L, farY = state.y + uy*L; // distal point (hand)
        c.lineWidth=2; c.strokeStyle="rgba(255,255,255,0.9)";
        c.beginPath(); c.moveTo(farX,farY); c.lineTo(state.x,state.y); c.stroke();

        const chevronSpacing=18, chevronSize=6;
        const speed = clamp(pullToSpeed(L) / cfg.maxSpeedPxPerFrame, 0, 1);
        const phase = ((performance.now()*0.08*(0.5+speed)) % chevronSpacing);
        const n = Math.floor(L/chevronSpacing);
        for (let i=1;i<=n;i++){
          const d = i*chevronSpacing - phase; if (d<=0 || d>=L) continue;
          const cx = state.x + ux*d, cy = state.y + uy*d;
          const px1 = cx + ux*(-chevronSize) + (-uy)*(chevronSize*0.5);
          const py1 = cy + uy*(-chevronSize) + ( ux)*(chevronSize*0.5);
          const px2 = cx + ux*(-chevronSize) + ( uy)*(chevronSize*0.5);
          const py2 = cy + uy*(-chevronSize) + (-ux)*(chevronSize*0.5);
          c.lineWidth=2; c.strokeStyle="rgba(255,255,255,0.9)";
          c.beginPath(); c.moveTo(px1,py1); c.lineTo(cx,cy); c.lineTo(px2,py2); c.stroke();
        }

        const pct = Math.round(100 * pullToSpeed(L) / cfg.maxSpeedPxPerFrame);
        const bars = Math.max(1, Math.round(pct/25)); // 1..4
        const legendTxt = `Power: ${'▁▃▆█'.slice(0,bars)}`;
        c.font="12px system-ui, -apple-system, Segoe UI, Roboto, Arial"; c.fillStyle=colors.powerText || 'rgba(255,255,255,0.9)';
        const tx = state.x + ux*(L*0.55), ty = state.y + uy*(L*0.55);
        c.fillText(legendTxt, tx+8, ty-8);
      }
    }

    // ---- Drawing: Energy Ledger (rolling window, responsive, “now” at 2/3) ----
    function drawLedger(){
      const c = cctx(), W = layoutChart.width, H = layoutChart.height;
      c.clearRect(0,0,W,H);
      const colors = readColors();

      // Plot rect
      const m = { l: 42, r: 12, t: 14, b: 30 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;

      c.save(); c.translate(m.l, m.t);

      // Grid: vertical fixed-time ticks + horizontal divisions
      c.lineWidth = 1; c.strokeStyle = colors.ledgerGrid;
      const Tw = cfg.timeWindowSec;
      const f  = cfg.nowFrac;
      const tNow = state.t;
      const tLeft  = Math.max(0, tNow - f*Tw);
      const tRight = tLeft + Tw;

      // Vertical ticks & rolling labels
      const S = cfg.tickSec;
      let tTick = Math.ceil(tLeft / S) * S;
      c.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      c.fillStyle = colors.ledgerAxis;
      while (tTick <= tRight + 1e-9) {
        const x = ((tTick - tLeft) / Tw) * iw;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ih); c.stroke();
        c.textAlign = "center"; c.fillText(`${tTick.toFixed(1)}s`, x, ih + 16);
        tTick += S;
      }
      // Horizontal lines (10 divisions)
      for (let j=0; j<=10; j++){ const y=(j/10)*ih; c.beginPath(); c.moveTo(0,y); c.lineTo(iw,y); c.stroke(); }

      // y-axis label
      c.fillStyle = colors.ledgerAxisStrong;
      c.save(); c.translate(-28, ih*0.5); c.rotate(-Math.PI/2); c.textAlign="center"; c.fillText("Energy", 0, 0); c.restore();

      // If no energy yet, still show the “now” line position
      if (!state.E0 || state.samples.length === 0) {
        const xNowEmpty = f * iw;
        c.strokeStyle = colors.ledgerNowLine; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(xNowEmpty, 0); c.lineTo(xNowEmpty, ih); c.stroke();
        c.restore(); return;
      }

      const xOf = (t)=> ((t - tLeft) / Tw) * iw;
      const yOf = (E)=> ih - clamp(E/state.E0, 0, 1) * ih;

      c.textAlign = "right";
      c.textBaseline = "middle";
      c.fillStyle = colors.ledgerAxis;
      c.fillText('1.00', -6, yOf(state.E0));
      c.fillText('0.50', -6, yOf(state.E0 * 0.5));
      c.fillText('0.00', -6, yOf(0));

      // “Now” line
      const xNow = xOf(tNow);
      c.strokeStyle = colors.ledgerNowLine; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(xNow, 0); c.lineTo(xNow, ih); c.stroke();

      // Visible samples [tLeft .. tNow]
      const data = state.samples;
      let i0 = 0;
      for (let i = data.length - 1; i >= 0; i--) { if (data[i].t <= tLeft) { i0 = Math.max(0, i); break; } }
      const i1 = data.length - 1;

      // Helper: fill area between two curves (upperFn, lowerFn in ENERGY units)
      function fillBetween(upperFn, lowerFn, fillStyle){
        const p = new Path2D();
        // Start at first bottom point
        p.moveTo(xOf(data[i0].t), yOf(lowerFn(data[i0])));
        // Forward along the UPPER curve
        for (let i=i0;i<=i1;i++){ const s=data[i]; p.lineTo(xOf(s.t), yOf(upperFn(s))); }
        // Backward along the LOWER curve
        for (let i=i1;i>=i0;i--){ const s=data[i]; p.lineTo(xOf(s.t), yOf(lowerFn(s))); }
        p.closePath();
        c.fillStyle = fillStyle;
        c.fill(p);
      }

      // Stacked fills (partitioned, no overlap):
      // 1) Friction: 0 → Wfric
      fillBetween(s => s.Wfric, s => 0, colors.ledgerFrictionFill);
      // 2) Inelastic: Wfric → Wfric+Winel
      fillBetween(s => s.Wfric + s.Winel, s => s.Wfric, colors.ledgerInelasticFill);
      // 3) Motion: (Wfric+Winel) → (E0)  [top is constant = total energy]
      fillBetween(s => state.E0, s => s.Wfric + s.Winel, colors.ledgerMotionFill);

      // Component lines
      c.lineWidth = 2;
      c.strokeStyle = colors.ledgerFrictionLine;
      c.beginPath(); for (let i=i0;i<=i1;i++){ const s=data[i], x=xOf(s.t), y=yOf(s.Wfric); (i===i0)?c.moveTo(x,y):c.lineTo(x,y); } c.stroke();
      c.strokeStyle = colors.ledgerInelasticLine;
      c.beginPath(); for (let i=i0;i<=i1;i++){ const s=data[i], x=xOf(s.t), y=yOf(s.Wfric+s.Winel); (i===i0)?c.moveTo(x,y):c.lineTo(x,y); } c.stroke();
      c.strokeStyle = colors.ledgerMotionLine;
      c.beginPath(); for (let i=i0;i<=i1;i++){ const s=data[i], x=xOf(s.t), y=yOf(s.Wfric+s.Winel+s.Etrans); (i===i0)?c.moveTo(x,y):c.lineTo(x,y); } c.stroke();

      // Invariant total energy reference line at E0
      c.setLineDash([4,3]); c.strokeStyle=colors.ledgerTotalRef; c.lineWidth=1.5;
      c.beginPath(); c.moveTo(0, yOf(state.E0)); c.lineTo(iw, yOf(state.E0)); c.stroke(); c.setLineDash([]);

      // Current-time dot on Motion curve
      const sNow = data[i1];
      const yNow = yOf(sNow.Wfric + sNow.Winel + sNow.Etrans);
      c.fillStyle = colors.ledgerMotionLine;
      c.beginPath(); c.arc(xNow, yNow, 3.5, 0, Math.PI*2); c.fill();

      c.restore();
    }

    function drawAll(){ drawTable(); drawLedger(); }

    onColorSchemeChange && onColorSchemeChange(() => {
      schemeState.mode = null;
      readColors(true);
      drawAll();
    });

    // ---- Main Loop ----
    let lastT = performance.now();
    function loop(){
      const now = performance.now();
      const dt = Math.max(1e-3, Math.min(0.05, (now-lastT)/1000)); // seconds

      if (state.mode==='hitting'){
        state.hitFrame++;
        if (state.hitFrame >= cfg.cueAnimFrames){ state.mode='moving'; beginMotionFromAim(); }
        drawAll(); lastT=now; requestAnimationFrame(loop); return;
      }

      if (state.mode==='moving'){
        state.t += dt;                       // advance sim time
        state.x += state.vx; state.y += state.vy;

        collideWallsAndTrackLoss();
        applyFrictionAndTrackLoss();

        if (Math.hypot(state.vx,state.vy) < 0.01) {
          state.vx=state.vy=0; state.mode='idle';
          announce(liveEl, 'Came to rest.');
        }

        energyCorrection();
        sampleEnergy();
      }

      drawAll();
      lastT=now; requestAnimationFrame(loop);
    }
    loop();
  }

  // Auto-init all `.wgt[data-widget="pool-invariance"]`
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.wgt[data-widget="pool-invariance"]').forEach(el => initOne(el));
  });

  // Optional manual init (accepts id or element)
  window.PoolInvarianceInit = function(idOrEl, opts){
    const el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (el) initOne(el, opts);
  };
})();
// ---------- end js/pool-invariance.js ----------
