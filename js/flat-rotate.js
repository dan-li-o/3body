// ---------- js/flat-rotate.js : Flatland rotation guessing game ----------
(function(){
  const Widgets = window.Widgets || {};
  const { autosizeCanvas, onPointerDrag, hoverCursor, clamp, announce, canvasDefaults } = Widgets;

  if (typeof autosizeCanvas !== 'function' || typeof onPointerDrag !== 'function' || typeof hoverCursor !== 'function' || typeof clamp !== 'function'){
    console.error('flat-rotate.js requires widgets-core.js to be loaded first.');
    return;
  }

  const speak = typeof announce === 'function' ? announce : (node, text) => { if (node) node.textContent = text; };
  const DEG_MIN = 0;
  const DEG_MAX = 90;
  const MIN_LINE = 12; // keep the edge-on “line” visible on HiDPI canvases once rotation is unlocked

  // ---------- Shape drawing helpers ----------
  function drawBackground(ctx, width, height){
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f9f7f4';
    ctx.fillRect(0, 0, width, height);

    const horizon = height * 0.62;
    ctx.strokeStyle = '#e0d9cf';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 40);
    ctx.lineTo(width, horizon + 40);
    ctx.stroke();

    ctx.strokeStyle = '#d3cdc3';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.stroke();
    ctx.setLineDash([]);

    return horizon;
  }

  function drawCirclePlate(ctx, angleDeg, dims, opts = {}){
    const { width, height, horizon } = dims;
    const radius = Math.min(width, height) * 0.22;
    const rad = angleDeg * Math.PI / 180;
    const tilt = Math.sin(rad);
    const cy = horizon;
    const cx = width / 2;
    const minY = opts.minThickness ?? (MIN_LINE / 2);
    const yRadius = Math.max(minY, radius * tilt);

    if (opts.showShadow){
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      const spread = radius * (0.75 + 0.25 * tilt);
      const thickness = Math.max(14, radius * 0.35 * Math.max(0.35, tilt));
      ctx.beginPath();
      ctx.ellipse(cx, cy + radius * 0.85, spread, thickness, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.lineWidth = 3;
    ctx.fillStyle = opts.colors?.fill || '#cfe3ff';
    ctx.strokeStyle = opts.colors?.stroke || '#20507a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, yRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Circle stays clean—no extra rim strokes to avoid hinting early.
    ctx.restore();
  }

  function drawSquarePlate(ctx, angleDeg, dims, opts = {}){
    const { width, height, horizon } = dims;
    const half = Math.min(width, height) * 0.22;
    const rad = angleDeg * Math.PI / 180;
    const tilt = Math.sin(rad);
    const minHalf = opts.minThickness ?? (MIN_LINE / 2);
    const halfHeight = Math.max(minHalf, half * tilt);
    const cx = width / 2;
    const cy = horizon;

    if (opts.showShadow){
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      const tiltNorm = Math.max(0, Math.min(1, tilt));
      const originY = horizon + half * 0.28;
      const topHalf = half * (1.0 - 0.35 * tiltNorm);
      const bottomHalf = half * (1.15 + 0.35 * tiltNorm);
      const depth = half * (0.18 + 0.55 * tiltNorm);
      ctx.beginPath();
      ctx.moveTo(cx - topHalf, originY);
      ctx.lineTo(cx + topHalf, originY);
      ctx.lineTo(cx + bottomHalf, originY + depth);
      ctx.lineTo(cx - bottomHalf, originY + depth);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = opts.colors?.fill || '#fde5cd';
    ctx.strokeStyle = opts.colors?.stroke || '#ad6930';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(cx - half, cy - halfHeight, half * 2, halfHeight * 2);
    ctx.fill();
    ctx.stroke();

    if (angleDeg > 0 && angleDeg < 90){
      ctx.lineWidth = 2;
      ctx.strokeStyle = (opts.colors?.edgeLight) || '#d89c62';
      ctx.beginPath();
      ctx.moveTo(cx - half, cy - halfHeight);
      ctx.lineTo(cx + half, cy - halfHeight);
      ctx.stroke();

      ctx.strokeStyle = (opts.colors?.edgeDark) || '#7a4920';
      ctx.beginPath();
      ctx.moveTo(cx - half, cy + halfHeight);
      ctx.lineTo(cx + half, cy + halfHeight);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrianglePlate(ctx, angleDeg, dims, opts = {}){
    const { width, height, horizon } = dims;
    const base = Math.min(width, height) * 0.28;
    const rad = angleDeg * Math.PI / 180;
    const tilt = Math.sin(rad);
    const totalHeight = base * 0.95;
    const minHalf = opts.minThickness ?? (MIN_LINE / 2);
    const halfHeight = Math.max(minHalf, totalHeight * tilt);
    const cx = width / 2;
    const cy = horizon;

    if (opts.showShadow){
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      const tiltNorm = Math.max(0, Math.min(1, tilt));
      const originY = horizon + base * 0.28;
      const apexLift = base * (0.12 + 0.35 * tiltNorm);
      const halfWidth = base * (0.18 + 0.55 * tiltNorm);
      const depth = base * (0.25 + 0.55 * tiltNorm);
      ctx.beginPath();
      ctx.moveTo(cx, originY - apexLift);
      ctx.lineTo(cx + halfWidth, originY + depth);
      ctx.lineTo(cx - halfWidth, originY + depth);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = opts.colors?.fill || '#e4d9ff';
    ctx.strokeStyle = opts.colors?.stroke || '#5e489b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfHeight);
    ctx.lineTo(cx - base / 2, cy + halfHeight);
    ctx.lineTo(cx + base / 2, cy + halfHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (angleDeg > 0 && angleDeg < 90){
      ctx.lineWidth = 2;
      ctx.strokeStyle = (opts.colors?.edgeLight) || 'rgba(94, 72, 155, 0.55)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfHeight);
      ctx.lineTo(cx, cy + halfHeight);
      ctx.stroke();
    }
    ctx.restore();
  }

  const FLAT_SHAPES = [
    {
      id: 'circle',
      name: 'Circle',
      revealNote: 'Edge-on, the flat disk collapses into a line—exactly the penny Abbott described.',
      success: 'Correct! Only when you tilt the penny does its circular face appear.',
      failure: (guess) => `You guessed ${guess}. Actually, it was a circle seen edge-on.`,
      colors: {
        fill: '#cfe3ff',
        stroke: '#20507a',
        line: '#20507a'
      },
      draw: drawCirclePlate
    },
    {
      id: 'square',
      name: 'Square',
      revealNote: 'A thin square card masquerades as a line until perspective opens a second dimension.',
      success: 'Nice call. Rotating the card shows all four edges at once.',
      failure: (guess) => `You guessed ${guess}. In truth, it was a square card lying edge-on.`,
      colors: {
        fill: '#fde5cd',
        stroke: '#ad6930',
        edgeLight: '#d89c62',
        edgeDark: '#7a4920',
        line: '#ad6930'
      },
      draw: drawSquarePlate
    },
    {
      id: 'triangle',
      name: 'Triangle',
      revealNote: 'The wedge keeps its point hidden; only rotation reveals the triangular face.',
      success: 'Exactly. The slender wedge had a triangular face all along.',
      failure: (guess) => `You guessed ${guess}. The shape was a triangle turned on its edge.`,
      colors: {
        fill: '#e4d9ff',
        stroke: '#5e489b',
        edgeLight: 'rgba(94, 72, 155, 0.55)',
        line: '#5e489b'
      },
      draw: drawTrianglePlate
    }
  ];

  const SHAPE_BY_ID = Object.fromEntries(FLAT_SHAPES.map(s => [s.id, s]));

  function pickShape(excludeId){
    const pool = FLAT_SHAPES.filter(shape => shape.id !== excludeId);
    const list = pool.length ? pool : FLAT_SHAPES;
    return list[Math.floor(Math.random() * list.length)];
  }

  function initWidget(root){
    const canvas = root.querySelector('canvas[data-role="canvas"]') || root.querySelector('canvas');
    if (!canvas) return;

    const choicesContainer = root.querySelector('[data-role="choices"]');
    const choiceButtons = Array.from(choicesContainer?.querySelectorAll('.wgt__choice[data-choice]') || []);
    const rotateRange = root.querySelector('[data-role="rotate-range"]');
    const resetBtn = root.querySelector('[data-role="reset"]');
    const revealBtn = root.querySelector('[data-role="reveal"]');
    const feedbackEl = root.querySelector('[data-role="feedback"]');
    const noteWrap = root.querySelector('[data-role="note-wrap"]');
    const noteEl = root.querySelector('[data-role="note"]');
    const gestureHint = root.querySelector('[data-role="gesture-hint"]');

    const baseCanvas = typeof canvasDefaults === 'function'
      ? canvasDefaults()
      : { aspect: 16 / 9, min: 320, max: 720 };

    const layout = autosizeCanvas(canvas, baseCanvas);
    const initialFeedback = feedbackEl ? feedbackEl.textContent.trim() : '';

    const state = {
      target: null,
      lastId: null,
      angleDeg: 0,
      guessed: false,
      guessId: null,
      revealed: false,
      hintShown: false
    };

    const dragState = { active: false, startY: 0, startAngle: 0 };

    function rotationEnabled(){
      return state.guessed || state.revealed;
    }

    function setAngle(value, source){
      const next = clamp(Number(value) || 0, DEG_MIN, DEG_MAX);
      if (Math.abs(next - state.angleDeg) < 0.01 && source === 'slider') return;
      state.angleDeg = next;
      if (rotateRange && source !== 'slider') {
        rotateRange.value = String(Math.round(next));
      }
      draw();
      if (state.angleDeg > 1) hideGestureHint();
    }

    function setFeedback(message){
      if (feedbackEl) {
        feedbackEl.textContent = message;
        speak(feedbackEl, message);
      }
    }

    function updateControls(){
      if (rotateRange) {
        rotateRange.disabled = !rotationEnabled();
      }
      if (revealBtn) {
        revealBtn.disabled = !state.guessed || state.revealed;
      }
    }

    function showGestureHint(){
      if (!gestureHint || state.hintShown) return;
      gestureHint.dataset.visible = 'true';
      state.hintShown = true;
    }

    function hideGestureHint(){
      if (!gestureHint) return;
      delete gestureHint.dataset.visible;
    }

    function clearChoiceStyles(){
      choiceButtons.forEach(btn => {
        btn.disabled = false;
        delete btn.dataset.selected;
        delete btn.dataset.correct;
      });
    }

    function animateAngle(targetAngle){
      const start = state.angleDeg;
      const delta = targetAngle - start;
      if (Math.abs(delta) < 0.5) {
        setAngle(targetAngle, 'animation');
        return;
      }
      const t0 = performance.now();
      const duration = 650;
      function step(now){
        const t = clamp((now - t0) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setAngle(start + delta * eased, 'animation');
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function draw(){
      const ctx = layout.ctx;
      if (!ctx || !state.target) return;
      const width = layout.width;
      const height = layout.height;
      const horizon = drawBackground(ctx, width, height);

      const dims = { width, height, horizon };
      const lineLocked = !state.guessed && !state.revealed;
      const showShadow = state.guessed || state.revealed;
      state.target.draw(ctx, state.angleDeg, dims, {
        minThickness: lineLocked ? 0 : undefined,
        showShadow,
        colors: state.target.colors
      });

      ctx.save();
      ctx.fillStyle = '#4a4a48';
      const size = Math.max(14, Math.round(width * 0.035));
      ctx.font = `600 ${size}px "Inter", "Helvetica Neue", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`${Math.round(state.angleDeg)}°`, width - 16, 16);
      ctx.restore();
    }

    function reset(){
      state.target = pickShape(state.lastId);
      state.lastId = state.target.id;
      state.angleDeg = 0;
      state.guessed = false;
      state.guessId = null;
      state.revealed = false;
      state.hintShown = false;

      clearChoiceStyles();
      choiceButtons.forEach(btn => { btn.disabled = false; });
      if (rotateRange){
        rotateRange.value = '0';
        rotateRange.disabled = true;
      }
      if (revealBtn){
        revealBtn.disabled = true;
      }
      if (noteWrap){
        noteWrap.hidden = true;
      }
      if (noteEl){
        noteEl.textContent = '';
      }
      hideGestureHint();
      setFeedback(initialFeedback || 'A thick line waits for your guess.');
      setAngle(0, 'reset');
    }

    function handleGuess(choiceId){
      if (state.guessed || !choiceId) return;
      state.guessed = true;
      state.guessId = choiceId;
      choiceButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.choice === choiceId){
          btn.dataset.selected = 'true';
        } else {
          delete btn.dataset.selected;
        }
      });

      const shape = state.target;
      const guessShape = SHAPE_BY_ID[choiceId];
      const guessName = guessShape ? guessShape.name : choiceId;
      const message = (choiceId === shape.id) ? shape.success : shape.failure(guessName);
      setFeedback(message);
      updateControls();
      showGestureHint();
    }

    function reveal(){
      if (!state.guessed || state.revealed) return;
      state.revealed = true;
      const shape = state.target;

      hideGestureHint();

      choiceButtons.forEach(btn => {
        if (btn.dataset.choice === shape.id){
          btn.dataset.correct = 'true';
        }
      });

      if (noteWrap && noteEl){
        noteWrap.hidden = false;
        noteEl.textContent = shape.revealNote;
      }

      if (state.angleDeg < DEG_MAX) {
        animateAngle(DEG_MAX);
      }

      const reinforcement = (state.guessId === shape.id)
        ? shape.success
        : shape.failure(SHAPE_BY_ID[state.guessId]?.name || state.guessId);
      setFeedback(reinforcement);
      updateControls();
    }

    function setupPointerControls(){
      hoverCursor(canvas, {
        hitTest: () => rotationEnabled(),
        hover: 'grab',
        normal: '',
        isDragging: () => dragState.active
      });

      onPointerDrag(canvas, {
        hitTest: () => rotationEnabled(),
        onStart(pt){
          dragState.active = true;
          dragState.startY = pt.y;
          dragState.startAngle = state.angleDeg;
          canvas.style.cursor = 'grabbing';
          hideGestureHint();
        },
        onMove(pt){
          if (!dragState.active) return;
          const dy = dragState.startY - pt.y;
          const height = layout.height || canvas.clientHeight || 1;
          const delta = (dy / height) * 320;
          setAngle(dragState.startAngle + delta, 'drag');
        },
        onEnd(){
          dragState.active = false;
          canvas.style.cursor = '';
        }
      });
    }

    if (rotateRange){
      rotateRange.addEventListener('input', (e) => {
        if (!rotationEnabled()) {
          rotateRange.value = String(Math.round(state.angleDeg));
          return;
        }
        hideGestureHint();
        setAngle(e.target.value, 'slider');
      });
    }

    choiceButtons.forEach(btn => {
      btn.addEventListener('click', () => handleGuess(btn.dataset.choice));
    });

    resetBtn && resetBtn.addEventListener('click', reset);
    revealBtn && revealBtn.addEventListener('click', reveal);

    setupPointerControls();

    const scheduleResize = () => {
      layout.relayout && layout.relayout();
      requestAnimationFrame(draw);
    };
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);

    if (canvas.parentElement){
      const ro = new ResizeObserver(() => {
        layout.relayout && layout.relayout();
        requestAnimationFrame(draw);
      });
      ro.observe(canvas.parentElement);
    }

    reset();
  }

  function initAll(){
    document.querySelectorAll('.wgt[data-widget="flat-rotate"]').forEach(initWidget);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
// ---------- end js/flat-rotate.js ----------
