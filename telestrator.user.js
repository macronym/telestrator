// ==UserScript==
// @name         Telestrator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Draw on the browser window.
// @author       macronym
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // --- 1. Configuration ---
    const COLORS = {
        '1': '#FFFF00',
        '2': '#32CD32',
        '3': '#FF00FF',
        '4': '#FF0000',
        '5': '#0000FF'
    };
    const SMOOTHING_THRESHOLD = 5;

    const state = {
        currentColor: COLORS['1'],
        strokeWidth: 8,
        mode: false,
        fading: false,
        drawing: false,
        erasing: false,
        currentPath: null,
        pathData: '',
        pathHistory: [],
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        lastPoint: { x: 0, y: 0 },
        drawPending: false,
        wasShiftKey: false,
        wasCtrlKey: false,
        wasAltKey: false,
        recentPoints: [],
        lastStableAngle: 0
    };

    const ui = {
        svg: null,
        pathsGroup: null,
        cursorIndicator: null,
        hud: null,
        iconEl: null,
        contentEl: null,
        statusEl: null,
        fadeStatusEl: null
    };

    // --- 2. SVG Setup ---
    function setupSvg() {
        ui.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ui.svg.style.position = 'fixed';
        ui.svg.style.top = '0';
        ui.svg.style.left = '0';
        ui.svg.style.width = '100vw';
        ui.svg.style.height = '100vh';
        ui.svg.style.zIndex = '999999999';
        ui.svg.style.pointerEvents = 'none';
        document.body.appendChild(ui.svg);

        ui.pathsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        ui.svg.appendChild(ui.pathsGroup);

        ui.cursorIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ui.cursorIndicator.setAttribute('r', state.strokeWidth / 2);
        ui.cursorIndicator.setAttribute('fill', state.currentColor);
        ui.cursorIndicator.setAttribute('stroke', '#ffffff');
        ui.cursorIndicator.setAttribute('stroke-width', '1.5');
        ui.cursorIndicator.style.filter = 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))';
        ui.cursorIndicator.style.display = 'none';
        ui.cursorIndicator.style.pointerEvents = 'none';
        ui.svg.appendChild(ui.cursorIndicator);
    }

    // --- 3. HUD Setup ---
    function setupHud() {
        ui.hud = document.createElement('div');
        ui.hud.style.position = 'fixed';
        ui.hud.style.bottom = '20px';
        ui.hud.style.right = '20px';
        ui.hud.style.zIndex = '9999999999';
        ui.hud.style.background = 'rgba(0,0,0,0.7)';
        ui.hud.style.color = 'white';
        ui.hud.style.fontFamily = 'sans-serif';
        ui.hud.style.borderRadius = '8px';
        ui.hud.style.padding = '10px';
        ui.hud.style.cursor = 'default';
        ui.hud.style.transition = 'all 0.3s ease';
        ui.hud.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

        ui.hud.innerHTML = `
            <div id="tele-icon" style="font-size:12px; text-align:center; cursor:pointer;">🖌️</div>
            <div id="tele-content" style="display:none; flex-direction:column; gap:6px; font-size:14px; margin-top:5px; white-space:nowrap;">
                <div style="font-weight:bold; border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:5px;">Telestrator HUD</div>
                <div><b>\`</b> : Toggle Mode (<span id="tele-status" style="color:#FF3333; font-weight:bold;">OFF</span>)</div>
                <div><b>1 - 5</b> : Colors (Y, G, M, R, B)</div>
                <div><b>[ or ]</b> : Stroke Width</div>
                <div><b>F</b> : Fading Strokes (<span id="tele-fade-status" style="color:#FF3333; font-weight:bold;">OFF</span>)</div>
                <div><b>Ctrl+Z</b> : Undo</div>
                <div style="margin-top:5px; border-top:1px solid #555; padding-top:10px;"><b>Mouse Actions:</b></div>
                <div><b>Left Click</b> : Draw</div>
                <div><b>Right Click</b> : Erase Line</div>
                <div><b>Middle Click</b> : Clear All</div>
                <div><b>Hold Shift</b> : Straight Line</div>
                <div><b>Hold L-Alt</b> : Draw Arrow</div>
                <div><b>Hold L-Ctrl</b>: Perfect Circle</div>
            </div>
        `;
        document.body.appendChild(ui.hud);

        ui.iconEl = ui.hud.querySelector('#tele-icon');
        ui.contentEl = ui.hud.querySelector('#tele-content');
        ui.statusEl = ui.hud.querySelector('#tele-status');
        ui.fadeStatusEl = ui.hud.querySelector('#tele-fade-status');

        ui.hud.addEventListener('mouseenter', () => {
            ui.iconEl.style.display = 'none';
            ui.contentEl.style.display = 'flex';
        });

        ui.hud.addEventListener('mouseleave', () => {
            ui.iconEl.style.display = 'block';
            ui.contentEl.style.display = 'none';
        });
    }

    function updateHUD() {
        ui.statusEl.textContent = state.mode ? 'ON' : 'OFF';
        ui.statusEl.style.color = state.mode ? '#32CD32' : '#FF3333';
        ui.fadeStatusEl.textContent = state.fading ? 'ON' : 'OFF';
        ui.fadeStatusEl.style.color = state.fading ? '#32CD32' : '#FF3333';
    }

    function setMode(enabled) {
        state.mode = enabled;
        ui.svg.style.pointerEvents = state.mode ? 'auto' : 'none';
        ui.svg.style.cursor = state.mode ? 'none' : 'default';
        ui.cursorIndicator.style.display = state.mode ? '' : 'none';

        if (state.mode) {
            ui.cursorIndicator.setAttribute('cx', state.lastX);
            ui.cursorIndicator.setAttribute('cy', state.lastY);
        } else {
            state.drawing = false;
            state.erasing = false;
            state.currentPath = null;
        }

        updateHUD();
    }

    function startPath(x, y) {
        state.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        state.currentPath.setAttribute('fill', 'none');
        state.currentPath.setAttribute('stroke', state.currentColor);
        state.currentPath.setAttribute('stroke-width', state.strokeWidth);
        state.currentPath.setAttribute('stroke-linecap', 'round');
        state.currentPath.setAttribute('stroke-linejoin', 'round');
        state.currentPath.style.filter = 'drop-shadow(2px 2px 1px rgba(0,0,0,0.8))';
        state.currentPath.style.pointerEvents = 'stroke';

        state.currentPath.addEventListener('mouseover', function () {
            if (state.erasing) this.remove();
        });

        ui.pathsGroup.appendChild(state.currentPath);
        state.pathData = `M ${x} ${y}`;
        state.currentPath.setAttribute('d', state.pathData);
    }

    function createCircleData(startX, startY, endX, endY) {
        const r = Math.hypot(endX - startX, endY - startY);
        return `M ${startX},${startY - r} A ${r},${r} 0 1,1 ${startX},${startY + r} A ${r},${r} 0 1,1 ${startX},${startY - r}`;
    }

    function updatePathForPointer(evt) {
        if (!state.currentPath) return;

        state.recentPoints.push({ x: state.lastX, y: state.lastY });
        if (state.recentPoints.length > 10) state.recentPoints.shift();

        if (evt.ctrlKey) {
            state.currentPath.setAttribute('d', createCircleData(state.startX, state.startY, state.lastX, state.lastY));
            state.wasCtrlKey = true;
            return;
        }

        if (state.wasCtrlKey) {
            state.pathData = `M ${state.startX} ${state.startY}`;
            state.lastPoint = { x: state.startX, y: state.startY };
            state.wasCtrlKey = false;
        }

        let tempPathData = state.pathData;

        if (evt.shiftKey) {
            tempPathData = `M ${state.startX} ${state.startY} L ${state.lastX} ${state.lastY}`;
            state.wasShiftKey = true;
        } else {
            if (state.wasShiftKey) {
                state.pathData = `M ${state.startX} ${state.startY} L ${state.lastX} ${state.lastY}`;
                state.lastPoint = { x: state.lastX, y: state.lastY };
                state.wasShiftKey = false;
            }

            const dist = Math.hypot(state.lastX - state.lastPoint.x, state.lastY - state.lastPoint.y);
            if (dist >= SMOOTHING_THRESHOLD) {
                const midX = (state.lastPoint.x + state.lastX) / 2;
                const midY = (state.lastPoint.y + state.lastY) / 2;
                state.pathData += ` Q ${state.lastPoint.x} ${state.lastPoint.y} ${midX} ${midY}`;
                state.lastPoint = { x: state.lastX, y: state.lastY };
            }
            tempPathData = `${state.pathData} L ${state.lastX} ${state.lastY}`;
        }

        if (evt.altKey) {
            const refPoint = evt.shiftKey ? { x: state.startX, y: state.startY } : state.recentPoints[0];
            const moveDist = Math.hypot(state.lastX - refPoint.x, state.lastY - refPoint.y);

            if (moveDist > 5 || evt.shiftKey) {
                state.lastStableAngle = Math.atan2(state.lastY - refPoint.y, state.lastX - refPoint.x);
            }

            const headLen = state.strokeWidth * 3;
            const a1 = state.lastStableAngle - Math.PI / 6;
            const a2 = state.lastStableAngle + Math.PI / 6;

            const arrowData = ` M ${state.lastX} ${state.lastY} L ${state.lastX - headLen * Math.cos(a1)} ${state.lastY - headLen * Math.sin(a1)} M ${state.lastX} ${state.lastY} L ${state.lastX - headLen * Math.cos(a2)} ${state.lastY - headLen * Math.sin(a2)}`;
            tempPathData += arrowData;
            state.wasAltKey = true;
        } else {
            state.wasAltKey = false;
        }

        state.currentPath.setAttribute('d', tempPathData);
    }

    function finishStroke() {
        if (state.drawing && state.currentPath) {
            const finalData = state.currentPath.getAttribute('d');
            state.currentPath.setAttribute('d', finalData);
            state.pathHistory.push(state.currentPath);

            if (state.fading) {
                const fadeNode = state.currentPath;
                setTimeout(() => {
                    if (fadeNode && fadeNode.parentNode) {
                        fadeNode.style.transition = 'opacity 2s ease-out';
                        fadeNode.style.opacity = '0';
                        setTimeout(() => fadeNode.remove(), 2000);
                    }
                }, 1500);
            }
        }

        state.drawing = false;
        state.currentPath = null;
        state.pathData = '';
        state.drawPending = false;
    }

    function clearBoard() {
        ui.pathsGroup.innerHTML = '';
        state.pathHistory = [];
    }

    function resetState() {
        state.drawing = false;
        state.erasing = false;
        state.currentPath = null;
        state.pathData = '';
        state.drawPending = false;
        state.wasShiftKey = false;
        state.wasCtrlKey = false;
        state.wasAltKey = false;
        state.recentPoints = [];
        state.lastStableAngle = 0;
    }

    function undoLastStroke() {
        const lastPath = state.pathHistory.pop();
        if (lastPath && lastPath.parentNode) {
            lastPath.remove();
        }
    }

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        if (state.mode && (e.key === 'Alt' || e.altKey)) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (e.key === '`') {
            e.preventDefault();
            setMode(!state.mode);
        }

        if (!state.mode) return;

        if (['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault();
            state.currentColor = COLORS[e.key];
            ui.cursorIndicator.setAttribute('fill', state.currentColor);
        }

        if (e.key === '[') {
            e.preventDefault();
            state.strokeWidth = Math.max(2, state.strokeWidth - 2);
            ui.cursorIndicator.setAttribute('r', state.strokeWidth / 2);
        }

        if (e.key === ']') {
            e.preventDefault();
            state.strokeWidth = Math.min(40, state.strokeWidth + 2);
            ui.cursorIndicator.setAttribute('r', state.strokeWidth / 2);
        }

        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            state.fading = !state.fading;
            updateHUD();
        }

        if (e.key.toLowerCase() === 'z' && e.ctrlKey) {
            e.preventDefault();
            undoLastStroke();
        }
    }

    function handleMouseDown(e) {
        if (!state.mode) return;
        e.preventDefault();

        if (e.button === 0) { // Left click
            state.drawing = true;
            state.startX = state.lastX;
            state.startY = state.lastY;
            state.lastPoint = { x: state.lastX, y: state.lastY };
            state.wasShiftKey = false;
            state.wasCtrlKey = false;
            state.wasAltKey = false;
            state.recentPoints = [{ x: state.lastX, y: state.lastY }];
            state.lastStableAngle = 0;
            startPath(state.lastX, state.lastY);
        } else if (e.button === 2) { // Right click
            state.erasing = true;
            if (e.target.tagName && e.target.tagName.toLowerCase() === 'path') {
                e.target.remove();
            }
        } else if (e.button === 1) { // Scroll wheel click / Middle click
            clearBoard();
        }
    }

    function handleMouseMove(e) {
        state.lastX = e.clientX;
        state.lastY = e.clientY;

        if (!state.mode) return;

        ui.cursorIndicator.setAttribute('cx', state.lastX);
        ui.cursorIndicator.setAttribute('cy', state.lastY);

        if (state.drawing && state.currentPath && !state.drawPending) {
            state.drawPending = true;
            requestAnimationFrame(() => {
                if (!state.currentPath) {
                    state.drawPending = false;
                    return;
                }

                updatePathForPointer(e);
                state.drawPending = false;
            });
        }

        if (state.erasing && e.target.tagName && e.target.tagName.toLowerCase() === 'path') {
            e.target.remove();
        }
    }

    function handleMouseUp(e) {
        if (!state.mode) return;

        if (e.button === 0) {
            finishStroke();
        } else if (e.button === 2) {
            state.erasing = false;
        }
    }

    function handleKeyUp(e) {
        if (!state.mode) return;

        if (e.key === "Alt") {
            e.preventDefault();
            e.stopPropagation();
            state.wasAltKey = false;
        }
    }

    // --- 4. Initialization ---
    setupSvg();
    setupHud();
    updateHUD();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', (e) => {
        if (state.mode) e.preventDefault();
    });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
})();
