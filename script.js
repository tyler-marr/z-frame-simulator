// Z-frame Wheelchair Simulator (vanilla JS)
// - angle1: middle member (rotates about base pivot)
// - angle2: seat pan (rotates about middle end)
// Angles displayed and expected in degrees; internal math uses degrees when evaluating user formulas.

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const angle1Display = document.getElementById('angle1-val');
  const angle2Display = document.getElementById('angle2-val');

  // Limit input elements
  const angle1MinInput = document.getElementById('angle1-min');
  const angle1MaxInput = document.getElementById('angle1-max');
  const angle2MinInput = document.getElementById('angle2-min');
  const angle2MaxInput = document.getElementById('angle2-max');

  // Position input elements
  const pos1Angle1Input = document.getElementById('pos1-angle1');
  const pos1Angle2Input = document.getElementById('pos1-angle2');
  const pos2Angle1Input = document.getElementById('pos2-angle1');
  const pos2Angle2Input = document.getElementById('pos2-angle2');

  // Clear graph button
  const clearGraphBtn = document.getElementById('clear-graph-btn');

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
    position1: { angle1: 15, angle2: 25 }, // draggable point 1 on phase graph
    position2: { angle1: 35, angle2: 10 }, // draggable point 2 on phase graph
    draggingPosition: null, // 'position1' | 'position2' | null
    movingTowards: null, // 'position1' | 'position2' | null - animating towards saved position
    targetAngle1: null,
    targetAngle2: null,
  };

  // Graph/oscilloscope data tracking
  const graphData = {
    startTime: Date.now(),
    maxDuration: 30000, // 30 seconds in milliseconds
    dataPoints: [], // { time, angle1, angle2, seatPanSum, buttonAction }
    lastRecordTime: 0,
    recordInterval: 50, // record every 50ms to keep data manageable
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

    pos1: { x: 90, y: 520, width: 60, height: 25, label: 'Pos 1', group: 'Position' },
    pos2: { x: 160, y: 520, width: 60, height: 25, label: 'Pos 2', group: 'Position' },
  };

  // Canvas checkbox
  const canvasCheckbox = {
    x: 230,
    y: 475,
    size: 15,
    label: 'Allow Limited Movement',
    checked: true
  };

  // Joystick configuration
  const joystick = {
    x: 300,
    y: 400,
    radius: 40,
    knobRadius: 12,
    knobX: 0,
    knobY: 0,
    isDragging: false
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

  // Record data point for oscilloscope graph
  function recordGraphData(){
    const now = Date.now();
    if(now - graphData.lastRecordTime >= graphData.recordInterval){
      graphData.lastRecordTime = now;
      const elapsed = now - graphData.startTime;
      // Normalize to -180 to +180 range to avoid warping when crossing zero
      let seatPanAbsolute = state.angle1 - state.angle2;
      while(seatPanAbsolute > 180) seatPanAbsolute -= 360;
      while(seatPanAbsolute < -180) seatPanAbsolute += 360;

      graphData.dataPoints.push({
        time: elapsed,
        angle1: state.angle1,
        angle2: state.angle2,
        seatPanSum: seatPanAbsolute,
        buttonAction: state.buttonHeld || null
      });

      // Remove old data points outside 30 second window
      graphData.dataPoints = graphData.dataPoints.filter(p => p.time > elapsed - graphData.maxDuration);
    }
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
    const height = 580;
    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

    config.basePivot.x = Math.round(width * 0.44);
    config.basePivot.y = Math.round(height * 0.55);
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
  ctx.fillText(`Middle (angle1): ${state.angle1.toFixed(1)}°`, 90, 20);

  // Draw angle2 text
  if(angle2AtLimit){
    ctx.fillStyle = '#ff4444';
  } else {
    ctx.fillStyle = '#111';
  }
  ctx.fillText(`Seat pan (angle2): ${state.angle2.toFixed(1)}°`, 90, 40);

  ctx.fillStyle = '#111';
  const seatPanAbsoluteAngle = (state.angle1 - state.angle2) % 360;
  ctx.fillText(`Seat pan (absolute): ${seatPanAbsoluteAngle.toFixed(1)}°`, 90, 60);

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

  // Draw joystick
  drawJoystick();

  // Draw oscilloscope graph
  drawOscilloscope();

  // Draw angle1 vs angle2 plot
  drawAngle1Vs2();

  // Draw position buttons
  drawButton(buttons.pos1, false, '#00cc00');
  drawButton(buttons.pos2, false, '#ff8a65');

  ctx.textAlign = 'left';
}

function drawButton(btn, isPressed, bgColor = null){
  const defaultBgColor = isPressed ? '#1e5ab0' : '#2b7cff';
  const finalBgColor = bgColor || defaultBgColor;
  const textColor = isPressed ? '#e0e0e0' : '#fff';

  ctx.fillStyle = finalBgColor;
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

function drawJoystick(){
  const j = joystick;

  // Draw background circle
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.arc(j.x, j.y, j.radius, 0, Math.PI*2);
  ctx.fill();

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw center crosshair
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(j.x - 10, j.y);
  ctx.lineTo(j.x + 10, j.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(j.x, j.y - 10);
  ctx.lineTo(j.x, j.y + 10);
  ctx.stroke();

  // Draw knob
  const knobX = j.x + j.knobX;
  const knobY = j.y + j.knobY;
  ctx.fillStyle = '#2b7cff';
  ctx.beginPath();
  ctx.arc(knobX, knobY, j.knobRadius, 0, Math.PI*2);
  ctx.fill();

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label
  ctx.fillStyle = '#333';
  ctx.font = '10px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Joystick', j.x, j.y + j.radius + 12);

  // Draw axis labels
  ctx.font = '9px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#666';
  ctx.fillText('▶ SUM', j.x, j.y - j.radius - 8);
  ctx.fillText('◀ SUM', j.x, j.y + j.radius + 12);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('◀ DIFF', j.x - j.radius - 30, j.y);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶ DIFF', j.x + j.radius + 30, j.y);
}

function drawOscilloscope(){
  // Graph dimensions and position
  const graphX = canvas.clientWidth - 320;
  const graphY = 10;
  const graphWidth = 300;
  const graphHeight = 200;

  // Draw background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(graphX, graphY, graphWidth, graphHeight);

  // Draw border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);

  // Draw title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Angles (30s)', graphX + 5, graphY + 5);

  if(graphData.dataPoints.length < 2) return; // Need at least 2 points to draw

  const now = Date.now() - graphData.startTime;
  const timeRange = graphData.maxDuration; // 30 seconds
  const angleMax = 180; // max angle scale

  // Draw grid lines
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  for(let i = 0; i <= 5; i++){
    const y = graphY + (graphHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(graphX, y);
    ctx.lineTo(graphX + graphWidth, y);
    ctx.stroke();
  }

  // Helper to convert data to screen coordinates
  function dataToScreen(time, value){
    const xRatio = (now - time) / timeRange; // older data on left
    const x = graphX + graphWidth - (xRatio * graphWidth);
    const yRatio = value / angleMax;
    const y = graphY + graphHeight - (yRatio * graphHeight);
    return { x, y };
  }

  // Draw angle1 trace (blue)
  ctx.strokeStyle = '#2b7cff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let firstPoint = true;
  for(let p of graphData.dataPoints){
    const { x, y } = dataToScreen(p.time, p.angle1);
    if(x >= graphX && x <= graphX + graphWidth){
      if(firstPoint){
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // Draw angle2 trace (orange)
  ctx.strokeStyle = '#ff8a65';
  ctx.lineWidth = 2;
  ctx.beginPath();
  firstPoint = true;
  for(let p of graphData.dataPoints){
    const { x, y } = dataToScreen(p.time, p.angle2);
    if(x >= graphX && x <= graphX + graphWidth){
      if(firstPoint){
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // Draw seat pan sum trace (green) - offset by 90 to center it higher
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 2;
  ctx.beginPath();
  firstPoint = true;
  for(let p of graphData.dataPoints){
    const { x, y } = dataToScreen(p.time, p.seatPanSum + 90);
    if(x >= graphX && x <= graphX + graphWidth){
      if(firstPoint){
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // Draw current time marker (right edge)
  const { x: nowX } = dataToScreen(now, 0);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(nowX, graphY);
  ctx.lineTo(nowX, graphY + graphHeight);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw legend
  const legendY = graphY + graphHeight + 5;
  ctx.font = '10px system-ui,Segoe UI,Roboto,Arial';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#2b7cff';
  ctx.fillRect(graphX, legendY, 8, 8);
  ctx.fillStyle = '#333';
  ctx.textAlign = 'left';
  ctx.fillText('angle1', graphX + 12, legendY);

  ctx.fillStyle = '#ff8a65';
  ctx.fillRect(graphX + 80, legendY, 8, 8);
  ctx.fillStyle = '#333';
  ctx.fillText('angle2', graphX + 92, legendY);

  ctx.fillStyle = '#4caf50';
  ctx.fillRect(graphX + 160, legendY, 8, 8);
  ctx.fillStyle = '#333';
  ctx.fillText('seat angle', graphX + 172, legendY);
}

function drawAngle1Vs2(){
  // Plot dimensions and position (below oscilloscope)
  const plotX = canvas.clientWidth - 320;
  const plotY = 235;
  const plotWidth = 300;
  const plotHeight = 200;

  // Draw background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(plotX, plotY, plotWidth, plotHeight);

  // Draw border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);

  // Draw title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px system-ui,Segoe UI,Roboto,Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('angle1 vs angle2', plotX + 5, plotY + 5);

  if(graphData.dataPoints.length < 1) return; // Need at least 1 point to draw

  // Get angle limits
  const { min: angle1Min, max: angle1Max } = getAngle1Limits();
  const { min: angle2Min, max: angle2Max } = getAngle2Limits();
  const angle1Range = angle1Max - angle1Min;
  const angle2Range = angle2Max - angle2Min;

  // Add 5% margin to bounds
  const marginFactor = 0.05;
  const angle1MarginMin = angle1Min - (angle1Range * marginFactor);
  const angle1MarginMax = angle1Max + (angle1Range * marginFactor);
  const angle2MarginMin = angle2Min - (angle2Range * marginFactor);
  const angle2MarginMax = angle2Max + (angle2Range * marginFactor);
  const angle1RangeWithMargin = angle1MarginMax - angle1MarginMin;
  const angle2RangeWithMargin = angle2MarginMax - angle2MarginMin;

  // Draw grid lines
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  for(let i = 0; i <= 5; i++){
    const x = plotX + (plotWidth / 5) * i;
    ctx.beginPath();
    ctx.moveTo(x, plotY);
    ctx.lineTo(x, plotY + plotHeight);
    ctx.stroke();

    const y = plotY + (plotHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotWidth, y);
    ctx.stroke();
  }

  // Draw axis labels
  ctx.font = '9px system-ui,Segoe UI,Roboto,Arial';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(angle1MarginMin.toFixed(0), plotX, plotY + plotHeight + 2);
  ctx.fillText(angle1MarginMax.toFixed(0), plotX + plotWidth, plotY + plotHeight + 2);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(angle2MarginMax.toFixed(0), plotX - 3, plotY);
  ctx.fillText(angle2MarginMin.toFixed(0), plotX - 3, plotY + plotHeight);

  // Helper to convert data to screen coordinates
  function dataToScreen(angle1, angle2){
    const xRatio = (angle1 - angle1MarginMin) / angle1RangeWithMargin;
    const x = plotX + (xRatio * plotWidth);
    const yRatio = (angle2 - angle2MarginMin) / angle2RangeWithMargin;
    const y = plotY + plotHeight - (yRatio * plotHeight);
    return { x, y };
  }

  // Draw data points as dots with connecting lines
  ctx.strokeStyle = '#2b7cff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let firstPointDrawn = false;
  for(let p of graphData.dataPoints){
    const { x, y } = dataToScreen(p.angle1, p.angle2);
    if(x >= plotX && x <= plotX + plotWidth && y >= plotY && y <= plotY + plotHeight){
      if(!firstPointDrawn){
        ctx.moveTo(x, y);
        firstPointDrawn = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // Draw current point as a dot
  if(graphData.dataPoints.length > 0){
    const lastP = graphData.dataPoints[graphData.dataPoints.length - 1];
    const { x, y } = dataToScreen(lastP.angle1, lastP.angle2);
    if(x >= plotX && x <= plotX + plotWidth && y >= plotY && y <= plotY + plotHeight){
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Draw position markers
  const pos1Screen = dataToScreen(state.position1.angle1, state.position1.angle2);
  if(pos1Screen.x >= plotX && pos1Screen.x <= plotX + plotWidth && pos1Screen.y >= plotY && pos1Screen.y <= plotY + plotHeight){
    ctx.fillStyle = '#00cc00';
    ctx.beginPath();
    ctx.arc(pos1Screen.x, pos1Screen.y, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const pos2Screen = dataToScreen(state.position2.angle1, state.position2.angle2);
  if(pos2Screen.x >= plotX && pos2Screen.x <= plotX + plotWidth && pos2Screen.y >= plotY && pos2Screen.y <= plotY + plotHeight){
    ctx.fillStyle = '#ff8a65';
    ctx.beginPath();
    ctx.arc(pos2Screen.x, pos2Screen.y, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
  // Check if point is in button or checkbox
  function getButtonAtPoint(px, py){
    // Check checkbox first
    if(px >= canvasCheckbox.x && px <= canvasCheckbox.x + canvasCheckbox.size &&
       py >= canvasCheckbox.y && py <= canvasCheckbox.y + canvasCheckbox.size){
      return 'canvasCheckbox';
    }

    // Check joystick
    const dx = px - joystick.x;
    const dy = py - joystick.y;
    if(Math.hypot(dx, dy) <= joystick.radius){
      return 'joystick';
    }

    for(const [key, btn] of Object.entries(buttons)){
      if(px >= btn.x && px <= btn.x + btn.width &&
         py >= btn.y && py <= btn.y + btn.height){
        return key;
      }
    }
    return null;
  }

  // Apply joystick movement with feathering between Z-Elevate and Z-Tilt
  function applyJoystickMovement(){
    const x = joystick.knobX / joystick.radius;
    const y = -joystick.knobY / joystick.radius; // negative because Y is down in canvas
    const magnitude = Math.hypot(x, y);

    if(magnitude < 0.1) return; // Dead zone

    // Calculate angle of stick (0 = right, 90 = up)
    const angle = Math.atan2(y, x) * 180 / Math.PI;

    // Normalize angle to 0-360
    const normalizedAngle = (angle + 360) % 360;

    // Z-Elevate (SUM: up/down maintains angle sum) is at 90° (up) and 270° (down)
    // Z-Tilt (DIFF: left/right maintains angle difference) is at 0°/180° (left/right)
    // Calculate blend factor: 1 = full Z-Elevate (sum), 0 = full Z-Tilt (diff)
    let elevateBlend = 0;
    if(normalizedAngle >= 45 && normalizedAngle <= 135){
      // Upper half - Z-Elevate (SUM) dominance
      elevateBlend = Math.cos((normalizedAngle - 90) * Math.PI / 180) ** 2;
    } else if(normalizedAngle > 135 && normalizedAngle < 225){
      // Left side - transitioning
      elevateBlend = Math.sin((normalizedAngle - 180) * Math.PI / 180) ** 2;
    } else if(normalizedAngle >= 225 && normalizedAngle <= 315){
      // Lower half - Z-Elevate (SUM) dominance (for down direction)
      elevateBlend = Math.cos((normalizedAngle - 270) * Math.PI / 180) ** 2;
    }
    // else right side = Z-Tilt (DIFF)

    const tiltBlend = 1 - elevateBlend;

    // Speed magnitude
    const speed = magnitude * 0.1;

    // Determine direction based on angle
    // For Z-Elevate (SUM): up (90°) = forward, down (270°) = backward
    // For Z-Tilt (DIFF): right (0°) = forward, left (180°) = backward
    const elevateDirection = Math.sin(normalizedAngle * Math.PI / 180); // positive up, negative down
    const tiltDirection = Math.cos(normalizedAngle * Math.PI / 180); // positive right, negative left

    let deltaElevate = 0;
    let deltaTilt = 0;

    if(elevateBlend > 0.1){
      // Z-Elevate (SUM): both angles move together
      deltaElevate = speed * elevateBlend * elevateDirection;
    }

    if(tiltBlend > 0.1){
      // Z-Tilt (DIFF): angles move oppositely
      deltaTilt = speed * tiltBlend * tiltDirection;
    }

    // Apply combined movement
    let newAngle1 = state.angle1 + deltaElevate + deltaTilt;
    let newAngle2 = state.angle2 + deltaElevate - deltaTilt;

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

  // Continuous frame timer to record graph data
  function frameTimer(){
    recordGraphData();

    // Apply joystick movement continuously if being dragged
    if(joystick.isDragging){
      applyJoystickMovement();
    }

    // Apply smooth movement towards saved position
    if(state.movingTowards && state.targetAngle1 !== null && state.targetAngle2 !== null){
      const speed = 0.08; // degrees per frame (slower animation)
      const angle1Diff = state.targetAngle1 - state.angle1;
      const angle2Diff = state.targetAngle2 - state.angle2;
      const distance = Math.hypot(angle1Diff, angle2Diff);

      if(distance < 0.1){
        // Reached target
        state.angle1 = state.targetAngle1;
        state.angle2 = state.targetAngle2;
        state.movingTowards = null;
        state.targetAngle1 = null;
        state.targetAngle2 = null;
        updateDisplays();
      } else {
        // Move towards target
        const stepDistance = Math.min(speed, distance);
        const angle1Step = (angle1Diff / distance) * stepDistance;
        const angle2Step = (angle2Diff / distance) * stepDistance;

        state.angle1 = constrainAngle1(state.angle1 + angle1Step);
        state.angle2 = constrainAngle2(state.angle2 + angle2Step);
        updateDisplays();
      }
    }

    draw();
    requestAnimationFrame(frameTimer);
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
        const delta = isIncrease ? 0.4 : -0.4;

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

  // Update joystick knob position
  function updateJoystickKnob(px, py){
    const dx = px - joystick.x;
    const dy = py - joystick.y;
    const distance = Math.hypot(dx, dy);

    if(distance > joystick.radius){
      // Clamp to radius
      joystick.knobX = (dx / distance) * joystick.radius;
      joystick.knobY = (dy / distance) * joystick.radius;
    } else {
      joystick.knobX = dx;
      joystick.knobY = dy;
    }
  }

  function onPointerMove(evt){
    const rect = canvas.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;

    // Track cursor position for debug visualization
    state.cursorX = px;
    state.cursorY = py;

    // Handle position marker dragging on phase graph
    if(state.draggingPosition){
      const { min: angle1Min, max: angle1Max } = getAngle1Limits();
      const { min: angle2Min, max: angle2Max } = getAngle2Limits();
      const angle1Range = angle1Max - angle1Min;
      const angle2Range = angle2Max - angle2Min;
      const marginFactor = 0.05;
      const angle1MarginMin = angle1Min - (angle1Range * marginFactor);
      const angle1MarginMax = angle1Max + (angle1Range * marginFactor);
      const angle2MarginMin = angle2Min - (angle2Range * marginFactor);
      const angle2MarginMax = angle2Max + (angle2Range * marginFactor);
      const angle1RangeWithMargin = angle1MarginMax - angle1MarginMin;
      const angle2RangeWithMargin = angle2MarginMax - angle2MarginMin;

      const plotX = canvas.clientWidth - 320;
      const plotY = 235;
      const plotWidth = 300;
      const plotHeight = 200;

      // Convert screen coords back to angle coords
      const xRatio = (px - plotX) / plotWidth;
      const yRatio = (plotY + plotHeight - py) / plotHeight;
      const newAngle1 = angle1MarginMin + (xRatio * angle1RangeWithMargin);
      const newAngle2 = angle2MarginMin + (yRatio * angle2RangeWithMargin);

      if(state.draggingPosition === 'position1'){
        state.position1.angle1 = Math.max(angle1MarginMin, Math.min(angle1MarginMax, newAngle1));
        state.position1.angle2 = Math.max(angle2MarginMin, Math.min(angle2MarginMax, newAngle2));
      } else if(state.draggingPosition === 'position2'){
        state.position2.angle1 = Math.max(angle1MarginMin, Math.min(angle1MarginMax, newAngle1));
        state.position2.angle2 = Math.max(angle2MarginMin, Math.min(angle2MarginMax, newAngle2));
      }
      draw();
      return;
    }

    // Handle joystick movement
    if(joystick.isDragging){
      updateJoystickKnob(px, py);
      return;
    }

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
        const pivot = middleEnd();
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

    // Check if clicking on position markers in phase graph
    const { min: angle1Min, max: angle1Max } = getAngle1Limits();
    const { min: angle2Min, max: angle2Max } = getAngle2Limits();
    const angle1Range = angle1Max - angle1Min;
    const angle2Range = angle2Max - angle2Min;
    const marginFactor = 0.05;
    const angle1MarginMin = angle1Min - (angle1Range * marginFactor);
    const angle1MarginMax = angle1Max + (angle1Range * marginFactor);
    const angle2MarginMin = angle2Min - (angle2Range * marginFactor);
    const angle2MarginMax = angle2Max + (angle2Range * marginFactor);
    const angle1RangeWithMargin = angle1MarginMax - angle1MarginMin;
    const angle2RangeWithMargin = angle2MarginMax - angle2MarginMin;

    const plotX = canvas.clientWidth - 320;
    const plotY = 235;
    const plotWidth = 300;
    const plotHeight = 200;

    function screenToData(sx, sy){
      const xRatio = (sx - plotX) / plotWidth;
      const yRatio = (plotY + plotHeight - sy) / plotHeight;
      return {
        angle1: angle1MarginMin + (xRatio * angle1RangeWithMargin),
        angle2: angle2MarginMin + (yRatio * angle2RangeWithMargin)
      };
    }

    function dataToScreen(angle1, angle2){
      const xRatio = (angle1 - angle1MarginMin) / angle1RangeWithMargin;
      const x = plotX + (xRatio * plotWidth);
      const yRatio = (angle2 - angle2MarginMin) / angle2RangeWithMargin;
      const y = plotY + plotHeight - (yRatio * plotHeight);
      return { x, y };
    }

    // Check distance to position1
    const pos1Screen = dataToScreen(state.position1.angle1, state.position1.angle2);
    const dist1 = Math.hypot(px - pos1Screen.x, py - pos1Screen.y);
    if(dist1 < 10 && px >= plotX && px <= plotX + plotWidth && py >= plotY && py <= plotY + plotHeight){
      state.draggingPosition = 'position1';
      canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
      draw();
      return;
    }

    // Check distance to position2
    const pos2Screen = dataToScreen(state.position2.angle1, state.position2.angle2);
    const dist2 = Math.hypot(px - pos2Screen.x, py - pos2Screen.y);
    if(dist2 < 10 && px >= plotX && px <= plotX + plotWidth && py >= plotY && py <= plotY + plotHeight){
      state.draggingPosition = 'position2';
      canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
      draw();
      return;
    }

    // Check if a button was clicked
    const buttonClicked = getButtonAtPoint(px, py);
    if(buttonClicked){
      if(buttonClicked === 'canvasCheckbox'){
        // Toggle checkbox
        canvasCheckbox.checked = !canvasCheckbox.checked;
        draw();
      } else if(buttonClicked === 'joystick'){
        // Start joystick drag
        joystick.isDragging = true;
        canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
        updateJoystickKnob(px, py);
      } else if(buttonClicked === 'pos1'){
        // Start animating towards position1
        state.movingTowards = 'position1';
        state.targetAngle1 = constrainAngle1(state.position1.angle1);
        state.targetAngle2 = constrainAngle2(state.position1.angle2);
        draw();
      } else if(buttonClicked === 'pos2'){
        // Start animating towards position2
        state.movingTowards = 'position2';
        state.targetAngle1 = constrainAngle1(state.position2.angle1);
        state.targetAngle2 = constrainAngle2(state.position2.angle2);
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

    // Update position inputs if we were dragging a position marker
    if(state.draggingPosition){
      updatePositionInputs();
    }
    state.draggingPosition = null;
    state.buttonHeld = null;
    state.buttonFrameCounter = 0;

    // Cancel movement towards position when user interacts elsewhere
    if(state.movingTowards && evt.target === canvas){
      // Only cancel if clicking on canvas (not on other elements)
      const rect = canvas.getBoundingClientRect();
      const px = evt.clientX - rect.left;
      const py = evt.clientY - rect.top;
      const buttonClicked = getButtonAtPoint(px, py);
      // Only cancel if NOT clicking a position button
      if(buttonClicked !== 'pos1' && buttonClicked !== 'pos2'){
        state.movingTowards = null;
        state.targetAngle1 = null;
        state.targetAngle2 = null;
      }
    }

    // Release joystick
    if(joystick.isDragging){
      joystick.isDragging = false;
      joystick.knobX = 0;
      joystick.knobY = 0;
    }

    canvas.releasePointerCapture && canvas.releasePointerCapture(evt.pointerId);
    draw();
  }

  // UI update
  function updateDisplays(){
    angle1Display.textContent = `${state.angle1.toFixed(1)}°`;
    angle2Display.textContent = `${state.angle2.toFixed(1)}°`;
  }

  // Update position input fields
  function updatePositionInputs(){
    pos1Angle1Input.value = state.position1.angle1.toFixed(1);
    pos1Angle2Input.value = state.position1.angle2.toFixed(1);
    pos2Angle1Input.value = state.position2.angle1.toFixed(1);
    pos2Angle2Input.value = state.position2.angle2.toFixed(1);
  }

  // Wire events
  function addListeners(){
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    window.addEventListener('resize', resizeCanvas);

    // Position input listeners
    pos1Angle1Input.addEventListener('change', () => {
      state.position1.angle1 = parseFloat(pos1Angle1Input.value) || state.position1.angle1;
      draw();
    });
    pos1Angle2Input.addEventListener('change', () => {
      state.position1.angle2 = parseFloat(pos1Angle2Input.value) || state.position1.angle2;
      draw();
    });
    pos2Angle1Input.addEventListener('change', () => {
      state.position2.angle1 = parseFloat(pos2Angle1Input.value) || state.position2.angle1;
      draw();
    });
    pos2Angle2Input.addEventListener('change', () => {
      state.position2.angle2 = parseFloat(pos2Angle2Input.value) || state.position2.angle2;
      draw();
    });

    // Clear graph button listener
    clearGraphBtn.addEventListener('click', () => {
      graphData.dataPoints = [];
      graphData.startTime = Date.now();
      graphData.lastRecordTime = 0;
      draw();
    });
  }

  // Initialize
  function init(){
    resizeCanvas();
    addListeners();
    updateDisplays();
    draw();
    frameTimer(); // Start continuous graph recording
  }

  init();
})();
