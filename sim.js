// Z-Frame Wheelchair Simulator
// Canvas and interactive mechanics

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const angleDisplay = document.getElementById('angle-display');

// Set canvas size
canvas.width = window.innerWidth - 20;
canvas.height = window. innerHeight - 150;

// Z-Frame structure configuration
const zFrame = {
    baseLength: 150,
    middleLength: 120,
    seatPanLength: 140,
    
    // Pivot points (in canvas coordinates)
    basePivot: { x: canvas.width / 3, y: canvas.height - 100 },
    middlePivot: { x: canvas.width / 2, y: canvas. height - 100 },
    
    // Angles (in radians)
    baseAngle: 0,
    middleAngle: Math.PI / 4, // 45 degrees
    seatPanAngle: Math.PI / 6, // 30 degrees
    
    // Relationship formula (default: none)
    formula: null,
    
    // Dragging state
    dragging: null,
    hovering: null
};

// Math expression evaluator (simple, safe)
function evaluateFormula(formula, angles) {
    try {
        let expr = formula
            .replace(/angle1/g, angles. angle1)
            .replace(/angle2/g, angles.angle2)
            .replace(/angle3/g, angles.angle3)
            .replace(/pi/g, Math.PI)
            .replace(/sin/g, 'Math.sin')
            .replace(/cos/g, 'Math. cos')
            .replace(/tan/g, 'Math.tan')
            .replace(/sqrt/g, 'Math.sqrt')
            .replace(/abs/g, 'Math.abs');
        
        return new Function('return ' + expr)();
    } catch (e) {
        console.error('Formula error:', e);
        return null;
    }
}

// Round to nearest 0.5 degrees
function roundAngle(radians) {
    const degrees = radians * 180 / Math.PI;
    const rounded = Math.round(degrees * 2) / 2;
    return rounded * Math.PI / 180;
}

// Get member endpoints
function getMemberEndpoints(pivot, angle, length) {
    return {
        start: pivot,
        end: {
            x: pivot.x + length * Math.cos(angle),
            y: pivot.y + length * Math.sin(angle)
        }
    };
}

// Draw Z-frame
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw base member (fixed)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(zFrame.basePivot.x - 80, zFrame.basePivot.y);
    ctx.lineTo(zFrame.basePivot.x + 80, zFrame.basePivot.y);
    ctx.stroke();
    
    // Draw middle member
    const middleEndpoints = getMemberEndpoints(zFrame.basePivot, zFrame.middleAngle, zFrame.middleLength);
    ctx.strokeStyle = zFrame.hovering === 'middle' ? '#ff6b6b' : '#444';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(middleEndpoints.start. x, middleEndpoints.start.y);
    ctx.lineTo(middleEndpoints.end.x, middleEndpoints.end. y);
    ctx.stroke();
    
    // Draw seat pan member
    const seatPanStart = middleEndpoints.end;
    const seatPanEndpoints = {
        start: seatPanStart,
        end: {
            x: seatPanStart.x + zFrame.seatPanLength * Math.cos(zFrame.seatPanAngle),
            y: seatPanStart.y + zFrame.seatPanLength * Math.sin(zFrame.seatPanAngle)
        }
    };
    ctx.strokeStyle = zFrame.hovering === 'seatpan' ? '#ff6b6b' : '#666';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(seatPanEndpoints.start. x, seatPanEndpoints.start.y);
    ctx.lineTo(seatPanEndpoints.end.x, seatPanEndpoints.end. y);
    ctx.stroke();
    
    // Draw pivot points
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(zFrame.basePivot.x, zFrame.basePivot. y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(middleEndpoints.end.x, middleEndpoints. end.y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Display angles
    const angle1Deg = (zFrame.middleAngle * 180 / Math.PI).toFixed(1);
    const angle2Deg = (zFrame.seatPanAngle * 180 / Math.PI).toFixed(1);
    
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText(`Middle Angle: ${angle1Deg}°`, 20, 30);
    ctx.fillText(`Seat Pan Angle: ${angle2Deg}°`, 20, 60);
    
    if (zFrame.formula) {
        ctx.fillText(`Formula: ${zFrame.formula}`, 20, 90);
    }
}

// Mouse events
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect. top;
    
    // Check if hovering over members
    const middleEndpoints = getMemberEndpoints(zFrame.basePivot, zFrame.middleAngle, zFrame.middleLength);
    const distToMiddle = pointToLineDistance(
        { x: mouseX, y: mouseY },
        middleEndpoints.start,
        middleEndpoints.end
    );
    
    const seatPanStart = middleEndpoints.end;
    const seatPanEndpoints = {
        start: seatPanStart,
        end: {
            x: seatPanStart.x + zFrame.seatPanLength * Math.cos(zFrame.seatPanAngle),
            y: seatPanStart.y + zFrame.seatPanLength * Math.sin(zFrame.seatPanAngle)
        }
    };
    const distToSeatPan = pointToLineDistance(
        { x: mouseX, y: mouseY },
        seatPanEndpoints.start,
        seatPanEndpoints.end
    );
    
    if (distToMiddle < 15) {
        zFrame.hovering = 'middle';
        canvas.style.cursor = 'grab';
    } else if (distToSeatPan < 15) {
        zFrame.hovering = 'seatpan';
        canvas.style.cursor = 'grab';
    } else {
        zFrame.hovering = null;
        canvas.style.cursor = 'default';
    }
    
    // Handle dragging
    if (zFrame. dragging) {
        const angle = Math.atan2(mouseY - zFrame.basePivot.y, mouseX - zFrame.basePivot.x);
        
        if (zFrame.dragging === 'middle') {
            zFrame.middleAngle = roundAngle(angle);
            
            // Apply formula if set
            if (zFrame.formula) {
                const newAngle = evaluateFormula(zFrame.formula, {
                    angle1: zFrame.middleAngle,
                    angle2: zFrame.seatPanAngle,
                    angle3: zFrame.baseAngle
                });
                if (newAngle !== null) {
                    zFrame.seatPanAngle = roundAngle(newAngle);
                }
            }
        } else if (zFrame.dragging === 'seatpan') {
            const seatPanPivot = getMemberEndpoints(zFrame.basePivot, zFrame.middleAngle, zFrame.middleLength).end;
            zFrame.seatPanAngle = roundAngle(Math.atan2(mouseY - seatPanPivot.y, mouseX - seatPanPivot.x));
        }
    }
    
    draw();
});

canvas.addEventListener('mousedown', (e) => {
    if (zFrame.hovering) {
        zFrame.dragging = zFrame.hovering;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mouseup', () => {
    zFrame.dragging = null;
    canvas.style.cursor = 'default';
});

canvas.addEventListener('mouseleave', () => {
    zFrame.dragging = null;
    zFrame.hovering = null;
    canvas.style.cursor = 'default';
});

// Utility:  Point to line distance
function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math. sqrt(dx * dx + dy * dy);
}

// Initialize
draw();

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 20;
    canvas.height = window.innerHeight - 150;
    draw();
});
