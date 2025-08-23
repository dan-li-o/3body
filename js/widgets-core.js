// ---------- widgets-core.js : House utils for all widgets ----------
// Exposes: Widgets.setupHiDPI, Widgets.autosizeCanvas, Widgets.clamp,
//          Widgets.onPointerDrag, Widgets.linkRangeNumber, Widgets.announce, Widgets.hoverCursor

window.Widgets = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // HiDPI canvas setup (keeps your drawing code in CSS pixels)
  function setupHiDPI(canvas, cssW, cssH, dpr = window.devicePixelRatio || 1){
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: cssW, height: cssH, dpr };
  }

  // Auto-size canvas to parent width with fixed aspect, min/max
  function autosizeCanvas(canvas, {aspect=16/9, min=320, max=900} = {}){
    let ctx, width, height;
    function layout(){
      const host = canvas.parentElement;
      const hostW = host.clientWidth || max;
      const w = clamp(hostW, min, max);
      const h = Math.round(w / aspect);
      ({ctx, width, height} = setupHiDPI(canvas, w, h));
    }
    const ro = new ResizeObserver(layout);
    ro.observe(canvas.parentElement);
    layout();
    return { get ctx(){return ctx;}, get width(){return width;}, get height(){return height;}, relayout: layout, ro };
  }

  // Range <-> Number twin inputs with optional transform
  function linkRangeNumber(rangeEl, numberEl, {toModel=(x)=>+x, fromModel=(x)=>x, onChange} = {}){
    if(!rangeEl && !numberEl) return;
    const setBoth = (val) => {
      const show = fromModel(val);
      if(rangeEl)  rangeEl.value  = show;
      if(numberEl) numberEl.value = show;
      onChange && onChange(val);
    };
    rangeEl && rangeEl.addEventListener('input', e => setBoth(toModel(e.target.value)));
    numberEl && numberEl.addEventListener('input', e => setBoth(toModel(e.target.value)));
    return { set: setBoth };
  }

  // Pointer drag (mouse/touch/pen), with setPointerCapture and proper cleanup
  function onPointerDrag(target, {hitTest=()=>true, onStart=()=>{}, onMove=()=>{}, onEnd=()=>{}} = {}){
    target.addEventListener('pointerdown', (e) => {
      const rect = target.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: e.pointerId };
      if(!hitTest(pt)) return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      onStart(pt, e);

      function move(ev){
        const r = target.getBoundingClientRect();
        onMove({ x: ev.clientX - r.left, y: ev.clientY - r.top, id: ev.pointerId }, ev);
      }
      function up(ev){
        onEnd(ev);
        target.releasePointerCapture(e.pointerId);
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        target.style.cursor = '';
      }
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
  }

  // Hover cursor helper: shows a cursor when hitTest is true and not dragging
  function hoverCursor(target, { hitTest, hover='grab', normal='', isDragging=()=>false } = {}){
    if (typeof hitTest !== 'function') return;
    target.addEventListener('pointermove', (e) => {
      if (isDragging()) return;
      const r = target.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      target.style.cursor = hitTest(p) ? hover : normal;
    });
    target.addEventListener('pointerleave', () => {
      if (!isDragging()) target.style.cursor = normal;
    });
  }

  // Announce text to an aria-live region (for telemetry)
  function announce(liveNode, text){
    if(!liveNode) return;
    liveNode.textContent = text;
  }

  return { setupHiDPI, autosizeCanvas, clamp, onPointerDrag, linkRangeNumber, announce, hoverCursor };
})();
// ---------- end widgets-core.js ----------