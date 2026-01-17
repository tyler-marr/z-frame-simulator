// Z-frame Wheelchair Simulator (vanilla JS)
// - angle1: middle member (rotates about base pivot)
// - angle2: seat pan (rotates about middle end)
// Angles displayed and expected in degrees; internal math uses degrees when evaluating user formulas.

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const angle1Display = document.getElementById('angle1-val');
  const angle2Display = document.getElementById('angle2-val');

  const debugA = document.getElementById('debugA-val');

  // Limit input elements
  const angle1MinInput = document.getElementById('angle1-min');
  const angle1MaxInput = document.getElementById('angle1-max');
  const angle2MinInput = document.getElementById('angle2-min');
  const angle2MaxInput = document.getElementById('angle2-max');

  // Layout / geometry
  const config = {
    basePivot: { x: 240, y: 360 }, // will be repositioned on resize
    middleLength: 180,
    seatPanLength: 160,
    hoverThreshold: 12,
  };

  // State
  const state = {
    angle1: 30, // degrees (middle)
    angle2: 30, // degrees (seat pan)
    angle3: 0,  // reserved (base)
    dragging: null, // 'angle1' | 'angle2' | null
    hovering: null, // same
    buttonHeld: null, // 'increase' | 'decrease' | null (for hold-down behavior)
    buttonFrameCounter: 0, // counter to slow down button movement
    cursorX: 0,
    cursorY: 0,
  };

  // Button configuration
  const buttons = {
    act1Down: { x: 90, y: 340, width: 60, height: 25, label: '◀', group: 'Act-1' },
    act1Up: { x: 160, y: 340, width: 60, height: 25, label: '▶', group: 'Act-1' },

    act2Down: { x: 90, y: 370, width: 60, height: 25, label: '◀', group: 'Act-2' },
    act2Up: { x: 160, y: 370, width: 60, height: 25, label: '▶', group: 'Act-2' },

    z1Down: { x: 90, y: 400, width: 60, height: 25, label: '◀', group: 'Z-1' },
    z1Up: { x: 160, y: 400, width: 60, height: 25, label: '▶', group: 'Z-1' },

    z2Down: { x: 90, y: 430, width: 60, height: 25, label: '◀', group: 'Z-2' },
    z2Up: { x: 160, y: 430, width: 60, height: 25, label: '▶', group: 'Z-2' },

    zElevateDown: { x: 90, y: 460, width: 60, height: 25, label: '◀', group: 'Z-Elevate' },
    zElevateUp: { x: 160, y: 460, width: 60, height: 25, label: '▶', group: 'Z-Elevate' },

    zTiltDown: { x: 90, y: 490, width: 60, height: 25, label: '◀', group: 'Z-Tilt' },
    zTiltUp: { x: 160, y: 490, width: 60, height: 25, label: '▶', group: 'Z-Tilt' },
  };

  // Canvas checkbox
  const canvasCheckbox = {
    x: 260,
    y: 475,
    size: 15,
    label: 'Allow Limited Movement',
    checked: true
  };

  // Helpers
  function d2r(d){ return d * Math.PI / 180; }
  function r2d(r){ return r * 180 / Math.PI; }
  function roundHalfDegree(deg){ return Math.round(deg * 2) / 2; }

  // Get angle limits
  function getAngle1Limits(){
    const min = parseFloat(angle1MinInput.value) || 0;
    const max = parseFloat(angle1MaxInput.value) || 360;
    return { min, max };
  }

  function getAngle2Limits(){
    const min = parseFloat(angle2MinInput.value) || 0;
    const max = parseFloat(angle2MaxInput.value) || 360;
    return { min, max };
  }

  // Constrain angle within limits
  function constrainAngle1(angle){
    const { min, max } = getAngle1Limits();
    return Math.max(min, Math.min(max, angle));
  }

  function constrainAngle2(angle){
    const { min, max } = getAngle2Limits();
    return Math.max(min, Math.min(max, angle));
  }

  function drawAngleArc(pivotX, pivotY, startDeg, endDeg, radius, color, labelText, isAtLimit = false) {
    // normalize degrees to [0,360)
    const norm = d => ((d % 360) + 360) % 360;
    let s = norm(startDeg);
    let e = norm(endDeg);

    // Ensure arc goes the short way (increasing angle)
    if (e <= s) e += 360;
    const sRad = d2r(s);
    const eRad = d2r(e);

    // Draw arc
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    let distance = ((e - s) % 360);

    if (distance != 0.0)
    {

      debugA.textContent = `${(distance)}°`;
      if (distance <= 180)
      {
        ctx.arc(pivotX, pivotY, radius, sRad, eRad, false);
      } else {
        ctx.arc(pivotX, pivotY, radius, eRad, sRad, false);
      }

      ctx.stroke();
    }

    // Draw small arrow/handle at arc midpoint
    const mid = (sRad + eRad) / 2;
    const tx = pivotX + Math.cos(mid+Math.PI) * (radius + 20);
    const ty = pivotY + Math.sin(mid+Math.PI) * (radius + 20);

    // Text background for readability
    if(isAtLimit){
      ctx.fillStyle = '#ff4444';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
    }
    const txt = labelText;
    ctx.font = '13px system-ui,Segoe UI,Roboto,Arial';
    const w = ctx.measureText(txt).width;
    ctx.fillRect(tx - w/2 - 6, ty - 12, w + 12, 18);

    // Text
    if(isAtLimit){
      ctx.fillStyle = '#fff';
    } else {
      ctx.fillStyle = '#111';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, tx, ty);
  }

  // Canvas sizing
  function resizeCanvas(){
    const width = Math.max(600, Math.min(window.innerWidth - 120, 1000));
    const height = 520;
    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

    config.basePivot.x = Math.round(width * 0.44);
    config.basePivot.y = Math.round(height * 0.72);
    draw();
  }

  // Geometry endpoints
  function middleEnd() {
    const a = d2r(state.angle1+180);
    return {
      x: config.basePivot.x + config.middleLength * Math.cos(a),
      y: config.basePivot.y + config.middleLength * Math.sin(a)
    };
  }

  function seatEnd() {
    const mid = middleEnd();
    const a = d2r(state.angle1-state.angle2);
    return {
      x: mid.x + config.seatPanLength * Math.cos(a),
      y: mid.y + config.seatPanLength * Math.sin(a)
    };
  }

  // Distance point to segment
  function pointToSegmentDistance(px,py, x1,y1, x2,y2){
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const len2 = C*C + D*D;
    let t = len2 !== 0 ? Math.max(0, Math.min(1, dot / len2)) : 0;
    const projx = x1 + t * C;
    const projy = y1 + t * D;
    const dx = px - projx, dy = py - projy;
    return Math.hypot(dx,dy);
  }

  // Draw function
  // Replace the existing draw() with this version (keeps original drawing + angle arcs/labels)
