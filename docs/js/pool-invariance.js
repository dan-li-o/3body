// ---------- js/pool-invariance.js ----------
(function () {
  const { autosizeCanvas, clamp, onPointerDrag, linkRangeNumber, announce, hoverCursor } = window.Widgets || {};

  function initOne(root, opts = {}) {
    if (!autosizeCanvas) { console.error("widgets-core.js must load before pool-invariance.js"); return; }

    // ---- Config ----
    const cfg = {
      // layout
      aspect: 12 / 7, minWidth: 320, maxWidth: 720,
      chartAspect: 16 / 7,

      // table + cue + ball
      ballRadius: 10,
      cueLength: 140,
      cueGap: 14,
      cueAnimFrames: 18,
      pullBackMaxPx: 60,

      // input → speed
      maxPull: 220,
      maxSpeedPxPerFrame: 8,

      // physics
      frictionFactor: 1.000,
      restitution: 1.000,

      // ledger window (rolling)
      timeWindowSec: 3.0,  // total visible width in seconds
      nowFrac: 2/3,        // “current time” anchor across the window
      tickSec: 0.5,        // fixed tick spacing (s)
      samplesMax: 2400,

      ...opts
    };

    // ---- DOM ----
    const tableCanvas = root.querySelector('canvas[data-role="table"]') || root.querySelector('.wgt__canvas canvas');
    const outPanel    = root.querySelector('.wgt__output') || root;

    // Create a tight chart wrapper so legend/equation stay immediately under the figure
    // Create a tight chart wrapper...
    let chartWrap = outPanel.querySelector('.wgt__chartwrap');
    if (!chartWrap) {
    chartWrap = document.createElement('div');
    chartWrap.className = 'wgt__chartwrap';
    Object.assign(chartWrap.style, {
        display: 'flex', flexDirection: 'column', gap: '6px', width: '100%',
    });
    }

    // Place the wrapper *above* any generic hints, ideally right after the title
    const titleEl = outPanel.querySelector('.wgt__title');
    const firstNonEqHint = outPanel.querySelector('.wgt__hint:not([data-role="eq"])');

    if (firstNonEqHint) {
    outPanel.insertBefore(chartWrap, firstNonEqHint);   // wrapper goes before your panel hint
    } else if (titleEl) {
    titleEl.insertAdjacentElement('afterend', chartWrap); // right after "Energy Ledger"
    } else {
    outPanel.prepend(chartWrap);
    }


    // Ensure a ledger canvas exists inside the wrapper
    let chartCanvas = chartWrap.querySelector('canvas[data-role="ledger"]');
    if (!chartCanvas) {
      chartCanvas = document.createElement('canvas');
      chartCanvas.setAttribute('data-role', 'ledger');
      chartWrap.appendChild(chartCanvas);
    }
    Object.assign(chartCanvas.style, {
      maxWidth: '100%', height: 'auto',
      borderRadius: 'var(--wgt-radius)', touchAction: 'none', userSelect: 'none'
    });

    // Legend (immediately under the canvas, inside the wrapper)
    let legendEl = chartWrap.querySelector('[data-role="legend"]');
    if (!legendEl) {
      legendEl = document.createElement('div');
      legendEl.setAttribute('data-role', 'legend');
      legendEl.className = 'wgt__hint';
      Object.assign(legendEl.style, { display: 'flex', alignItems: 'center', gap: '14px' });
      legendEl.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:rgba(60,145,130,1.0);border-radius:2px;"></span> Motion
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:rgba(244,119,74,0.95);border-radius:2px;"></span> Friction
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:rgba(231,188,79,0.95);border-radius:2px;"></span> Inelastic
        </span>`;
      chartWrap.appendChild(legendEl);
    }

    // Equation (LaTeX), always placed right after the legend in the wrapper
    let eqEl = chartWrap.querySelector('[data-role="eq"]');
    if (!eqEl) {
      eqEl = document.createElement('div');
      eqEl.setAttribute('data-role', 'eq');
      eqEl.className = 'wgt__hint';
      eqEl.style.marginTop = '0px';
      chartWrap.appendChild(eqEl);
    }
    function renderEquation() {
      const tex = String.raw`K(t) + W_{\mathrm{fric}}(t) + W_{\mathrm{inel}}(t) = E_{\text{total}}`;
      // Prefer KaTeX if available
      if (window.katex && typeof window.katex.render === 'function') {
        window.katex.render(tex, eqEl, { throwOnError: false, displayMode: false });
      }
      // Quarto’s math typesetter (works with $...$)
      else if (window.Quarto && typeof window.Quarto.typesetMath === 'function') {
        eqEl.innerHTML = `$${tex}$`;
        window.Quarto.typesetMath(eqEl);
      }
      // MathJax v3
      else if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        eqEl.innerHTML = `\\(${tex}\\)`;
        window.MathJax.typesetPromise([eqEl]);
      }
      // Fallback
      else {
        eqEl.textContent = 'K(t) + W_fric(t) + W_inel(t) = E_total';
      }
    }

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

    // Controls
    const frRange = root.querySelector('[data-role="fric-range"]');
    const frNum   = root.querySelector('[data-role="fric-num"]');
    const reRange = root.querySelector('[data-role="rest-range"]');
    const reNum   = root.querySelector('[data-role="rest-num"]');
    const resetBtn = root.querySelector('[data-role="reset"]');

    // ---- Layout (HiDPI) ----
    const layoutTable = autosizeCanvas(tableCanvas, { aspect: cfg.aspect, min: cfg.minWidth, max: cfg.maxWidth });
    const layoutChart = autosizeCanvas(chartCanvas, { aspect: cfg.chartAspect, min: cfg.minWidth, max: cfg.maxWidth });
    const tctx = () => layoutTable.ctx;
    const cctx = () => layoutChart.ctx;

    // ---- State ----
    const state = {
      x: 0, y: 0, r: cfg.ballRadius,
      vx: 0, vy: 0,
      mode: 'idle',            // 'idle' | 'dragBall' | 'aim' | 'hitting' | 'moving'
      hitFrame: 0,
      aimVec: { x: 0, y: 0 },  // pointer → ball (toward the ball)
      frictionFactor: cfg.frictionFactor,
      restitution: cfg.restitution,
      E0: 0, Etrans: 0, Wfric: 0, Winel: 0,
      t: 0, samples: []        // {t, Etrans, Wfric, Winel}
    };

    function placeCenter(force=false){
      if (force || (state.x===0 && state.y===0)) { state.x = layoutTable.width*0.5; state.y = layoutTable.height*0.5; }
      else {
        state.x = clamp(state.x, state.r, layoutTable.width  - state.r);
        state.y = clamp(state.y, state.r, layoutTable.height - state.r);
      }
    }
    placeCenter(true);

    // ---- UI bindings ----
    const linkFric = linkRangeNumber(frRange, frNum, {
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
      state.vx=state.vy=0; state.mode='idle'; state.hitFrame=0;
      state.aimVec.x=state.aimVec.y=0;
      state.E0=state.Etrans=state.Wfric=state.Winel=0;
      state.t=0; state.samples=[];
      placeCenter(true); drawAll(); renderEquation();
      announce(liveEl, 'Reset. Drag the ball or pull to aim.');
    }
    resetBtn && resetBtn.addEventListener('click', hardReset);

    // Hover affordance
    const ballHitTest = (p) => { const dx=p.x-state.x, dy=p.y-state.y; return dx*dx + dy*dy <= state.r*state.r; };
    hoverCursor && hoverCursor(tableCanvas, { hitTest: ballHitTest, hover:'grab', normal:'', isDragging:()=>state.mode==='dragBall' });

    // ---- Gesture mapping ----
    const pullToSpeed = (lenPx)=> cfg.maxSpeedPxPerFrame * Math.sqrt(clamp(lenPx/cfg.maxPull, 0, 1));

    onPointerDrag(tableCanvas, {
      hitTest: ()=>true,
      onStart: (p)=>{
        if (ballHitTest(p)) {
          state.vx=state.vy=0; state.mode='dragBall'; state.hitFrame=0; tableCanvas.style.cursor='grabbing'; return;
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

    // ---- Physics ----
    function beginMotionFromAim(){
      const L = Math.hypot(state.aimVec.x, state.aimVec.y);
      if (L<=0) return;
      const ux = state.aimVec.x / L, uy = state.aimVec.y / L; // toward ball
      const speed = pullToSpeed(L);
      state.vx = speed * ux;
      state.vy = speed * uy;
      state.aimVec.x = state.aimVec.y = 0;

      state.E0 = 0.5*(state.vx*state.vx + state.vy*state.vy);
      state.Etrans = state.E0; state.Wfric=0; state.Winel=0;
      state.t = 0; state.samples = []; sampleEnergy();
      renderEquation();
      announce(liveEl, 'Shot! Force equals pull direction.');
    }

    function collideWallsAndTrackLoss(){
      const e = state.restitution;
      let bounced = false;
      const v2b = state.vx*state.vx + state.vy*state.vy;

      if (state.x - state.r < 0) { state.x = state.r; state.vx =  Math.abs(state.vx) * e; bounced = true; }
      else if (state.x + state.r > layoutTable.width)  { state.x = layoutTable.width - state.r; state.vx = -Math.abs(state.vx) * e; bounced = true; }
      if (state.y - state.r < 0) { state.y = state.r; state.vy =  Math.abs(state.vy) * e; bounced = true; }
      else if (state.y + state.r > layoutTable.height) { state.y = layoutTable.height - state.r; state.vy = -Math.abs(state.vy) * e; bounced = true; }

      if (bounced && e<1.0) {
        const v2a = state.vx*state.vx + state.vy*state.vy;
        const dE = 0.5*(v2b - v2a);
        if (dE>0) state.Winel += dE;
      }
    }

    function applyFrictionAndTrackLoss(){
      if (state.frictionFactor >= 1.0) return;
      const v2b = state.vx*state.vx + state.vy*state.vy;
      state.vx *= state.frictionFactor; state.vy *= state.frictionFactor;
      const v2a = state.vx*state.vx + state.vy*state.vy;
      const dE = 0.5*(v2b - v2a);
      if (dE>0) state.Wfric += dE;
    }

    function energyCorrection(){
      state.Etrans = 0.5*(state.vx*state.vx + state.vy*state.vy);
      const sum = state.Etrans + state.Wfric + state.Winel;
      const corr = state.E0 - sum;
      if (Math.abs(corr)>1e-6) state.Wfric = Math.max(0, state.Wfric + corr);
    }

    function sampleEnergy(){
      state.samples.push({ t: state.t, Etrans: state.Etrans, Wfric: state.Wfric, Winel: state.Winel });
      if (state.samples.length > cfg.samplesMax) state.samples.shift();
    }

    // ---- Drawing: table & cue ----
    function drawTable(){
      const c = tctx(), w = layoutTable.width, h = layoutTable.height;
      c.clearRect(0,0,w,h);

      // Felt + rails
      c.fillStyle = "#35654d"; c.fillRect(0,0,w,h);
      const rail=8; c.fillStyle="#1f3a2c";
      c.fillRect(0,0,w,rail); c.fillRect(0,h-rail,w,rail);
      c.fillRect(0,0,rail,h); c.fillRect(w-rail,0,rail,h);

      // Ball
      c.beginPath(); c.arc(state.x, state.y, state.r, 0, Math.PI*2);
      c.fillStyle="#f7f7f7"; c.shadowColor="rgba(0,0,0,0.25)"; c.shadowBlur=4; c.fill(); c.shadowBlur=0;

      // Cue + pull visuals
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

        // cue retreats along the same line; tip sits behind the ball (your fix)
        const tipX  = state.x + ux * (-cfg.cueGap - retract);
        const tipY  = state.y + uy * (-cfg.cueGap - retract);
        const buttX = tipX - ux * cfg.cueLength;
        const buttY = tipY - uy * cfg.cueLength;

        c.lineCap="round";
        c.lineWidth=6;  c.strokeStyle="#b88955"; c.beginPath(); c.moveTo(buttX,buttY); c.lineTo(tipX,tipY); c.stroke();
        c.lineWidth=10; c.strokeStyle="#7a5c3a"; c.beginPath(); c.moveTo(buttX,buttY); c.lineTo(buttX+ux*18,buttY+uy*18); c.stroke();
      }

      // force line with chevrons toward the ball
      if (state.mode==='aim' && L>6){
        const farX = state.x + ux*L, farY = state.y + uy*L; // distal end (hand)
        const nearX = state.x, nearY = state.y;            // ball
        c.lineWidth=2; c.strokeStyle="rgba(255,255,255,0.9)";
        c.beginPath(); c.moveTo(farX,farY); c.lineTo(nearX,nearY); c.stroke();

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
        const legend = `Power: ${'▁▃▆█'.slice(0,bars)}`;
        c.font="12px system-ui, -apple-system, Segoe UI, Roboto, Arial"; c.fillStyle="rgba(255,255,255,0.9)";
        const tx = state.x + ux*(L*0.55), ty = state.y + uy*(L*0.55);
        c.fillText(legend, tx+8, ty-8);
      }
    }

    // ---- Drawing: Energy Ledger (rolling window; “now” at 2/3) ----
    function drawLedger(){
      const c = cctx(), W = layoutChart.width, H = layoutChart.height;
      c.clearRect(0,0,W,H);

      // Margins and inner plot
      const m = { l: 42, r: 12, t: 14, b: 30 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;

      c.save(); c.translate(m.l, m.t);

      // Grid: vertical ticks at fixed seconds, horizontal at 10 divisions
      c.lineWidth = 1; c.strokeStyle = "#e6e6e6";
      const Tw = cfg.timeWindowSec;
      const f  = cfg.nowFrac;
      const tNow = state.t;
      const tLeft  = Math.max(0, tNow - f*Tw);
      const tRight = tLeft + Tw;

      // vertical grid & rolling labels
      const S = cfg.tickSec;
      let tTick = Math.ceil(tLeft / S) * S;
      c.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      c.fillStyle = "#666";
      while (tTick <= tRight + 1e-9) {
        const x = ((tTick - tLeft) / Tw) * iw;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ih); c.stroke();
        c.textAlign = "center"; c.fillText(`${tTick.toFixed(1)}s`, x, ih + 16);
        tTick += S;
      }
      // horizontal grid
      for (let j=0; j<=10; j++){ const y=(j/10)*ih; c.beginPath(); c.moveTo(0,y); c.lineTo(iw,y); c.stroke(); }

      // y-axis label
      c.fillStyle = "#444";
      c.save(); c.translate(-28, ih*0.5); c.rotate(-Math.PI/2); c.textAlign="center"; c.fillText("Energy", 0, 0); c.restore();

      // no data yet → just draw “now” line
      if (!state.E0 || state.samples.length === 0) {
        const xNowEmpty = f * iw;
        c.strokeStyle = "#bbb"; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(xNowEmpty, 0); c.lineTo(xNowEmpty, ih); c.stroke();
        c.restore(); return;
      }

      const yOf = (E)=> ih - clamp(E/state.E0, 0, 1) * ih;
      const xOf = (t)=> ((t - tLeft) / Tw) * iw;

      // “now” line
      const xNow = xOf(tNow);
      c.strokeStyle = "#bbb"; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(xNow, 0); c.lineTo(xNow, ih); c.stroke();

      // visible data
      const data = state.samples;
      let i0 = 0;
      for (let i = data.length - 1; i >= 0; i--) { if (data[i].t <= tLeft) { i0 = Math.max(0, i); break; } }
      const i1 = data.length - 1;

      const pathFric = new Path2D();
      const pathInel = new Path2D();
      const pathMove = new Path2D();

      // areas (stacked)
      pathFric.moveTo(xOf(Math.max(tLeft, data[i0].t)), yOf(0));
      for (let i=i0;i<=i1;i++){ const s=data[i]; pathFric.lineTo(xOf(s.t), yOf(s.Wfric)); }
      pathFric.lineTo(xOf(data[i1].t), yOf(0)); pathFric.closePath();

      pathInel.moveTo(xOf(Math.max(tLeft, data[i0].t)), yOf(data[i0].Wfric));
      for (let i=i0;i<=i1;i++){ const s=data[i]; pathInel.lineTo(xOf(s.t), yOf(s.Wfric+s.Winel)); }
      pathInel.lineTo(xOf(data[i1].t), yOf(data[i1].Wfric)); pathInel.closePath();

      pathMove.moveTo(xOf(Math.max(tLeft, data[i0].t)), yOf(data[i0].Wfric + data[i0].Winel));
      for (let i=i0;i<=i1;i++){ const s=data[i]; pathMove.lineTo(xOf(s.t), yOf(s.Wfric+s.Winel+s.Etrans)); }
      pathMove.lineTo(xOf(data[i1].t), yOf(data[i1].Wfric + data[i1].Winel)); pathMove.closePath();

      // fills (semi-transparent)
      c.fillStyle = "rgba(244,119,74,0.30)";  c.fill(pathFric); // Friction
      c.fillStyle = "rgba(231,188,79,0.30)";  c.fill(pathInel); // Inelastic
      c.fillStyle = "rgba(80,170,155,0.35)";  c.fill(pathMove); // Motion

      // component lines
      c.lineWidth = 2;
      c.strokeStyle = "rgba(244,119,74,0.95)";
      c.beginPath(); for (let i=i0;i<=i1;i++){ const s=data[i]; const x=xOf(s.t), y=yOf(s.Wfric); (i===i0)?c.moveTo(x,y):c.lineTo(x,y); } c.stroke();
      c.strokeStyle = "rgba(231,188,79,0.95)";
      c.beginPath(); for (let i=i0;i<=i1;i++){ const s=data[i]; const x=xOf(s.t), y=yOf(s.Wfric+s.Winel); (i===i0)?c.moveTo(x,y):c.lineTo(x,y); } c.stroke();
      c.strokeStyle = "rgba(60,145,130,1.0)";
      c.beginPath(); for (let i=i0;i<=i1;i++){ const s=data[i]; const x=xOf(s.t), y=yOf(s.Wfric+s.Winel+s.Etrans); (i===i0)?c.moveTo(x,y):c.lineTo(x,y); } c.stroke();

      // invariant total energy reference line
      c.setLineDash([4,3]); c.strokeStyle="rgba(70,70,70,0.8)"; c.lineWidth=1.5;
      c.beginPath(); c.moveTo(0, yOf(state.E0)); c.lineTo(iw, yOf(state.E0)); c.stroke(); c.setLineDash([]);

      // current-time dot on Motion curve
      const sNow = data[i1];
      const yNow = yOf(sNow.Wfric + sNow.Winel + sNow.Etrans);
      c.fillStyle = "rgba(60,145,130,1.0)";
      c.beginPath(); c.arc(xNow, yNow, 3.5, 0, Math.PI*2); c.fill();

      c.restore();
    }

    function drawAll(){ drawTable(); drawLedger(); }

    // ---- Loop ----
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
        state.t += dt;
        state.x += state.vx; state.y += state.vy;
        collideWallsAndTrackLoss();
        applyFrictionAndTrackLoss();

        if (Math.hypot(state.vx,state.vy) < 0.01){
          state.vx=state.vy=0; state.mode='idle'; announce(liveEl,'Came to rest.');
        }

        energyCorrection();
        sampleEnergy();
      }

      drawAll();
      lastT=now; requestAnimationFrame(loop);
    }
    loop();
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.wgt[data-widget="pool-invariance"]').forEach(el => initOne(el));
  });

  // Manual init
  window.PoolInvarianceInit = function(idOrEl, opts){
    const el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (el) initOne(el, opts);
  };
})();
// ---------- end js/pool-invariance.js ----------
