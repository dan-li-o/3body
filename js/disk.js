// --------------------------------------------------------------
// disk.js -- Johnny walks the Poincare disk.
// Two views share a single canvas split down the middle so the reader
// can watch the Euclidean shooter eye (left) and the Poincarite view
// that trails Johnny like a game camera (right).
// --------------------------------------------------------------

(function(){
  const WIDGET_SELECTOR = '[data-widget="poincare-disk"]';
  const HYPER_SPEED = 1; // intrinsic metres per second
  const TARGET_EUCLIDEAN_SPEED = 0.00001;
  const MAX_HYPER_DISTANCE = hyperDistanceForEuclidSpeed(TARGET_EUCLIDEAN_SPEED);
  const OBSERVER_RING_STEP = 0.6;
  const GRID_SPACING = 56;
  const INTRINSIC_PIXELS_PER_UNIT = 90;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(WIDGET_SELECTOR).forEach(setupWidget);
  });

  function setupWidget(root){
    const canvas = root.querySelector('[data-role="views"]');
    const sendButton = root.querySelector('[data-role="send"]');
    const statusCopy = root.querySelector('[data-role="status-copy"] .wgt__hint');

    if(!canvas || !sendButton){
      return; // Nothing to wire up.
    }

    const sizing = Widgets.autosizeCanvas(canvas, {
      aspect: 16 / 9,
      min: 320,
      max: 720
    });

    const state = {
      running: false,
      startTime: null,
      hyperDistance: 0,
      rafId: null
    };

    // Keep the illustration fresh whenever the container snaps to a new size.
    const host = canvas.parentElement;
    if(host){
      const layoutObserver = new ResizeObserver(() => {
        sizing.relayout();
        drawFrame(sizing, state.hyperDistance);
      });
      layoutObserver.observe(host);
    }

    drawFrame(sizing, 0);
    updateTelemetry(statusCopy, 0);

    sendButton.addEventListener('click', () => {
      if(state.running){
        return;
      }
      beginWalk();
    });

    function beginWalk(){
      state.running = true;
      state.startTime = null;
      state.hyperDistance = 0;
      sendButton.disabled = true;
      sendButton.textContent = 'Johnny is walking...';
      step(performance.now());
    }

    function step(timestamp){
      if(!state.running){
        return;
      }
      if(state.startTime === null){
        state.startTime = timestamp;
      }

      const elapsedSeconds = (timestamp - state.startTime) / 1000;
      state.hyperDistance = Math.min(MAX_HYPER_DISTANCE, elapsedSeconds * HYPER_SPEED);

      drawFrame(sizing, state.hyperDistance);
      updateTelemetry(statusCopy, state.hyperDistance);

      if(state.hyperDistance >= MAX_HYPER_DISTANCE){
        state.running = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Replay Johnny';
        return;
      }

      state.rafId = requestAnimationFrame(step);
    }
  }

  function drawFrame(sizing, hyperDistance){
    const ctx = sizing.ctx;
    if(!ctx){
      return;
    }
    const width = sizing.width;
    const height = sizing.height;
    ctx.clearRect(0, 0, width, height);

    const splitX = width * 0.5;
    const r = Math.tanh(hyperDistance / 2);
    const euclidSpeed = 0.5 * HYPER_SPEED * (1 - r * r);
    const displaySpeed = Math.max(euclidSpeed, TARGET_EUCLIDEAN_SPEED);
    drawObserverView(ctx, { x: 0, y: 0, width: splitX, height }, {
      hyperDistance,
      euclidSpeed: displaySpeed,
      euclidDistance: r
    });
    drawIntrinsicView(ctx, { x: splitX, y: 0, width: width - splitX, height }, {
      hyperDistance,
      poincareSpeed: HYPER_SPEED
    });
    drawDivider(ctx, splitX, height);
  }

  function drawObserverView(ctx, rect, metrics){
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.translate(rect.x, rect.y);

    const width = rect.width;
    const height = rect.height;
    const centreX = width / 2;
    const centreY = height / 2;
    const diskRadius = Math.min(width, height) * 0.42;

    // Disk backdrop with a subtle highlight at the centre.
    const gradient = ctx.createRadialGradient(centreX, centreY, diskRadius * 0.05, centreX, centreY, diskRadius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(1, 'rgba(200,210,220,0.55)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centreX, centreY, diskRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(30,36,44,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centreX, centreY, diskRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric circles mark equal hyperbolic steps; spacing shrinks toward the rim.
    ctx.strokeStyle = 'rgba(47,122,107,0.45)';
    ctx.lineWidth = 1.5;
    for(let s = OBSERVER_RING_STEP; s < MAX_HYPER_DISTANCE; s += OBSERVER_RING_STEP){
      const r = Math.tanh(s / 2);
      const radius = r * diskRadius;
      if(radius >= diskRadius * 0.995){
        break;
      }
      ctx.beginPath();
      ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Johnny walks along a diameter that shoots straight up toward the rim.
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(47,122,107,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centreX, centreY);
    ctx.lineTo(centreX, centreY - diskRadius);
    ctx.stroke();
    ctx.setLineDash([]);

    const rWalker = Math.min(Math.tanh(metrics.hyperDistance / 2), 0.999);
    const yWalker = centreY - rWalker * diskRadius;
    const scale = Math.max(0.12, 1 - rWalker * rWalker);
    const bodyRadius = diskRadius * 0.06 * scale;
    const rulerLength = diskRadius * 0.18 * scale;

    // Trail illustrating the slowing Euclidean projection.
    ctx.strokeStyle = 'rgba(31,122,107,0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centreX, centreY);
    ctx.lineTo(centreX, yWalker);
    ctx.stroke();

    // Tick marks along the path shrink as they approach the rim.
    ctx.strokeStyle = 'rgba(47,122,107,0.55)';
    ctx.lineWidth = 2;
    for(let s = OBSERVER_RING_STEP; s < MAX_HYPER_DISTANCE; s += OBSERVER_RING_STEP){
      const rTick = Math.tanh(s / 2);
      const yTick = centreY - rTick * diskRadius;
      if(yTick <= centreY - diskRadius * 0.995){
        break;
      }
      const tickSpan = 10 * (1 - rTick * rTick);
      ctx.beginPath();
      ctx.moveTo(centreX - tickSpan * 0.5, yTick);
      ctx.lineTo(centreX + tickSpan * 0.5, yTick);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(15,32,42,0.85)';
    ctx.beginPath();
    ctx.arc(centreX, yWalker, Math.max(bodyRadius, 3), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(31,122,107,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centreX, yWalker);
    ctx.lineTo(centreX, yWalker - Math.max(rulerLength, 6));
    ctx.stroke();

    drawInfoText(ctx, width, height, [
      ['Euclidean speed', metrics.euclidSpeed.toFixed(5) + ' units/s'],
      ['Euclidean distance', metrics.euclidDistance.toFixed(5) + ' units']
    ]);
    drawBanner(ctx, width, 'Our View');

    ctx.restore();
  }

  function drawIntrinsicView(ctx, rect, metrics){
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.translate(rect.x, rect.y);

    const width = rect.width;
    const height = rect.height;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(235,240,245,0.95)');
    grad.addColorStop(1, 'rgba(205,214,224,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // The intrinsic grid: equally spaced rails sliding past at constant speed.
    const spacing = GRID_SPACING;
    const shift = (metrics.hyperDistance * INTRINSIC_PIXELS_PER_UNIT) % spacing;

    ctx.strokeStyle = 'rgba(47,122,107,0.3)';
    ctx.lineWidth = 2;
    for(let i = -1; i < height / spacing + 2; i++){
      const y = i * spacing + shift;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(47,122,107,0.25)';
    ctx.lineWidth = 2;
    for(let i = -4; i <= 4; i++){
      const x = width / 2 + i * spacing;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Soften the central corridor Johnny believes he marches through.
    ctx.fillStyle = 'rgba(31,122,107,0.08)';
    ctx.fillRect(width * 0.2, 0, width * 0.6, height);

    const walkerX = width * 0.5;
    const walkerY = height * 0.68;
    const bobOffset = Math.sin(metrics.hyperDistance * 2) * 2;

    ctx.fillStyle = 'rgba(15,32,42,0.9)';
    ctx.beginPath();
    ctx.arc(walkerX, walkerY - bobOffset, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(31,122,107,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(walkerX, walkerY - bobOffset);
    ctx.lineTo(walkerX, walkerY - bobOffset - 42);
    ctx.stroke();

    drawInfoText(ctx, width, height, [
      ['Poincarite speed', metrics.poincareSpeed.toFixed(2) + ' units/s'],
      ['Poincarite distance', metrics.hyperDistance.toFixed(2) + ' units']
    ]);
    drawBanner(ctx, width, 'Following Johnny in Poincarite Land');

    ctx.restore();
  }

  function drawDivider(ctx, x, height){
    ctx.save();
    ctx.strokeStyle = 'rgba(30,36,44,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
  }

  function drawBanner(ctx, width, text){
    const padX = 14;
    const padY = 12;
    const bannerHeight = 34;
    const bannerWidth = Math.max(0, width - padX * 2);
    ctx.save();
    ctx.fillStyle = 'rgba(18,28,36,0.78)';
    ctx.fillRect(padX, padY, bannerWidth, bannerHeight);
    ctx.fillStyle = '#f5f7fa';
    ctx.font = '600 16px "Inter", "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, padX + 12, padY + bannerHeight / 2);
    ctx.restore();
  }

  function drawInfoText(ctx, width, height, lines){
    if(!Array.isArray(lines) || !lines.length){
      return;
    }
    const padX = 18;
    const padY = 18;
    const lineHeight = 20;
    const totalHeight = lineHeight * lines.length;
    let y = height - padY - totalHeight + lineHeight / 2;

    ctx.save();
    ctx.font = '600 15px "Inter", "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(22, 31, 39, 0.92)';

    lines.forEach(([label, value]) => {
      const labelText = label + ': ' + value;
      ctx.fillText(labelText, padX, y);
      y += lineHeight;
    });
    ctx.restore();
  }

  function updateTelemetry(statusEl, hyperDistance){
    if(!statusEl){
      return;
    }
    const r = Math.tanh(hyperDistance / 2);
    const euclidSpeed = 0.5 * HYPER_SPEED * (1 - r * r);
    const displaySpeed = Math.max(euclidSpeed, TARGET_EUCLIDEAN_SPEED);
    const distanceCopy = hyperDistance.toFixed(1);
    const complete = hyperDistance >= MAX_HYPER_DISTANCE - 1e-6;
    const note = complete
      ? 'Johnny has slipped beyond our Euclidean window while his own clock stays honest.'
      : 'Johnny feels constant stride; we watch his steps shrink toward the rim.';
    statusEl.textContent = 'Euclidean speed: ' + displaySpeed.toFixed(5) + ' | Intrinsic speed: ' + HYPER_SPEED.toFixed(2) + ' | Hyper distance: ' + distanceCopy + ' units. ' + note;
  }

  // Convert a Euclidean-speed threshold into the matching hyperbolic
  // distance from the origin using r = tanh(s/2) and v_euclid = 0.5(1 - r^2).
  function hyperDistanceForEuclidSpeed(speed){
    const clamped = Math.max(0, Math.min(speed, HYPER_SPEED * 0.5));
    if(clamped === 0){
      return 0;
    }
    const rSquared = Math.max(0, 1 - (2 * clamped) / HYPER_SPEED);
    const r = Math.min(0.999999999, Math.sqrt(rSquared));
    return 2 * artanh(r);
  }

  function artanh(x){
    if(Math.abs(x) >= 1){
      return x > 0 ? Infinity : -Infinity;
    }
    return 0.5 * Math.log((1 + x) / (1 - x));
  }
})();
