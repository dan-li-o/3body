// ---------- js/coin-flip.js : Coin flip + H/T ratio chart ----------
(function(){
  const { autosizeCanvas, ensurePanelFigure, clamp, announce } = window.Widgets || {};

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

  function initOne(root){
    if (!autosizeCanvas || !ensurePanelFigure){
      console.error('widgets-core.js must load before coin-flip.js');
      return;
    }

    // DOM
    const coinCanvas = root.querySelector('canvas[data-role="coin"]') || root.querySelector('canvas');
    const outPanel   = root.querySelector('.wgt__output') || root;
    const btnFlip    = root.querySelector('[data-role="flip1"]');
    const btnFlip10  = root.querySelector('[data-role="flip10"]');
    const btnFlip100 = root.querySelector('[data-role="flip100"]');
    const btnReset   = root.querySelector('[data-role="reset"]');

    const nEl = root.querySelector('[data-role="n"]');
    const hEl = root.querySelector('[data-role="h"]');
    const tEl = root.querySelector('[data-role="t"]');
    const rEl = root.querySelector('[data-role="ratio"]');
    const pEl = root.querySelector('[data-role="p"]');

    // Chart holder inside output panel
    const { canvas: chartCanvas, legend: legendEl } = ensurePanelFigure(outPanel, { role: 'figure', ensureLegend: true, ensureEq: false });
    if (legendEl && !legendEl.hasChildNodes()){
      legendEl.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:16px;height:3px;background:#1f7a6b;border-radius:2px;"></span> H/T ratio
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
    const layoutCoin  = autosizeCanvas(coinCanvas,  { aspect: 16/9, min: 320, max: 720 });
    const layoutChart = autosizeCanvas(chartCanvas, { aspect: 16/9, min: 320, max: 720 });
    const cctx = () => layoutCoin.ctx;
    const xctx = () => layoutChart.ctx;

    // State
    const state = {
      n: 0, h: 0, t: 0,
      seriesRatio: [], // y_i = H_i / T_i (NaN if T_i==0)
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

    // Helpers
    function updateTelemetry(){
      const { n, h, t } = state;
      const ratio = (t>0) ? (h/t) : NaN;
      const p = (n>0) ? (h/n) : NaN;
      nEl && (nEl.textContent = String(n));
      hEl && (hEl.textContent = String(h));
      tEl && (tEl.textContent = String(t));
      rEl && (rEl.textContent = Number.isFinite(ratio) ? ratio.toFixed(3) : '—');
      pEl && (pEl.textContent = Number.isFinite(p) ? (p*100).toFixed(2) + '%' : '—');
    }

    function pushSample(){
      const { n, h, t } = state;
      const ratio = (t>0) ? (h/t) : NaN;
      state.seriesRatio.push(ratio);
      if (state.seriesRatio.length > 5000) state.seriesRatio.shift();
    }

    function drawChart(){
      const ctx = xctx(); const W = layoutChart.width, H = layoutChart.height;
      ctx.clearRect(0,0,W,H);

      // Padding
      const L=36, R=12, T=14, B=30;
      const iw = W - L - R, ih = H - T - B;
      ctx.save();
      ctx.translate(L, T);

      // Determine y range based on recent data (ignore NaNs). Keep within [0, 2] unless wider is needed.
      const data = state.seriesRatio;
      const n = data.length;
      let ymin = 0, ymax = 2;
      for (let i=0;i<n;i++){
        const v = data[i]; if (!Number.isFinite(v)) continue;
        ymin = Math.min(ymin, v);
        ymax = Math.max(ymax, v);
      }
      // Clamp and pad
      const pad = 0.05*(ymax - ymin || 1);
      ymin = Math.max(0, ymin - pad);
      ymax = Math.max(1.0, ymax + pad);

      // Axes + grid
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(0,0,iw,ih); ctx.stroke();
      ctx.setLineDash([3,3]);
      // Horizontal grid at y=1 (theoretical target)
      const y1 = ih - (1 - ymin) / (ymax - ymin) * ih;
      ctx.beginPath(); ctx.moveTo(0,y1); ctx.lineTo(iw,y1); ctx.stroke();
      ctx.setLineDash([]);

      // X ticks (5–10 ticks)
      const N = Math.max(1, state.n);
      const ticks = Math.min(10, Math.ceil(iw/80));
      const step = Math.max(1, Math.round(N / ticks));
      ctx.fillStyle = '#444'; ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let k=step; k<=N; k+=step){
        const x = (k-1) / Math.max(1,N-1) * iw;
        ctx.strokeStyle='#eee'; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ih); ctx.stroke();
        ctx.fillText(String(k), x, ih+6);
      }

      // Y labels for min/1/max
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const yOf = (v)=> ih - (v - ymin)/(ymax - ymin) * ih;
      ctx.fillText(ymax.toFixed(2), -6, yOf(ymax));
      ctx.fillText('1.00', -6, yOf(1));
      ctx.fillText(ymin.toFixed(2), -6, yOf(ymin));

      // Line: H/T
      ctx.strokeStyle = '#1f7a6b'; ctx.lineWidth = 2; ctx.beginPath();
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

      // Felt/table background for better initial visibility
      ctx.fillStyle = "#35654d"; // same palette as pool widgets
      ctx.fillRect(0,0,W,H);
      // Rails/outliner to match pool widgets style
      const rail = 8; ctx.fillStyle = "#1f3a2c";
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
        ctx.fillStyle = faceIsHeads ? '#1f7a6b' : '#7a1f1f';
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
      const bit = rngBit();
      state.neutral = false;
      animateToFace(bit ? 'H' : 'T');
    }
    function flipMany(k){
      if (state.isFlipping) return;
      state.neutral = false;
      // Bulk simulate without animating each; animate the last outcome for feedback
      let lastFace = 'H';
      for (let i=0;i<k;i++){
        const bit = rngBit();
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
      state.n=state.h=state.t=0; state.seriesRatio.length=0; state.neutral = true;
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
    const ro = new ResizeObserver(() => { drawCoin(state.phiCur); drawChart(); });
    if (coinCanvas?.parentElement) ro.observe(coinCanvas.parentElement);
    if (chartCanvas?.parentElement) ro.observe(chartCanvas.parentElement);
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => { drawCoin(state.phiCur); drawChart(); }, { once: true });
    } else {
      requestAnimationFrame(() => { drawCoin(state.phiCur); drawChart(); });
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
