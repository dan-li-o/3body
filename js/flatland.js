// ---------- js/flatland.js : Spherical Flatland Explorer prototype ----------
(function(){
  const Widgets = window.Widgets || {};
  const {
    autosizeCanvas,
    hoverCursor,
    clamp,
    announce,
    canvasDefaults
  } = Widgets;

  if (typeof autosizeCanvas !== 'function' || typeof hoverCursor !== 'function' || typeof clamp !== 'function'){
    console.error('flatland.js requires widgets-core.js to be loaded first.');
    return;
  }

  const root = document.querySelector('[data-widget="flatland-explorer"]');
  if (!root){
    return;
  }

  const viewCanvas = root.querySelector('[data-role="views"]');
  if (!viewCanvas){
    console.error('flatland.js expects a combined canvas with data-role="views".');
    return;
  }

  const projectionEl = root.querySelector('[data-role="narrative"]');
  const triangleSumEl = root.querySelector('[data-role="triangle-sum"]');
  const resultBlockEl = root.querySelector('[data-role="result-block"]');
  const resultTitleEl = root.querySelector('[data-role="result-title"]');
  const resultTextEl = root.querySelector('[data-role="result-text"]');
  const triangleMetricEl = root.querySelector('[data-role="triangle-metric"]');
  const narrativeBlock = root.querySelector('[data-role="narrative-block"]');

  const modeInputs = Array.from(root.querySelectorAll('[data-role="mode"]'));
  const toolButtons = {
    line: root.querySelector('[data-role="tool-line"]'),
    triangle: root.querySelector('[data-role="tool-triangle"]'),
    walker: root.querySelector('[data-role="tool-walker"]')
  };
  const resetAllBtn = root.querySelector('[data-role="reset-all"]');
  const toolHintEl = root.querySelector('[data-role="tool-hint"]');

  const baseCanvas = typeof canvasDefaults === 'function'
    ? canvasDefaults()
    : { aspect: 16 / 9, min: 320, max: 720 };

  const view = autosizeCanvas(viewCanvas, baseCanvas);
  const resizeSync = new ResizeObserver(() => render());
  resizeSync.observe(viewCanvas);

  const liveNarrate = typeof announce === 'function'
    ? (text) => announce(projectionEl, text)
    : (text) => { if (projectionEl) projectionEl.textContent = text; };

  const VIEW_RANGE = 1.15;
  const WALKER_SPEED = 0.9; // world units per second in Euclidean mode
  const WALKER_ORBIT_SPEED = Math.PI * 0.35;
  const DEG = 180 / Math.PI;
  const VIEW_COLOR = '#f97316';
  const SPHERE_Y_OFFSET = 0.12; // fraction of viewport height to drop the globe
  const FLATLANDER_VEC = Object.freeze({ x: 0, y: 0, z: 1 });

  // Centralised widget state; keep raw world coordinates so we can map into
  // whichever viewport we happen to be drawing. Each tool owns its own slice
  // so resets stay isolated.
  const state = {
    mode: 'euclid',
    triangle: [],
    line: {
      world: [],
      shooterPixels: []
    },
    triangleLine: {
      world: [],
      shooterPixels: []
    },
    walker: {
      mode: 'euclid',
      active: false,
      position: 0,
      theta: 0,
      lastTime: 0
    }
  };

  let raf = null;
  let activePlacement = null;

  // Short instructional snippets that surface under the experiment buttons.
  // Copy for the live hint underneath the tool buttons. Useful when we clear
  // results because it gives the user some immediate instruction again.
  const TOOL_HINTS = {
    line: "Drop two points in the shooter's view to compare straight paths.",
    triangle: "Plot three vertices to test how triangles behave across worlds.",
    walker: "Send Johnny forth and see whether space keeps him close."
  };

  // --- Result panel helpers -------------------------------------------------

  // Hide the entire result panel and narrative. We rely on this whenever a
  // tool is switched or reset so stale copy never lingers.
  function clearResult(){
    if (resultBlockEl){
      resultBlockEl.hidden = true;
    }
    if (resultTitleEl){
      resultTitleEl.textContent = '';
    }
    if (resultTextEl){
      resultTextEl.textContent = '';
    }
    if (triangleMetricEl){
      triangleMetricEl.hidden = true;
    }
    if (triangleSumEl){
      triangleSumEl.textContent = '--';
    }
    if (narrativeBlock){
      narrativeBlock.hidden = true;
    }
  }

  // Populate the shared result template. `showTriangleMetric` lets the triangle
  // experiment surface the angle-sum line without creating a bespoke DOM block.
  function showResult({ title, text, showTriangleMetric = false }){
    if (!resultBlockEl) return;
    resultBlockEl.hidden = false;
    if (resultTitleEl){
      resultTitleEl.textContent = title;
    }
    if (resultTextEl){
      resultTextEl.textContent = text;
    }
    if (triangleMetricEl){
      triangleMetricEl.hidden = !showTriangleMetric;
      if (!showTriangleMetric && triangleSumEl){
        triangleSumEl.textContent = '--';
      }
    }
  }

  // --- Geometry helpers -----------------------------------------------------

  // Walker orbits are easier to reason about in spherical coordinates; this
  // returns the current equator vector so multiple draw paths can reuse the
  // same maths.
  function getWalkerEquatorVector(){
    const theta = state.walker.theta;
    return {
      x: Math.sin(theta),
      y: 0,
      z: Math.cos(theta)
    };
  }

  // Every narrative update should also surface the philosophical-payoff block;
  // otherwise the textual payoff would disappear when switching experiments.
  function setNarrative(text){
    if (narrativeBlock){
      narrativeBlock.hidden = false;
    }
    if (projectionEl){
      projectionEl.textContent = text;
    }
    liveNarrate(text);
  }

  function clampPlane(pt){
    return {
      x: clamp(pt.x, -VIEW_RANGE * 1.4, VIEW_RANGE * 1.4),
      y: clamp(pt.y, -VIEW_RANGE * 1.4, VIEW_RANGE * 1.4)
    };
  }

  function getViewports(){
    const width = view.width;
    const height = view.height;
    return {
      shooter: { x: 0, y: 0, width: width / 2, height },
      flat: { x: width / 2, y: 0, width: width / 2, height }
    };
  }

  // Map world-plane coordinates (used by the experiments) into a specific
  // viewport. The explorer keeps both halves in a single <canvas>, so we have
  // to translate and scale manually.
  function planeToCanvas(pt, viewport){
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    return {
      x: viewport.x + halfW + (pt.x / VIEW_RANGE) * halfW,
      y: viewport.y + halfH - (pt.y / VIEW_RANGE) * halfH
    };
  }

  // Perspective projection for the Euclidean shooter view (a faux 3‑D floor).
  // This keeps horizon lines consistent so the Flatlander horizon aligns with
  // the orange equator in curved mode.
  function planeToCanvasPerspective(pt, viewport){
    const xClamp = clamp(pt.x, -VIEW_RANGE * 1.35, VIEW_RANGE * 1.35);
    const farLimit = VIEW_RANGE * 0.998;
    const yClamp = clamp(pt.y, -VIEW_RANGE, farLimit);
    const horizonY = viewport.y + viewport.height * 0.3;
    const floorY = viewport.y + viewport.height;
    const vanishingX = viewport.x + viewport.width * 0.7;
    const t = (yClamp + VIEW_RANGE) / (VIEW_RANGE + farLimit);
    const y = floorY - (floorY - horizonY) * t;
    const depthScale = Math.max(0.12, 1 - t * 0.94);
    const maxSpan = viewport.width * 0.65;
    const x = vanishingX + (xClamp / (VIEW_RANGE * 1.35)) * maxSpan * depthScale;
    return { x, y };
  }

  function projectToCanvas(pt, viewport, opts = {}){
    return opts.perspective ? planeToCanvasPerspective(pt, viewport) : planeToCanvas(pt, viewport);
  }

  function planeToSphere(pt){
    const denom = Math.sqrt(pt.x * pt.x + pt.y * pt.y + 1);
    return {
      x: pt.x / denom,
      y: pt.y / denom,
      z: 1 / denom
    };
  }

  function sphereToPlane(vec){
    if (vec.z <= 0) return null;
    return {
      x: vec.x / vec.z,
      y: vec.y / vec.z
    };
  }

  function getSphereCenter(viewport){
    return {
      cx: viewport.x + viewport.width / 2,
      cy: viewport.y + viewport.height / 2 + viewport.height * SPHERE_Y_OFFSET
    };
  }

  // Convert a 3‑D unit vector to the on-screen ellipse representing our
  // visible hemisphere.
  function sphereToCanvas(vec, viewport){
    const radius = Math.min(viewport.width, viewport.height) * 0.42;
    const { cx, cy } = getSphereCenter(viewport);
    return {
      x: cx + vec.x * radius,
      y: cy - vec.y * radius
    };
  }

  function canvasToPlane(event, viewport, rect){
    const localX = (event.clientX - rect.left - viewport.x) / viewport.width - 0.5;
    const localY = (event.clientY - rect.top - viewport.y) / viewport.height - 0.5;
    return clampPlane({
      x: localX * 2 * VIEW_RANGE,
      y: -localY * 2 * VIEW_RANGE
    });
  }

  function canvasToSpherePlane(event, viewport, rect){
    const { cx, cy } = getSphereCenter(viewport);
    const radius = Math.min(viewport.width, viewport.height) * 0.42;
    const nx = (event.clientX - rect.left - cx) / radius;
    const ny = (event.clientY - rect.top - cy) / radius;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return null;
    const z = Math.sqrt(Math.max(0, 1 - d2));
    const spherePoint = { x: nx, y: -ny, z };
    const plane = sphereToPlane(spherePoint);
    if (!plane) return null;
    return clampPlane(plane);
  }

  function vectorLength(v){
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  function dot3(a, b){
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross3(a, b){
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  function norm3(v){
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  // Compute the spherical or Euclidean angle sum and feed both the result
  // panel and the narrative. No output is shown when the user is mid-placement
  // so they can cancel without seeing partial copy.
  function updateTriangleReport(){
    if (activePlacement !== 'triangle'){
      return;
    }

    if (state.triangle.length < 3){
      clearResult();
      return;
    }

    const pts = state.triangle.slice(-3);

    if (state.mode === 'euclid'){
      const sides = pts.map((pt, i) => {
        const next = pts[(i + 1) % 3];
        return vectorLength({ x: next.x - pt.x, y: next.y - pt.y });
      });
      const [a, b, c] = sides;
      const angles = [
        Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c), -1, 1)),
        Math.acos(clamp((c * c + a * a - b * b) / (2 * c * a), -1, 1)),
        Math.acos(clamp((a * a + b * b - c * c) / (2 * a * b), -1, 1))
      ];
      const sum = (angles[0] + angles[1] + angles[2]) * DEG;
      const sumText = sum.toFixed(1) + ' deg';
      if (triangleSumEl){
        triangleSumEl.textContent = sumText;
      }
      showResult({
        title: 'Triangle Experiment',
        text: 'Flatlander still sees straight lines.',
        showTriangleMetric: true
      });
      setNarrative('In Euclidean space, triangles behave exactly as the Flatlander expects.');
    } else {
      const A = planeToSphere(pts[0]);
      const B = planeToSphere(pts[1]);
      const C = planeToSphere(pts[2]);
      const a = Math.acos(clamp(dot3(B, C), -1, 1));
      const b = Math.acos(clamp(dot3(C, A), -1, 1));
      const c = Math.acos(clamp(dot3(A, B), -1, 1));
      const angleA = Math.acos(clamp((Math.cos(a) - Math.cos(b) * Math.cos(c)) / (Math.sin(b) * Math.sin(c) || 1), -1, 1));
      const angleB = Math.acos(clamp((Math.cos(b) - Math.cos(c) * Math.cos(a)) / (Math.sin(c) * Math.sin(a) || 1), -1, 1));
      const angleC = Math.acos(clamp((Math.cos(c) - Math.cos(a) * Math.cos(b)) / (Math.sin(a) * Math.sin(b) || 1), -1, 1));
      const sum = (angleA + angleB + angleC) * DEG;
      const sumText = sum.toFixed(1) + ' deg';
      if (triangleSumEl){
        triangleSumEl.textContent = sumText;
      }
      showResult({
        title: 'Triangle Experiment',
        text: `In the shooter's view, this triangle's angles sum to ${sumText}, yet the Flatlander still sees straight lines.`,
        showTriangleMetric: true
      });
      setNarrative('Curvature fattens triangles, even while the Flatlander insists everything stays straight.');
    }
  }

  function resetTriangle(){
    state.triangle = [];
    state.triangleLine.world = [];
    state.triangleLine.shooterPixels = [];
    if (triangleSumEl){
      triangleSumEl.textContent = '--';
    }
    render();
  }

  // ------- Experiment state helpers -------

  function resetLine(){
    state.line.world = [];
    state.line.shooterPixels = [];
    updateLineResult();
    render();
  }

  // Similar flow for the line experiment: only surface copy once the user has
  // supplied both endpoints, otherwise keep the result panel empty.
  function updateLineResult(){
    if (activePlacement !== 'line'){
      return;
    }
    if (state.line.world.length < 2){
      clearResult();
      return;
    }
    if (state.mode === 'euclid'){
      showResult({
        title: 'Line Experiment',
        text: 'Flatlander also sees a straight line, but of different length, and always bounded on their horizon.'
      });
      setNarrative('Even in flat space, distant horizons shrink the Flatlander\'s sense of length.');
    } else {
      showResult({
        title: 'Line Experiment',
        text: 'In the shooter\'s view, this line appears to be an arc, but the Flatlander still sees a straight line bounded on the horizon.'
      });
      setNarrative('Great circles bend overhead while the Flatlander insists the line stays straight.');
    }
  }

  // Record the most recent click for the two-point line experiment.
  function addLinePoint(worldPt, shooterPixel){
    state.line.world = state.line.world.slice(-1);
    state.line.shooterPixels = state.line.shooterPixels.slice(-1);
    state.line.world.push(worldPt);
    state.line.shooterPixels.push(shooterPixel);
    updateLineResult();
    render();
  }

  // Record up to three vertices (and their screen pixels) for the triangle overlay.
  function addTriangleLinePoint(worldPt, shooterPixel){
    state.triangleLine.world = state.triangleLine.world.slice(-2);
    state.triangleLine.shooterPixels = state.triangleLine.shooterPixels.slice(-2);
    state.triangleLine.world.push(worldPt);
    state.triangleLine.shooterPixels.push(shooterPixel);
    render();
  }

  function setToolHint(tool){
    if (!toolHintEl) return;
    toolHintEl.textContent = TOOL_HINTS[tool] || 'Select an experiment--each click resets its setup.';
  }

  // Style the experiment buttons so the active tool is obvious.
  function updateToolButtonStyles(active){
    Object.entries(toolButtons).forEach(([name, btn]) => {
      if (!btn) return;
      const isActive = name === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive){
        btn.classList.add('wgt__btn--accent');
        btn.classList.remove('wgt__btn--ghost');
      } else {
        btn.classList.remove('wgt__btn--accent');
        btn.classList.add('wgt__btn--ghost');
      }
    });
  }

  // Change tool, update hint text, and optionally reset that experiment's state.
  // Switching tools resets the relevant buffers and redraws hints. Keeping the
  // logic in one place makes it safer to add future experiments without
  // duplicating clean-up code.
  function setActiveTool(tool, {triggerReset = true} = {}){
    updateToolButtonStyles(tool);
    setToolHint(tool);
    if (tool !== 'walker' && state.walker.active){
      resetWalker();
    }
    activePlacement = tool;
    if (!triggerReset){
      clearResult();
      return;
    }
    switch(tool){
      case 'line':
        resetLine();
        break;
      case 'triangle':
        resetTriangle();
        break;
      case 'walker':
        resetWalker();
        startWalker();
        break;
      default:
        clearResult();
        break;
    }
  }

  // Full reset wipes every experiment, deselects the active tool, and hides
  // the result panel. Render runs at the end so the canvases visibly clear.
  function resetAll(){
    activePlacement = null;
    updateToolButtonStyles(null);
    setToolHint(null);
    resetLine();
    resetTriangle();
    resetWalker();
    clearResult();
    render();
  }

  function resetWalker(){
    state.walker.active = false;
    state.walker.position = 0;
    state.walker.theta = 0;
    state.walker.lastTime = 0;
    if (raf){
      cancelAnimationFrame(raf);
      raf = null;
    }
    if (activePlacement === 'walker'){
      clearResult();
    }
    render();
  }

  // Each walker launch writes its own result copy so the panel can narrate
  // without waiting for the animation loop to complete.
  function startWalker(){
    state.walker.mode = state.mode;
    state.walker.active = true;
    state.walker.lastTime = performance.now();
    if (state.mode === 'euclid'){
      state.walker.position = -VIEW_RANGE * 1.6;
      state.walker.theta = 0;
      showResult({
        title: 'Johnny the Walker',
        text: 'Both shooter and Flatlander see Johnny disappearing on the horizon because both worlds are infinite and unbounded.'
      });
      setNarrative('Johnny strides across an endless plain until the horizon swallows him.');
    } else {
      state.walker.theta = 0;
      state.walker.position = 0;
      showResult({
        title: 'Johnny the Walker',
        text: 'Both Shooter and Flatlander see Johnny keep circling back to where he was. The shooter knows this world is finite, yet the Flatlander feels it as finite but unbounded.'
      });
      setNarrative('On the sphere, Johnny loops along the equator—finite space with no edges.');
    }
    if (!raf){
      raf = requestAnimationFrame(step);
    }
  }

  function step(now){
    const dt = Math.min(0.05, (now - state.walker.lastTime) / 1000);
    state.walker.lastTime = now;

    if (state.walker.active){
      if (state.walker.mode === 'euclid'){
        state.walker.position += dt * WALKER_SPEED;
        if (state.walker.position > VIEW_RANGE * 1.6){
          state.walker.active = false;
        }
      } else {
        state.walker.theta = (state.walker.theta + dt * WALKER_ORBIT_SPEED) % (Math.PI * 2);
      }
    }

    render();
    if (state.walker.active){
      raf = requestAnimationFrame(step);
    } else {
      raf = null;
    }
  }

  function drawGrid(ctx, viewport, spacing){
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    const cx = viewport.x + viewport.width / 2;
    const cy = viewport.y + viewport.height / 2;
    const countX = Math.ceil(viewport.width / spacing);
    const countY = Math.ceil(viewport.height / spacing);
    for (let i = -countX; i <= countX; i++){
      const x = cx + i * spacing;
      ctx.beginPath();
      ctx.moveTo(x, viewport.y);
      ctx.lineTo(x, viewport.y + viewport.height);
      ctx.stroke();
    }
    for (let j = -countY; j <= countY; j++){
      const y = cy + j * spacing;
      ctx.beginPath();
      ctx.moveTo(viewport.x, y);
      ctx.lineTo(viewport.x + viewport.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGnomonicGrid(ctx, viewport){
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    const cx = viewport.x + viewport.width / 2;
    const cy = viewport.y + viewport.height / 2;
    const base = Math.min(viewport.width, viewport.height) * 0.4;
    const rings = [0.3, 0.6, 0.9];
    rings.forEach(r => {
      const rad = r * base;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(cx, viewport.y);
    ctx.lineTo(cx, viewport.y + viewport.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(viewport.x, cy);
    ctx.lineTo(viewport.x + viewport.width, cy);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlatlanderHorizonLine(ctx, viewport){
    const horizonY = viewport.y + viewport.height / 2;
    ctx.save();
    ctx.strokeStyle = VIEW_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(viewport.x, horizonY);
    ctx.lineTo(viewport.x + viewport.width, horizonY);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlatlanderHorizon(ctx, viewport){
    const cx = viewport.x + viewport.width / 2;
    const cy = viewport.y + viewport.height / 2;
    const radius = Math.min(viewport.width, viewport.height) / 2 * 0.95;
    ctx.save();
    ctx.strokeStyle = VIEW_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = VIEW_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('Horizon', cx, cy - radius - 6);
    ctx.restore();
  }

  function drawSphereBackground(ctx, viewport){
    const radius = Math.min(viewport.width, viewport.height) * 0.42;
    const { cx, cy } = getSphereCenter(viewport);
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    ctx.clip();
    ctx.fillStyle = '#06395f';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b4e82';
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.05, radius, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawVisibleHemisphere(ctx, viewport){
    const radius = Math.min(viewport.width, viewport.height) * 0.42;
    const { cx, cy } = getSphereCenter(viewport);
    ctx.save();
    ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = VIEW_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function rotateVecX(vec, angle){
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: vec.x,
      y: vec.y * cos - vec.z * sin,
      z: vec.y * sin + vec.z * cos
    };
  }

  function drawFlatlanderMarkerShooter(ctx, viewport){
    // Rotate the north-pole vector 90deg so it lands at the top of the rendered sphere.
    const rotated = rotateVecX(FLATLANDER_VEC, -Math.PI / 2);
    const p = sphereToCanvas(rotated, viewport);
    ctx.save();
    ctx.fillStyle = VIEW_COLOR;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 12);
    ctx.lineTo(p.x, p.y + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y + 20);
    ctx.lineTo(p.x, p.y + 28);
    ctx.lineTo(p.x + 6, p.y + 20);
    ctx.fill();

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Flatlander', p.x, p.y - 14);
    ctx.restore();
  }

  function drawEquator3D(ctx, viewport){
    const radius = Math.min(viewport.width, viewport.height) * 0.42;
    const { cx, cy } = getSphereCenter(viewport);
    ctx.save();
    const ry = radius * 0.45;

    // Back half (top) in dashed white to suggest it wraps behind the globe
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Front half (bottom) in solid orange to indicate the visible horizon
    ctx.setLineDash([]);
    ctx.strokeStyle = VIEW_COLOR;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, ry, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawTriangleFlat(ctx, viewport, opts = {}){
    if (opts.perspective){
      // Shooter view: fill directly between the recorded click pixels so the
      // translucent overlay aligns perfectly with the visible dots.
      if (state.triangleLine.shooterPixels.length >= 3){
        const pixels = state.triangleLine.shooterPixels;
        ctx.save();
        ctx.fillStyle = '#f28e2b';
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.moveTo(pixels[0].x, pixels[0].y);
        ctx.lineTo(pixels[1].x, pixels[1].y);
        ctx.lineTo(pixels[2].x, pixels[2].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      return;
    }
  }

  function drawGreatCircleEdge(ctx, viewport, A, B){
    const dots = [];
    const steps = 48;
    const omega = Math.acos(clamp(dot3(A, B), -1, 1));
    if (omega < 1e-4) return;
    const sinOmega = Math.sin(omega);
    for (let i = 0; i <= steps; i++){
      const t = i / steps;
      const scale0 = Math.sin((1 - t) * omega) / sinOmega;
      const scale1 = Math.sin(t * omega) / sinOmega;
      const vec = {
        x: scale0 * A.x + scale1 * B.x,
        y: scale0 * A.y + scale1 * B.y,
        z: scale0 * A.z + scale1 * B.z
      };
      if (vec.z >= 0){
        dots.push(sphereToCanvas(vec, viewport));
      }
    }
    if (dots.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(dots[0].x, dots[0].y);
    for (let i = 1; i < dots.length; i++){
      ctx.lineTo(dots[i].x, dots[i].y);
    }
    ctx.stroke();
  }

  // Sample evenly spaced vectors along the great-circle arc between A and B.
  function sampleGreatCircleVectors(A, B, steps = 96){
    const omega = Math.acos(clamp(dot3(A, B), -1, 1));
    if (omega < 1e-6) return [A];
    const sinOmega = Math.sin(omega);
    const points = [];
    for (let i = 0; i <= steps; i++){
      const t = i / steps;
      const scale0 = Math.sin((1 - t) * omega) / sinOmega;
      const scale1 = Math.sin(t * omega) / sinOmega;
      const vec = {
        x: scale0 * A.x + scale1 * B.x,
        y: scale0 * A.y + scale1 * B.y,
        z: scale0 * A.z + scale1 * B.z
      };
      points.push(norm3(vec));
    }
    return points;
  }

  function drawTriangleSphere(ctx, viewport){
    if (state.triangle.length < 3) return;
    const lastPts = state.triangle.slice(-3);
    const spherePts = lastPts.map(planeToSphere);
    const fallback = spherePts.map(vec => sphereToCanvas(vec, viewport));

    const edges = [
      sampleGreatCircleVectors(spherePts[0], spherePts[1], 96),
      sampleGreatCircleVectors(spherePts[1], spherePts[2], 96),
      sampleGreatCircleVectors(spherePts[2], spherePts[0], 96)
    ];

    const arcPath = [];
    edges.forEach((edge, edgeIndex) => {
      edge.forEach((vec, pointIndex) => {
        if (vec.z < 0) return;
        if (edgeIndex > 0 && pointIndex === 0) return;
        arcPath.push(sphereToCanvas(vec, viewport));
      });
    });

    const pointsToDraw = arcPath.length >= 3 ? arcPath : fallback;
    if (pointsToDraw.length < 3) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 201, 107, 0.28)';
    ctx.beginPath();
    ctx.moveTo(pointsToDraw[0].x, pointsToDraw[0].y);
    for (let i = 1; i < pointsToDraw.length; i++){
      ctx.lineTo(pointsToDraw[i].x, pointsToDraw[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlatlanderBaseline(ctx, viewport, opts = {}){
    ctx.save();
    ctx.strokeStyle = 'rgba(60,60,60,0.45)';
    ctx.lineWidth = 2;
    const a = projectToCanvas({ x: -VIEW_RANGE * 1.2, y: 0 }, viewport, opts);
    const b = projectToCanvas({ x: VIEW_RANGE * 1.2, y: 0 }, viewport, opts);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawPerspectivePlane(ctx, viewport){
    const farLimit = VIEW_RANGE * 0.99999;
    const horizonY = viewport.y + viewport.height * 0.3;
    const floorY = viewport.y + viewport.height;
    ctx.save();
    // sky
    const gradSky = ctx.createLinearGradient(0, viewport.y, 0, horizonY);
    gradSky.addColorStop(0, '#d7e3f4');
    gradSky.addColorStop(1, '#eef3f9');
    ctx.fillStyle = gradSky;
    ctx.fillRect(viewport.x, viewport.y, viewport.width, horizonY - viewport.y);
    // ground
    const gradGround = ctx.createLinearGradient(0, horizonY, 0, floorY);
    gradGround.addColorStop(0, '#f7eedd');
    gradGround.addColorStop(0.45, '#ead9bf');
    gradGround.addColorStop(1, '#d0ba9b');
    ctx.fillStyle = gradGround;
    ctx.fillRect(viewport.x, horizonY, viewport.width, floorY - horizonY);

    // Vertical perspective rails (viewer-facing grid lines).
    ctx.strokeStyle = 'rgba(128,112,88,0.28)';
    ctx.lineWidth = 1;
    const columns = 14;
    const planeSpan = VIEW_RANGE * 2.2;
    const xStart = -planeSpan / 2;
    const deltaX = planeSpan / columns;
    for (let i = 0; i <= columns; i++){
      const xWorld = xStart + i * deltaX;
      const nearPt = projectToCanvas({ x: xWorld, y: -VIEW_RANGE }, viewport, { perspective: true });
      const farPt = projectToCanvas({ x: xWorld, y: farLimit }, viewport, { perspective: true });
      ctx.beginPath();
      ctx.moveTo(nearPt.x, nearPt.y);
      ctx.lineTo(farPt.x, farPt.y);
      ctx.stroke();
    }

    const depthLevels = [];
    let depth = -VIEW_RANGE;
    while (depth < farLimit){
      depthLevels.push(depth);
      const distToHorizon = farLimit - depth;
      const step = Math.max(VIEW_RANGE * 0.025, distToHorizon * 0.22);
      depth += step;
    }
    depthLevels.forEach(depth => {
      const pos = projectToCanvas({ x: 0, y: depth }, viewport, { perspective: true });
      if (pos.y <= floorY + 1 && pos.y >= horizonY - 1){
        ctx.beginPath();
        ctx.moveTo(viewport.x, pos.y);
        ctx.lineTo(viewport.x + viewport.width, pos.y);
        ctx.strokeStyle = 'rgba(128,112,88,0.32)';
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawViewportHeader(ctx, viewport, title, subtitle, theme){
    const height = subtitle ? 44 : 32;
    ctx.save();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(viewport.x, viewport.y, viewport.width, height);
    if (theme.border){
      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(viewport.x + 0.5, viewport.y + 0.5, viewport.width - 1, height - 1);
    }
    ctx.fillStyle = theme.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = theme.titleFont || '600 16px "Source Sans Pro", system-ui, sans-serif';
    const centerX = viewport.x + viewport.width / 2;
    ctx.fillText(title, centerX, viewport.y + 8);
    if (subtitle){
      ctx.font = theme.subtitleFont || '400 13px "Source Sans Pro", system-ui, sans-serif';
      ctx.fillText(subtitle, centerX, viewport.y + 24);
    }
    ctx.restore();
  }

  function drawWalkerPlane(ctx, viewport, opts = {}){
    const walker = state.walker;
    if (!walker.active && Math.abs(walker.position) < 1e-6 && Math.abs(walker.theta) < 1e-6) return;
    ctx.save();
    ctx.fillStyle = '#5f27cd';
    let point;
    if (walker.mode === 'euclid'){
      if (walker.position < -VIEW_RANGE * 1.4 || walker.position > VIEW_RANGE * 1.6){
        ctx.restore();
        return;
      }
      point = projectToCanvas({ x: walker.position, y: 0 }, viewport, opts);
    } else {
      const vec = getWalkerEquatorVector();
      if (vec.z <= 0){
        ctx.restore();
        return;
      }
      const planePt = sphereToPlane(vec);
      if (!planePt){
        ctx.restore();
        return;
      }
      const horizonY = viewport.y + viewport.height / 2;
      const projected = planeToCanvas({ x: planePt.x, y: 0 }, viewport);
      point = { x: projected.x, y: horizonY };
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWalkerSphere(ctx, viewport){
    const walker = state.walker;
    if (!walker.active && Math.abs(walker.position) < 1e-6 && Math.abs(walker.theta) < 1e-6) return;
    ctx.save();
    ctx.fillStyle = '#5f27cd';
    let point;
    if (walker.mode === 'euclid'){
      if (walker.position < -VIEW_RANGE * 1.4 || walker.position > VIEW_RANGE * 1.6){
        ctx.restore();
        return;
      }
      point = planeToCanvas({ x: walker.position, y: 0 }, viewport);
    } else {
      const vec = getWalkerEquatorVector();
      const angle = state.walker.theta;
      const radius = Math.min(viewport.width, viewport.height) * 0.42;
      const ry = radius * 0.45;
      const { cx, cy } = getSphereCenter(viewport);
      point = {
        x: cx + radius * Math.sin(angle),
        y: cy + ry * Math.cos(angle)
      };
      if (vec.z < 0){
        ctx.globalAlpha = 0.35;
      }
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Render the two-point geodesic in the shooter half (perspective or sphere).
  function drawLineShooter(ctx, viewport){
    const count = state.line.world.length;
    if (!count) return;
    ctx.save();
    const pathColor = 'rgba(31,111,235,0.85)';
    ctx.fillStyle = '#c0392b';
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 2;

    if (count >= 2){
      if (state.mode === 'euclid' && state.line.shooterPixels.length >= 2){
        const [p0, p1] = state.line.shooterPixels;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      } else {
        const A = planeToSphere(state.line.world[0]);
        const B = planeToSphere(state.line.world[1]);
        ctx.strokeStyle = pathColor;
        ctx.lineWidth = 2;
        drawGreatCircleEdge(ctx, viewport, A, B);
      }
    }

    state.line.shooterPixels.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Render the two-point geodesic for the Flatlander view.
  function drawLineFlat(ctx, viewport){
    const count = state.line.world.length;
    if (!count) return;
    ctx.save();
    const pathColor = 'rgba(31,111,235,0.85)';
    const horizonY = viewport.y + viewport.height / 2;

    const dotPoints = state.line.world.map(worldPt => {
      const projected = planeToCanvas({ x: worldPt.x, y: 0 }, viewport);
      return { x: projected.x, y: horizonY };
    });

    if (dotPoints.length >= 2){
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dotPoints[0].x, dotPoints[0].y);
      for (let i = 1; i < dotPoints.length; i++){
        ctx.lineTo(dotPoints[i].x, dotPoints[i].y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = '#c0392b';
    dotPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawGreatCircleOnFlat(ctx, viewport, A, B){
    const arcVecs = sampleGreatCircleVectors(A, B, 96);
    let begun = false;
    ctx.beginPath();
    arcVecs.forEach(vec => {
      const planePt = sphereToPlane(vec);
      if (!planePt) return;
      const canvasPt = planeToCanvas(planePt, viewport);
      if (!begun){
        ctx.moveTo(canvasPt.x, canvasPt.y);
        begun = true;
      } else {
        ctx.lineTo(canvasPt.x, canvasPt.y);
      }
    });
    if (begun){
      ctx.stroke();
    }
  }

  // Render the triangle overlay in the shooter half using the recorded vertices.
  function drawTriangleLineShooter(ctx, viewport){
    const count = state.triangleLine.world.length;
    if (!count) return;
    ctx.save();
    const color = 'rgba(227,104,52,0.9)';
    ctx.strokeStyle = color;
    ctx.fillStyle = '#e76f51';
    ctx.lineWidth = 2;

    if (count >= 2){
      if (state.mode === 'euclid' && state.triangleLine.shooterPixels.length >= 2){
        const pts = state.triangleLine.shooterPixels;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        if (pts.length >= 3){
          ctx.lineTo(pts[2].x, pts[2].y);
          ctx.closePath();
        }
        ctx.stroke();
      } else if (state.triangleLine.world.length >= 2){
        const vecs = state.triangleLine.world.map(planeToSphere);
        const segments = vecs.length === 3 ? [[0,1],[1,2],[2,0]] : [[0,1]];
        segments.forEach(([i, j]) => {
          const A = vecs[i];
          const B = vecs[j];
          drawGreatCircleEdge(ctx, viewport, A, B);
        });
      }
    }

    if (state.mode === 'euclid'){
      state.triangleLine.shooterPixels.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      state.triangleLine.world.forEach(worldPt => {
        const vec = planeToSphere(worldPt);
        const marker = sphereToCanvas(vec, viewport);
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  // Render the triangle overlay from the Flatlander's perspective.
  function drawTriangleLineFlat(ctx, viewport){
    const count = state.triangleLine.world.length;
    if (!count) return;
    ctx.save();
    const color = 'rgba(227,104,52,0.9)';
    ctx.strokeStyle = color;
    ctx.fillStyle = '#e76f51';
    ctx.lineWidth = 2;

    if (count >= 1){
      if (state.mode === 'euclid'){
        const horizonY = viewport.y + viewport.height / 2;
        const projected = state.triangleLine.world.map(pt => planeToCanvas({ x: pt.x, y: 0 }, viewport));
        if (projected.length >= 2){
          ctx.beginPath();
          ctx.moveTo(projected[0].x, horizonY);
          ctx.lineTo(projected[1].x, horizonY);
          if (projected.length >= 3){
            ctx.lineTo(projected[2].x, horizonY);
            ctx.closePath();
          }
          ctx.stroke();
        }
        projected.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, horizonY, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        const horizonY = viewport.y + viewport.height / 2;
        const projected = state.triangleLine.world.map(pt => {
          const base = planeToCanvas({ x: pt.x, y: 0 }, viewport);
          return { x: base.x, y: horizonY };
        });
        const segments = projected.length === 3 ? [[0,1],[1,2],[2,0]] : [[0,1]];
        segments.forEach(([i, j]) => {
          const start = projected[i];
          const end = projected[j];
          if (!start || !end) return;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        });
        projected.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    ctx.restore();
  }

  function drawDivider(ctx){
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    const x = view.width / 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, view.height);
    ctx.stroke();
    ctx.restore();
  }

  // Master render pass; called after every state change and on resize. We draw
  // the left and right views sequentially inside the same canvas so clipping
  // is used heavily to keep content in its half.
  function render(){
    const ctx = view.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, view.width, view.height);
    const viewports = getViewports();

    // Shooter's view (left)
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewports.shooter.x, viewports.shooter.y, viewports.shooter.width, viewports.shooter.height);
    ctx.clip();
    if (state.mode === 'euclid'){
      drawPerspectivePlane(ctx, viewports.shooter);
      drawTriangleFlat(ctx, viewports.shooter, { perspective: true });
      drawLineShooter(ctx, viewports.shooter);
      drawTriangleLineShooter(ctx, viewports.shooter);
      drawWalkerPlane(ctx, viewports.shooter, { perspective: true });
      drawViewportHeader(ctx, viewports.shooter, "Shooter's View", "God's-eye perspective", {
        fg: 'rgba(32,32,32,0.88)',
        bg: 'rgba(255,255,255,0.86)',
        border: 'rgba(32,32,32,0.15)'
      });
    } else {
      ctx.fillStyle = '#021f35';
      ctx.fillRect(viewports.shooter.x, viewports.shooter.y, viewports.shooter.width, viewports.shooter.height);
      drawSphereBackground(ctx, viewports.shooter);
      drawEquator3D(ctx, viewports.shooter);
      drawVisibleHemisphere(ctx, viewports.shooter);
      drawFlatlanderMarkerShooter(ctx, viewports.shooter);
      drawTriangleSphere(ctx, viewports.shooter);
      drawLineShooter(ctx, viewports.shooter);
      drawTriangleLineShooter(ctx, viewports.shooter);
      drawWalkerSphere(ctx, viewports.shooter);
      drawViewportHeader(ctx, viewports.shooter, "Shooter's View", "God's-eye perspective", {
        fg: 'rgba(240,246,255,0.96)',
        bg: 'rgba(6,18,32,0.72)',
        border: 'rgba(180,205,255,0.25)'
      });
    }
    ctx.restore();

    // Flatlander's view (right)
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewports.flat.x, viewports.flat.y, viewports.flat.width, viewports.flat.height);
    ctx.clip();
    if (state.mode === 'euclid'){
      ctx.fillStyle = '#fbfaf7';
      ctx.fillRect(viewports.flat.x, viewports.flat.y, viewports.flat.width, viewports.flat.height);
      drawGrid(ctx, viewports.flat, viewports.flat.width * 0.1);
      drawFlatlanderHorizonLine(ctx, viewports.flat);
    } else {
    ctx.fillStyle = '#f4f8ff';
    ctx.fillRect(viewports.flat.x, viewports.flat.y, viewports.flat.width, viewports.flat.height);
    drawGnomonicGrid(ctx, viewports.flat);
      drawFlatlanderHorizonLine(ctx, viewports.flat);
    }
    drawFlatlanderBaseline(ctx, viewports.flat);
    drawTriangleFlat(ctx, viewports.flat);
    drawLineFlat(ctx, viewports.flat);
    drawTriangleLineFlat(ctx, viewports.flat);
    drawWalkerPlane(ctx, viewports.flat);
    drawViewportHeader(ctx, viewports.flat, "Flatlander's View", "2D and intelligent perspective", {
      fg: 'rgba(32,32,32,0.88)',
      bg: 'rgba(255,255,255,0.86)',
      border: 'rgba(32,32,32,0.15)'
    });
    ctx.restore();

    drawDivider(ctx);
  }

  function addTrianglePoint(pt){
    state.triangle = state.triangle.slice(-2);
    state.triangle.push(pt);
    updateTriangleReport();
    render();
  }

  // Route pointer events to the active experiment. The tools only accept input
  // inside the shooter's half of the canvas so the Flatland view remains a
  // passive projection.
  function handlePointer(event){
    const rect = viewCanvas.getBoundingClientRect();
    const tool = activePlacement;
    if (!tool) return;
    const viewports = getViewports();
    const isShooter = (event.clientX - rect.left) < rect.width / 2;

    // Line and triangle experiments only accept clicks in the shooter's viewport.
    if (tool === 'line' && !isShooter){
      return;
    }
    if (tool === 'walker'){
      return;
    }
    if (tool === 'triangle' && !isShooter){
      return;
    }

    // In Euclidean mode we ignore sky clicks so that points live on the ground plane.
    if ((tool === 'line' || tool === 'triangle') && state.mode === 'euclid'){
      const horizonScreenY = viewports.shooter.y + viewports.shooter.height * 0.3;
      const pointerY = event.clientY - rect.top;
      if (pointerY < horizonScreenY){
        return;
      }
    }

    let pt = null;
    if (isShooter && state.mode === 'sphere'){
      pt = canvasToSpherePlane(event, viewports.shooter, rect);
    } else {
      const targetViewport = isShooter ? viewports.shooter : viewports.flat;
      pt = canvasToPlane(event, targetViewport, rect);
    }

    if (!pt) return;

    if (tool === 'triangle'){
      addTrianglePoint(pt);
      const shooterPixel = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      addTriangleLinePoint(pt, shooterPixel);
    } else if (tool === 'line'){
      const shooterPixel = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      addLinePoint(pt, shooterPixel);
    }
  }

  modeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      state.mode = e.target.value === 'sphere' ? 'sphere' : 'euclid';
      state.walker.mode = state.mode;
      resetLine();
      resetTriangle();
      resetWalker();
      updateTriangleReport();
      clearResult();
    });
  });

  toolButtons.line?.addEventListener('click', () => {
    setActiveTool('line');
  });
  toolButtons.triangle?.addEventListener('click', () => {
    setActiveTool('triangle');
  });
  toolButtons.walker?.addEventListener('click', () => {
    setActiveTool('walker');
  });

  resetAllBtn?.addEventListener('click', () => {
    resetAll();
  });

  viewCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handlePointer(event);
  });

  hoverCursor(viewCanvas, {
    hover: 'crosshair',
    hitTest: (pt) => {
      if (state.mode !== 'sphere') return true;
      const viewports = getViewports();
      if (pt.x <= viewports.shooter.x + viewports.shooter.width){
        const cx = viewports.shooter.x + viewports.shooter.width / 2;
        const cy = viewports.shooter.y + viewports.shooter.height / 2;
        const radius = Math.min(viewports.shooter.width, viewports.shooter.height) * 0.42;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        return (dx * dx + dy * dy) <= radius * radius;
      }
      return true;
    }
  });

  resetAll();
  if (projectionEl){
    projectionEl.textContent = 'Geometry feels like law to the Flatlander. From the shooter view, it is a negotiated truce with curvature.';
  }
  render();
  requestAnimationFrame(() => render());
})();
