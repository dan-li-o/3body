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

  const view3dCanvas = root.querySelector('[data-role="view3d"]');
  const view2dCanvas = root.querySelector('[data-role="view2d"]');
  if (!view3dCanvas || !view2dCanvas){
    console.error('flatland.js expects both canvases to exist.');
    return;
  }

  const projectionEl = root.querySelector('[data-role="narrative"]');
  const triangleSumEl = root.querySelector('[data-role="triangle-sum"]');
  const triangleMsgEl = root.querySelector('[data-role="triangle-message"]');
  const parallelStatusEl = root.querySelector('[data-role="parallel-status"]');
  const parallelMsgEl = root.querySelector('[data-role="parallel-message"]');
  const walkerStatusEl = root.querySelector('[data-role="walker-status"]');
  const walkerMsgEl = root.querySelector('[data-role="walker-message"]');

  const modeInputs = Array.from(root.querySelectorAll('[data-role="mode"]'));
  const triangleResetBtn = root.querySelector('[data-role="triangle-reset"]');
  const parallelResetBtn = root.querySelector('[data-role="parallel-reset"]');
  const walkerResetBtn = root.querySelector('[data-role="walker-reset"]');
  const walkerPlayBtn = root.querySelector('[data-role="walker-play"]');

  const triangleField = root.querySelector('[aria-label="Triangle experiment"]');
  const parallelField = root.querySelector('[aria-label="Parallel lines test"]');

  const baseCanvas = typeof canvasDefaults === 'function'
    ? canvasDefaults()
    : { aspect: 16 / 9, min: 320, max: 720 };

  const view3d = autosizeCanvas(view3dCanvas, baseCanvas);
  const view2d = autosizeCanvas(view2dCanvas, baseCanvas);

  const liveNarrate = typeof announce === 'function'
    ? (text) => announce(projectionEl, text)
    : (text) => { if (projectionEl) projectionEl.textContent = text; };

  const VIEW_RANGE = 1.15;
  const WALKER_LIMIT = 2.4;
  const DEG = 180 / Math.PI;

  const state = {
    mode: 'euclid',
    triangle: [],
    parallelPoint: null,
    walker: {
      mode: 'euclid',
      active: false,
      t: 0,
      theta: 0,
      lastTime: 0
    }
  };

  let raf = null;
  let activePlacement = 'triangle';

  function setNarrative(text){
    if (!projectionEl) return;
    projectionEl.textContent = text;
    liveNarrate(text);
  }

  function clampPlane(pt){
    return {
      x: clamp(pt.x, -VIEW_RANGE * 1.4, VIEW_RANGE * 1.4),
      y: clamp(pt.y, -VIEW_RANGE * 1.4, VIEW_RANGE * 1.4)
    };
  }

  function planeToCanvas(pt, canvas){
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: cx + (pt.x / VIEW_RANGE) * cx,
      y: cy - (pt.y / VIEW_RANGE) * cy
    };
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

  function sphereToCanvas(vec, canvas){
    const rect = canvas.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.42;
    return {
      x: rect.width / 2 + vec.x * radius,
      y: rect.height / 2 - vec.y * radius
    };
  }

  function canvasToPlane(canvas, event){
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    return clampPlane({
      x: x * 2 * VIEW_RANGE,
      y: -y * 2 * VIEW_RANGE
    });
  }

  function canvasToSpherePlane(canvas, event){
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.42;
    const x = (event.clientX - rect.left) - cx;
    const y = (event.clientY - rect.top) - cy;
    const nx = x / radius;
    const ny = y / radius;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return null;
    const z = Math.sqrt(Math.max(0, 1 - d2));
    const spherePoint = { x: nx, y: -ny, z };
    const plane = sphereToPlane(spherePoint);
    if (!plane) return null;
    return clampPlane(plane);
  }

  function addTrianglePoint(pt){
    state.triangle = state.triangle.slice(-2);
    state.triangle.push(pt);
    updateTriangleReport();
    render();
  }

  function resetTriangle(){
    state.triangle = [];
    triangleSumEl.textContent = '--';
    triangleMsgEl.textContent = '';
    render();
  }

  function setParallelPoint(pt){
    state.parallelPoint = pt;
    updateParallelReport();
    render();
  }

  function resetParallel(){
    state.parallelPoint = null;
    parallelStatusEl.textContent = '--';
    parallelMsgEl.textContent = '';
    render();
  }

  function resetWalker(){
    state.walker.active = false;
    state.walker.t = 0;
    state.walker.theta = 0;
    walkerStatusEl.textContent = '--';
    walkerMsgEl.textContent = '';
    if (raf){
      cancelAnimationFrame(raf);
      raf = null;
    }
    render();
  }

  function startWalker(){
    resetWalker();
    state.walker.mode = state.mode;
    state.walker.active = true;
    state.walker.lastTime = performance.now();
    walkerStatusEl.textContent = 'Running';
    walkerMsgEl.textContent = state.mode === 'euclid'
      ? 'Our walker strides endlessly on a flat plane.'
      : 'The walker hugs a great circle. Wait for the loop.';
    setNarrative(state.mode === 'euclid'
      ? 'Induction feels safe: in flat space, straight paths run forever.'
      : 'On a sphere, uniform motion smuggles you home. Laws depend on hidden curvature.');
    raffy();
  }

  function raffy(){
    if (raf) return;
    state.walker.lastTime = performance.now();
    raf = requestAnimationFrame(step);
  }

  function step(now){
    const dt = Math.min(0.05, (now - state.walker.lastTime) / 1000);
    state.walker.lastTime = now;

    if (state.walker.active){
      if (state.walker.mode === 'euclid'){
        state.walker.t += dt * 0.5;
        if (state.walker.t * 2 > WALKER_LIMIT){
          walkerStatusEl.textContent = 'Never comes back';
          walkerMsgEl.textContent = 'Flatland report: the walker drifts off forever.';
          setNarrative('Uniformity feels eternal when space is truly flat.');
          state.walker.active = false;
        }
      } else {
        state.walker.theta += dt * Math.PI * 0.35;
        if (state.walker.theta >= Math.PI * 2){
          walkerStatusEl.textContent = 'Returned home';
          walkerMsgEl.textContent = 'Curvature closes the walk. No edges, yet finite.';
          setNarrative('Curved space bends even straight intentions back on themselves.');
          state.walker.active = false;
        }
      }
    }

    render();
    if (state.walker.active){
      raf = requestAnimationFrame(step);
    } else {
      raf = null;
    }
  }

  function vectorLength(v){
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  function dot2(a, b){
    return a.x * b.x + a.y * b.y;
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

  function updateTriangleReport(){
    if (state.triangle.length < 3){
      triangleSumEl.textContent = '--';
      triangleMsgEl.textContent = 'Pick three vertices to compare geometries.';
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
      triangleSumEl.textContent = sum.toFixed(1) + ' deg';
      triangleMsgEl.textContent = 'Flat verdict: angles add to 180 deg. Induction still smiles.';
      setNarrative('In Euclidean mode, the triangle obeys 180 deg. Geometry feels inevitable.');
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
      triangleSumEl.textContent = sum.toFixed(1) + ' deg';
      triangleMsgEl.textContent = 'Your triangle got fat. Curvature swallowed the surplus.';
      setNarrative('Riemannian mode inflates the triangle: geometry bends with the world.');
    }
  }

  function updateParallelReport(){
    if (!state.parallelPoint){
      parallelStatusEl.textContent = '--';
      parallelMsgEl.textContent = 'Select a point to test parallels.';
      return;
    }

    if (state.mode === 'euclid'){
      parallelStatusEl.textContent = 'True parallel';
      parallelMsgEl.textContent = 'Flatland says: parallel lines stay strangers forever.';
      setNarrative('On a flat plane, parallels never meet. The postulate feels like law.');
    } else {
      const pSphere = planeToSphere(state.parallelPoint);
      if (Math.abs(pSphere.y) < 1e-3){
        parallelStatusEl.textContent = 'Equator only';
        parallelMsgEl.textContent = 'Only the equator stays parallel to itself. Any other path curves home.';
      } else {
        parallelStatusEl.textContent = 'They meet';
        parallelMsgEl.textContent = 'Parallel? A Euclidean superstition. Great circles cross again.';
      }
      setNarrative('Hidden curvature collapses the parallel postulate. Laws wobble with context.');
    }
  }

  function drawGrid(ctx, width, height, squareSize){
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    const halfW = Math.ceil(width / (squareSize * 2));
    const halfH = Math.ceil(height / (squareSize * 2));
    for (let i = -halfW; i <= halfW; i++){
      const x = width / 2 + i * squareSize;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let j = -halfH; j <= halfH; j++){
      const y = height / 2 + j * squareSize;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGnomonicGrid(ctx, width, height){
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    const rings = [0.3, 0.6, 0.9];
    rings.forEach(r => {
      const rad = r * width * 0.4;
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, rad, rad, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
  }

  function rotateAroundAxis(vec, axis, angle){
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = vec.x * axis.x + vec.y * axis.y + vec.z * axis.z;
    return {
      x: vec.x * cos + sin * (axis.y * vec.z - axis.z * vec.y) + axis.x * dot * (1 - cos),
      y: vec.y * cos + sin * (axis.z * vec.x - axis.x * vec.z) + axis.y * dot * (1 - cos),
      z: vec.z * cos + sin * (axis.x * vec.y - axis.y * vec.x) + axis.z * dot * (1 - cos)
    };
  }

  function sampleGreatCircle(anchor, tangent){
    const axis = norm3(cross3(anchor, tangent));
    const pts = [];
    const steps = 96;
    for (let i = -steps; i <= steps; i++){
      const angle = (i / steps) * Math.PI;
      const p = rotateAroundAxis(anchor, axis, angle);
      if (p.z >= 0) pts.push(p);
    }
    return pts;
  }

  function derivativeVector(pt, delta){
    const ahead = planeToSphere({ x: pt.x + delta, y: pt.y });
    const here = planeToSphere(pt);
    return {
      x: ahead.x - here.x,
      y: ahead.y - here.y,
      z: ahead.z - here.z
    };
  }

  function renderView2D(){
    const ctx = view2d.ctx;
    const width = view2d.width;
    const height = view2d.height;
    ctx.clearRect(0, 0, width, height);

    if (state.mode === 'euclid'){
      ctx.fillStyle = '#fbfaf7';
      ctx.fillRect(0, 0, width, height);
      drawGrid(ctx, width, height, width * 0.1);
    } else {
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(0, 0, width, height);
      drawGnomonicGrid(ctx, width, height);
    }

    drawBaseParallels2D(ctx, view2dCanvas);
    drawTriangle2D(ctx, view2dCanvas);
    drawParallelCandidate2D(ctx, view2dCanvas);
    drawWalker2D(ctx, width, height, view2dCanvas);
  }

  function renderView3D(){
    const ctx = view3d.ctx;
    const width = view3d.width;
    const height = view3d.height;
    ctx.clearRect(0, 0, width, height);

    if (state.mode === 'euclid'){
      ctx.fillStyle = '#f8f5f0';
      ctx.fillRect(0, 0, width, height);
      drawGrid(ctx, width, height, width * 0.1);
      drawBaseParallels2D(ctx, view3dCanvas);
      drawTriangle2D(ctx, view3dCanvas);
      drawParallelCandidate2D(ctx, view3dCanvas);
      drawWalker2D(ctx, width, height, view3dCanvas);
      return;
    }

    const radius = Math.min(width, height) * 0.42;
    ctx.fillStyle = '#06395f';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b4e82';
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2 + radius * 0.05, radius, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();

    drawEquator3D(ctx, width, height, radius);
    drawTriangle3D(ctx, width, height, radius);
    drawParallelCandidate3D(ctx, width, height, radius);
    drawWalker3D(ctx, width, height, radius);
  }

  function drawTriangle2D(ctx, canvas){
    if (state.triangle.length < 1) return;
    const targetCanvas = canvas || view2dCanvas;
    const pts = state.triangle.map(pt => planeToCanvas(pt, targetCanvas));

    ctx.save();
    ctx.fillStyle = '#f28e2b';
    ctx.strokeStyle = '#d46900';
    ctx.lineWidth = 2;
    if (pts.length >= 3){
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawTriangle3D(ctx, width, height, radius){
    if (state.triangle.length < 1) return;
    const spherePts = state.triangle.map(planeToSphere);
    const proj = spherePts.map(vec => sphereToCanvas(vec, view3dCanvas));

    ctx.save();
    ctx.strokeStyle = '#ffd37f';
    ctx.fillStyle = 'rgba(255, 201, 107, 0.28)';
    ctx.lineWidth = 2;
    if (proj.length >= 3){
      ctx.beginPath();
      ctx.moveTo(proj[0].x, proj[0].y);
      ctx.lineTo(proj[1].x, proj[1].y);
      ctx.lineTo(proj[2].x, proj[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw great-circle edges by sampling between vertices
      drawGreatCircleEdge(ctx, spherePts[0], spherePts[1]);
      drawGreatCircleEdge(ctx, spherePts[1], spherePts[2]);
      drawGreatCircleEdge(ctx, spherePts[2], spherePts[0]);
    }
    proj.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawGreatCircleEdge(ctx, A, B){
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
        dots.push(sphereToCanvas(vec, view3dCanvas));
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

  function drawBaseParallels2D(ctx, canvas){
    ctx.save();
    ctx.strokeStyle = 'rgba(60,60,60,0.45)';
    ctx.lineWidth = 2;
    const targetCanvas = canvas || view2dCanvas;
    const a = planeToCanvas({ x: -VIEW_RANGE * 1.2, y: 0 }, targetCanvas);
    const b = planeToCanvas({ x: VIEW_RANGE * 1.2, y: 0 }, targetCanvas);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawParallelCandidate2D(ctx, canvas){
    if (!state.parallelPoint) return;
    const baseY = state.parallelPoint.y;
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = state.mode === 'euclid' ? '#18a999' : '#c0392b';
    ctx.lineWidth = 2.5;
    const targetCanvas = canvas || view2dCanvas;
    const a = planeToCanvas({ x: -VIEW_RANGE * 1.2, y: baseY }, targetCanvas);
    const b = planeToCanvas({ x: VIEW_RANGE * 1.2, y: baseY }, targetCanvas);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const marker = planeToCanvas(state.parallelPoint, targetCanvas);
    ctx.fillStyle = '#18a999';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParallelCandidate3D(ctx, width, height, radius){
    if (!state.parallelPoint) return;
    const base = planeToSphere({ x: 0, y: 0 });
    const basePts = sampleGreatCircle(base, derivativeVector({ x: 0, y: 0 }, 0.02));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    drawSpherePath(ctx, basePts);
    ctx.restore();

    const pointSphere = planeToSphere(state.parallelPoint);
    const tangent = derivativeVector(state.parallelPoint, 0.02);
    const arcPts = sampleGreatCircle(pointSphere, tangent);
    ctx.save();
    ctx.strokeStyle = state.mode === 'euclid' ? '#18a999' : '#ff6f61';
    ctx.lineWidth = 2.5;
    drawSpherePath(ctx, arcPts);
    const marker = sphereToCanvas(pointSphere, view3dCanvas);
    ctx.fillStyle = '#18a999';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSpherePath(ctx, pts){
    const mapped = pts.map(p => sphereToCanvas(p, view3dCanvas));
    if (mapped.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(mapped[0].x, mapped[0].y);
    for (let i = 1; i < mapped.length; i++){
      ctx.lineTo(mapped[i].x, mapped[i].y);
    }
    ctx.stroke();
  }

  function drawEquator3D(ctx, width, height, radius){
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, radius, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWalker2D(ctx, width, height, canvas){
    const walker = state.walker;
    if (!walker.active && walker.t === 0 && walker.theta === 0) return;
    ctx.save();
    ctx.fillStyle = '#5f27cd';
    let point;
    const targetCanvas = canvas || view2dCanvas;
    if (walker.mode === 'euclid'){
      const x = walker.t * 2;
      point = planeToCanvas({ x, y: 0 }, targetCanvas);
    } else {
      const vec = {
        x: Math.sin(walker.theta),
        y: 0,
        z: Math.cos(walker.theta)
      };
      const planePt = sphereToPlane(vec);
      if (!planePt){
        ctx.restore();
        return;
      }
      point = planeToCanvas(planePt, targetCanvas);
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWalker3D(ctx, width, height, radius){
    const walker = state.walker;
    if (!walker.active && walker.t === 0 && walker.theta === 0) return;
    ctx.save();
    ctx.fillStyle = '#5f27cd';
    let point;
    if (walker.mode === 'euclid'){
      point = planeToCanvas({ x: walker.t * 2, y: 0 }, view3dCanvas);
    } else {
      const vec = {
        x: Math.sin(walker.theta),
        y: 0,
        z: Math.cos(walker.theta)
      };
      if (vec.z < 0){
        ctx.restore();
        return;
      }
      point = sphereToCanvas(vec, view3dCanvas);
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render(){
    renderView2D();
    renderView3D();
  }

  function handlePointer(source, event){
    let pt;
    if (source === 'flatland'){
      pt = canvasToPlane(view2dCanvas, event);
    } else if (state.mode === 'sphere'){
      pt = canvasToSpherePlane(view3dCanvas, event);
    } else {
      pt = canvasToPlane(view3dCanvas, event);
    }
    if (!pt) return;

    const tool = event.shiftKey ? 'parallel' : activePlacement;
    if (tool === 'triangle'){
      addTrianglePoint(pt);
    } else {
      setParallelPoint(pt);
    }
  }

  modeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      state.mode = e.target.value === 'sphere' ? 'sphere' : 'euclid';
      state.walker.mode = state.mode;
      updateTriangleReport();
      updateParallelReport();
      render();
    });
  });

  triangleResetBtn?.addEventListener('click', () => {
    activePlacement = 'triangle';
    resetTriangle();
  });

  parallelResetBtn?.addEventListener('click', () => {
    activePlacement = 'parallel';
    resetParallel();
  });

  walkerResetBtn?.addEventListener('click', () => {
    resetWalker();
  });

  walkerPlayBtn?.addEventListener('click', () => {
    startWalker();
  });

  triangleField?.addEventListener('mouseenter', () => {
    activePlacement = 'triangle';
  });
  triangleField?.addEventListener('focusin', () => {
    activePlacement = 'triangle';
  });
  parallelField?.addEventListener('mouseenter', () => {
    activePlacement = 'parallel';
  });
  parallelField?.addEventListener('focusin', () => {
    activePlacement = 'parallel';
  });

  view2dCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handlePointer('flatland', event);
  });

  view3dCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handlePointer('shooter', event);
  });

  hoverCursor(view2dCanvas, {
    hover: 'crosshair',
    hitTest: () => true
  });

  hoverCursor(view3dCanvas, {
    hover: 'crosshair',
    hitTest: (pt) => {
      if (state.mode !== 'sphere') return true;
      const rect = view3dCanvas.getBoundingClientRect();
      const radius = Math.min(rect.width, rect.height) * 0.42;
      const dx = pt.x - rect.width / 2;
      const dy = pt.y - rect.height / 2;
      return dx * dx + dy * dy <= radius * radius;
    }
  });

  resetTriangle();
  resetParallel();
  resetWalker();
  setNarrative('Geometry feels like law to the Flatlander. From the shooter view, it is a negotiated truce with curvature.');
  render();
})();
