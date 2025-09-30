(function(){
  const { autosizeCanvas, onPointerDrag, linkRangeNumber, clamp, announce, canvasDefaults } = window.Widgets;

  const state = { x: 0, y: 0, r: 12, dragging: false };

  function init(){
    const root   = document.querySelector('.wgt[data-widget="smoke"]');
    const canvas = root.querySelector('#smoke-canvas');
    const posEl  = root.querySelector('#pos');
    const liveEl = root.querySelector('#smoke-live');

    // autosize canvas (HiDPI + responsive)
    const baseCanvas = typeof canvasDefaults === 'function'
      ? canvasDefaults()
      : { aspect: 16 / 9, min: 320, max: 720 };

    const layout = autosizeCanvas(canvas, baseCanvas);
    const ctx = () => layout.ctx;

    // center ball after first layout
    const center = () => {
      state.x = layout.width * 0.5;
      state.y = layout.height * 0.5;
    };
    center();

    // link slider <-> number for ball radius
    const rRange = root.querySelector('#size-range');
    const rNum   = root.querySelector('#size-num');
    const link = linkRangeNumber(rRange, rNum, {
      toModel: (v)=> +v,
      fromModel: (v)=> String(v),
      onChange: (v)=> { state.r = clamp(v, 6, 30); draw(); }
    });
    link && link.set(state.r);

    // pointer drag on the ball
    onPointerDrag(canvas, {
      hitTest: (p) => {
        const dx = p.x - state.x, dy = p.y - state.y;
        return dx*dx + dy*dy <= state.r*state.r;
      },
      onStart: () => { state.dragging = true; },
      onMove:  (p) => {
        if(!state.dragging) return;
        state.x = clamp(p.x, state.r, layout.width  - state.r);
        state.y = clamp(p.y, state.r, layout.height - state.r);
        updateTelemetry();
        draw();
      },
      onEnd: () => { state.dragging = false; }
    });

    // reset
    root.querySelector('#reset').addEventListener('click', () => { center(); updateTelemetry(); draw(); });

    function updateTelemetry(){
      posEl.textContent = `(${state.x.toFixed(1)}, ${state.y.toFixed(1)})`;
      announce(liveEl, `Position ${state.x.toFixed(0)}, ${state.y.toFixed(0)}`);
    }

    function draw(){
      const c = ctx(), w = layout.width, h = layout.height;
      c.clearRect(0,0,w,h);
      // background grid
      c.fillStyle = '#fafafa'; c.fillRect(0,0,w,h);
      c.strokeStyle = '#ddd';
      for(let x=0;x<w;x+=40){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
      for(let y=0;y<h;y+=40){ c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
      // ball
      c.beginPath(); c.arc(state.x, state.y, state.r, 0, Math.PI*2);
      c.fillStyle = '#555'; c.fill();
    }

    updateTelemetry();
    draw();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
