// Z-frame Wheelchair Simulator (vanilla JS)
// - angle1: middle member (rotates about base pivot)
// - angle2: seat pan (rotates about middle end)
// - angle3: backrest (rotates about seat pan end, measured clockwise)
// Angles displayed and expected in degrees; internal math uses degrees when evaluating user formulas.

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const angle1Display = document.getElementById('angle1-val');
  const angle2Display = document.getElementById('angle2-val');
  const angle3Display = document.getElementById('angle3-val');

  // Limit input elements
  const angle1MinInput = document.getElementById('angle1-min');
  const angle1MaxInput = document.getElementById('angle1-max');
  const angle2MinInput = document.getElementById('angle2-min');
  const angle2MaxInput = document.getElementById('angle2-max');
  const angle3MinInput = document.getElementById('angle3-min');
  const angle3MaxInput = document.getElementById('angle3-max');

  // Position input elements
  const pos1Angle1Input = document.getElementById('pos1-angle1');
  const pos1Angle2Input = document.getElementById('pos1-angle2');
  const pos2Angle1Input = document.getElementById('pos2-angle1');
  const pos2Angle2Input = document.getElementById('pos2-angle2');

  const seatPanImage = new Image();
  seatPanImage.src = 'seatpan-image.png'; // Replace with your image path

  const wheelBaseImage = new Image();
  wheelBaseImage.src = 'wheelbase-image.png'; // Replace with your image path

  const backRestImage = new Image();
  backRestImage.src = 'backrest-image.png'; // Replace with your image path

  // Clear graph button
  const clearGraphBtn = document.getElementById('clear-graph-btn');

  // Layout / geometry
  const config = {
    basePivot: { x: 240, y: 400 }, // will be repositioned on resize
    middleLength: 180,
    seatPanLength: 160,
    backrestLength: 150,
    hoverThreshold: 12,
    slider: {
      x: 120,       // X position of the slider
      y: 460,      // Y position of the slider (below the Z-frame)
      width: 100,  // Total width of the slider
      height: 8,   // Height of the slider bar
      handleRadius: 12, // Radius of the draggable handle
      min: 10,     // Minimum slider value (10%)
      max: 200,    // Maximum slider value (200%)
    },
    seatPanPoints: [0.25, 0.5, 0.75], // Points at 25%, 50%, 75% along the seat pan
    maxTrailLength: 100, // Maximum number of positions to retain per trail
  };

  // State
  const state = {
    angle1: 30, // degrees (middle)
    angle2: 30, // degrees (seat pan)
    angle3: 30, // degrees (backrest)
    dragging: null, // 'angle1' | 'angle2' | null
    hovering: null, // same
    buttonHeld: null, // 'increase' | 'decrease' | null (for hold-down behavior)
    buttonFrameCounter: 0, // counter to slow down button movement
    cursorX: 0,
    cursorY: 0,
    positions:{
      position1: { angle1: 15, angle1Enabled: true, angle2: 25, angle2Enabled: true, angle3: 50, angle3Enabled: true }, // draggable point 1 on phase graph
      position2: { angle1: 35, angle1Enabled: true, angle2: 10, angle2Enabled: true, angle3: 50, angle3Enabled: true }, // draggable point 2 on phase graph
      position3: { angle1: 10, angle1Enabled: true, angle2: 10, angle2Enabled: true, angle3: 50, angle3Enabled: true }, // draggable point 3 on phase graph
      position4: { angle1: 15, angle1Enabled: true, angle2: 15, angle2Enabled: true, angle3: 50, angle3Enabled: true }, // draggable point 4 on phase graph
      position5: { angle1: 20, angle1Enabled: true, angle2: 20, angle2Enabled: true, angle3: 50, angle3Enabled: true }, // draggable point 5 on phase graph
      position6: { angle1: 25, angle1Enabled: true, angle2: 25, angle2Enabled: true, angle3: 50, angle3Enabled: true }, // draggable point 6 on phase graph
    },

    draggingPosition: null, // 'position1' | 'position2' | null
    movingTowards: null, // 'position1' | 'position2' | null - animating towards saved position
    targetAngle1: null,
    targetAngle2: null,
    targetAngle3: null,
    maintainRatioStartAngle1: null,
    maintainRatioStartAngle2: null,
    sliderValue: 80,  // Initial slider value (80%)
    draggingSlider: false, // Whether the slider is being dragged
    angleMultiplier : 0.80,
    seatPanTrails: config.seatPanPoints.map(() => []),
    showGraph12: true,  // Show angle1 vs angle2 graph
    showGraph13: false,  // Show angle1 vs angle3 graph
    showGraph32: false,  // Show angle3 vs angle2 graph
    drawChair: false,   // Draw chair images
    showOscilloscope: false,  // Show oscilloscope graph
    showSeatPanTrails: false,  // Show seat pan trails
  };

  const layout = {
    buttonSection: { x: 10, y: 10, width: 300 }, // Buttons on the left in rows
    graphSection: { x: window.innerWidth - 320, y: 10, width: 300 }, // Graphs on the right
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
    pos1: { x:  90, y:  0, width: 60, height: 25, label: 'Pos1', group: 'Position', colour: '#FF728E' },
    pos2: { x: 160, y:  0, width: 60, height: 25, label: 'Pos2', group: 'Position', colour: '#FF9671' },
    pos3: { x:  90, y: 10, width: 60, height: 25, label: 'Pos3', group: 'Position', colour: '#FFD371' },
    pos4: { x: 160, y: 10, width: 60, height: 25, label: 'Pos4', group: 'Position', colour: '#8EFF8C' },
    pos5: { x:  90, y: 20, width: 60, height: 25, label: 'Pos5', group: 'Position', colour: '#6EC9FF' },
    pos6: { x: 160, y: 20, width: 60, height: 25, label: 'Pos6', group: 'Position', colour: '#C382FF' },

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

    maintainRatioDown: { x: 90, y: 550, width: 60, height: 25, label: '◀' },
    maintainRatioUp: { x: 160, y: 550, width: 60, height: 25, label: '▶' },
  };

  // Canvas checkbox
  const canvasCheckbox = {
    x: 250,
    y: 380,
    size: 15,
    label: 'Allow Limited Movement',
    checked: true
  };

    // Canvas checkbox
  const imageCheckbox = {
    x: 250,
    y: 600,
    size: 15,
    label: 'Draw Chair',
    checked: false
  };

  // Joystick configuration
  const joystick = {
    x: 172,
    y: 540,
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

  function getAngle3Limits(){
    const min = parseFloat(angle3MinInput.value) || 0;
    const max = parseFloat(angle3MaxInput.value) || 360;
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

  function constrainAngle3(angle){
    const { min, max } = getAngle3Limits();
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
        angle3: state.angle3,
        seatPanSum: seatPanAbsolute,
        buttonAction: state.buttonHeld || null
      });

      // Record positions of points along the seat pan
      const trails = state.seatPanTrails;
      const mid = middleEnd(); // Middle pivot point
      const seatEndPt = seatEnd(); // End of seat pan
      const direction = Math.atan2(seatEndPt.y - mid.y, seatEndPt.x - mid.x);

      config.seatPanPoints.forEach((percent, index) => {
        const x = mid.x + config.seatPanLength * percent * Math.cos(direction);
        const y = mid.y + config.seatPanLength * percent * Math.sin(direction);
        trails[index].push({ x, y });

        // Limit trail length
        if(trails[index].length > config.maxTrailLength){
          trails[index].shift();
        }
      });

      // Remove old data points outside 30 second window
      graphData.dataPoints = graphData.dataPoints.filter(p => p.time > elapsed - graphData.maxDuration);

    }
  }

  function drawSeatPanImage(){
    const mid = middleEnd(); // Starting point of the seat pan (middle joint)
    const seatEndPt = seatEnd(); // End point of the seat pan
    const seatPanCenter = {
      x: (mid.x + seatEndPt.x) / 2,
      y: (mid.y + seatEndPt.y) / 2
    }; // Center position of the seat pan

    const direction = Math.atan2(seatEndPt.y - mid.y, seatEndPt.x - mid.x); // Rotation angle

    let imageScaler = config.seatPanLength*2/seatPanImage.width;
    const imageWidth = seatPanImage.width*imageScaler; // Stretch or fit the image to match seat pan length
    const imageHeight = seatPanImage.height*imageScaler; // Adjust height proportionately

    // Save the canvas state before applying transformations
    ctx.save();

    // Move canvas origin to the center of the seat pan
    ctx.translate(seatPanCenter.x, seatPanCenter.y);
    ctx.rotate(direction); // Rotate to match the seat pan's angle

    // Draw the image (centered around the seat pan's center)
    ctx.drawImage(seatPanImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);

    // Restore the canvas state to avoid affecting other drawings
    ctx.restore();
  }

  function drawBackRestImage(){
    const backRestEnd = rightArmEnd(); // Starting point of the seat pan (middle joint)
    const seatEndPt = seatEnd(); // End point of the seat pan
    const seatPanCenter = {
      x: (backRestEnd.x + seatEndPt.x) / 2,
      y: (backRestEnd.y + seatEndPt.y) / 2
    }; // Center position of the seat pan

    const direction = Math.atan2(seatEndPt.y - backRestEnd.y, seatEndPt.x - backRestEnd.x)+d2r(270); // Rotation angle

    let imageScaler = config.seatPanLength*2/backRestImage.width;
    const imageWidth = backRestImage.width*imageScaler; // Stretch or fit the image to match seat pan length
    const imageHeight = backRestImage.height*imageScaler; // Adjust height proportionately

    // Save the canvas state before applying transformations
    ctx.save();

    // Move canvas origin to the center of the seat pan
    ctx.translate(seatPanCenter.x, seatPanCenter.y);
    ctx.rotate(direction); // Rotate to match the seat pan's angle

    const offset = {
      x: -70,
      y:80,
    }

    // Draw the image (centered around the seat pan's center)
    ctx.drawImage(backRestImage, (-imageWidth / 2) + offset.x, (-imageHeight / 2)+ offset.y, imageWidth, imageHeight);

    // Restore the canvas state to avoid affecting other drawings
    ctx.restore();
  }

  function drawWheelBaseImage(){
    const seatPanCenter = {
      x: config.basePivot.x - 90,
      y: config.basePivot.y - 20
    }; // Center position of the seat pan


    let imageScaler = config.seatPanLength*2/wheelBaseImage.width;
    const imageWidth = wheelBaseImage.width*imageScaler; // Stretch or fit the image to match seat pan length
    const imageHeight = wheelBaseImage.height*imageScaler; // Adjust height proportionately

    // Save the canvas state before applying transformations
    ctx.save();

    // Move canvas origin to the center of the seat pan
    ctx.translate(seatPanCenter.x, seatPanCenter.y);
    // ctx.rotate(direction); // Rotate to match the seat pan's angle

    // Draw the image (centered around the seat pan's center)
    ctx.drawImage(wheelBaseImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);

    // Restore the canvas state to avoid affecting other drawings
    ctx.restore();
  }


  function drawSlider(){
    const slider = config.slider;
    const valueRatio = (state.sliderValue - slider.min) / (slider.max - slider.min); // Normalize value (0-1)

    // Draw the slider bar
    ctx.fillStyle = '#ccc'; // Background color for the slider bar
    ctx.fillRect(slider.x, slider.y, slider.width, slider.height);

    // Draw the slider handle
    const handleX = slider.x + valueRatio * slider.width; // Handle position based on value
    const handleY = slider.y + slider.height / 2;
    ctx.beginPath();
    ctx.arc(handleX, handleY, slider.handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = state.draggingSlider ? '#2b7cff' : '#666'; // Highlight handle if dragged
    ctx.fill();

    // Draw the slider value label
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.fillText(`${state.sliderValue.toFixed(0)}%`, slider.x + slider.width + 40, slider.y + slider.height / 2);
  }

  function drawSeatPanTrails(){
    const trails = state.seatPanTrails;
    ctx.lineWidth = 2;

    // Draw each trail
    trails.forEach((trail, i) => {
      if(trail.length < 2) return; // Need at least 2 points to draw a trail

      // Draw the trail
      ctx.strokeStyle = `rgba(0, 150, 200, ${(i + 1) / trails.length})`; // Adjust opacity per trail
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for(let j = 1; j < trail.length; j++){
        ctx.lineTo(trail[j].x, trail[j].y);
      }
      ctx.stroke();

      // Draw the current point
      const { x, y } = trail[trail.length - 1];
      ctx.fillStyle = '#0096c8';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2); // Smaller dot
      ctx.fill();
    });
  }

  function clearCanvas(){
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,w,h);
  }

  function drawGrid(){
    const spacing = 40; // Distance between grid lines (in pixels)
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Set grid style
    ctx.strokeStyle = '#e0e0e0'; // Light gray for grid lines
    ctx.lineWidth = 1;

    // Draw vertical grid lines
    for (let x = 0; x <= w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = 0; y <= h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Highlight the X and Y axes
    ctx.strokeStyle = '#b0b0b0'; // Darker gray for axes
    ctx.lineWidth = 2;

    // Y-axis (vertical line through the base pivot's X-coordinate)
    ctx.beginPath();
    ctx.moveTo(config.basePivot.x, 0);
    ctx.lineTo(config.basePivot.x, h);
    ctx.stroke();

    // X-axis (horizontal line through the base pivot's Y-coordinate)
    ctx.beginPath();
    ctx.moveTo(0, config.basePivot.y);
    ctx.lineTo(w, config.basePivot.y);
    ctx.stroke();
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
    const width = window.innerWidth; // Full screen width
    const height = Math.max(520, window.innerHeight * 0.8); // Responsive height

    // Resize the canvas
    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    // Keep the Z-frame centered
    config.basePivot.x = Math.round(width / 2); // Center horizontally
    config.basePivot.y = 2*Math.round(height / 3); // Center vertically
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

  function rightArmEnd() {
    const seat = seatEnd();
    const a = d2r(state.angle1-state.angle2-state.angle3);
    return {
      x: seat.x + config.backrestLength * Math.cos(a),
      y: seat.y + config.backrestLength * Math.sin(a)
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

  function drawZBase(){
    // base line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(config.basePivot.x-160, config.basePivot.y);
    ctx.lineTo(config.basePivot.x, config.basePivot.y);
    ctx.stroke();
  }

  function drawZMiddle(){
    // middle member
    const midStart = { ...config.basePivot };
    const midEnd = middleEnd();
    ctx.strokeStyle = state.hovering === 'angle1' || state.dragging === 'angle1' ? '#ff8a65' : '#2f2f2f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(midStart.x, midStart.y);
    ctx.lineTo(midEnd.x, midEnd.y);
    ctx.stroke();
  }
  function drawZSeat(){
    // seat pan
    const seatStart = middleEnd();
    const seatEndPt = seatEnd();
    ctx.strokeStyle = state.hovering === 'angle2' || state.dragging === 'angle2' ? '#ff8a65' : '#666';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(seatStart.x, seatStart.y);
    ctx.lineTo(seatEndPt.x, seatEndPt.y);
    ctx.stroke();
  }

  function drawZBackrest(){
    // backrest
    const armStart = seatEnd();
    const armEndPt = rightArmEnd();
    ctx.strokeStyle = state.hovering === 'angle3' || state.dragging === 'angle3' ? '#ff8a65' : '#999';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(armStart.x, armStart.y);
    ctx.lineTo(armEndPt.x, armEndPt.y);
    ctx.stroke();
  }

  function drawZPivots(){
    // pivots
    const midEnd = middleEnd();
    const seadtEnd = seatEnd();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(config.basePivot.x, config.basePivot.y, 6, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(midEnd.x, midEnd.y, 6, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(seadtEnd.x, seadtEnd.y, 6, 0, Math.PI*2);
    ctx.fill();
  }

  function drawZAngleArc(){
    // Draw angle arcs and labels:
    // angle1: between the base horizontal (0° to the right) and middle member (state.angle1)
    // angle2: between the middle member direction (state.angle1) and the seat pan (state.angle2)
    // angle3: between the seat pan and the backrest (measured clockwise)
    // Use distinct radii/colors so they don't overlap.
    // Check if angles are at their limits
    const midEnd = middleEnd();
    const seatEndPt = seatEnd();

    const { min: angle1Min, max: angle1Max } = getAngle1Limits();
    const { min: angle2Min, max: angle2Max } = getAngle2Limits();
    const { min: angle3Min, max: angle3Max } = getAngle3Limits();

    const angle1AtLimit = Math.abs(state.angle1 - angle1Min) < 0.01 || Math.abs(state.angle1 - angle1Max) < 0.01;
    const angle2AtLimit = Math.abs(state.angle2 - angle2Min) < 0.01 || Math.abs(state.angle2 - angle2Max) < 0.01;
    const angle3AtLimit = Math.abs(state.angle3 - angle3Min) < 0.01 || Math.abs(state.angle3 - angle3Max) < 0.01;

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

    // Angle3: measure between seat pan direction and backrest direction at seat pivot
    const angle3StartDeg = state.angle1 - state.angle2; // direction of seat pan
    const angle3EndDeg = state.angle1 - state.angle2 - state.angle3; // direction of backrest (clockwise)
    const interiorAngle3Deg = state.angle3; // interior angle
    drawAngleArc(
      seatEndPt.x,
      seatEndPt.y,
      angle3EndDeg,
      angle3StartDeg,
      20,
      '#66bb6a',
      `angle3 ${interiorAngle3Deg.toFixed(1)}°`,
      angle3AtLimit
    );
  }

  function drawZ(){
    drawZBase();
    drawZMiddle();
    drawZSeat();
    drawZBackrest();
    drawZPivots();
    drawZAngleArc();
    if(state.showSeatPanTrails) drawSeatPanTrails();
  }

  function drawText(){
    const { min: angle1Min, max: angle1Max } = getAngle1Limits();
    const seatPanAbsoluteAngle = (state.angle1 - state.angle2) % 360;
    let minHeight = Math.sin(d2r(angle1Min));
    let maxHeight = Math.sin(d2r(angle1Max));
    let preHeight = Math.sin(d2r(state.angle1));

    ctx.fillStyle = '#111';
    ctx.font = '14px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillText(`Middle (angle1): ${state.angle1.toFixed(1)}°`, 90, 20);
    ctx.fillText(`Seat pan (angle2): ${state.angle2.toFixed(1)}°`, 90, 40);
    ctx.fillText(`Seat pan (absolute): ${seatPanAbsoluteAngle.toFixed(1)}°`, 90, 60);
    ctx.fillText(`Recline (angle3): ${state.angle3.toFixed(1)}°`, 90, 80);
    ctx.fillText(`Height: ${(((preHeight-minHeight)/(maxHeight-minHeight))*100).toFixed(1)}%`, 90, 100);
  }

  function drawPictureOfChair(){
    if (imageCheckbox.checked)
    {
      drawSeatPanImage(); // Draw the image following the seat pan
      drawBackRestImage();
      drawWheelBaseImage();
    }
  }

  // Draw function
  // Replace the existing draw() with this version (keeps original drawing + angle arcs/labels)
function draw(){
  clearCanvas();
  drawGrid();
  drawZ();
  drawText();
  drawButtons();
  drawPictureOfChair();
  drawCanvasCheckbox();
  // drawImageCheckbox();
  drawJoystick();
  if(state.showOscilloscope) drawOscilloscope();
  drawPhaseChart();
  drawSlider(); // Draw the slider
}

function LightenDarkenColor(hex, amount) {
  let usePound = false;
  if (hex[0] === "#") {
    hex = hex.slice(1);
    usePound = true;
  }

  // Handle 3-digit hex codes
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  let num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  let b = ((num >> 8) & 0x00ff) + amount;
  let g = (num & 0x0000ff) + amount;

  // Clamp values to stay within 0-255
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;

  // Recombine into hex string
  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function drawButton(btn, isPressed, bgColor = null){
  const defaultBgColor = bgColor || '#2b7cff';
  const finalBgColor = isPressed ? LightenDarkenColor(defaultBgColor, -100) : defaultBgColor;
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

function drawButtons(){
  const buttonXStart = layout.buttonSection.x + 100; // Start X position of the buttons section
  const buttonYStart = 150; // Start Y position of the buttons section
  const buttonSpacing = 65; // Horizontal spacing between buttons in a row
  const rowSpacing = 30; // Vertical spacing between button rows
  let x = buttonXStart;
  let y = buttonYStart;
  let buttonsInRow = 0; // Keep track of the number of buttons in the current row

  // Draw actuator buttons with labels
  const actuatorGroups = [
    { label: 'Act-1', buttons: ['act1Down', 'act1Up'] },
    { label: 'Act-2', buttons: ['act2Down', 'act2Up'] },
    { label: 'Act-1-then-2', buttons: ['z1Down', 'z1Up'] },
    { label: 'Act-2-then-1', buttons: ['z2Down', 'z2Up'] },
    { label: 'Z-Diff-Const', buttons: ['zElevateDown', 'zElevateUp'] },
    { label: 'Z-Sum-Const', buttons: ['zTiltDown', 'zTiltUp'] },
    { label: 'Maintain Ratio', buttons: ['maintainRatioDown', 'maintainRatioUp'] },
  ];
  actuatorGroups.forEach(group => {
    const btn = buttons[group.buttons[0]];
    // Draw label to the left
    ctx.fillStyle = '#333';
    ctx.font = '11px system-ui,Segoe UI,Roboto,Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(group.label, btn.x - 8, btn.y + btn.height / 2);
  });

  Object.keys(buttons).forEach(key => {
    const btn = buttons[key];
    btn.x = x;
    btn.y = y;

    // Draw the button
    drawButton(btn, state.buttonHeld === key, btn.colour || null);

    // Move to the next position
    buttonsInRow++;
    if(buttonsInRow === 2){ // Move to the next row after two buttons
      buttonsInRow = 0;
      x = buttonXStart; // Reset X position
      y += rowSpacing;  // Move to the next row
    } else {
      x += buttonSpacing; // Place the next button in the same row
    }
  });
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

function drawImageCheckbox(){
  const cb = imageCheckbox;

  // Draw checkbox box
  ctx.fillStyle = imageCheckbox.checked ? '#2b7cff' : '#fff';
  ctx.fillRect(cb.x, cb.y, cb.size, cb.size);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(cb.x, cb.y, cb.size, cb.size);

  // Draw checkmark if checked
  if(imageCheckbox.checked){
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
};


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
  ctx.fillText('▶ Diff', j.x, j.y - j.radius - 8);
  ctx.fillText('◀ Diff', j.x, j.y + j.radius + 12);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('◀ Sum', j.x - j.radius - 30, j.y);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶ Sum', j.x + j.radius + 30, j.y);
}

function drawOscilloscope(){
  // Graph dimensions and position
  const graphX = layout.graphSection.x;
  const graphWidth = layout.graphSection.width;
  const graphY = 10; // Start drawing from top
  const graphHeight = 200;

  // Draw graph background
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

// Generic phase chart drawing function
function drawPhaseGraphForAngles(plotX, plotY, plotWidth, plotHeight, angleXKey, angleYKey, title, getLimitsX, getLimitsY, dataExtractor) {
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
  ctx.fillText(title, plotX + 5, plotY + 5);

  if(graphData.dataPoints.length < 1) return { trajectoryPoints: [], currentPoint: null };

  // Get angle limits
  const { min: angleXMin, max: angleXMax } = getLimitsX();
  const { min: angleYMin, max: angleYMax } = getLimitsY();
  const angleXRange = angleXMax - angleXMin;
  const angleYRange = angleYMax - angleYMin;

  // Add 5% margin to bounds
  const marginFactor = 0.05;
  const angleXMarginMin = angleXMin - (angleXRange * marginFactor);
  const angleXMarginMax = angleXMax + (angleXRange * marginFactor);
  const angleYMarginMin = angleYMin - (angleYRange * marginFactor);
  const angleYMarginMax = angleYMax + (angleYRange * marginFactor);
  const angleXRangeWithMargin = angleXMarginMax - angleXMarginMin;
  const angleYRangeWithMargin = angleYMarginMax - angleYMarginMin;

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
  ctx.fillText(angleXMarginMin.toFixed(0), plotX, plotY + plotHeight + 2);
  ctx.fillText(angleXMarginMax.toFixed(0), plotX + plotWidth, plotY + plotHeight + 2);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(angleYMarginMax.toFixed(0), plotX - 3, plotY);
  ctx.fillText(angleYMarginMin.toFixed(0), plotX - 3, plotY + plotHeight);

  // Helper to convert data to screen coordinates
  function dataToScreen(angleX, angleY){
    const xRatio = (angleX - angleXMarginMin) / angleXRangeWithMargin;
    const x = plotX + (xRatio * plotWidth);
    const yRatio = (angleY - angleYMarginMin) / angleYRangeWithMargin;
    const y = plotY + plotHeight - (yRatio * plotHeight);
    return { x, y };
  }

  // Draw data points as dots with connecting lines
  ctx.strokeStyle = '#2b7cff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let firstPointDrawn = false;
  const trajectoryPoints = [];
  for(let p of graphData.dataPoints){
    const angleX = dataExtractor(p).x;
    const angleY = dataExtractor(p).y;
    const { x, y } = dataToScreen(angleX, angleY);
    trajectoryPoints.push({ x, y });
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
  let currentPoint = null;
  if(graphData.dataPoints.length > 0){
    const lastP = graphData.dataPoints[graphData.dataPoints.length - 1];
    const angleX = dataExtractor(lastP).x;
    const angleY = dataExtractor(lastP).y;
    const { x, y } = dataToScreen(angleX, angleY);
    currentPoint = { x, y };
    if(x >= plotX && x <= plotX + plotWidth && y >= plotY && y <= plotY + plotHeight){
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawPositionMarker(position, colour, posExtractor)
  {
    const posData = posExtractor(position);
    const posScreen = dataToScreen(posData.x, posData.y);
    if(posScreen.x >= plotX && posScreen.x <= plotX + plotWidth && posScreen.y >= plotY && posScreen.y <= plotY + plotHeight){
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(posScreen.x, posScreen.y, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    return posScreen;
  }

  const positionMarkers = {};

  // Draw position markers based on enabled angles
  if(angleXKey === 'angle1' && angleYKey === 'angle2') {
    if(state.positions.position1.angle1Enabled && state.positions.position1.angle2Enabled) {
      positionMarkers.pos1 = { screen: drawPositionMarker(state.positions.position1, buttons.pos1.colour, p => ({x: p.angle1, y: p.angle2})), colour: buttons.pos1.colour };
    }
    if(state.positions.position2.angle1Enabled && state.positions.position2.angle2Enabled) {
      positionMarkers.pos2 = { screen: drawPositionMarker(state.positions.position2, buttons.pos2.colour, p => ({x: p.angle1, y: p.angle2})), colour: buttons.pos2.colour };
    }
    if(state.positions.position3.angle1Enabled && state.positions.position3.angle2Enabled) {
      positionMarkers.pos3 = { screen: drawPositionMarker(state.positions.position3, buttons.pos3.colour, p => ({x: p.angle1, y: p.angle2})), colour: buttons.pos3.colour };
    }
    if(state.positions.position4.angle1Enabled && state.positions.position4.angle2Enabled) {
      positionMarkers.pos4 = { screen: drawPositionMarker(state.positions.position4, buttons.pos4.colour, p => ({x: p.angle1, y: p.angle2})), colour: buttons.pos4.colour };
    }
    if(state.positions.position5.angle1Enabled && state.positions.position5.angle2Enabled) {
      positionMarkers.pos5 = { screen: drawPositionMarker(state.positions.position5, buttons.pos5.colour, p => ({x: p.angle1, y: p.angle2})), colour: buttons.pos5.colour };
    }
    if(state.positions.position6.angle1Enabled && state.positions.position6.angle2Enabled) {
      positionMarkers.pos6 = { screen: drawPositionMarker(state.positions.position6, buttons.pos6.colour, p => ({x: p.angle1, y: p.angle2})), colour: buttons.pos6.colour };
    }
  } else if(angleXKey === 'angle1' && angleYKey === 'angle3') {
    if(state.positions.position1.angle1Enabled && state.positions.position1.angle3Enabled) {
      positionMarkers.pos1 = { screen: drawPositionMarker(state.positions.position1, buttons.pos1.colour, p => ({x: p.angle1, y: p.angle3})), colour: buttons.pos1.colour };
    }
    if(state.positions.position2.angle1Enabled && state.positions.position2.angle3Enabled) {
      positionMarkers.pos2 = { screen: drawPositionMarker(state.positions.position2, buttons.pos2.colour, p => ({x: p.angle1, y: p.angle3})), colour: buttons.pos2.colour };
    }
    if(state.positions.position3.angle1Enabled && state.positions.position3.angle3Enabled) {
      positionMarkers.pos3 = { screen: drawPositionMarker(state.positions.position3, buttons.pos3.colour, p => ({x: p.angle1, y: p.angle3})), colour: buttons.pos3.colour };
    }
    if(state.positions.position4.angle1Enabled && state.positions.position4.angle3Enabled) {
      positionMarkers.pos4 = { screen: drawPositionMarker(state.positions.position4, buttons.pos4.colour, p => ({x: p.angle1, y: p.angle3})), colour: buttons.pos4.colour };
    }
    if(state.positions.position5.angle1Enabled && state.positions.position5.angle3Enabled) {
      positionMarkers.pos5 = { screen: drawPositionMarker(state.positions.position5, buttons.pos5.colour, p => ({x: p.angle1, y: p.angle3})), colour: buttons.pos5.colour };
    }
    if(state.positions.position6.angle1Enabled && state.positions.position6.angle3Enabled) {
      positionMarkers.pos6 = { screen: drawPositionMarker(state.positions.position6, buttons.pos6.colour, p => ({x: p.angle1, y: p.angle3})), colour: buttons.pos6.colour };
    }
  } else if(angleXKey === 'angle2' && angleYKey === 'angle3') {
    if(state.positions.position1.angle2Enabled && state.positions.position1.angle3Enabled) {
      positionMarkers.pos1 = { screen: drawPositionMarker(state.positions.position1, buttons.pos1.colour, p => ({x: p.angle2, y: p.angle3})), colour: buttons.pos1.colour };
    }
    if(state.positions.position2.angle2Enabled && state.positions.position2.angle3Enabled) {
      positionMarkers.pos2 = { screen: drawPositionMarker(state.positions.position2, buttons.pos2.colour, p => ({x: p.angle2, y: p.angle3})), colour: buttons.pos2.colour };
    }
    if(state.positions.position3.angle2Enabled && state.positions.position3.angle3Enabled) {
      positionMarkers.pos3 = { screen: drawPositionMarker(state.positions.position3, buttons.pos3.colour, p => ({x: p.angle2, y: p.angle3})), colour: buttons.pos3.colour };
    }
    if(state.positions.position4.angle2Enabled && state.positions.position4.angle3Enabled) {
      positionMarkers.pos4 = { screen: drawPositionMarker(state.positions.position4, buttons.pos4.colour, p => ({x: p.angle2, y: p.angle3})), colour: buttons.pos4.colour };
    }
    if(state.positions.position5.angle2Enabled && state.positions.position5.angle3Enabled) {
      positionMarkers.pos5 = { screen: drawPositionMarker(state.positions.position5, buttons.pos5.colour, p => ({x: p.angle2, y: p.angle3})), colour: buttons.pos5.colour };
    }
    if(state.positions.position6.angle2Enabled && state.positions.position6.angle3Enabled) {
      positionMarkers.pos6 = { screen: drawPositionMarker(state.positions.position6, buttons.pos6.colour, p => ({x: p.angle2, y: p.angle3})), colour: buttons.pos6.colour };
    }
  } else if(angleXKey === 'angle3' && angleYKey === 'angle2') {
    if(state.positions.position1.angle3Enabled && state.positions.position1.angle2Enabled) {
      positionMarkers.pos1 = { screen: drawPositionMarker(state.positions.position1, buttons.pos1.colour, p => ({x: p.angle3, y: p.angle2})), colour: buttons.pos1.colour };
    }
    if(state.positions.position2.angle3Enabled && state.positions.position2.angle2Enabled) {
      positionMarkers.pos2 = { screen: drawPositionMarker(state.positions.position2, buttons.pos2.colour, p => ({x: p.angle3, y: p.angle2})), colour: buttons.pos2.colour };
    }
    if(state.positions.position3.angle3Enabled && state.positions.position3.angle2Enabled) {
      positionMarkers.pos3 = { screen: drawPositionMarker(state.positions.position3, buttons.pos3.colour, p => ({x: p.angle3, y: p.angle2})), colour: buttons.pos3.colour };
    }
    if(state.positions.position4.angle3Enabled && state.positions.position4.angle2Enabled) {
      positionMarkers.pos4 = { screen: drawPositionMarker(state.positions.position4, buttons.pos4.colour, p => ({x: p.angle3, y: p.angle2})), colour: buttons.pos4.colour };
    }
    if(state.positions.position5.angle3Enabled && state.positions.position5.angle2Enabled) {
      positionMarkers.pos5 = { screen: drawPositionMarker(state.positions.position5, buttons.pos5.colour, p => ({x: p.angle3, y: p.angle2})), colour: buttons.pos5.colour };
    }
    if(state.positions.position6.angle3Enabled && state.positions.position6.angle2Enabled) {
      positionMarkers.pos6 = { screen: drawPositionMarker(state.positions.position6, buttons.pos6.colour, p => ({x: p.angle3, y: p.angle2})), colour: buttons.pos6.colour };
    }
  }

  return { trajectoryPoints, currentPoint, positionMarkers };
}

function drawPhaseChart(){
  // Layout for orthographic 3D view
  const plotX1 = canvas.clientWidth - 650; // Left column
  const plotX2 = plotX1 + 310; // Right column (gap between graphs)
  const plotY1 = 235; // Top row
  const plotY2 = plotY1 + 180 + 5; // Bottom row
  const plotWidth = 300;
  const plotHeight = 180;

  // Draw Angle1 vs Angle2 graph (top-left)
  let result12 = null;
  if(state.showGraph12) {
    result12 = drawPhaseGraphForAngles(
      plotX1, plotY1, plotWidth, plotHeight,
      'angle1', 'angle2',
      'angle1 vs angle2',
      getAngle1Limits,
      getAngle2Limits,
      (p) => ({x: p.angle1, y: p.angle2})
    );
  }

  // Draw Angle1 vs Angle3 graph (bottom-left)
  let result13 = null;
  if(state.showGraph13) {
    result13 = drawPhaseGraphForAngles(
      plotX1, plotY2, plotWidth, plotHeight,
      'angle1', 'angle3',
      'angle1 vs angle3',
      getAngle1Limits,
      getAngle3Limits,
      (p) => ({x: p.angle1, y: p.angle3})
    );
  }

  // Draw Angle3 vs Angle2 graph (top-right)
  let result32 = null;
  if(state.showGraph32) {
    result32 = drawPhaseGraphForAngles(
      plotX2, plotY1, plotWidth, plotHeight,
      'angle3', 'angle2',
      'angle3 vs angle2',
      getAngle3Limits,
      getAngle2Limits,
      (p) => ({x: p.angle3, y: p.angle2})
    );
  }

// Helper to draw orthographic folding connecting lines (pure horizontal/vertical within graphs)
  function drawOrthographicLine(fromX, fromY, toX, toY, colour, lineWidth, fromGraph, toGraph) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);

    if(fromGraph === '12' && toGraph === '13') {
      // 1v2 to 1v3: straight vertical (they share angle1 x-axis)
      ctx.lineTo(toX, toY);
    } else if((fromGraph === '12' && toGraph === '32') || (fromGraph === '13' && toGraph === '32')) {
      // Going to 3v2 graph: find the intersection point in empty space
      // For 1v2→3v2: angle2 is shared (Y axis in 1v2, Y axis in 3v2)
      // For 1v3→3v2: angle3 is shared (Y axis in 1v3, X axis in 3v2)

      if(fromGraph === '12') {
        // From 1v2 (angle1 x, angle2 y) to 3v2 (angle3 x, angle2 y): angle2 shared on Y
        // Go horizontally to the right edge, then vertically to destination
        const bendX = plotX1 + plotWidth;  // Right edge of left graphs
        ctx.lineTo(bendX, fromY);          // Horizontal, preserving angle2 Y
        ctx.lineTo(toX, toY);               // Vertical to destination
      } else {
        // From 1v3 (angle1 x, angle3 y) to 3v2 (angle3 x, angle2 y): angle3 shared
        // Horizontal line from 1v3 point will have Y = fromY (angle3)
        // Vertical line to 3v2 point will have X = toX (angle3)
        // They intersect at (toX, fromY)
        const bendX = toX;      // angle3 X position in 3v2 graph
        const bendY = fromY;    // angle3 Y position in 1v3 graph
        ctx.lineTo(bendX, bendY);  // Horizontal to intersection
        ctx.lineTo(toX, toY);       // Vertical to destination
      }
    }
    ctx.stroke();
  }

  // Draw connecting line between current points (12 to 13 vertical, sharing angle1 x-axis)
  if(result12 && result13 && result12.currentPoint && result13.currentPoint){
    drawOrthographicLine(result12.currentPoint.x, result12.currentPoint.y, result13.currentPoint.x, result13.currentPoint.y, 'rgba(255, 107, 107, 0.3)', 2, '12', '13');
  }

  // Draw connecting line between current points (12 to 32 with fold, sharing angle2 y-axis)
  if(result12 && result32 && result12.currentPoint && result32.currentPoint){
    drawOrthographicLine(result12.currentPoint.x, result12.currentPoint.y, result32.currentPoint.x, result32.currentPoint.y, 'rgba(255, 107, 107, 0.3)', 2, '12', '32');
  }

  // Draw connecting line between current points (13 to 32 with fold, sharing angle3)
  if(result13 && result32 && result13.currentPoint && result32.currentPoint){
    drawOrthographicLine(result13.currentPoint.x, result13.currentPoint.y, result32.currentPoint.x, result32.currentPoint.y, 'rgba(255, 107, 107, 0.3)', 2, '13', '32');
  }

  // Draw connecting lines between position markers (12 to 13 vertical, sharing angle1)
  if(result12 && result13 && result12.positionMarkers && result13.positionMarkers){
    for(const posKey in result12.positionMarkers){
      const pos12 = result12.positionMarkers[posKey];
      const pos13 = result13.positionMarkers[posKey];
      if(pos12 && pos13){
        const colour = pos12.colour;
        ctx.strokeStyle = `rgba(${colour.substring(1, 3)}, ${colour.substring(3, 5)}, ${colour.substring(5, 7)}, 0.25)`;
        drawOrthographicLine(pos12.screen.x, pos12.screen.y, pos13.screen.x, pos13.screen.y, ctx.strokeStyle, 1.5, '12', '13');
      }
    }
  }

  // Draw connecting lines between position markers (12 to 32 with fold, sharing angle2)
  if(result12 && result32 && result12.positionMarkers && result32.positionMarkers){
    for(const posKey in result12.positionMarkers){
      const pos12 = result12.positionMarkers[posKey];
      const pos32 = result32.positionMarkers[posKey];
      if(pos12 && pos32){
        const colour = pos12.colour;
        ctx.strokeStyle = `rgba(${colour.substring(1, 3)}, ${colour.substring(3, 5)}, ${colour.substring(5, 7)}, 0.25)`;
        drawOrthographicLine(pos12.screen.x, pos12.screen.y, pos32.screen.x, pos32.screen.y, ctx.strokeStyle, 1.5, '12', '32');
      }
    }
  }

  // Draw connecting lines between position markers (13 to 32 with fold, sharing angle3)
  if(result13 && result32 && result13.positionMarkers && result32.positionMarkers){
    for(const posKey in result13.positionMarkers){
      const pos13 = result13.positionMarkers[posKey];
      const pos32 = result32.positionMarkers[posKey];
      if(pos13 && pos32){
        const colour = pos13.colour;
        ctx.strokeStyle = `rgba(${colour.substring(1, 3)}, ${colour.substring(3, 5)}, ${colour.substring(5, 7)}, 0.25)`;
        drawOrthographicLine(pos13.screen.x, pos13.screen.y, pos32.screen.x, pos32.screen.y, ctx.strokeStyle, 1.5, '13', '32');
      }
    }
  }
}
  // Check if point is in button or checkbox
  function getButtonAtPoint(px, py){
    // Check checkbox first
    if(px >= canvasCheckbox.x && px <= canvasCheckbox.x + canvasCheckbox.size &&
       py >= canvasCheckbox.y && py <= canvasCheckbox.y + canvasCheckbox.size){
      return 'canvasCheckbox';
    }

    if(px >= imageCheckbox.x && px <= imageCheckbox.x + imageCheckbox.size &&
       py >= imageCheckbox.y && py <= imageCheckbox.y + imageCheckbox.size){
      return 'imageCheckbox';
    }

    // Check joystick
    const dx = px - joystick.x;
    const dy = py - joystick.y;
    if(Math.hypot(dx, dy) <= joystick.radius){
      return 'joystick';
    }

    for (const [key, btn] of Object.entries(buttons)) {
      if (px >= btn.x && px <= btn.x + btn.width &&
        py >= btn.y && py <= btn.y + btn.height) {
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
    if(state.movingTowards && (state.targetAngle1 !== null || state.targetAngle2 !== null || state.targetAngle3 !== null)){
      const speed = 0.08; // degrees per frame (slower animation)
      let angle1Diff = state.targetAngle1 !== null ? state.targetAngle1 - state.angle1 : 0;
      let angle2Diff = state.targetAngle2 !== null ? state.targetAngle2 - state.angle2 : 0;
      let angle3Diff = state.targetAngle3 !== null ? state.targetAngle3 - state.angle3 : 0;
      const distance = Math.hypot(angle1Diff, angle2Diff, angle3Diff);

      if(distance < 0.1){
        // Reached target
        if(state.targetAngle1 !== null) state.angle1 = state.targetAngle1;
        if(state.targetAngle2 !== null) state.angle2 = state.targetAngle2;
        if(state.targetAngle3 !== null) state.angle3 = state.targetAngle3;
        state.movingTowards = null;
        state.targetAngle1 = null;
        state.targetAngle2 = null;
        state.targetAngle3 = null;
        updateDisplays();
      } else {
        // Move towards target
        const stepDistance = Math.min(speed, distance);
        let angle1Step = 0;
        let angle2Step = 0;
        let angle3Step = 0;

        if(distance > 0){
          if(state.targetAngle1 !== null){
            angle1Step = (angle1Diff / distance) * stepDistance;
          }
          if(state.targetAngle2 !== null){
            angle2Step = (angle2Diff / distance) * stepDistance;
          }
          if(state.targetAngle3 !== null){
            angle3Step = (angle3Diff / distance) * stepDistance;
          }
        }

        if(state.targetAngle1 !== null){
          state.angle1 = constrainAngle1(state.angle1 + angle1Step);
        }
        if(state.targetAngle2 !== null){
          state.angle2 = constrainAngle2(state.angle2 + angle2Step);
        }
        if(state.targetAngle3 !== null){
          state.angle3 = constrainAngle3(state.angle3 + angle3Step);
        }
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
        else if (state.buttonHeld === 'maintainRatioUp' || state.buttonHeld === 'maintainRatioDown') {
          const delta = state.buttonHeld === 'maintainRatioUp' ? 0.5 : -0.5; // Increment or decrement

          // Calculate the new angles based on the starting values and delta
          const adjustedAngle1 = state.angle1 + delta; // Increment/decrement angle1
          const adjustedAngle2 = state.angle2 + delta * -state.angleMultiplier; // Compute corresponding change in angle2

          // Apply constraints
          const newAngle1 = constrainAngle1(adjustedAngle1);
          const newAngle2 = constrainAngle2(adjustedAngle2);

          // Update angles if they have changed
          if (Math.abs(newAngle1 - state.angle1) > 0.01 || Math.abs(newAngle2 - state.angle2) > 0.01) {
            state.angle1 = newAngle1;
            state.angle2 = newAngle2;
            updateDisplays();
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

    // Handle position marker dragging on phase graphs
    if(state.draggingPosition){
      const { min: angle1Min, max: angle1Max } = getAngle1Limits();
      const { min: angle2Min, max: angle2Max } = getAngle2Limits();
      const { min: angle3Min, max: angle3Max } = getAngle3Limits();
      const angle1Range = angle1Max - angle1Min;
      const angle2Range = angle2Max - angle2Min;
      const angle3Range = angle3Max - angle3Min;
      const marginFactor = 0.05;
      const angle1MarginMin = angle1Min - (angle1Range * marginFactor);
      const angle1MarginMax = angle1Max + (angle1Range * marginFactor);
      const angle2MarginMin = angle2Min - (angle2Range * marginFactor);
      const angle2MarginMax = angle2Max + (angle2Range * marginFactor);
      const angle3MarginMin = angle3Min - (angle3Range * marginFactor);
      const angle3MarginMax = angle3Max + (angle3Range * marginFactor);
      const angle1RangeWithMargin = angle1MarginMax - angle1MarginMin;
      const angle2RangeWithMargin = angle2MarginMax - angle2MarginMin;
      const angle3RangeWithMargin = angle3MarginMax - angle3MarginMin;

      const plotX = canvas.clientWidth - 650;
      const plotX2 = plotX + 310;
      const plotY1 = 235;
      const plotY2 = plotY1 + 180 + 5;
      const plotWidth = 300;
      const plotHeight = 180;

      // Determine which graph is being dragged
      const whichGraph = state.draggingGraph || '12'; // Default to angle1-angle2 for backwards compatibility

      if(whichGraph === '12'){
        // Dragging on angle1-angle2 graph
        const xRatio = (px - plotX) / plotWidth;
        const yRatio = (plotY1 + plotHeight - py) / plotHeight;
        const newAngle1 = angle1MarginMin + (xRatio * angle1RangeWithMargin);
        const newAngle2 = angle2MarginMin + (yRatio * angle2RangeWithMargin);

        if(state.draggingPosition && state.positions[state.draggingPosition]){
          const pos = state.positions[state.draggingPosition];
          pos.angle1 = Math.max(angle1Min, Math.min(angle1Max, newAngle1));
          pos.angle2 = Math.max(angle2Min, Math.min(angle2Max, newAngle2));

          // Update hidden input elements to match
          if(state.draggingPosition === 'position1'){
            pos1Angle1Input.value = state.positions.position1.angle1.toFixed(1);
            pos1Angle2Input.value = state.positions.position1.angle2.toFixed(1);
          } else if(state.draggingPosition === 'position2'){
            pos2Angle1Input.value = state.positions.position2.angle1.toFixed(1);
            pos2Angle2Input.value = state.positions.position2.angle2.toFixed(1);
          } else {
            const idx = state.draggingPosition.replace('position', '');
            document.getElementById(`pos${idx}-angle1`).value = state.positions[state.draggingPosition].angle1.toFixed(1);
            document.getElementById(`pos${idx}-angle2`).value = state.positions[state.draggingPosition].angle2.toFixed(1);
          }

          // Also update modal inputs if modal is visible
          syncSettingsModal();

          // Save to localStorage
          saveSettings();
        }
      } else if(whichGraph === '13'){
        // Dragging on angle1-angle3 graph
        const xRatio = (px - plotX) / plotWidth;
        const yRatio = (plotY2 + plotHeight - py) / plotHeight;
        const newAngle1 = angle1MarginMin + (xRatio * angle1RangeWithMargin);
        const newAngle3 = angle3MarginMin + (yRatio * angle3RangeWithMargin);

        if(state.draggingPosition && state.positions[state.draggingPosition]){
          const pos = state.positions[state.draggingPosition];
          pos.angle1 = Math.max(angle1Min, Math.min(angle1Max, newAngle1));
          pos.angle3 = Math.max(angle3Min, Math.min(angle3Max, newAngle3));

          // Update hidden input elements to match
          if(state.draggingPosition === 'position1'){
            pos1Angle1Input.value = state.positions.position1.angle1.toFixed(1);
            document.getElementById('pos1-angle3').value = state.positions.position1.angle3.toFixed(1);
          } else if(state.draggingPosition === 'position2'){
            pos2Angle1Input.value = state.positions.position2.angle1.toFixed(1);
            document.getElementById('pos2-angle3').value = state.positions.position2.angle3.toFixed(1);
          } else {
            const idx = state.draggingPosition.replace('position', '');
            document.getElementById(`pos${idx}-angle1`).value = state.positions[state.draggingPosition].angle1.toFixed(1);
            document.getElementById(`pos${idx}-angle3`).value = state.positions[state.draggingPosition].angle3.toFixed(1);
          }

          // Also update modal inputs if modal is visible
          syncSettingsModal();

          // Save to localStorage
          saveSettings();
        }
      } else if(whichGraph === '32'){
        // Dragging on angle3-angle2 graph
        const xRatio = (px - plotX2) / plotWidth;
        const yRatio = (plotY1 + plotHeight - py) / plotHeight;
        const newAngle3 = angle3MarginMin + (xRatio * angle3RangeWithMargin);
        const newAngle2 = angle2MarginMin + (yRatio * angle2RangeWithMargin);

        if(state.draggingPosition && state.positions[state.draggingPosition]){
          const pos = state.positions[state.draggingPosition];
          pos.angle2 = Math.max(angle2Min, Math.min(angle2Max, newAngle2));
          pos.angle3 = Math.max(angle3Min, Math.min(angle3Max, newAngle3));

          // Update hidden input elements to match
          if(state.draggingPosition === 'position1'){
            pos1Angle2Input.value = state.positions.position1.angle2.toFixed(1);
            document.getElementById('pos1-angle3').value = state.positions.position1.angle3.toFixed(1);
          } else if(state.draggingPosition === 'position2'){
            pos2Angle2Input.value = state.positions.position2.angle2.toFixed(1);
            document.getElementById('pos2-angle3').value = state.positions.position2.angle3.toFixed(1);
          } else {
            const idx = state.draggingPosition.replace('position', '');
            document.getElementById(`pos${idx}-angle2`).value = state.positions[state.draggingPosition].angle2.toFixed(1);
            document.getElementById(`pos${idx}-angle3`).value = state.positions[state.draggingPosition].angle3.toFixed(1);
          }

          // Also update modal inputs if modal is visible
          syncSettingsModal();

          // Save to localStorage
          saveSettings();
        }
      }

      draw();
      return;
    }

    // If dragging the slider, update the value
    if(state.draggingSlider){
      const slider = config.slider;
      const clampedX = Math.max(slider.x, Math.min(px, slider.x + slider.width)); // Clamp position
      const valueRatio = (clampedX - slider.x) / slider.width; // Normalize (0-1)
      state.sliderValue = slider.min + valueRatio * (slider.max - slider.min); // Map to slider range
      state.angleMultiplier = state.sliderValue / 100; // Update the multiplier

      draw(); // Redraw to reflect changes
    }

    // Handle joystick movement
    if(joystick.isDragging){
      updateJoystickKnob(px, py);
      return;
    }

    const midEnd = middleEnd();
    const seatEndPt = seatEnd();
    const rightArmEndPt = rightArmEnd();
    const dMid = pointToSegmentDistance(px,py, config.basePivot.x, config.basePivot.y, midEnd.x, midEnd.y);
    const dSeat = pointToSegmentDistance(px,py, midEnd.x, midEnd.y, seatEndPt.x, seatEndPt.y);
    const dBackrest = pointToSegmentDistance(px,py, seatEndPt.x, seatEndPt.y, rightArmEndPt.x, rightArmEndPt.y);

    if(!state.dragging){
      if(dBackrest < config.hoverThreshold){ state.hovering = 'angle3'; canvas.style.cursor = 'grab'; }
      else if(dSeat < config.hoverThreshold){ state.hovering = 'angle2'; canvas.style.cursor = 'grab'; }
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
      } else if(state.dragging === 'angle3'){
        const pivot = seatEnd();
        const dx = px - pivot.x;
        const dy = py - pivot.y;
        let deg = r2d(Math.atan2(dy, dx));
        deg = -roundHalfDegree(deg) + state.angle1 - state.angle2;
        deg = constrainAngle3(deg);

        // Only update if the value actually changed
        if(deg !== state.angle3){
          state.angle3 = deg;
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

    // Check if clicking on position markers in phase graphs
    const { min: angle1Min, max: angle1Max } = getAngle1Limits();
    const { min: angle2Min, max: angle2Max } = getAngle2Limits();
    const { min: angle3Min, max: angle3Max } = getAngle3Limits();
    const angle1Range = angle1Max - angle1Min;
    const angle2Range = angle2Max - angle2Min;
    const angle3Range = angle3Max - angle3Min;
    const marginFactor = 0.05;
    const angle1MarginMin = angle1Min - (angle1Range * marginFactor);
    const angle1MarginMax = angle1Max + (angle1Range * marginFactor);
    const angle2MarginMin = angle2Min - (angle2Range * marginFactor);
    const angle2MarginMax = angle2Max + (angle2Range * marginFactor);
    const angle3MarginMin = angle3Min - (angle3Range * marginFactor);
    const angle3MarginMax = angle3Max + (angle3Range * marginFactor);
    const angle1RangeWithMargin = angle1MarginMax - angle1MarginMin;
    const angle2RangeWithMargin = angle2MarginMax - angle2MarginMin;
    const angle3RangeWithMargin = angle3MarginMax - angle3MarginMin;

    const plotX = canvas.clientWidth - 650;
    const plotX2 = plotX + 310;
    const plotY1 = 235;
    const plotY2 = plotY1 + 180 + 5; // Same height as graph + 5px gap
    const plotWidth = 300;
    const plotHeight = 180;

    function screenToData12(sx, sy){
      const xRatio = (sx - plotX) / plotWidth;
      const yRatio = (plotY1 + plotHeight - sy) / plotHeight;
      return {
        angle1: angle1MarginMin + (xRatio * angle1RangeWithMargin),
        angle2: angle2MarginMin + (yRatio * angle2RangeWithMargin)
      };
    }

    function screenToData13(sx, sy){
      const xRatio = (sx - plotX) / plotWidth;
      const yRatio = (plotY2 + plotHeight - sy) / plotHeight;
      return {
        angle1: angle1MarginMin + (xRatio * angle1RangeWithMargin),
        angle3: angle3MarginMin + (yRatio * angle3RangeWithMargin)
      };
    }

    function screenToData23(sx, sy){
      const xRatio = (sx - plotX2) / plotWidth;
      const yRatio = (plotY1 + plotHeight - sy) / plotHeight;
      return {
        angle2: angle2MarginMin + (xRatio * angle2RangeWithMargin),
        angle3: angle3MarginMin + (yRatio * angle3RangeWithMargin)
      };
    }

    function dataToScreen12(angle1, angle2){
      const xRatio = (angle1 - angle1MarginMin) / angle1RangeWithMargin;
      const x = plotX + (xRatio * plotWidth);
      const yRatio = (angle2 - angle2MarginMin) / angle2RangeWithMargin;
      const y = plotY1 + plotHeight - (yRatio * plotHeight);
      return { x, y };
    }

    function dataToScreen13(angle1, angle3){
      const xRatio = (angle1 - angle1MarginMin) / angle1RangeWithMargin;
      const x = plotX + (xRatio * plotWidth);
      const yRatio = (angle3 - angle3MarginMin) / angle3RangeWithMargin;
      const y = plotY2 + plotHeight - (yRatio * plotHeight);
      return { x, y };
    }

    function dataToScreen32(angle3, angle2){
      const xRatio = (angle3 - angle3MarginMin) / angle3RangeWithMargin;
      const x = plotX2 + (xRatio * plotWidth);
      const yRatio = (angle2 - angle2MarginMin) / angle2RangeWithMargin;
      const y = plotY1 + plotHeight - (yRatio * plotHeight);
      return { x, y };
    }

    // Check distance to all positions in angle1-angle2 graph
    for(const positionName in state.positions){
      const posScreen = dataToScreen12(state.positions[positionName].angle1, state.positions[positionName].angle2);
      const dist = Math.hypot(px - posScreen.x, py - posScreen.y);
      if(dist < 10 && px >= plotX && px <= plotX + plotWidth && py >= plotY1 && py <= plotY1 + plotHeight){
        state.draggingPosition = positionName;
        state.draggingGraph = '12'; // Dragging on angle1-angle2 graph
        canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
        draw();
        return;
      }
    }

    // Check distance to all positions in angle1-angle3 graph
    for(const positionName in state.positions){
      const posScreen = dataToScreen13(state.positions[positionName].angle1, state.positions[positionName].angle3);
      const dist = Math.hypot(px - posScreen.x, py - posScreen.y);
      if(dist < 10 && px >= plotX && px <= plotX + plotWidth && py >= plotY2 && py <= plotY2 + plotHeight){
        state.draggingPosition = positionName;
        state.draggingGraph = '13'; // Dragging on angle1-angle3 graph
        canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
        draw();
        return;
      }
    }

    // Check distance to all positions in angle3-angle2 graph
    for(const positionName in state.positions){
      const posScreen = dataToScreen32(state.positions[positionName].angle3, state.positions[positionName].angle2);
      const dist = Math.hypot(px - posScreen.x, py - posScreen.y);
      if(dist < 10 && px >= plotX2 && px <= plotX2 + plotWidth && py >= plotY1 && py <= plotY1 + plotHeight){
        state.draggingPosition = positionName;
        state.draggingGraph = '32'; // Dragging on angle3-angle2 graph
        canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
        draw();
        return;
      }
    }

    // Check if a button was clicked
    const buttonClicked = getButtonAtPoint(px, py);
    if(buttonClicked){
      if (buttonClicked === 'maintainRatioUp' || buttonClicked === 'maintainRatioDown') {
        state.buttonHeld = buttonClicked;
        // Record the starting values when the button is first pressed
        state.maintainRatioStartAngle1 = state.angle1;
        state.maintainRatioStartAngle2 = state.angle2;
        draw();
        updateHeldButton();
        return; // Exit early since we don't need drag functionality
      } else if(buttonClicked === 'canvasCheckbox'){
        // Toggle checkbox
        canvasCheckbox.checked = !canvasCheckbox.checked;
        draw();
      } else if(buttonClicked === 'imageCheckbox'){
        // Toggle checkbox
        imageCheckbox.checked = !imageCheckbox.checked;
        draw();
      } else if(buttonClicked === 'joystick'){
        // Start joystick drag
        joystick.isDragging = true;
        canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
        updateJoystickKnob(px, py);
      } else if(buttonClicked.startsWith('pos') && state.positions[buttonClicked.replace('pos', 'position')]){
        // Start animating towards the selected position
        const positionName = buttonClicked.replace('pos', 'position');
        const pos = state.positions[positionName];
        state.movingTowards = positionName;
        console.log(state.movingTowards);
        // Only set target if angle is enabled
        state.targetAngle1 = pos.angle1Enabled ? constrainAngle1(pos.angle1) : null;
        state.targetAngle2 = pos.angle2Enabled ? constrainAngle2(pos.angle2) : null;
        state.targetAngle3 = pos.angle3Enabled ? constrainAngle3(pos.angle3) : null;
        draw();
      } else {
        state.buttonHeld = buttonClicked;
        draw();
        updateHeldButton();
      }
      return;
    }

    // Check if the slider handle is clicked
    const slider = config.slider;
    const valueRatio = (state.sliderValue - slider.min) / (slider.max - slider.min);
    const handleX = slider.x + valueRatio * slider.width;
    const handleY = slider.y + slider.height / 2;

    const distance = Math.hypot(px - handleX, py - handleY);
    if(distance <= slider.handleRadius){
      state.draggingSlider = true;
      return; // Prevent other interactions while dragging slider
    }


    if(state.hovering){
      state.dragging = state.hovering;
      canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
      draw();
    }
  }

  function onPointerUp(evt){
    state.dragging = null;

    state.draggingSlider = false;

    // Update position inputs if we were dragging a position marker
    if(state.draggingPosition){
      updatePositionInputs();
    }
    state.draggingPosition = null;
    state.draggingGraph = null;
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
      if(!buttonClicked){
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
    angle3Display.textContent = `${state.angle3.toFixed(1)}°`;
  }

  // Update position input fields
  function updatePositionInputs(){
    pos1Angle1Input.value = state.positions.position1.angle1.toFixed(1);
    pos1Angle2Input.value = state.positions.position1.angle2.toFixed(1);
    pos2Angle1Input.value = state.positions.position2.angle1.toFixed(1);
    pos2Angle2Input.value = state.positions.position2.angle2.toFixed(1);
  }

  // Settings Management - localStorage functions
  const STORAGE_KEY = 'z-frame-simulator-config';

  function saveSettings() {
    const settings = {
      angle1: { min: angle1MinInput.value, max: angle1MaxInput.value },
      angle2: { min: angle2MinInput.value, max: angle2MaxInput.value },
      angle3: { min: angle3MinInput.value, max: angle3MaxInput.value },
      showGraph12: state.showGraph12,
      showGraph13: state.showGraph13,
      showGraph32: state.showGraph32,
      drawChair: state.drawChair,
      showOscilloscope: state.showOscilloscope,
      showSeatPanTrails: state.showSeatPanTrails,
      positions: {
        position1: { angle1: pos1Angle1Input.value, angle1Enabled: state.positions.position1.angle1Enabled, angle2: pos1Angle2Input.value, angle2Enabled: state.positions.position1.angle2Enabled, angle3: document.getElementById('pos1-angle3').value, angle3Enabled: state.positions.position1.angle3Enabled },
        position2: { angle1: pos2Angle1Input.value, angle1Enabled: state.positions.position2.angle1Enabled, angle2: pos2Angle2Input.value, angle2Enabled: state.positions.position2.angle2Enabled, angle3: document.getElementById('pos2-angle3').value, angle3Enabled: state.positions.position2.angle3Enabled },
        position3: { angle1: document.getElementById('pos3-angle1').value, angle1Enabled: state.positions.position3.angle1Enabled, angle2: document.getElementById('pos3-angle2').value, angle2Enabled: state.positions.position3.angle2Enabled, angle3: document.getElementById('pos3-angle3').value, angle3Enabled: state.positions.position3.angle3Enabled },
        position4: { angle1: document.getElementById('pos4-angle1').value, angle1Enabled: state.positions.position4.angle1Enabled, angle2: document.getElementById('pos4-angle2').value, angle2Enabled: state.positions.position4.angle2Enabled, angle3: document.getElementById('pos4-angle3').value, angle3Enabled: state.positions.position4.angle3Enabled },
        position5: { angle1: document.getElementById('pos5-angle1').value, angle1Enabled: state.positions.position5.angle1Enabled, angle2: document.getElementById('pos5-angle2').value, angle2Enabled: state.positions.position5.angle2Enabled, angle3: document.getElementById('pos5-angle3').value, angle3Enabled: state.positions.position5.angle3Enabled },
        position6: { angle1: document.getElementById('pos6-angle1').value, angle1Enabled: state.positions.position6.angle1Enabled, angle2: document.getElementById('pos6-angle2').value, angle2Enabled: state.positions.position6.angle2Enabled, angle3: document.getElementById('pos6-angle3').value, angle3Enabled: state.positions.position6.angle3Enabled }
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('Saved settings:', settings);
    console.log('localStorage contents:', localStorage.getItem(STORAGE_KEY));
  }

  function loadSettings() {
    console.log('loadSettings called');
    const stored = localStorage.getItem(STORAGE_KEY);
    console.log('Raw localStorage value:', stored);
    const defaults = {
      positions: {
        position1: { angle1: '15', angle2: '25', angle3: '50' },
        position2: { angle1: '35', angle2: '10', angle3: '50' },
        position3: { angle1: '10', angle2: '10', angle3: '50' },
        position4: { angle1: '15', angle2: '15', angle3: '50' },
        position5: { angle1: '20', angle2: '20', angle3: '50' },
        position6: { angle1: '25', angle2: '25', angle3: '50' }
      }
    };
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        console.log('Parsed settings:', settings);
        if (settings.angle1) {
          angle1MinInput.value = settings.angle1.min;
          angle1MaxInput.value = settings.angle1.max;
        }
        if (settings.angle2) {
          angle2MinInput.value = settings.angle2.min;
          angle2MaxInput.value = settings.angle2.max;
        }
        if (settings.angle3) {
          angle3MinInput.value = settings.angle3.min;
          angle3MaxInput.value = settings.angle3.max;
        }
        state.showGraph12 = settings.showGraph12 !== undefined ? settings.showGraph12 : true;
        state.showGraph13 = settings.showGraph13 !== undefined ? settings.showGraph13 : true;
        state.showGraph32 = settings.showGraph32 !== undefined ? settings.showGraph32 : true;
        state.drawChair = settings.drawChair !== undefined ? settings.drawChair : false;
        imageCheckbox.checked = state.drawChair;
        state.showOscilloscope = settings.showOscilloscope !== undefined ? settings.showOscilloscope : true;
        state.showSeatPanTrails = settings.showSeatPanTrails !== undefined ? settings.showSeatPanTrails : true;
        console.log('Loaded graph visibility - 12:', state.showGraph12, '13:', state.showGraph13, '32:', state.showGraph32);
        console.log('Loaded graph visibility - 12:', state.showGraph12, '13:', state.showGraph13, '32:', state.showGraph32);
        if (settings.positions) {
          pos1Angle1Input.value = settings.positions.position1.angle1;
          pos1Angle2Input.value = settings.positions.position1.angle2;
          pos2Angle1Input.value = settings.positions.position2.angle1;
          pos2Angle2Input.value = settings.positions.position2.angle2;
          document.getElementById('pos3-angle1').value = settings.positions.position3.angle1;
          document.getElementById('pos3-angle2').value = settings.positions.position3.angle2;
          document.getElementById('pos4-angle1').value = settings.positions.position4.angle1;
          document.getElementById('pos4-angle2').value = settings.positions.position4.angle2;
          document.getElementById('pos5-angle1').value = settings.positions.position5.angle1;
          document.getElementById('pos5-angle2').value = settings.positions.position5.angle2;
          document.getElementById('pos6-angle1').value = settings.positions.position6.angle1;
          document.getElementById('pos6-angle2').value = settings.positions.position6.angle2;

          // Load angle3 and enabled states
          state.positions.position1.angle3 = parseFloat(settings.positions.position1.angle3) || 50;
          state.positions.position2.angle3 = parseFloat(settings.positions.position2.angle3) || 50;
          state.positions.position3.angle3 = parseFloat(settings.positions.position3.angle3) || 50;
          state.positions.position4.angle3 = parseFloat(settings.positions.position4.angle3) || 50;
          state.positions.position5.angle3 = parseFloat(settings.positions.position5.angle3) || 50;
          state.positions.position6.angle3 = parseFloat(settings.positions.position6.angle3) || 50;

          state.positions.position1.angle1Enabled = settings.positions.position1.angle1Enabled !== false;
          state.positions.position1.angle2Enabled = settings.positions.position1.angle2Enabled !== false;
          state.positions.position1.angle3Enabled = settings.positions.position1.angle3Enabled !== false;
          state.positions.position2.angle1Enabled = settings.positions.position2.angle1Enabled !== false;
          state.positions.position2.angle2Enabled = settings.positions.position2.angle2Enabled !== false;
          state.positions.position2.angle3Enabled = settings.positions.position2.angle3Enabled !== false;
          state.positions.position3.angle1Enabled = settings.positions.position3.angle1Enabled !== false;
          state.positions.position3.angle2Enabled = settings.positions.position3.angle2Enabled !== false;
          state.positions.position3.angle3Enabled = settings.positions.position3.angle3Enabled !== false;
          state.positions.position4.angle1Enabled = settings.positions.position4.angle1Enabled !== false;
          state.positions.position4.angle2Enabled = settings.positions.position4.angle2Enabled !== false;
          state.positions.position4.angle3Enabled = settings.positions.position4.angle3Enabled !== false;
          state.positions.position5.angle1Enabled = settings.positions.position5.angle1Enabled !== false;
          state.positions.position5.angle2Enabled = settings.positions.position5.angle2Enabled !== false;
          state.positions.position5.angle3Enabled = settings.positions.position5.angle3Enabled !== false;
          state.positions.position6.angle1Enabled = settings.positions.position6.angle1Enabled !== false;
          state.positions.position6.angle2Enabled = settings.positions.position6.angle2Enabled !== false;
          state.positions.position6.angle3Enabled = settings.positions.position6.angle3Enabled !== false;
        } else {
          // Use defaults if no positions in storage
          pos1Angle1Input.value = defaults.positions.position1.angle1;
          pos1Angle2Input.value = defaults.positions.position1.angle2;
          pos2Angle1Input.value = defaults.positions.position2.angle1;
          pos2Angle2Input.value = defaults.positions.position2.angle2;
          document.getElementById('pos3-angle1').value = defaults.positions.position3.angle1;
          document.getElementById('pos3-angle2').value = defaults.positions.position3.angle2;
          document.getElementById('pos4-angle1').value = defaults.positions.position4.angle1;
          document.getElementById('pos4-angle2').value = defaults.positions.position4.angle2;
          document.getElementById('pos5-angle1').value = defaults.positions.position5.angle1;
          document.getElementById('pos5-angle2').value = defaults.positions.position5.angle2;
          document.getElementById('pos6-angle1').value = defaults.positions.position6.angle1;
          document.getElementById('pos6-angle2').value = defaults.positions.position6.angle2;
        }
        // Update state.positions
        state.positions.position1.angle1 = parseFloat(pos1Angle1Input.value);
        state.positions.position1.angle2 = parseFloat(pos1Angle2Input.value);
        state.positions.position2.angle1 = parseFloat(pos2Angle1Input.value);
        state.positions.position2.angle2 = parseFloat(pos2Angle2Input.value);
        state.positions.position3.angle1 = parseFloat(document.getElementById('pos3-angle1').value);
        state.positions.position3.angle2 = parseFloat(document.getElementById('pos3-angle2').value);
        state.positions.position4.angle1 = parseFloat(document.getElementById('pos4-angle1').value);
        state.positions.position4.angle2 = parseFloat(document.getElementById('pos4-angle2').value);
        state.positions.position5.angle1 = parseFloat(document.getElementById('pos5-angle1').value);
        state.positions.position5.angle2 = parseFloat(document.getElementById('pos5-angle2').value);
        state.positions.position6.angle1 = parseFloat(document.getElementById('pos6-angle1').value);
        state.positions.position6.angle2 = parseFloat(document.getElementById('pos6-angle2').value);
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    } else {
      // No stored settings - ensure graph visibility defaults are set
      state.showGraph12 = true;
      state.showGraph13 = false;
      state.showGraph32 = false;
      state.drawChair = false;
      state.showOscilloscope = false;
      state.showSeatPanTrails = false;
    }
    // Always sync the modal to reflect current state, regardless of whether we loaded or are using defaults
    syncSettingsModal();
  }

  function syncSettingsModal() {
    console.log('syncSettingsModal - setting checkbox states: 12=', state.showGraph12, '13=', state.showGraph13, '32=', state.showGraph32);
    document.getElementById('settings-angle1-min').value = angle1MinInput.value;
    document.getElementById('settings-angle1-max').value = angle1MaxInput.value;
    document.getElementById('settings-angle2-min').value = angle2MinInput.value;
    document.getElementById('settings-angle2-max').value = angle2MaxInput.value;
    document.getElementById('settings-angle3-min').value = angle3MinInput.value;
    document.getElementById('settings-angle3-max').value = angle3MaxInput.value;
    document.getElementById('settings-show-graph12').checked = state.showGraph12;
    document.getElementById('settings-show-graph13').checked = state.showGraph13;
    document.getElementById('settings-show-graph32').checked = state.showGraph32;
    document.getElementById('settings-draw-chair').checked = state.drawChair;
    document.getElementById('settings-show-oscilloscope').checked = state.showOscilloscope;
    document.getElementById('settings-show-seatpantrails').checked = state.showSeatPanTrails;
    console.log('After sync - checkboxes: 12=', document.getElementById('settings-show-graph12').checked, '13=', document.getElementById('settings-show-graph13').checked, '32=', document.getElementById('settings-show-graph32').checked);
    document.getElementById('settings-pos1-angle1').value = pos1Angle1Input.value;
    document.getElementById('settings-pos1-angle1-enabled').checked = state.positions.position1.angle1Enabled;
    document.getElementById('settings-pos1-angle2').value = pos1Angle2Input.value;
    document.getElementById('settings-pos1-angle2-enabled').checked = state.positions.position1.angle2Enabled;
    document.getElementById('settings-pos1-angle3').value = state.positions.position1.angle3;
    document.getElementById('settings-pos1-angle3-enabled').checked = state.positions.position1.angle3Enabled;
    document.getElementById('settings-pos2-angle1').value = pos2Angle1Input.value;
    document.getElementById('settings-pos2-angle1-enabled').checked = state.positions.position2.angle1Enabled;
    document.getElementById('settings-pos2-angle2').value = pos2Angle2Input.value;
    document.getElementById('settings-pos2-angle2-enabled').checked = state.positions.position2.angle2Enabled;
    document.getElementById('settings-pos2-angle3').value = state.positions.position2.angle3;
    document.getElementById('settings-pos2-angle3-enabled').checked = state.positions.position2.angle3Enabled;
    document.getElementById('settings-pos3-angle1').value = document.getElementById('pos3-angle1').value;
    document.getElementById('settings-pos3-angle1-enabled').checked = state.positions.position3.angle1Enabled;
    document.getElementById('settings-pos3-angle2').value = document.getElementById('pos3-angle2').value;
    document.getElementById('settings-pos3-angle2-enabled').checked = state.positions.position3.angle2Enabled;
    document.getElementById('settings-pos3-angle3').value = state.positions.position3.angle3;
    document.getElementById('settings-pos3-angle3-enabled').checked = state.positions.position3.angle3Enabled;
    document.getElementById('settings-pos4-angle1').value = document.getElementById('pos4-angle1').value;
    document.getElementById('settings-pos4-angle1-enabled').checked = state.positions.position4.angle1Enabled;
    document.getElementById('settings-pos4-angle2').value = document.getElementById('pos4-angle2').value;
    document.getElementById('settings-pos4-angle2-enabled').checked = state.positions.position4.angle2Enabled;
    document.getElementById('settings-pos4-angle3').value = state.positions.position4.angle3;
    document.getElementById('settings-pos4-angle3-enabled').checked = state.positions.position4.angle3Enabled;
    document.getElementById('settings-pos5-angle1').value = document.getElementById('pos5-angle1').value;
    document.getElementById('settings-pos5-angle1-enabled').checked = state.positions.position5.angle1Enabled;
    document.getElementById('settings-pos5-angle2').value = document.getElementById('pos5-angle2').value;
    document.getElementById('settings-pos5-angle2-enabled').checked = state.positions.position5.angle2Enabled;
    document.getElementById('settings-pos5-angle3').value = state.positions.position5.angle3;
    document.getElementById('settings-pos5-angle3-enabled').checked = state.positions.position5.angle3Enabled;
    document.getElementById('settings-pos6-angle1').value = document.getElementById('pos6-angle1').value;
    document.getElementById('settings-pos6-angle1-enabled').checked = state.positions.position6.angle1Enabled;
    document.getElementById('settings-pos6-angle2').value = document.getElementById('pos6-angle2').value;
    document.getElementById('settings-pos6-angle2-enabled').checked = state.positions.position6.angle2Enabled;
    document.getElementById('settings-pos6-angle3').value = state.positions.position6.angle3;
    document.getElementById('settings-pos6-angle3-enabled').checked = state.positions.position6.angle3Enabled;
  }

  function applySettingsFromModal() {
    angle1MinInput.value = document.getElementById('settings-angle1-min').value;
    angle1MaxInput.value = document.getElementById('settings-angle1-max').value;
    angle2MinInput.value = document.getElementById('settings-angle2-min').value;
    angle2MaxInput.value = document.getElementById('settings-angle2-max').value;
    angle3MinInput.value = document.getElementById('settings-angle3-min').value;
    angle3MaxInput.value = document.getElementById('settings-angle3-max').value;
    state.showGraph12 = document.getElementById('settings-show-graph12').checked;
    state.showGraph13 = document.getElementById('settings-show-graph13').checked;
    state.showGraph32 = document.getElementById('settings-show-graph32').checked;
    state.drawChair = document.getElementById('settings-draw-chair').checked;
    imageCheckbox.checked = state.drawChair;
    state.showOscilloscope = document.getElementById('settings-show-oscilloscope').checked;
    state.showSeatPanTrails = document.getElementById('settings-show-seatpantrails').checked;
    pos1Angle1Input.value = document.getElementById('settings-pos1-angle1').value;
    pos1Angle2Input.value = document.getElementById('settings-pos1-angle2').value;
    pos2Angle1Input.value = document.getElementById('settings-pos2-angle1').value;
    pos2Angle2Input.value = document.getElementById('settings-pos2-angle2').value;
    document.getElementById('pos3-angle1').value = document.getElementById('settings-pos3-angle1').value;
    document.getElementById('pos3-angle2').value = document.getElementById('settings-pos3-angle2').value;
    document.getElementById('pos4-angle1').value = document.getElementById('settings-pos4-angle1').value;
    document.getElementById('pos4-angle2').value = document.getElementById('settings-pos4-angle2').value;
    document.getElementById('pos5-angle1').value = document.getElementById('settings-pos5-angle1').value;
    document.getElementById('pos5-angle2').value = document.getElementById('settings-pos5-angle2').value;
    document.getElementById('pos6-angle1').value = document.getElementById('settings-pos6-angle1').value;
    document.getElementById('pos6-angle2').value = document.getElementById('settings-pos6-angle2').value;

    // Update state.positions to match
    state.positions.position1.angle1 = parseFloat(pos1Angle1Input.value);
    state.positions.position1.angle2 = parseFloat(pos1Angle2Input.value);
    state.positions.position1.angle3 = parseFloat(document.getElementById('settings-pos1-angle3').value);
    state.positions.position2.angle1 = parseFloat(pos2Angle1Input.value);
    state.positions.position2.angle2 = parseFloat(pos2Angle2Input.value);
    state.positions.position2.angle3 = parseFloat(document.getElementById('settings-pos2-angle3').value);
    state.positions.position3.angle1 = parseFloat(document.getElementById('pos3-angle1').value);
    state.positions.position3.angle2 = parseFloat(document.getElementById('pos3-angle2').value);
    state.positions.position3.angle3 = parseFloat(document.getElementById('settings-pos3-angle3').value);
    state.positions.position4.angle1 = parseFloat(document.getElementById('pos4-angle1').value);
    state.positions.position4.angle2 = parseFloat(document.getElementById('pos4-angle2').value);
    state.positions.position4.angle3 = parseFloat(document.getElementById('settings-pos4-angle3').value);
    state.positions.position5.angle1 = parseFloat(document.getElementById('pos5-angle1').value);
    state.positions.position5.angle2 = parseFloat(document.getElementById('pos5-angle2').value);
    state.positions.position5.angle3 = parseFloat(document.getElementById('settings-pos5-angle3').value);
    state.positions.position6.angle1 = parseFloat(document.getElementById('pos6-angle1').value);
    state.positions.position6.angle2 = parseFloat(document.getElementById('pos6-angle2').value);
    state.positions.position6.angle3 = parseFloat(document.getElementById('settings-pos6-angle3').value);

    // Update enabled states
    state.positions.position1.angle1Enabled = document.getElementById('settings-pos1-angle1-enabled').checked;
    state.positions.position1.angle2Enabled = document.getElementById('settings-pos1-angle2-enabled').checked;
    state.positions.position1.angle3Enabled = document.getElementById('settings-pos1-angle3-enabled').checked;
    state.positions.position2.angle1Enabled = document.getElementById('settings-pos2-angle1-enabled').checked;
    state.positions.position2.angle2Enabled = document.getElementById('settings-pos2-angle2-enabled').checked;
    state.positions.position2.angle3Enabled = document.getElementById('settings-pos2-angle3-enabled').checked;
    state.positions.position3.angle1Enabled = document.getElementById('settings-pos3-angle1-enabled').checked;
    state.positions.position3.angle2Enabled = document.getElementById('settings-pos3-angle2-enabled').checked;
    state.positions.position3.angle3Enabled = document.getElementById('settings-pos3-angle3-enabled').checked;
    state.positions.position4.angle1Enabled = document.getElementById('settings-pos4-angle1-enabled').checked;
    state.positions.position4.angle2Enabled = document.getElementById('settings-pos4-angle2-enabled').checked;
    state.positions.position4.angle3Enabled = document.getElementById('settings-pos4-angle3-enabled').checked;
    state.positions.position5.angle1Enabled = document.getElementById('settings-pos5-angle1-enabled').checked;
    state.positions.position5.angle2Enabled = document.getElementById('settings-pos5-angle2-enabled').checked;
    state.positions.position5.angle3Enabled = document.getElementById('settings-pos5-angle3-enabled').checked;
    state.positions.position6.angle1Enabled = document.getElementById('settings-pos6-angle1-enabled').checked;
    state.positions.position6.angle2Enabled = document.getElementById('settings-pos6-angle2-enabled').checked;
    state.positions.position6.angle3Enabled = document.getElementById('settings-pos6-angle3-enabled').checked;

    saveSettings();
  }

  function resetToDefaults() {
    const defaults = {
      angle1: { min: '5', max: '40' },
      angle2: { min: '5', max: '90' },
      angle3: { min: '5', max: '100' },
      positions: {
        position1: { angle1: '15', angle2: '25', angle3: '50' },
        position2: { angle1: '35', angle2: '10', angle3: '50' },
        position3: { angle1: '10', angle2: '10', angle3: '50' },
        position4: { angle1: '15', angle2: '15', angle3: '50' },
        position5: { angle1: '20', angle2: '20', angle3: '50' },
        position6: { angle1: '25', angle2: '25', angle3: '50' }
      }
    };
    angle1MinInput.value = defaults.angle1.min;
    angle1MaxInput.value = defaults.angle1.max;
    angle2MinInput.value = defaults.angle2.min;
    angle2MaxInput.value = defaults.angle2.max;
    angle3MinInput.value = defaults.angle3.min;
    angle3MaxInput.value = defaults.angle3.max;
    pos1Angle1Input.value = defaults.positions.position1.angle1;
    pos1Angle2Input.value = defaults.positions.position1.angle2;
    pos2Angle1Input.value = defaults.positions.position2.angle1;
    pos2Angle2Input.value = defaults.positions.position2.angle2;
    document.getElementById('pos3-angle1').value = defaults.positions.position3.angle1;
    document.getElementById('pos3-angle2').value = defaults.positions.position3.angle2;
    document.getElementById('pos4-angle1').value = defaults.positions.position4.angle1;
    document.getElementById('pos4-angle2').value = defaults.positions.position4.angle2;
    document.getElementById('pos5-angle1').value = defaults.positions.position5.angle1;
    document.getElementById('pos5-angle2').value = defaults.positions.position5.angle2;
    document.getElementById('pos6-angle1').value = defaults.positions.position6.angle1;
    document.getElementById('pos6-angle2').value = defaults.positions.position6.angle2;

    // Reset all enabled states to true
    state.positions.position1.angle1Enabled = true;
    state.positions.position1.angle2Enabled = true;
    state.positions.position2.angle1Enabled = true;
    state.positions.position2.angle2Enabled = true;
    state.positions.position3.angle1Enabled = true;
    state.positions.position3.angle2Enabled = true;
    state.positions.position4.angle1Enabled = true;
    state.positions.position4.angle2Enabled = true;
    state.positions.position5.angle1Enabled = true;
    state.positions.position5.angle2Enabled = true;
    state.positions.position6.angle1Enabled = true;
    state.positions.position6.angle2Enabled = true;

    state.showGraph12 = true;
    state.showGraph13 = false;
    state.showGraph32 = false;
    state.drawChair = false;
    state.showOscilloscope = false;
    state.showSeatPanTrails = false;

    syncSettingsModal();
    saveSettings();
  }

  // Settings Modal UI
  function setupSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings');
    const saveBtn = document.getElementById('save-settings');
    const resetBtn = document.getElementById('reset-settings');

    settingsBtn.addEventListener('click', () => {
      modal.style.display = 'block';
      syncSettingsModal();
    });

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    saveBtn.addEventListener('click', () => {
      applySettingsFromModal();
      modal.style.display = 'none';
    });

    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        resetToDefaults();
      }
    });

    // Add live update listeners to position inputs in modal
    const positionInputIds = [
      'settings-pos1-angle1', 'settings-pos1-angle2', 'settings-pos1-angle3',
      'settings-pos2-angle1', 'settings-pos2-angle2', 'settings-pos2-angle3',
      'settings-pos3-angle1', 'settings-pos3-angle2', 'settings-pos3-angle3',
      'settings-pos4-angle1', 'settings-pos4-angle2', 'settings-pos4-angle3',
      'settings-pos5-angle1', 'settings-pos5-angle2', 'settings-pos5-angle3',
      'settings-pos6-angle1', 'settings-pos6-angle2', 'settings-pos6-angle3'
    ];

    positionInputIds.forEach(id => {
      const input = document.getElementById(id);
      if(input){
        input.addEventListener('input', () => {
          // Update state.positions immediately
          const match = id.match(/settings-pos(\d+)-angle(\d+)/);
          if(match){
            const posNum = match[1];
            const angleNum = match[2];
            const posKey = `position${posNum}`;
            const angleKey = `angle${angleNum}`;
            state.positions[posKey][angleKey] = parseFloat(input.value) || 0;
            draw(); // Redraw chart immediately
          }
        });
      }
    });

    // Add event listeners to enabled checkboxes
    const enabledCheckboxIds = [
      'settings-pos1-angle1-enabled', 'settings-pos1-angle2-enabled', 'settings-pos1-angle3-enabled',
      'settings-pos2-angle1-enabled', 'settings-pos2-angle2-enabled', 'settings-pos2-angle3-enabled',
      'settings-pos3-angle1-enabled', 'settings-pos3-angle2-enabled', 'settings-pos3-angle3-enabled',
      'settings-pos4-angle1-enabled', 'settings-pos4-angle2-enabled', 'settings-pos4-angle3-enabled',
      'settings-pos5-angle1-enabled', 'settings-pos5-angle2-enabled', 'settings-pos5-angle3-enabled',
      'settings-pos6-angle1-enabled', 'settings-pos6-angle2-enabled', 'settings-pos6-angle3-enabled'
    ];

    enabledCheckboxIds.forEach(id => {
      const checkbox = document.getElementById(id);
      if(checkbox){
        checkbox.addEventListener('change', () => {
          // Update state.positions enabled flag immediately
          const match = id.match(/settings-pos(\d+)-angle(\d+)-enabled/);
          if(match){
            const posNum = match[1];
            const angleNum = match[2];
            const posKey = `position${posNum}`;
            const enabledKey = `angle${angleNum}Enabled`;
            state.positions[posKey][enabledKey] = checkbox.checked;
            saveSettings(); // Save immediately when toggling
            draw(); // Redraw chart immediately
          }
        });
      }
    });

    // Add event listeners to graph visibility checkboxes
    const graphCheckboxIds = ['settings-show-graph12', 'settings-show-graph13', 'settings-show-graph32'];
    graphCheckboxIds.forEach(id => {
      const checkbox = document.getElementById(id);
      if(checkbox){
        checkbox.addEventListener('change', () => {
          const match = id.match(/settings-show-graph(\d+)/);
          if(match){
            const graphNum = match[1];
            const graphKey = `showGraph${graphNum}`;
            state[graphKey] = checkbox.checked;
            saveSettings(); // Save immediately when toggling
            draw(); // Redraw chart immediately
          }
        });
      }
    });

    // Add event listener to draw chair checkbox
    const drawChairCheckbox = document.getElementById('settings-draw-chair');
    if(drawChairCheckbox){
      drawChairCheckbox.addEventListener('change', () => {
        state.drawChair = drawChairCheckbox.checked;
        imageCheckbox.checked = state.drawChair;
        saveSettings();
        draw();
      });
    }

    // Add event listener to oscilloscope checkbox
    const oscilloscopeCheckbox = document.getElementById('settings-show-oscilloscope');
    if(oscilloscopeCheckbox){
      oscilloscopeCheckbox.addEventListener('change', () => {
        state.showOscilloscope = oscilloscopeCheckbox.checked;
        saveSettings();
        draw();
      });
    }

    // Add event listener to seat pan trails checkbox
    const seatPanTrailsCheckbox = document.getElementById('settings-show-seatpantrails');
    if(seatPanTrailsCheckbox){
      seatPanTrailsCheckbox.addEventListener('change', () => {
        state.showSeatPanTrails = seatPanTrailsCheckbox.checked;
        saveSettings();
        draw();
      });
    }
  }

  // Wire events
  function addListeners(){
    setupSettingsModal();

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    window.addEventListener('resize', () => {
      layout.graphSection.x = window.innerWidth - 320; // Dynamically adjust graph position
      resizeCanvas(); // Resize the canvas and redraw everything
    });

    // Position input listeners
    pos1Angle1Input.addEventListener('change', () => {
      state.positions.position1.angle1 = parseFloat(pos1Angle1Input.value) || state.positions.position1.angle1;
      draw();
    });
    pos1Angle2Input.addEventListener('change', () => {
      state.positions.position1.angle2 = parseFloat(pos1Angle2Input.value) || state.positions.position1.angle2;
      draw();
    });
    pos2Angle1Input.addEventListener('change', () => {
      state.positions.position2.angle1 = parseFloat(pos2Angle1Input.value) || state.positions.position2.angle1;
      draw();
    });
    pos2Angle2Input.addEventListener('change', () => {
      state.positions.position2.angle2 = parseFloat(pos2Angle2Input.value) || state.positions.position2.angle2;
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
    loadSettings();
    resizeCanvas();
    addListeners();
    updateDisplays();
    draw();
    frameTimer(); // Start continuous graph recording
  }

  init();
})();
