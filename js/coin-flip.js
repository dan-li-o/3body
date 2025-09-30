// ---------- js/coin-flip.js : Coin flip + H/T ratio chart ----------
(function(){
  const {
    autosizeCanvas, ensurePanelFigure, clamp, announce, linkRangeNumber,
    themeVar, onColorSchemeChange, currentColorScheme, canvasDefaults
  } = window.Widgets || {};

  function rngBit(){
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function'){
        const u8 = new Uint8Array(1);
        window.crypto.getRandomValues(u8);
        // Use the lowest bit; distribution is uniform over 0..255
        return (u8[0] & 1) === 1 ? 1 : 0;
      }
    } catch {}
    // Fallback to Math.random()
    return Math.random() < 0.5 ? 1 : 0;
  }

  function rngFloat(){
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === 'function'){
        const u32 = new Uint32Array(1);
        window.crypto.getRandomValues(u32);
        return u32[0] / 4294967296; // [0,1)
      }
    } catch {}
    return Math.random();
  }

  // No rngFloat needed for fair coin commit

  function initOne(root){
    if (!autosizeCanvas || !ensurePanelFigure){
      console.error('widgets-core.js must load before coin-flip.js');
      return;
    }

    const schemeState = { mode: null, colors: {} };
    function detectScheme(){
      return currentColorScheme ? currentColorScheme() :
        (document.body?.classList?.contains('quarto-dark') || document.documentElement?.classList?.contains('quarto-dark') ? 'dark' : 'light');
    }
    function readColors(force = false){
      const cached = !force && schemeState.mode === detectScheme();
      if (cached && schemeState.colors && Object.keys(schemeState.colors).length) {
        return schemeState.colors;
      }
      const scheme = detectScheme();
      const read = (name, fallback) => themeVar ? themeVar(name, fallback) : fallback;
      schemeState.mode = scheme;
      schemeState.colors = {
        chartBorder: read('--wgt-chart-border', '#ccc'),
        chartGrid: read('--wgt-chart-grid', '#eee'),
        chartAxis: read('--wgt-chart-axis', '#444'),
        chartTarget: read('--wgt-chart-target', 'rgba(31,122,107,0.45)'),
        chartLine: read('--wgt-energy-motion-line', '#1f7a6b'),
        chartBackground: read('--wgt-card-bg-alt', '#ffffff'),
        textMuted: read('--wgt-muted', '#666'),
        felt: read('--wgt-coin-felt', '#35654d'),
        rail: read('--wgt-coin-rail', '#1f3a2c'),
        coinHead: read('--wgt-coin-head', '#1f7a6b'),
        coinTail: read('--wgt-coin-tail', '#7a1f1f')
      };
      return schemeState.colors;
    }

    readColors(true);

    // DOM
    const coinCanvas = root.querySelector('canvas[data-role="coin"]') || root.querySelector('canvas');
    const outPanel   = root.querySelector('.wgt__output') || root;
    const btnFlip    = root.querySelector('[data-role="flip1"]');
    const btnFlip10  = root.querySelector('[data-role="flip10"]');
    const btnFlip100 = root.querySelector('[data-role="flip100"]');
    const btnReset   = root.querySelector('[data-role="reset"]');
    const pRange     = root.querySelector('[data-role="p-range"]');
    const pNum       = root.querySelector('[data-role="p-num"]');

    const nEl = root.querySelector('[data-role="n"]');
    const hEl = root.querySelector('[data-role="h"]');
    const tEl = root.querySelector('[data-role="t"]');
    const phEl = root.querySelector('[data-role="phat"]');
    const pEl = root.querySelector('[data-role="p"]');

    // Chart holder inside output panel
    const { canvas: chartCanvas, legend: legendEl } = ensurePanelFigure(outPanel, { role: 'figure', ensureLegend: true, ensureEq: false });
    if (legendEl && !legendEl.hasChildNodes()){
      legendEl.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:var(--wgt-energy-motion-line);border-radius:2px;"></span> p̂ (estimate)
        </span>`;
    }

    // Live region
    let liveEl = outPanel.querySelector('[data-role="live"]');
    if (!liveEl){
      liveEl = document.createElement('div');
      liveEl.setAttribute('data-role', 'live');
      liveEl.setAttribute('aria-live', 'polite');
      liveEl.className = 'visually-hidden';
      Object.assign(liveEl.style, { position:'absolute', width:'1px', height:'1px', padding:'0', margin:'-1px', overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap' });
      outPanel.appendChild(liveEl);
    }

    // Layout
    const baseCanvas = typeof canvasDefaults === 'function'
      ? canvasDefaults()
      : { aspect: 16 / 9, min: 320, max: 720 };

    const layoutCoin  = autosizeCanvas(coinCanvas,  baseCanvas);
    const layoutChart = autosizeCanvas(chartCanvas, baseCanvas);
    const cctx = () => layoutCoin.ctx;
    const xctx = () => layoutChart.ctx;

    // State
    const state = {
      n: 0, h: 0, t: 0,
      seriesPHat: [], // y_i = H_i / n_i (NaN if n_i==0)
      isFlipping: false,
      // Flip animation
      phi0: 0, phi1: 0, t0: 0, dur: 900, // ms
      finalFace: 'H', // 'H' or 'T'
      // Visual coin params
      coinR: 70,
      // Orientation baseline (0 => Heads up)
      base: 0,
      // Neutral face before first flip or after reset
      neutral: true,
      // Track current angle for redraws on resize
      phiCur: 0
    };
    // Probability control
    state.pHeads = 0.50;
    let initializing = true;
    const linkP = (pRange || pNum) ? linkRangeNumber(pRange, pNum, {
      toModel: (ui)=> clamp(parseFloat(ui || 0) || 0, 0, 1),
      fromModel: (val)=> (Number(val) || 0).toFixed(2),
      onChange: (val)=> {
        const prev = state.pHeads; state.pHeads = val;
        if (!initializing) {
          // Auto-reset on p change to maintain IID assumption and clear chart
          resetAll();
          announce(liveEl, `Heads probability set to ${val.toFixed(2)}. Run reset.`);
        } else {
          // Initial paint: just refresh chart to show new target line
          drawChart();
        }
      }
    }) : null;
    // Fair coin (no bias control in this commit)

    // Helpers
    function updateTelemetry(){
      const { n, h, t } = state;
      const p = (n>0) ? (h/n) : NaN;
      nEl && (nEl.textContent = String(n));
      hEl && (hEl.textContent = String(h));
      tEl && (tEl.textContent = String(t));
      phEl && (phEl.textContent = Number.isFinite(p) ? p.toFixed(3) : '—');
      pEl && (pEl.textContent = Number.isFinite(p) ? (p*100).toFixed(2) + '%' : '—');
    }

    function pushSample(){
      const { n, h, t } = state;
      const ph = (n>0) ? (h/n) : NaN;
      state.seriesPHat.push(ph);
      if (state.seriesPHat.length > 5000) state.seriesPHat.shift();
    }

    function drawChart(){
      const ctx = xctx(); const W = layoutChart.width, H = layoutChart.height;
      ctx.clearRect(0,0,W,H);
      const colors = readColors();
      ctx.fillStyle = colors.chartBackground || '#ffffff';
      ctx.fillRect(0,0,W,H);

      // Padding
      const L=36, R=12, T=14, B=30;
      const iw = W - L - R, ih = H - T - B;
      ctx.save();
      ctx.translate(L, T);

      // Fixed y-range [0,1] for proportions
      const data = state.seriesPHat;
      const n = data.length;
      const ymin = 0, ymax = 1;

      // Axes + grid
      ctx.strokeStyle = colors.chartBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(0,0,iw,ih); ctx.stroke();
      ctx.setLineDash([3,3]);
      // Dashed reference at target p
      const yTarget = ih - (state.pHeads - ymin) / (ymax - ymin) * ih;
      ctx.strokeStyle = colors.chartTarget;
      ctx.beginPath(); ctx.moveTo(0,yTarget); ctx.lineTo(iw,yTarget); ctx.stroke();
      ctx.setLineDash([]);

      // X ticks (5–10 ticks)
      const N = Math.max(1, state.n);
      const ticks = Math.min(10, Math.ceil(iw/80));
      const step = Math.max(1, Math.round(N / ticks));
      ctx.fillStyle = colors.chartAxis; ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let k=step; k<=N; k+=step){
        const x = (k-1) / Math.max(1,N-1) * iw;
        ctx.strokeStyle=colors.chartGrid; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ih); ctx.stroke();
        ctx.fillText(String(k), x, ih+6);
      }

      // Y labels for 0, 0.5, 1
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const yOf = (v)=> ih - (v - ymin)/(ymax - ymin) * ih;
      ctx.fillStyle = colors.chartAxis;
      ctx.fillText('1.00', -6, yOf(1));
      ctx.fillText('0.50', -6, yOf(0.5));
      ctx.fillText('0.00', -6, yOf(0));

      // Line: p̂ = H/n
      ctx.strokeStyle = colors.chartLine; ctx.lineWidth = 2; ctx.beginPath();
      let started = false;
      for (let i=0;i<N;i++){
        const v = data[i]; if (!Number.isFinite(v)) { started=false; continue; }
        const x = (i) / Math.max(1,N-1) * iw;
        const y = yOf(v);
        if (!started){ ctx.moveTo(x,y); started=true; }
        else ctx.lineTo(x,y);
      }
      ctx.stroke();

      ctx.restore();
    }

    function drawCoin(phi){
      state.phiCur = phi;
      const ctx = cctx(); const W = layoutCoin.width, H = layoutCoin.height;
      ctx.clearRect(0,0,W,H);
      const colors = readColors();

      // Felt/table background for better initial visibility
      ctx.fillStyle = colors.felt;
      ctx.fillRect(0,0,W,H);
      // Rails/outliner to match pool widgets style
      const rail = 8; ctx.fillStyle = colors.rail;
      ctx.fillRect(0,0,W,rail); ctx.fillRect(0,H-rail,W,rail);
      ctx.fillRect(0,0,rail,H); ctx.fillRect(W-rail,0,rail,H);

      const cx = W*0.5, cy = H*0.5;
      const R = state.coinR;
      // Apparent vertical scale from flipping angle (squash on edge)
      const s = Math.abs(Math.cos(phi));

      // Coin body (ellipse)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, clamp(0.08 + 0.92*s, 0.08, 1));
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2);
      const grad = ctx.createRadialGradient(-R*0.3, -R*0.3, R*0.2, 0,0, R);
      grad.addColorStop(0, '#f7f4e8');
      grad.addColorStop(1, '#d0c8a6');
      ctx.fillStyle = grad; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#b8ae8d'; ctx.stroke();
      ctx.restore();

      // Face symbol: neutral 'H/T' before first flip; otherwise show outcome letter
      const faceIsHeads = Math.cos(phi + state.base) >= 0; // simple model
      const alpha = clamp((s - 0.15)/0.85, 0, 1);
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if (state.neutral) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(R*0.55)}px system-ui, sans-serif`;
        ctx.fillText('H/T', 0, 4);
      } else {
        ctx.fillStyle = faceIsHeads ? (colors.coinHead || '#1f7a6b') : (colors.coinTail || '#7a1f1f');
        ctx.font = `bold ${Math.round(R*0.9)}px system-ui, sans-serif`;
        ctx.fillText(faceIsHeads ? 'H' : 'T', 0, 4);
      }
      ctx.restore();

      // Shadow
      const shW = R*1.2, shH = R*0.30*(1-s*0.9);
      ctx.save(); ctx.translate(cx, cy + R + 16);
      ctx.scale(1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(0, 0, shW, shH, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    onColorSchemeChange && onColorSchemeChange(() => {
      schemeState.mode = null;
      readColors(true);
      drawChart();
      drawCoin(state.phiCur || 0);
    });

    function animateToFace(finalFace){
      if (state.isFlipping) return;
      state.isFlipping = true;
      state.neutral = false;
      state.finalFace = finalFace;

      // Choose a random number of half-rotations; ensure parity matches target face
      const baseTurns = 6 + Math.floor(Math.random()*6); // 6..11 half-turns
      const needOdd = (finalFace === 'T');
      const halfTurns = (baseTurns % 2 === (needOdd?0:1)) ? baseTurns + 1 : baseTurns; // adjust parity
      state.phi0 = 0;
      state.phi1 = halfTurns * Math.PI; // each half-turn flips face
      state.t0 = performance.now();

      const easeOutCubic = (x)=> 1 - Math.pow(1 - x, 3);

      function tick(){
        const now = performance.now();
        const u = clamp((now - state.t0) / state.dur, 0, 1);
        const e = easeOutCubic(u);
        const phi = state.phi0 + (state.phi1 - state.phi0) * e;
        drawCoin(phi);
        if (u < 1){ requestAnimationFrame(tick); }
        else {
          // Snap and settle
          const finalPhi = state.phi1;
          drawCoin(finalPhi);
          state.isFlipping = false;
          // Update tallies
          state.n += 1;
          if (finalFace === 'H') state.h += 1; else state.t += 1;
          updateTelemetry(); pushSample(); drawChart();
          announce(liveEl, `Flip ${state.n}: ${finalFace==='H'?'Heads':'Tails'}. Heads ${state.h}, Tails ${state.t}.`);
        }
      }
      requestAnimationFrame(tick);
    }

    // API actions
    function flipOnce(){
      const bit = (rngFloat() < state.pHeads) ? 1 : 0;
      state.neutral = false;
      animateToFace(bit ? 'H' : 'T');
    }
    function flipMany(k){
      if (state.isFlipping) return;
      state.neutral = false;
      // Bulk simulate without animating each; animate the last outcome for feedback
      let lastFace = 'H';
      for (let i=0;i<k;i++){
        const bit = (rngFloat() < state.pHeads) ? 1 : 0;
        lastFace = bit ? 'H' : 'T';
        state.n += 1;
        if (bit) state.h += 1; else state.t += 1;
        pushSample();
      }
      updateTelemetry(); drawChart();
      // Small nudge animation to lastFace for continuity
      state.phi0 = 0; state.phi1 = (lastFace==='H'?0:Math.PI); state.t0 = performance.now();
      drawCoin(state.phi1);
      announce(liveEl, `Bulk flips: +${k}. Total ${state.n}. Heads ${state.h}, Tails ${state.t}.`);
    }
    function resetAll(){
      if (state.isFlipping) return;
      state.n=state.h=state.t=0; state.seriesPHat.length=0; state.neutral = true;
      updateTelemetry(); drawChart(); drawCoin(0);
      announce(liveEl, 'Reset. Click the coin to flip.');
    }

    // Bind
    coinCanvas.addEventListener('click', flipOnce);
    btnFlip && btnFlip.addEventListener('click', flipOnce);
    btnFlip10 && btnFlip10.addEventListener('click', ()=> flipMany(10));
    btnFlip100 && btnFlip100.addEventListener('click', ()=> flipMany(100));
    btnReset && btnReset.addEventListener('click', resetAll);

    // Initial state: trigger a reset and ensure subsequent redraws when layout changes
    resetAll();
    // Finish initializing after we’ve synced the p control once
    if (linkP) linkP.set(state.pHeads);
    initializing = false;
    // Debounced redraw to run AFTER autosizeCanvas finishes resizing
    let redrawReq = 0;
    function scheduleRedraw(){
      if (redrawReq) cancelAnimationFrame(redrawReq);
      redrawReq = requestAnimationFrame(() => {
        // One more frame to ensure canvas size/ctx is finalized
        requestAnimationFrame(() => { drawCoin(state.phiCur); drawChart(); });
      });
    }

    const ro = new ResizeObserver(() => { scheduleRedraw(); });
    if (coinCanvas?.parentElement) ro.observe(coinCanvas.parentElement);
    if (chartCanvas?.parentElement) ro.observe(chartCanvas.parentElement);
    window.addEventListener('resize', scheduleRedraw);
    window.addEventListener('orientationchange', scheduleRedraw);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => { scheduleRedraw(); }, { once: true });
    } else {
      scheduleRedraw();
    }
  }

  function autoInit(){
    document.querySelectorAll('.wgt[data-widget="coin-flip"]').forEach(el => initOne(el));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM is already ready (e.g., script loaded late) — init immediately
    autoInit();
  }
})();
// ---------- end js/coin-flip.js ----------
