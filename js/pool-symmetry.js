// ---------- js/pool-symmetry.js ----------
(function () {
  const {
    autosizeCanvas, clamp, onPointerDrag, linkRangeNumber, announce,
    hoverCursor, ensurePanelFigure, renderLatex
  } = window.Widgets || {};

  // No external sprite assets; use vector drawings for reliability

  function initOne(root, opts = {}) {
    if (!autosizeCanvas || !ensurePanelFigure) {
      console.error("widgets-core.js v0.3+ must load before pool-symmetry.js");
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

      // Symmetry-breaking defaults
      sizeField: { enabled: false, amp: 0.6 }, // radius = baseR * (1 + amp * ((x/W)-0.5))
      transmute: {
        enabled: false,
        region: { cx: 0.80, cy: 0.25, r: 0.10 },
        random: { enabled: true, minDelay: 0.8, maxDelay: 2.0 }
      },

      // Energy ledger (rolling window)
      timeWindowSec: 3.0,
      nowFrac: 2/3,
      tickSec: 0.5,
      samplesMax: 2400,

      ...opts
    };

    // ---- DOM
    const tableCanvas = root.querySelector('canvas[data-role="table"]')
                      || root.querySelector('.wgt__canvas canvas');
    const outPanel    = root.querySelector('.wgt__output') || root;

    const { canvas: chartCanvas, legend: legendEl, eq: eqEl } =
      ensurePanelFigure(outPanel, { role: 'ledger', ensureLegend: true, ensureEq: true });

    if (legendEl) {
      legendEl.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:rgba(60,145,130,1.0);border-radius:2px;"></span> Kinetic
        </span>`;
    }

    function setEquation(){
      if (!eqEl) return;
      const alreadyTypeset = !!eqEl.querySelector('.katex');
      if (alreadyTypeset) return;
      const hasInlineTex = /\$[^$]+\$|\\\(|\\\[/.test(eqEl.textContent || '');
      if (hasInlineTex) { if (window.Quarto?.typesetMath) window.Quarto.typesetMath(eqEl); return; }
      //renderLatex(eqEl, String.raw`K + W_{\mathrm{fric}} + W_{\mathrm{inel}} = E_0 + W_{\mathrm{ext}}`, { displayMode: false });
    }
    setEquation();

    // Live region
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

    // Controls (optional bindings)
    const frRange = root.querySelector('[data-role="fric-range"]');
    const frNum   = root.querySelector('[data-role="fric-num"]');
    const reRange = root.querySelector('[data-role="rest-range"]');
    const reNum   = root.querySelector('[data-role="rest-num"]');
    const resetBtn= root.querySelector('[data-role="reset"]');
    // No transmute region or transmute-now UI in this version
    const transRandChk = root.querySelector('[data-role="transmute-rand-on"]');
    const sizeFieldChk = root.querySelector('[data-role="sizefield-on"]');
    const sizeFieldNum = root.querySelector('[data-role="sizefield-amp"]');

    const layoutTable = autosizeCanvas(tableCanvas, { aspect: cfg.aspect,     min: cfg.minWidth, max: cfg.maxWidth });
    const layoutChart = autosizeCanvas(chartCanvas, { aspect: cfg.chartAspect, min: cfg.minWidth, max: cfg.maxWidth });
    const tctx = () => layoutTable.ctx;
    const cctx = () => layoutChart.ctx;

    // ---- State ----
    const state = {
      // Ball kinematics; we model size visually but treat mass via size^2
      x: 0, y: 0, r: cfg.ballRadius, baseR: cfg.ballRadius,
      vx: 0, vy: 0,
      mode: 'idle',
      hitFrame: 0,
      aimVec: { x: 0, y: 0 },

      // Environment
      frictionFactor: cfg.frictionFactor,
      restitution: cfg.restitution,

      // Symmetry breakers
      sizeField: { ...cfg.sizeField },
      transmute: { ...cfg.transmute, _done: false, hopT: 0, creature: null, px: 0, py: 0, vx: 0, vy: 0, rot: 0, scheduledAt: null },

      // Energies (m depends on r)
      m0: 0, E0: 0, Etrans: 0, Wfric: 0, Winel: 0, Wext: 0,
      t: 0,
      samples: [] // { t, Etrans, Wfric, Winel, Wext }
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

    // Bind UI
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

    if (transRandChk) transRandChk.checked = !!state.transmute.random.enabled;
    transRandChk && transRandChk.addEventListener('change', (e)=>{
      state.transmute.random.enabled = !!e.target.checked;
      if (state.mode==='moving' && state.transmute.scheduledAt == null) {
        const delay = Math.random() * 4.0;
        state.transmute.scheduledAt = state.t + delay;
      }
    });

    if (sizeFieldChk) sizeFieldChk.checked = !!state.sizeField.enabled;
    if (sizeFieldNum) sizeFieldNum.value = Number(state.sizeField.amp).toFixed(2);
    sizeFieldChk && sizeFieldChk.addEventListener('change', (e)=>{ state.sizeField.enabled = !!e.target.checked; recalcRadius(); drawAll(); });
    sizeFieldNum && sizeFieldNum.addEventListener('input', (e)=>{ const v=clamp(Number(e.target.value)||0, 0, 1.5); state.sizeField.amp=v; e.target.value=v.toFixed(2); recalcRadius(); drawAll();});

    function hardReset(){
      state.vx = state.vy = 0; state.mode='idle'; state.hitFrame=0;
      state.aimVec.x = state.aimVec.y = 0;
      state.E0 = state.Etrans = state.Wfric = state.Winel = state.Wext = 0;
      state.t = 0; state.samples = [];
      state.transmute._done = false; state.transmute.hopT = 0; state.transmute.creature = null; state.transmute.px = 0; state.transmute.py = 0; state.transmute.vx = 0; state.transmute.vy = 0; state.transmute.rot = 0; state.transmute.scheduledAt = null;
      placeCenter(true); recalcRadius();
      setEquation(); drawAll();
      announce(liveEl, 'Reset. Drag the ball or pull to aim.');
    }
    resetBtn && resetBtn.addEventListener('click', hardReset);

    // Pointer affordances
    const ballHitTest = (p) => { const dx=p.x-state.x, dy=p.y-state.y; return dx*dx + dy*dy <= state.r*state.r; };
    hoverCursor && hoverCursor(tableCanvas, { hitTest: ballHitTest, hover:'grab', normal:'', isDragging:()=>state.mode==='dragBall' });

    const pullToSpeed = (lenPx)=> cfg.maxSpeedPxPerFrame * Math.sqrt(clamp(lenPx/cfg.maxPull, 0, 1));

    onPointerDrag(tableCanvas, {
      hitTest: ()=> state.mode !== 'transmuted',
      onStart: (p)=>{
        if (state.mode==='transmuted') return;
        if (ballHitTest(p)) { state.vx=state.vy=0; state.mode='dragBall'; state.hitFrame=0; tableCanvas.style.cursor='grabbing'; return; }
        if (state.mode!=='hitting') { state.mode='aim'; state.aimVec.x = state.x - p.x; state.aimVec.y = state.y - p.y; }
      },
      onMove: (p)=>{
        if (state.mode==='transmuted') return;
        if (state.mode==='dragBall') { state.x = clamp(p.x, state.r, layoutTable.width - state.r); state.y = clamp(p.y, state.r, layoutTable.height - state.r); recalcRadius(); drawAll(); return; }
        if (state.mode==='aim') { state.aimVec.x = state.x - p.x; state.aimVec.y = state.y - p.y; drawAll(); }
      },
      onEnd: ()=>{
        if (state.mode==='transmuted') { drawAll(); return; }
        if (state.mode==='dragBall') { state.mode='idle'; tableCanvas.style.cursor=''; drawAll(); return; }
        if (state.mode==='aim') { const L=Math.hypot(state.aimVec.x,state.aimVec.y); if(L>5){ state.mode='hitting'; state.hitFrame=0; announce(liveEl,'Shot armed.'); } else { state.mode='idle'; state.aimVec.x=state.aimVec.y=0; } }
      }
    });

    // Physics helpers
    function mass(){
      // Use radius^2 as a simple mass proxy (area ~ size visually)
      const ratio = state.r / state.baseR;
      return ratio * ratio;
    }

    function beginMotionFromAim(){
      const L = Math.hypot(state.aimVec.x, state.aimVec.y);
      if (L<=0) return;
      const ux = state.aimVec.x / L, uy = state.aimVec.y / L;
      const speed = pullToSpeed(L);
      state.vx = speed * ux; state.vy = speed * uy; state.aimVec.x = state.aimVec.y = 0;

      // Initialize energy ledger with current mass
      const m = mass();
      state.m0 = m;
      state.E0 = 0.5*m*(state.vx*state.vx + state.vy*state.vy);
      state.Etrans = state.E0; state.Wfric=0; state.Winel=0; state.Wext=0;
      state.t = 0; state.samples = []; sampleEnergy();
      setEquation(); announce(liveEl, 'Shot!');

      // Schedule random transmutation if enabled (0..4s after shot)
      const r = state.transmute.random;
      if (r?.enabled && !state.transmute._done) {
        const delay = Math.random() * 4.0; // seconds
        state.transmute.scheduledAt = state.t + delay;
      } else {
        state.transmute.scheduledAt = null;
      }
    }

    function collideWallsAndTrackLoss(){
      const e = state.restitution;
      let bounced = false;
      const m = mass();
      const v2b = state.vx*state.vx + state.vy*state.vy;

      if (state.x - state.r < 0) { state.x = state.r;                         state.vx =  Math.abs(state.vx) * e; bounced = true; }
      else if (state.x + state.r > layoutTable.width)  { state.x = layoutTable.width  - state.r; state.vx = -Math.abs(state.vx) * e; bounced = true; }
      if (state.y - state.r < 0) { state.y = state.r;                         state.vy =  Math.abs(state.vy) * e; bounced = true; }
      else if (state.y + state.r > layoutTable.height) { state.y = layoutTable.height - state.r; state.vy = -Math.abs(state.vy) * e; bounced = true; }

      if (bounced && e<1.0){
        const v2a = state.vx*state.vx + state.vy*state.vy;
        const dE = 0.5*m*(v2b - v2a);
        if (dE>0) state.Winel += dE; // inelastic cushion loss
      }
    }

    function applyFrictionAndTrackLoss(){
      if (state.frictionFactor >= 1.0) return;
      const m = mass();
      const v2b = state.vx*state.vx + state.vy*state.vy;
      state.vx *= state.frictionFactor; state.vy *= state.frictionFactor;
      const v2a = state.vx*state.vx + state.vy*state.vy;
      const dE = 0.5*m*(v2b - v2a);
      if (dE>0) state.Wfric += dE;
    }

    // No region trigger in this version
    function triggerTransmutation(){
      state.mode = 'transmuted';
      state.transmute._done = true; state.transmute.hopT = 0;
      state.vx = state.vy = 0;
      state.tEvent = state.t;
      // Initialize creature and motion (vector only)
      const kinds = ['frog','rabbit','bird','bear','lion'];
      const k = kinds[Math.floor(Math.random()*kinds.length)];
      state.transmute.creature = k;
      state.transmute.px = state.x; state.transmute.py = state.y;
      // Random outbound direction roughly up-right
      const ang = (-Math.PI/2) + (Math.random()*Math.PI/3 - Math.PI/6); // around upward
      const base = (k==='frog')?1.8:(k==='rabbit')?2.0:(k==='bird')?2.2:(k==='bear')?1.5:1.7;
      const speed = base + Math.random()*0.8;
      state.transmute.vx = Math.cos(ang) * speed;
      state.transmute.vy = Math.sin(ang) * speed;
      state.transmute.rot = 0;
      announce(liveEl, 'The ball transformed and left the table. Ledger halted.');
    }

    function recalcRadius(){
      const sf = state.sizeField; if (!sf.enabled) { state.r = state.baseR; return; }
      const W = layoutTable.width; if (!W) return;
      const xFrac = clamp(state.x / W, 0, 1);
      const f = 1 + sf.amp * (xFrac - 0.5); // left small, right large
      const oldM = mass();
      state.r = clamp(state.baseR * f, 4, 26);
      // Changing mass at same velocity changes KE → account as external work
      const newM = mass();
      const v2 = state.vx*state.vx + state.vy*state.vy;
      const dE = 0.5*(newM - oldM) * v2;
      if (dE!==0) state.Wext += dE;
    }

    function sampleEnergy(){
      // Maintain current kinetic with current mass
      state.Etrans = 0.5*mass()*(state.vx*state.vx + state.vy*state.vy);
      state.samples.push({ t: state.t, Etrans: state.Etrans, Wfric: state.Wfric, Winel: state.Winel, Wext: state.Wext });
      if (state.samples.length > cfg.samplesMax) state.samples.shift();
    }

    // Drawing
    function drawTable(){
      const c = tctx(), w = layoutTable.width, h = layoutTable.height;
      c.clearRect(0,0,w,h);
      c.fillStyle = "#35654d"; c.fillRect(0,0,w,h);
      const rail=8; c.fillStyle="#1f3a2c";
      c.fillRect(0,0,w,rail); c.fillRect(0,h-rail,w,rail); c.fillRect(0,0,rail,h); c.fillRect(w-rail,0,rail,h);

      // No region marker (random transmutation only)

      // Ball or creature
      if (state.mode !== 'transmuted'){
        c.beginPath(); c.arc(state.x, state.y, state.r, 0, Math.PI*2);
        c.fillStyle="#f7f7f7"; c.shadowColor="rgba(0,0,0,0.25)"; c.shadowBlur=4; c.fill(); c.shadowBlur=0;
      } else {
        // Draw creature as vectors (frog, rabbit, bird, bear, lion)
        const hop = state.transmute.hopT || 0;
        const k = state.transmute.creature || 'frog';
        const px = state.transmute.px; const py = state.transmute.py;
        c.save();
        c.translate(px, py);
        if (k==='frog'){
          c.fillStyle = "#3aa34b";
          c.beginPath(); c.ellipse(0, 0, state.r*1.2, state.r*0.9, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#fff"; c.beginPath(); c.arc(-state.r*0.4, -state.r*0.35, 2.4, 0, Math.PI*2); c.arc(state.r*0.4, -state.r*0.35, 2.4, 0, Math.PI*2); c.fill();
          c.fillStyle = "#222"; c.beginPath(); c.arc(-state.r*0.4, -state.r*0.35, 1.2, 0, Math.PI*2); c.arc(state.r*0.4, -state.r*0.35, 1.2, 0, Math.PI*2); c.fill();
        }
        else if (k==='rabbit'){
          c.fillStyle = "#ddd";
          c.beginPath(); c.ellipse(0, 0, state.r*1.3, state.r*0.95, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#eee"; c.beginPath(); c.ellipse(-state.r*0.3, -state.r*1.1, state.r*0.25, state.r*0.6, 0, 0, Math.PI*2); c.ellipse(state.r*0.3, -state.r*1.1, state.r*0.25, state.r*0.6, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#f4a"; c.beginPath(); c.ellipse(-state.r*0.3, -state.r*1.1, state.r*0.12, state.r*0.45, 0, 0, Math.PI*2); c.ellipse(state.r*0.3, -state.r*1.1, state.r*0.12, state.r*0.45, 0, 0, Math.PI*2); c.fill();
        }
        else if (k==='bird'){
          c.rotate(state.transmute.rot);
          c.fillStyle = "#55a7ff";
          c.beginPath(); c.ellipse(0, 0, state.r*1.2, state.r*0.8, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#4c96e6";
          c.beginPath(); c.ellipse(-state.r*0.1, 0, state.r*0.3, state.r*0.7, Math.PI/2, 0, Math.PI*2); c.fill();
          c.beginPath(); c.ellipse(state.r*0.1, 0, state.r*0.3, state.r*0.7, -Math.PI/2, 0, Math.PI*2); c.fill();
          c.fillStyle = "#222"; c.beginPath(); c.arc(state.r*0.5, -state.r*0.15, 1.5, 0, Math.PI*2); c.fill();
        }
        else if (k==='bear'){
          c.fillStyle = "#6b4f3a"; // brown body
          c.beginPath(); c.ellipse(0, 0, state.r*1.5, state.r*1.1, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#5a3f2d"; c.beginPath(); c.arc(-state.r*0.7, -state.r*0.7, state.r*0.35, 0, Math.PI*2); c.arc(state.r*0.7, -state.r*0.7, state.r*0.35, 0, Math.PI*2); c.fill();
          c.fillStyle = "#222"; c.beginPath(); c.arc(0, 0, 2, 0, Math.PI*2); c.fill();
        }
        else if (k==='lion'){
          c.fillStyle = "#d9a441"; // golden body
          c.beginPath(); c.ellipse(0, 0, state.r*1.4, state.r*1.0, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#a86b2f"; c.beginPath(); c.ellipse(0, -state.r*0.2, state.r*1.2, state.r*1.2, 0, 0, Math.PI*2); c.fill();
          c.fillStyle = "#222"; c.beginPath(); c.arc(0, 0, 2, 0, Math.PI*2); c.fill();
        }
        c.restore();
      }

      // Cue + pull
      const ax = state.aimVec.x, ay = state.aimVec.y; const L = Math.hypot(ax, ay);
      let ux=1, uy=0; if (L>0) { ux=ax/L; uy=ay/L; }
      const hasAim = (state.mode==='aim' || state.mode==='hitting' || state.mode==='idle');
      if (hasAim) {
        const retract = (state.mode==='aim') ? Math.min(L, cfg.pullBackMaxPx)
          : (state.mode==='hitting' ? Math.max(0, cfg.pullBackMaxPx * (1 - state.hitFrame / cfg.cueAnimFrames)) : 0);
        const tipX  = state.x + ux * (-cfg.cueGap - retract);
        const tipY  = state.y + uy * (-cfg.cueGap - retract);
        const buttX = tipX - ux * cfg.cueLength;
        const buttY = tipY - uy * cfg.cueLength;
        c.lineCap="round"; c.lineWidth=6;  c.strokeStyle="#b88955"; c.beginPath(); c.moveTo(buttX,buttY); c.lineTo(tipX,tipY); c.stroke();
        c.lineWidth=10; c.strokeStyle="#7a5c3a"; c.beginPath(); c.moveTo(buttX,buttY); c.lineTo(buttX+ux*18,buttY+uy*18); c.stroke();
      }

      if (state.mode==='aim' && L>6){
        const farX = state.x + ux*L, farY = state.y + uy*L; // pointer → ball
        c.lineWidth=2; c.strokeStyle="rgba(255,255,255,0.9)"; c.beginPath(); c.moveTo(farX,farY); c.lineTo(state.x,state.y); c.stroke();
        const chevronSpacing=18, chevronSize=6; const speed = clamp(pullToSpeed(L) / cfg.maxSpeedPxPerFrame, 0, 1);
        const phase = ((performance.now()*0.08*(0.5+speed)) % chevronSpacing);
        const n = Math.floor((L - phase) / chevronSpacing);
        c.fillStyle = "rgba(255,255,255,0.9)";
        for (let i=0;i<n;i++){
          const d = phase + i*chevronSpacing; const cx = state.x + ux*(d-8), cy = state.y + uy*(d-8);
          c.beginPath(); c.moveTo(cx,cy); c.lineTo(cx-uy*chevronSize, cy+ux*chevronSize); c.lineTo(cx+uy*chevronSize, cy-ux*chevronSize); c.closePath(); c.fill();
        }
      }
    }

    function drawLedger(){
      const c = cctx(); const W = layoutChart.width, H = layoutChart.height; c.save(); c.clearRect(0,0,W,H);
      const padL=42, padR=8, padT=10, padB=28; const iw=W-padL-padR, ih=H-padT-padB; c.translate(padL, padT);
      c.fillStyle = "#fff"; c.fillRect(-padL,-padT,W,H);
      c.strokeStyle="#ddd"; c.lineWidth=1;
      // Time window
      const Tw = cfg.timeWindowSec; const f = cfg.nowFrac; const tNow = state.t; const tLeft = Math.max(0, tNow - Tw*(1-f));
      // Axes
      c.strokeStyle="#e5e5e5"; c.lineWidth=1;
      const S = cfg.tickSec; let tTick = Math.ceil(tLeft/S)*S; while (tTick < tNow + Tw*f){ const x = ((tTick - tLeft) / Tw) * iw; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ih); c.stroke(); c.textAlign = "center"; c.fillStyle="#666"; c.fillText(`${tTick.toFixed(1)}s`, x, ih + 16); tTick += S; }
      for (let j=0;j<=10;j++){ const y=(j/10)*ih; c.beginPath(); c.moveTo(0,y); c.lineTo(iw,y); c.stroke(); }
      c.fillStyle="#444"; c.save(); c.translate(-34, ih*0.5); c.rotate(-Math.PI/2); c.textAlign="center"; c.fillText("Kinetic Energy", 0, 0); c.restore();

      if (!state.E0 || state.samples.length===0){ const xNow = f*iw; c.strokeStyle="#bbb"; c.lineWidth=1.5; c.beginPath(); c.moveTo(xNow,0); c.lineTo(xNow,ih); c.stroke(); c.restore(); return; }

      const xOf = (t)=> ((t - tLeft) / Tw) * iw;
      const yOf = (E, Eref)=> ih - clamp(E / Math.max(1e-9, Eref), 0, 1) * ih; // fixed reference

      const data = state.samples; let i0 = 0; for (let i=data.length-1;i>=0;i--){ if (data[i].t <= tLeft) { i0=Math.max(0,i); break; } }
      const i1 = data.length-1; const xNow = xOf(tNow);

      // Fixed reference: theoretical maximum kinetic energy under current settings
      function massMax(){
        if (!state.sizeField.enabled) return 1.0; // m/base
        const rMax = clamp(state.baseR * (1 + state.sizeField.amp * 0.5), 4, 26);
        return (rMax / state.baseR) * (rMax / state.baseR);
      }
      const m0 = state.m0 || mass();
      const Eref = state.E0 * (massMax() / (m0 > 0 ? m0 : 1.0));
      // Y tick labels (0..Eref)
      c.fillStyle = "#666"; c.textAlign = "right";
      for (let j=0;j<=4;j++){
        const frac = j/4; const val = Eref * frac; const y = ih - frac * ih;
        c.fillText(val.toFixed(2), -6, y+3);
      }
      // Reference line at initial E0 (grey dashed)
      c.setLineDash([4,3]); c.strokeStyle="rgba(70,70,70,0.8)"; c.lineWidth=1.5; c.beginPath(); c.moveTo(0, yOf(state.E0, Eref)); c.lineTo(iw, yOf(state.E0, Eref)); c.stroke(); c.setLineDash([]);

      // Kinetic energy line
      c.lineWidth=2; c.strokeStyle = "rgba(60,145,130,1.0)"; c.beginPath();
      for (let i=i0;i<=i1;i++){ const s=data[i], x=xOf(s.t), y=yOf(s.Etrans, Eref); (i===i0)?c.moveTo(x,y):c.lineTo(x,y);} c.stroke();

      // Now/event line + current dot
      c.strokeStyle="#bbb"; c.lineWidth=1.5; c.beginPath(); c.moveTo(xNow,0); c.lineTo(xNow,ih); c.stroke();
      const sNow = data[i1]; const yNow = yOf(sNow.Etrans, Eref);
      c.fillStyle = "rgba(60,145,130,1.0)"; c.beginPath(); c.arc(xNow, yNow, 3.5, 0, Math.PI*2); c.fill();

      // If transmuted, fade and overlay a question mark
      if (state.mode === 'transmuted'){
        c.save();
        c.globalAlpha = 0.30;
        c.fillStyle = '#fff';
        c.fillRect(-padL, -padT, W, H);
        c.restore();

        c.save();
        c.fillStyle = '#333';
        c.textAlign = 'center';
        c.font = 'bold 44px system-ui, sans-serif';
        c.fillText('?', iw*0.5, ih*0.45);
        c.font = '12px system-ui, sans-serif';
        c.fillText('System ceased to be the modeled object', iw*0.5, ih*0.45 + 22);
        c.restore();
      }

      c.restore();
    }

    function drawAll(){ drawTable(); drawLedger(); }

    // Main loop
    let lastT = performance.now();
    function loop(){
      const now = performance.now();
      const dt = Math.max(1e-3, Math.min(0.05, (now-lastT)/1000));

      if (state.mode==='hitting'){
        state.hitFrame++;
        if (state.hitFrame >= cfg.cueAnimFrames){ state.mode='moving'; beginMotionFromAim(); }
        drawAll(); lastT=now; requestAnimationFrame(loop); return;
      }

      if (state.mode==='moving'){
        state.t += dt; state.x += state.vx; state.y += state.vy;
        collideWallsAndTrackLoss();
        recalcRadius(); // size field may inject/remove energy as x changes
        applyFrictionAndTrackLoss();

        // Random-time trigger
        if (state.transmute.scheduledAt != null && !state.transmute._done && state.t >= state.transmute.scheduledAt) {
          triggerTransmutation();
        }
        // After transmutation, skip rest-of-motion bookkeeping
        if (state.mode !== 'transmuted') {
          if (Math.hypot(state.vx,state.vy) < 0.01) { state.vx=state.vy=0; state.mode='idle'; announce(liveEl, 'Came to rest.'); }
          sampleEnergy();
        }
      }

      // Advance creature animation if transmuted (simple kinematics)
      if (state.mode==='transmuted') {
        const w = layoutTable.width, h = layoutTable.height;
        state.transmute.hopT += 1;
        const k = state.transmute.creature || 'frog';
        if (k === 'frog' || k === 'rabbit' || k==='bear' || k==='lion'){
          // Hop: piecewise parabolic bumps while moving outward
          const t = state.transmute.hopT;
          const hopPhase = (t % 28) / 28;
          const amp = (k==='frog')?16:(k==='rabbit')?22:(k==='bear')?12:14;
          const bump = Math.sin(hopPhase * Math.PI) * amp;
          state.transmute.px += state.transmute.vx;
          state.transmute.py += state.transmute.vy - 0.18 + (-bump*0.02);
        } else if (k === 'bird'){
          // Glide upward and rotate a bit
          state.transmute.px += state.transmute.vx * 1.1;
          state.transmute.py += state.transmute.vy * 1.1 - 0.25;
          state.transmute.rot += 0.012;
        }
        // If fully off-canvas, keep it off; do nothing else (await Reset)
        if (state.transmute.px < -40 || state.transmute.px > w + 40 || state.transmute.py < -60 || state.transmute.py > h + 60) {
          // Stop updating further motion gently
          state.transmute.vx *= 0.98; state.transmute.vy *= 0.98;
        }
      }
      drawAll(); lastT=now; requestAnimationFrame(loop);
    }
    loop();
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.wgt[data-widget="pool-symmetry"]').forEach(el => initOne(el));
  });

  // Optional manual init
  window.PoolSymmetryInit = function(idOrEl, opts){
    const el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (el) initOne(el, opts);
  };
})();
// ---------- end js/pool-symmetry.js ----------