function draw(){
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);

  // background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,w,h);

  // base line
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(config.basePivot.x-160, config.basePivot.y);
  ctx.lineTo(config.basePivot.x, config.basePivot.y);
  ctx.stroke();

  // middle member
  const midStart = { ...config.basePivot };
  const midEnd = middleEnd();
  ctx.strokeStyle = state.hovering === 'angle1' || state.dragging === 'angle1' ? '#ff8a65' : '#2f2f2f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(midStart.x, midStart.y);
  ctx.lineTo(midEnd.x, midEnd.y);
  ctx.stroke();

  // seat pan
  const seatStart = midEnd;
  const seatEndPt = seatEnd();
  ctx.strokeStyle = state.hovering === 'angle2' || state.dragging === 'angle2' ? '#ff8a65' : '#666';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(seatStart.x, seatStart.y);
  ctx.lineTo(seatEndPt.x, seatEndPt.y);
  ctx.stroke();

  // pivots
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(config.basePivot.x, config.basePivot.y, 6, 0, Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(midEnd.x, midEnd.y, 6, 0, Math.PI*2);
  ctx.fill();

  // Draw angle arcs and labels:
  // angle1: between the base horizontal (0° to the right) and middle member (state.angle1)
  // angle2: between the middle member direction (state.angle1) and the seat pan (state.angle2)
  // Use distinct radii/colors so they don't overlap.
  try {
    // Check if angles are at their limits
    const { min: angle1Min, max: angle1Max } = getAngle1Limits();
    const { min: angle2Min, max: angle2Max } = getAngle2Limits();

    const angle1AtLimit = Math.abs(state.angle1 - angle1Min) < 0.01 || Math.abs(state.angle1 - angle1Max) < 0.01;
    const angle2AtLimit = Math.abs(state.angle2 - angle2Min) < 0.01 || Math.abs(state.angle2 - angle2Max) < 0.01;

    // Angle1: measure from horizontal (0°) to state.angle1 on the top side
    const baseReferenceDeg = 0; // baseline pointing right
    const angle1Deg = state.angle1;
    drawAngleArc(
      config.basePivot.x,
      config.basePivot.y,
      baseReferenceDeg+180,
      angle1Deg+180,
      36,
      '#2b7cff',
      `angle1 ${angle1Deg.toFixed(1)}°`,
      angle1AtLimit
    );

    // Angle2: measure between middle member direction and seat pan direction at middle pivot
    const angle2StartDeg = state.angle1; // direction of middle member
    const angle2EndDeg = state.angle1 - state.angle2;   // direction of seat pan (absolute)
    const sweepDeg = (angle2EndDeg - angle2StartDeg + 360) % 360;
    const interiorAngle2Deg = state.angle2; // interior angle
    drawAngleArc(
      midEnd.x,
      midEnd.y,
      angle2EndDeg,
      angle2StartDeg,
      28,
      '#ff8a65',
      `angle2 ${interiorAngle2Deg.toFixed(1)}°`,
      angle2AtLimit
    );
  } catch (e) {
    // if anything goes wrong with arc drawing, ignore to avoid blocking the rest of the UI
    // console.warn('Angle label draw error', e);
  }

  // angle text (left UI)
  const { min: angle1Min, max: angle1Max } = getAngle1Limits();
  const { min: angle2Min, max: angle2Max } = getAngle2Limits();

  const angle1AtLimit = Math.abs(state.angle1 - angle1Min) < 0.01 || Math.abs(state.angle1 - angle1Max) < 0.01;
  const angle2AtLimit = Math.abs(state.angle2 - angle2Min) < 0.01 || Math.abs(state.angle2 - angle2Max) < 0.01;

  // Draw angle1 text
  if(angle1AtLimit){
    ctx.fillStyle = '#ff4444';
  } else {
    ctx.fillStyle = '#111';
  }
  ctx.font = '14px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillText(`Middle (angle1): ${state.angle1.toFixed(1)}°`, 14, 20);

  // Draw angle2 text
  if(angle2AtLimit){
    ctx.fillStyle = '#ff4444';
  } else {
    ctx.fillStyle = '#111';
  }
  ctx.fillText(`Seat pan (angle2): ${state.angle2.toFixed(1)}°`, 14, 40);

  ctx.fillStyle = '#111';
  const seatPanAbsoluteAngle = (state.angle1 - state.angle2) % 360;
  ctx.fillText(`Seat pan (absolute): ${seatPanAbsoluteAngle.toFixed(1)}°`, 14, 60);

  // formula display
  if(state.formulaExpr){
    ctx.fillStyle = '#444';
    ctx.fillText(`Formula: ${state.formulaExpr}`, 14, 80);
  }

  // Draw actuator buttons with labels
  const actuatorGroups = [
    { label: 'Act-1', buttons: ['act1Down', 'act1Up'] },
    { label: 'Act-2', buttons: ['act2Down', 'act2Up'] },
    { label: 'Act-1-then-2', buttons: ['z1Down', 'z1Up'] },
    { label: 'Act-2-then-1', buttons: ['z2Down', 'z2Up'] },
    { label: 'Z-Sum-Const', buttons: ['zElevateDown', 'zElevateUp'] },
    { label: 'Z-Diff-Const', buttons: ['zTiltDown', 'zTiltUp'] },
  ];

  actuatorGroups.forEach(group => {
    const btn = buttons[group.buttons[0]];
    // Draw label to the left
    ctx.fillStyle = '#333';
    ctx.font = '11px system-ui,Segoe UI,Roboto,Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(group.label, btn.x - 8, btn.y + btn.height / 2);

    // Draw buttons
    buttons[group.buttons[0]] && drawButton(buttons[group.buttons[0]], state.buttonHeld === group.buttons[0]);
    buttons[group.buttons[1]] && drawButton(buttons[group.buttons[1]], state.buttonHeld === group.buttons[1]);
  });

  // Draw canvas checkbox
  drawCanvasCheckbox();

  ctx.textAlign = 'left';
}

