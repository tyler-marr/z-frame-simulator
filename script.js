// Z-frame Wheelchair Simulator (vanilla JS)
// - angle1: middle member (rotates about base pivot)
// - angle2: seat pan (rotates about middle end)
// Angles displayed and expected in degrees; internal math uses degrees when evaluating user formulas.

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const angle1Display = document.getElementById('angle1-val');
  const angle2Display = document.getElementById('angle2-val');
  const formulaInput = document.getElementById('formula-input');
  const enforceCheckbox = document.getElementById('enforce-checkbox');
  const formulaError = document.getElementById('formula-error');

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
    angle2: 10, // degrees (seat pan)
    angle3: 0,  // reserved (base)
    dragging: null, // 'angle1' | 'angle2' | null
    hovering: null, // same
    formulaExpr: '', // user-entered string (right hand side, or full assignment)
    formulaFn: null, // compiled function(angle1,angle2,angle3) => number (degrees)
  };

  // Helpers
  function d2r(d){ return d * Math.PI / 180; }
  function r2d(r){ return r * 180 / Math.PI; }
  function roundHalfDegree(deg){ return Math.round(deg * 2) / 2; }

  // Canvas sizing
  function resizeCanvas(){
    // set backing store size for crisp rendering
    const width = Math.max(600, Math.min(window.innerWidth - 120, 1000));
    const height = 520;
    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

    // reposition base pivot in canvas coordinates
    config.basePivot.x = Math.round(width * 0.22);
    config.basePivot.y = Math.round(height * 0.72);
    draw();
  }

  // Geometry endpoints
  function middleEnd() {
    const a = d2r(state.angle1);
    return {
      x: config.basePivot.x + config.middleLength * Math.cos(a),
      y: config.basePivot.y + config.middleLength * Math.sin(a)
    };
  }

  function seatEnd() {
    const mid = middleEnd();
    const a = d2r(state.angle2);
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
    ctx.moveTo(config.basePivot.x - 80, config.basePivot.y);
    ctx.lineTo(config.basePivot.x + 80, config.basePivot.y);
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

    // angle text
    ctx.fillStyle = '#111';
    ctx.font = '14px system-ui,Segoe UI,Roboto,Arial';
    ctx.fillText(`Middle (angle1): ${state.angle1.toFixed(1)}°`, 14, 20);
    ctx.fillText(`Seat pan (angle2): ${state.angle2.toFixed(1)}°`, 14, 40);

    // formula display
    if(state.formulaExpr){
      ctx.fillStyle = '#444';
      ctx.fillText(`Formula: ${state.formulaExpr}`, 14, 62);
    }
  }

  // Compile user formula (basic sanitizer + compile)
  function compileFormula(raw){
    formulaError.textContent = '';
    if(!raw || !raw.trim()) { state.formulaFn = null; state.formulaExpr = ''; return; }

    // Accept either "angle2 = <expr>" or just "<expr>"
    let expr = raw.trim();
    if(/^
*angle2\s*=/.test(expr)) expr = expr.replace(/^
*angle2\s*=','').trim();

    // Replace ^ with ** for exponent; allow common functions, PI, and variables
    expr = expr.replace(/\^/g, '**');

    // Allowed tokens check — keep it simple: only allow letters, numbers, operators, parentheses, commas, dots, spaces
    const allowedChars = /^[0-9\s()+\-*/%.,*^*eEa-zA-Z_**]+$/;
    if(!allowedChars.test(expr)){
      throw new Error('Formula contains invalid characters.');
    }

    // Replace common math function names with Math.xxx
    const fnNames = ['sin','cos','tan','asin','acos','atan','sqrt','abs','min','max','round','floor','ceil','pow'];
    fnNames.forEach(fn=>{
      const re = new RegExp('\b' + fn + '\s*\(', 'g');
      expr = expr.replace(re, 'Math.' + fn + '(');
    });

    // Replace PI (case-insensitive)
    expr = expr.replace(/\bPI\b/gi, 'Math.PI');

    // Ensure variables angle1/angle2/angle3 present with word boundaries
    expr = expr.replace(/\bangle1\b/g, 'angle1').replace(/\bangle2\b/g,'angle2').replace(/\bangle3\b/g,'angle3');

    // Build a function that accepts angles in degrees and returns degrees
    const fn = new Function('angle1','angle2','angle3', 'return (' + expr + ');');
    // Test-run the function with safe numbers to catch runtime errors
    const test = fn(10, 5, 0);
    if(typeof test !== 'number' || !isFinite(test)) throw new Error('Formula did not return a finite number.');

    state.formulaFn = fn;
    state.formulaExpr = raw.trim();
  }

  // Evaluate formula mapping angle1→angle2 (angles provided in degrees)
  function applyFormulaFromAngle1(){
    if(!state.formulaFn) return;
    try {
      const res = state.formulaFn(state.angle1, state.angle2, state.angle3);
      if(typeof res === 'number' && isFinite(res)){
        state.angle2 = roundHalfDegree(res);
        updateDisplays();
      } else {
        throw new Error('Result is not a finite number');
      }
    } catch (err){
      formulaError.textContent = 'Formula error: ' + (err.message || err);
      state.formulaFn = null;
    }
  }

  // Input handlers
  function onPointerMove(evt){
    const rect = canvas.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;

    // hover logic
    const midEnd = middleEnd();
    const seatEndPt = seatEnd();
    const dMid = pointToSegmentDistance(px,py, config.basePivot.x, config.basePivot.y, midEnd.x, midEnd.y);
    const dSeat = pointToSegmentDistance(px,py, midEnd.x, midEnd.y, seatEndPt.x, seatEndPt.y);

    if(!state.dragging){
      if(dMid < config.hoverThreshold){ state.hovering = 'angle1'; canvas.style.cursor = 'grab'; }
      else if(dSeat < config.hoverThreshold){ state.hovering = 'angle2'; canvas.style.cursor = 'grab'; }
      else { state.hovering = null; canvas.style.cursor = 'default'; }
    } else {
      canvas.style.cursor = 'grabbing';
      if(state.dragging === 'angle1'){
        // rotate about basePivot
        const dx = px - config.basePivot.x;
        const dy = py - config.basePivot.y;
        let deg = r2d(Math.atan2(dy, dx));
        deg = roundHalfDegree(deg);
        state.angle1 = deg;
        // If formula enforced, update angle2 based on angle1
        if(enforceCheckbox.checked && state.formulaFn){
          applyFormulaFromAngle1();
        }
      } else if(state.dragging === 'angle2'){
        // rotate about middle end point
        const pivot = midEnd;
        const dx = px - pivot.x;
        const dy = py - pivot.y;
        let deg = r2d(Math.atan2(dy, dx));
        deg = roundHalfDegree(deg);
        state.angle2 = deg;
        // NOTE: we do not attempt to invert formula; dragging angle2 overrides formula until next angle1 edit
      }
      updateDisplays();
    }

    draw();
  }

  function onPointerDown(evt){
    if(state.hovering){
      state.dragging = state.hovering;
      canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
      draw();
    }
  }

  function onPointerUp(evt){
    state.dragging = null;
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
    // pointer events unify mouse/touch
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    // formula input
    formulaInput.addEventListener('change', () => {
      const raw = formulaInput.value.trim();
      formulaError.textContent = '';
      try {
        compileFormula(raw);
        formulaError.textContent = '';
        // If enforce is checked, apply immediately
        if(enforceCheckbox.checked && state.formulaFn){
          applyFormulaFromAngle1();
        }
      } catch(err){
        formulaError.textContent = 'Formula error: ' + (err.message || err);
        state.formulaFn = null;
      }
      draw();
    });

    enforceCheckbox.addEventListener('change', () => {
      formulaError.textContent = '';
      if(enforceCheckbox.checked && state.formulaFn){
        applyFormulaFromAngle1();
      }
      draw();
    });

    window.addEventListener('resize', resizeCanvas);
  }

  // Initialize
  function init(){
    resizeCanvas();
    addListeners();
    updateDisplays();
    // Optional: prefill placeholder example
    formulaInput.value = 'angle2 = 90 - angle1';
    try { compileFormula(formulaInput.value); } catch(e){ /* ignore */ }
    draw();
  }

  init();
})();