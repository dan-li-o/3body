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
      transmute: { ...cfg.transmute, _done: false, hopT: 0, creature: null, px: 0, py: 0, vx: 0, vy: 0, rot: 0, scheduledAt: null,
        phase: 'idle', phaseT: 0,
        bubbleMs: 900, anticipateMs: 600, hop1Ms: 1800, noteMs: 1200, noteVisible: false, noteAt: {x:0,y:0},
        bounced: false
      },

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
      // Initialize creature and motion (always white rabbit for gag)
      const k = 'rabbit';
      state.transmute.creature = k;
      state.transmute.px = state.x; state.transmute.py = state.y;
      // Random outbound direction roughly up-right
      const ang = (-Math.PI/2) + (Math.random()*Math.PI/3 - Math.PI/6); // around upward
      // Slower base speed so the gag reads clearly
      const base = 0.9;
      const speed = base + Math.random()*0.4;
      state.transmute.vx = Math.cos(ang) * speed;
      state.transmute.vy = Math.sin(ang) * speed;
      state.transmute.rot = 0;
      state.transmute.phase = 'anticipate';
      state.transmute.phaseT = 0;
      state.transmute.noteVisible = false; state.transmute.noteAt = {x: state.transmute.px, y: state.transmute.py};
      state.transmute.bounced = false;
      // Vector-only gag (no sprite)
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
        // Phased gag draw: anticipate morph, then rabbit with watch, speech bubble, sticky note
        const k = 'rabbit';
        const px = state.transmute.px; const py = state.transmute.py;
        // Anticipation: squash+glow on the ball
        if (state.transmute.phase === 'anticipate'){
          const t = clamp(state.transmute.phaseT / (state.transmute.anticipateMs/1000), 0, 1);
          // Two squeeze cycles before morph
          const cycles = 2;
          const squash = 1 + 0.20*Math.sin(t * cycles * Math.PI);
          c.save(); c.translate(px, py);
          c.shadowColor = 'rgba(255,255,200,0.8)'; c.shadowBlur = 12;
          c.scale(squash, 1/squash);
          c.beginPath(); c.arc(0,0,state.r,0,Math.PI*2); c.fillStyle = '#fdfdfd'; c.fill(); c.shadowBlur=0; c.restore();
        } else {
          // Rabbit body (vector, merged detailed version)
          c.save(); c.translate(px, py);
          const RS = 2.0; // scale up rabbit size
          // Body (main ellipse)
          c.fillStyle = '#f5f5f5';
          c.beginPath();
          c.ellipse(0, 0, RS*state.r*1.3, RS*state.r*0.95, 0, 0, Math.PI*2);
          c.fill();
          // Body outline
          c.strokeStyle = '#ddd';
          c.lineWidth = 1;
          c.stroke();
          // Ears outer (same color as body)
          c.fillStyle = '#f5f5f5';
          c.beginPath();
          c.ellipse(-RS*state.r*0.3, -RS*state.r*1.1, RS*state.r*0.25, RS*state.r*0.6, -0.1, 0, Math.PI*2);
          c.ellipse( RS*state.r*0.3, -RS*state.r*1.1, RS*state.r*0.25, RS*state.r*0.6,  0.1, 0, Math.PI*2);
          c.fill();
          // Ears inner
          c.fillStyle = '#f7a';
          c.beginPath();
          c.ellipse(-RS*state.r*0.3, -RS*state.r*1.1, RS*state.r*0.12, RS*state.r*0.45, -0.1, 0, Math.PI*2);
          c.ellipse( RS*state.r*0.3, -RS*state.r*1.1, RS*state.r*0.12, RS*state.r*0.45,  0.1, 0, Math.PI*2);
          c.fill();
          // Eyes (both)
          c.fillStyle = '#222';
          c.beginPath();
          c.arc( RS*state.r*0.4, -RS*state.r*0.15, RS*2.8, 0, Math.PI*2); // right eye
          c.arc(-RS*state.r*0.2, -RS*state.r*0.15, RS*2.8, 0, Math.PI*2); // left eye
          c.fill();
          // Eye highlights
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc( RS*state.r*0.45, -RS*state.r*0.2, RS*0.8, 0, Math.PI*2);
          c.arc(-RS*state.r*0.15, -RS*state.r*0.2, RS*0.6, 0, Math.PI*2);
          c.fill();
          // Nose (smaller / lower)
          c.fillStyle = '#ff6b9d';
          c.beginPath();
          c.ellipse(RS*state.r*0.1, RS*state.r*0.22, RS*1.0, RS*0.75, 0, 0, Math.PI*2);
          c.fill();
          // Mouth
          c.strokeStyle = '#333';
          c.lineWidth = RS*0.6;
          c.beginPath();
          c.arc(RS*state.r*0.1, RS*state.r*0.25, RS*6, 0.25, Math.PI-0.25);
          c.stroke();
          // Whiskers
          c.strokeStyle = '#666';
          c.lineWidth = RS*0.5;
          c.beginPath();
          // Left
          c.moveTo(-RS*state.r*0.4, RS*state.r*0.1);
          c.lineTo(-RS*state.r*0.8, RS*state.r*0.05);
          c.moveTo(-RS*state.r*0.4, RS*state.r*0.2);
          c.lineTo(-RS*state.r*0.8, RS*state.r*0.2);
          // Right
          c.moveTo(RS*state.r*0.6, RS*state.r*0.1);
          c.lineTo(RS*state.r*1.0, RS*state.r*0.05);
          c.moveTo(RS*state.r*0.6, RS*state.r*0.2);
          c.lineTo(RS*state.r*1.0, RS*state.r*0.2);
          c.stroke();
          // Pocket watch + face
          c.fillStyle = '#d4af37';
          c.beginPath(); c.arc(-RS*state.r*0.7, RS*state.r*0.3, RS*state.r*0.4, 0, Math.PI*2); c.fill();
          c.fillStyle = '#ffffff';
          c.beginPath(); c.arc(-RS*state.r*0.7, RS*state.r*0.3, RS*state.r*0.3, 0, Math.PI*2); c.fill();
          // Watch hands
          c.strokeStyle = '#333'; c.lineWidth = RS*1.0;
          c.beginPath();
          c.moveTo(-RS*state.r*0.7, RS*state.r*0.3);
          c.lineTo(-RS*state.r*0.7, RS*state.r*0.1);
          c.moveTo(-RS*state.r*0.7, RS*state.r*0.3);
          c.lineTo(-RS*state.r*0.6, RS*state.r*0.15);
          c.stroke();
          // Tail
          c.fillStyle = '#f5f5f5';
          c.beginPath(); c.arc(-RS*state.r*1.2, RS*state.r*0.3, RS*state.r*0.3, 0, Math.PI*2); c.fill();
          c.strokeStyle = '#ddd'; c.lineWidth = 1; c.stroke();
          c.restore();

          // Speech bubble during "say" phase
          if (state.transmute.phase === 'say' && state.transmute.phaseT <= state.transmute.bubbleMs/1000){
            // Preferred bubble position: to the right-above of rabbit
            let bx = px + RS*state.r*1.8, by = py - RS*state.r*1.6;
            c.save(); c.fillStyle = '#ffffff'; c.strokeStyle='#333'; c.lineWidth=1.2;
            const bw = 200, bh = 56, M = 6; // larger bubble
            // Helper: clamp rect inside canvas
            function clampRect(){
              if (bx + bw > w - M) bx = w - M - bw;
              if (bx < M) bx = M;
              if (by + bh > h - M) by = h - M - bh;
              if (by < M) by = M;
            }
            clampRect();
            // Avoid overlap with rabbit bbox; try alternate sides if needed
            const rbx = px - RS*state.r*1.4, rby = py - RS*state.r*1.9; // rabbit rough bbox
            const rbw = RS*state.r*2.8, rbh = RS*state.r*3.8;
            function overlaps(){ return !(bx>rbx+rbw || bx+bw<rbx || by>rby+rbh || by+bh<rby); }
            if (overlaps()) {
              // Try left side
              bx = px - RS*state.r*1.8 - bw; by = py - RS*state.r*1.6; clampRect();
              if (overlaps()) {
                // Try above centered
                bx = px - bw/2; by = py - RS*state.r*2.2 - bh; clampRect();
                if (overlaps()) {
                  // Try below
                  bx = px - bw/2; by = py + RS*state.r*0.8; clampRect();
                }
              }
            }
            c.beginPath(); c.rect(bx,by,bw,bh); c.fill(); c.stroke();
            // tail (simple downward tail from bottom-left area)
            c.beginPath(); c.moveTo(bx+26, by+bh); c.lineTo(bx+18, by+bh+14); c.lineTo(bx+38, by+bh); c.closePath(); c.fill(); c.stroke();
            c.fillStyle = '#222'; c.font = '18px system-ui, sans-serif'; c.textAlign='center'; c.textBaseline='middle';
            c.fillText("I'm late!", bx + bw/2, by + bh/2);
            c.restore();
          }

          // Sticky note if visible
          if (state.transmute.noteVisible){
            let nx = state.transmute.noteAt.x, ny = state.transmute.noteAt.y;
            // Ensure note rect stays within canvas and avoids rabbit bbox
            const Wn = 200, Hn = 100, M = 8;
            const rbx = px - RS*state.r*1.4, rby = py - RS*state.r*1.9; // rabbit bbox (same as above)
            const rbw = RS*state.r*2.8, rbh = RS*state.r*3.8;
            function clampNote(){
              nx = Math.max(Wn/2 + M, Math.min(w - Wn/2 - M, nx));
              ny = Math.max(Hn/2 + M, Math.min(h - Hn/2 - M, ny));
            }
            function noteOverlaps(){ return !(nx-Wn/2>rbx+rbw || nx+Wn/2<rbx || ny-Hn/2>rby+rbh || ny+Hn/2<rby); }
            clampNote();
            if (noteOverlaps()) {
              // Try above the rabbit
              nx = px; ny = py - RS*state.r*2.2 - Hn/2; clampNote();
              if (noteOverlaps()) {
                // Try below
                nx = px; ny = py + RS*state.r*1.2 + Hn/2; clampNote();
                if (noteOverlaps()) {
                  // Try right
                  nx = px + RS*state.r*1.8 + Wn/2; ny = py; clampNote();
                  if (noteOverlaps()) {
                    // Try left
                    nx = px - RS*state.r*1.8 - Wn/2; ny = py; clampNote();
                  }
                }
              }
            }
            // Draw the note at resolved nx,ny
            c.save();
            c.translate(nx, ny);
            c.fillStyle = '#fff9b1';
            c.strokeStyle = '#d9cc7a'; c.lineWidth=1.2;
            c.beginPath(); c.rect(-Wn/2, -Hn/2, Wn, Hn); c.fill(); c.stroke();
            c.fillStyle = '#333'; c.font='italic 15px "Comic Sans MS", "Brush Script MT", cursive, system-ui'; c.textAlign='center';
            c.fillText('BRB: Breaking symmetry—', 0, -10);
            c.fillText('Ask Noether.', 0, 12);
            c.restore();
          }
        }
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

      // If transmuted, keep ledger frozen without overlay (table gag owns the moment)

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
        const dtSec = dt;
        // Phase machine
        state.transmute.phaseT += dtSec;
        const ph = state.transmute.phase;
        if (ph === 'anticipate'){
          if (state.transmute.phaseT >= state.transmute.anticipateMs/1000){
            state.transmute.phase = 'say'; state.transmute.phaseT = 0;
            announce(liveEl, "Rabbit: 'I'm late!'");
          }
        }
        else if (ph === 'say' || ph === 'hop1'){
          // During say/hop1 we move with hop bumps; bubble shows during 'say'
          const k = 'rabbit';
          state.transmute.hopT += dtSec * 60; // scale to frame-ish units
          const hopPhase = (state.transmute.hopT % 28) / 28;
          const amp = 22;
          const bump = Math.sin(hopPhase * Math.PI) * amp;
          state.transmute.px += state.transmute.vx;
          state.transmute.py += state.transmute.vy - 0.18 + (-bump*0.02);
          if (ph === 'say' && state.transmute.phaseT >= state.transmute.hop1Ms/1000){
            state.transmute.phase = 'note'; state.transmute.phaseT = 0;
            state.transmute.noteVisible = true;
            // Clamp note center so sticky note stays within table bounds
            const Wn = 200, Hn = 100, M = 8;
            const minX = Wn/2 + M, maxX = w - Wn/2 - M;
            const minY = Hn/2 + M, maxY = h - Hn/2 - M;
            const cx = Math.max(minX, Math.min(maxX, state.transmute.px));
            const cy = Math.max(minY, Math.min(maxY, state.transmute.py - 10));
            state.transmute.noteAt = {x: cx, y: cy};
            announce(liveEl, 'Rabbit left a note: BRB: Breaking symmetry — Ask Noether.');
          }
        }
        else if (ph === 'note'){
          // Pause and show note
          if (state.transmute.phaseT >= state.transmute.noteMs/1000){
            state.transmute.phase = 'hop2'; state.transmute.phaseT = 0;
          }
        }
        else if (ph === 'hop2'){
          state.transmute.hopT += dtSec * 60;
          const hopPhase = (state.transmute.hopT % 28) / 28;
          const amp = 22;
          const bump = Math.sin(hopPhase * Math.PI) * amp;
          state.transmute.px += state.transmute.vx;
          state.transmute.py += state.transmute.vy - 0.18 + (-bump*0.02);
          // Single bounce off table edge, then exit
          if (!state.transmute.bounced){
            const RS = 2.0; // rabbit scale used in draw
            const rRadX = RS*state.r*1.3; // approx half-width
            const rRadY = RS*state.r*1.4; // approx half-height
            let hit = false;
            if (state.transmute.px - rRadX < 0){ state.transmute.px = rRadX; state.transmute.vx = Math.abs(state.transmute.vx); hit = true; }
            else if (state.transmute.px + rRadX > w){ state.transmute.px = w - rRadX; state.transmute.vx = -Math.abs(state.transmute.vx); hit = true; }
            if (state.transmute.py - rRadY < 0){ state.transmute.py = rRadY; state.transmute.vy = Math.abs(state.transmute.vy); hit = true; }
            else if (state.transmute.py + rRadY > h){ state.transmute.py = h - rRadY; state.transmute.vy = -Math.abs(state.transmute.vy); hit = true; }
            if (hit) state.transmute.bounced = true;
          } else {
            // After bounce, gently bias outward so it exits
            state.transmute.vx += 0.03 * (state.transmute.vx >= 0 ? 1 : -1);
            state.transmute.vy += 0.03 * (state.transmute.vy >= 0 ? 1 : -1);
          }
        }

        // If fully off-canvas, slow to stop
        if (state.transmute.px < -60 || state.transmute.px > w + 60 || state.transmute.py < -80 || state.transmute.py > h + 80) {
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