function drawButton(btn, isPressed){
  const bgColor = isPressed ? '#1e5ab0' : '#2b7cff';
  const textColor = isPressed ? '#e0e0e0' : '#fff';

  ctx.fillStyle = bgColor;
  ctx.fillRect(btn.x, btn.y, btn.width, btn.height);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

  ctx.fillStyle = textColor;
  ctx.font = '12px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, btn.x + btn.width/2, btn.y + btn.height/2);
  ctx.textAlign = 'left';
}

function drawCanvasCheckbox(){
  const cb = canvasCheckbox;

  // Draw checkbox box
  ctx.fillStyle = canvasCheckbox.checked ? '#2b7cff' : '#fff';
  ctx.fillRect(cb.x, cb.y, cb.size, cb.size);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(cb.x, cb.y, cb.size, cb.size);

  // Draw checkmark if checked
  if(canvasCheckbox.checked){
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cb.x + 3, cb.y + 8);
    ctx.lineTo(cb.x + 6, cb.y + 11);
    ctx.lineTo(cb.x + 12, cb.y + 3);
    ctx.stroke();
  }

  // Draw label
  ctx.fillStyle = '#333';
  ctx.font = '11px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cb.label, cb.x + cb.size + 8, cb.y + cb.size / 2);
}
  // Check if point is in button or checkbox
  function getButtonAtPoint(px, py){
    // Check checkbox first
    if(px >= canvasCheckbox.x && px <= canvasCheckbox.x + canvasCheckbox.size &&
       py >= canvasCheckbox.y && py <= canvasCheckbox.y + canvasCheckbox.size){
      return 'canvasCheckbox';
    }

    for(const [key, btn] of Object.entries(buttons)){
      if(px >= btn.x && px <= btn.x + btn.width &&
         py >= btn.y && py <= btn.y + btn.height){
        return key;
      }
    }
    return null;
  }

  // Continuous update loop for held buttons
  function updateHeldButton(){
    if(state.buttonHeld){
      state.buttonFrameCounter++;

      // Always redraw to show pressed state
      draw();

      // Only apply movement every 3 frames (slower than 60fps)
      if(state.buttonFrameCounter >= 3){
        state.buttonFrameCounter = 0;

        // Determine which angle to control and the direction
        const isIncrease = state.buttonHeld === 'increase' || state.buttonHeld === 'act1Up' || state.buttonHeld === 'act2Up' || state.buttonHeld === 'z1Up' || state.buttonHeld === 'z2Up' || state.buttonHeld === 'zElevateUp' || state.buttonHeld === 'zTiltUp';
        const delta = isIncrease ? 0.2 : -0.2;

        // Get limit status
        const { min: angle1Min, max: angle1Max } = getAngle1Limits();
        const { min: angle2Min, max: angle2Max } = getAngle2Limits();
        const angle1AtLimit = Math.abs(state.angle1 - angle1Min) < 0.01 || Math.abs(state.angle1 - angle1Max) < 0.01;
        const angle2AtLimit = Math.abs(state.angle2 - angle2Min) < 0.01 || Math.abs(state.angle2 - angle2Max) < 0.01;

        // Act-1 controls angle1
        if(state.buttonHeld === 'act1Up' || state.buttonHeld === 'act1Down'){
          let newAngle1 = state.angle1 + delta;
          newAngle1 = constrainAngle1(newAngle1);

          if(Math.abs(newAngle1 - state.angle1) > 0.01){
            state.angle1 = newAngle1;
            updateDisplays();
          }
        }
        // Act-2 controls angle2
        else if(state.buttonHeld === 'act2Up' || state.buttonHeld === 'act2Down'){
          let newAngle2 = state.angle2 + delta;
          newAngle2 = constrainAngle2(newAngle2);

          if(Math.abs(newAngle2 - state.angle2) > 0.01){
            state.angle2 = newAngle2;
            updateDisplays();
          }
        }
        // Z-1 controls angle1, but swaps to angle2 only when hitting limit in direction of motion
        else if(state.buttonHeld === 'z1Up' || state.buttonHeld === 'z1Down'){
          const angle1Min = getAngle1Limits().min;
          const angle1Max = getAngle1Limits().max;
          const atMinMovingDown = Math.abs(state.angle1 - angle1Min) < 0.01 && delta < 0;
          const atMaxMovingUp = Math.abs(state.angle1 - angle1Max) < 0.01 && delta > 0;
          const shouldSwap = atMinMovingDown || atMaxMovingUp;

          if(shouldSwap){
            // angle1 is at limit in direction of motion, control angle2 instead with REVERSED direction
            let newAngle2 = state.angle2 - delta;
            newAngle2 = constrainAngle2(newAngle2);

            if(Math.abs(newAngle2 - state.angle2) > 0.01){
              state.angle2 = newAngle2;
              updateDisplays();
            }
          } else {
            // angle1 is free or at limit in opposite direction, control it normally
            let newAngle1 = state.angle1 + delta;
            newAngle1 = constrainAngle1(newAngle1);

            if(Math.abs(newAngle1 - state.angle1) > 0.01){
              state.angle1 = newAngle1;
              updateDisplays();
            }
          }
        }
        // Z-2 controls angle2, but swaps to angle1 only when hitting limit in direction of motion
        else if(state.buttonHeld === 'z2Up' || state.buttonHeld === 'z2Down'){
          const angle2Min = getAngle2Limits().min;
          const angle2Max = getAngle2Limits().max;
          const atMinMovingDown = Math.abs(state.angle2 - angle2Min) < 0.01 && delta < 0;
          const atMaxMovingUp = Math.abs(state.angle2 - angle2Max) < 0.01 && delta > 0;
          const shouldSwap = atMinMovingDown || atMaxMovingUp;

          if(shouldSwap){
            // angle2 is at limit in direction of motion, control angle1 instead with REVERSED direction
            let newAngle1 = state.angle1 - delta;
            newAngle1 = constrainAngle1(newAngle1);

            if(Math.abs(newAngle1 - state.angle1) > 0.01){
              state.angle1 = newAngle1;
              updateDisplays();
            }
          } else {
            // angle2 is free or at limit in opposite direction, control it normally
            let newAngle2 = state.angle2 + delta;
            newAngle2 = constrainAngle2(newAngle2);

            if(Math.abs(newAngle2 - state.angle2) > 0.01){
              state.angle2 = newAngle2;
              updateDisplays();
            }
          }
        }
        // Z-Elevate controls both angles equally (maintaining their difference)
        else if(state.buttonHeld === 'zElevateUp' || state.buttonHeld === 'zElevateDown'){
          let newAngle1 = state.angle1 + delta;
          let newAngle2 = state.angle2 + delta;

          newAngle1 = constrainAngle1(newAngle1);
          newAngle2 = constrainAngle2(newAngle2);

          if(canvasCheckbox.checked){
            // Allow independent movement if one angle hits a limit
            let changed = false;
            if(Math.abs(newAngle1 - state.angle1) > 0.01){
              state.angle1 = newAngle1;
              changed = true;
            }
            if(Math.abs(newAngle2 - state.angle2) > 0.01){
              state.angle2 = newAngle2;
              changed = true;
            }
            if(changed){
              updateDisplays();
            }
          } else {
            // Only update if both angles can change
            if((Math.abs(newAngle1 - state.angle1) > 0.01) && (Math.abs(newAngle2 - state.angle2) > 0.01)){
              state.angle1 = newAngle1;
              state.angle2 = newAngle2;
              updateDisplays();
            }
          }
        }
        // Z-Tilt controls angles oppositely (maintaining their sum)
        else if(state.buttonHeld === 'zTiltUp' || state.buttonHeld === 'zTiltDown'){
          let newAngle1 = state.angle1 + delta;
          let newAngle2 = state.angle2 - delta;

          newAngle1 = constrainAngle1(newAngle1);
          newAngle2 = constrainAngle2(newAngle2);

          if(canvasCheckbox.checked){
            // Allow independent movement if one angle hits a limit
            let changed = false;
            if(Math.abs(newAngle1 - state.angle1) > 0.01){
              state.angle1 = newAngle1;
              changed = true;
            }
            if(Math.abs(newAngle2 - state.angle2) > 0.01){
              state.angle2 = newAngle2;
              changed = true;
            }
            if(changed){
              updateDisplays();
            }
          } else {
            // Only update if both angles can change
            if((Math.abs(newAngle1 - state.angle1) > 0.01) && (Math.abs(newAngle2 - state.angle2) > 0.01)){
              state.angle1 = newAngle1;
              state.angle2 = newAngle2;
              updateDisplays();
            }
          }
        }
      }

      requestAnimationFrame(updateHeldButton);
    }
  }

  function onPointerMove(evt){
    const rect = canvas.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;

    // Track cursor position for debug visualization
    state.cursorX = px;
    state.cursorY = py;

    const midEnd = middleEnd();
    const seatEndPt = seatEnd();
    const dMid = pointToSegmentDistance(px,py, config.basePivot.x, config.basePivot.y, midEnd.x, midEnd.y);
    const dSeat = pointToSegmentDistance(px,py, midEnd.x, midEnd.y, seatEndPt.x, seatEndPt.y);

    if(!state.dragging){
      if(dSeat < config.hoverThreshold){ state.hovering = 'angle2'; canvas.style.cursor = 'grab'; }
      else if(dMid < config.hoverThreshold){ state.hovering = 'angle1'; canvas.style.cursor = 'grab'; }
      else { state.hovering = null; canvas.style.cursor = 'default'; }
    } else {
      canvas.style.cursor = 'grabbing';
      let changed = false;
      if(state.dragging === 'angle1'){
        const dx = px - config.basePivot.x;
        const dy = py - config.basePivot.y;
        let deg = r2d(Math.atan2(dy, dx))+180;
        deg = roundHalfDegree(deg);

        // Handle wraparound at 0/360 boundary
        // If the change is too large, we've probably wrapped around
        const diff = deg - state.angle1;
        if(Math.abs(diff) > 180){
          if(diff > 0){
            deg -= 360;
          } else {
            deg += 360;
          }
        }

        deg = constrainAngle1(deg);

        // Only update if the value actually changed
        if(deg !== state.angle1){
          state.angle1 = deg;
          changed = true;
        }
      } else if(state.dragging === 'angle2'){
        const pivot = midEnd;
        const dx = px - pivot.x;
        const dy = py - pivot.y;
        let deg = r2d(Math.atan2(dy, dx));
        deg = -roundHalfDegree(deg) + state.angle1;
        deg = constrainAngle2(deg);

        // Only update if the value actually changed
        if(deg !== state.angle2){
          state.angle2 = deg;
          changed = true;
        }
      }

      if(changed){
        updateDisplays();
      }
      draw();
    }
  }

  function onPointerDown(evt){
    const rect = canvas.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;

    // Check if a button was clicked
    const buttonClicked = getButtonAtPoint(px, py);
    if(buttonClicked){
      if(buttonClicked === 'canvasCheckbox'){
        // Toggle checkbox
        canvasCheckbox.checked = !canvasCheckbox.checked;
        draw();
      } else {
        state.buttonHeld = buttonClicked;
        draw();
        updateHeldButton();
      }
      return;
    }

    if(state.hovering){
      state.dragging = state.hovering;
      canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
      draw();
    }
  }

  function onPointerUp(evt){
    state.dragging = null;
    state.buttonHeld = null;
    state.buttonFrameCounter = 0;
    canvas.releasePointerCapture && canvas.releasePointerCapture(evt.pointerId);
    draw();
  }

  // UI update
  function updateDisplays(){
    angle1Display.textContent = `${state.angle1.toFixed(1)}°`;
    angle2Display.textContent = `${state.angle2.toFixed(1)}°`;
  }

  // Wire events
  function addListeners(){
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    window.addEventListener('resize', resizeCanvas);
  }

  // Initialize
  function init(){
    resizeCanvas();
    addListeners();
    updateDisplays();
    draw();
  }

  init();
})();
