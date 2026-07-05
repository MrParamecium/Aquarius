// phasor — extracted from app.js Phase 3 PR #21 (hydrateInteractiveDemos dispatcher split).
// Loaded as a classic <script> BEFORE app.js. Reaches into the shared script-global lexical env.
//
// External globals used at call time:
//   - escapeHtml, decodeInlineMarkdownFragment                              (app.js)
//   - applyCanvasDpr, drawCanvasArrow, coalesceFrames                       (helpers.js — Phase 3 Step F)
//   - window.typesetMath, window.ResizeObserver                             (CDN / browser)
//
// Public surface (free-name lookup from the dispatcher in app.js):
//   - renderPhasorDemo(node, demo, demoSpec)
// Preserve `node._phasorResizeObserver` — introspected by external callers.

function renderPhasorDemo(node, demo, demoControls, demoSpec) {
      // PH-4: prefer the dispatcher-resolved demoControls (which already falls back
      // to demo.controls) over demoSpec.controls, so a phasor demo authored with
      // top-level demo.controls renders its panel instead of collapsing to the
      // hardcoded slider_a=1 / slider_b=-1.732 defaults + an empty control panel.
      const spec = demoSpec || {};
      const controls = (Array.isArray(demoControls) && demoControls.length)
        ? demoControls
        : (Array.isArray(spec.controls) ? spec.controls : []);
      const state = Object.create(null);
      controls.forEach((control) => {
        const key = control.id || control.key;
        if (!key) return;
        if (Array.isArray(control.options)) {
          state[key] = control.default || control.options[0] || 'degrees';
          return;
        }
        if (String(control.action || '').startsWith('set ')) return;
        state[key] = Number(control.default ?? control.min ?? 0);
      });
      if (!Object.prototype.hasOwnProperty.call(state, 'slider_a')) state.slider_a = 1;
      if (!Object.prototype.hasOwnProperty.call(state, 'slider_b')) state.slider_b = -1.732;
      if (!Object.prototype.hasOwnProperty.call(state, 'angle_toggle')) state.angle_toggle = 'degrees';

      node.innerHTML = `
        <section class="phasor-demo-shell">
          <div class="phasor-demo-head">
            <div class="phasor-demo-title">${escapeHtml(demo.title || 'Interactive demo')}</div>
            <div class="phasor-demo-subtitle">${escapeHtml(demo.explanation || '')}</div>
          </div>
          <div class="phasor-demo-intro">${decodeInlineMarkdownFragment(demo.content || '')}</div>
          <div class="phasor-demo-grid">
            <div class="phasor-demo-left">
              <div class="phasor-demo-controls"></div>
              <div class="phasor-demo-readouts"></div>
              <div class="phasor-demo-formula"></div>
            </div>
            <div class="phasor-demo-right">
              <div class="phasor-demo-canvas-wrap">
                <canvas class="phasor-demo-canvas phasor-demo-plane"></canvas>
              </div>
              <div class="phasor-demo-canvas-wrap">
                <canvas class="phasor-demo-canvas phasor-demo-wave"></canvas>
              </div>
            </div>
          </div>
        </section>
      `;

      const controlsEl = node.querySelector('.phasor-demo-controls');
      const readoutsEl = node.querySelector('.phasor-demo-readouts');
      const formulaEl = node.querySelector('.phasor-demo-formula');
      const planeCanvas = node.querySelector('.phasor-demo-plane');
      const waveCanvas = node.querySelector('.phasor-demo-wave');
      const planeCtx = planeCanvas && planeCanvas.getContext ? planeCanvas.getContext('2d') : null;
      const waveCtx = waveCanvas && waveCanvas.getContext ? waveCanvas.getContext('2d') : null;
      const shellEl = node.querySelector('.phasor-demo-shell');

      const toRadians = (deg) => (deg * Math.PI) / 180;
      const formatNum = (value) => {
        if (!Number.isFinite(value)) return '0';
        const rounded = Math.abs(value) < 1e-9 ? 0 : value;
        return Number(rounded.toFixed(3)).toString();
      };
      const getA = () => Number(state.slider_a ?? 1);
      const getB = () => Number(state.slider_b ?? -1.732);
      const getThetaRad = () => Math.atan2(-getB(), getA());
      const getThetaDeg = () => (getThetaRad() * 180) / Math.PI;
      const getC = () => Math.sqrt((getA() ** 2) + (getB() ** 2));
      const formatAngle = () => {
        const deg = getThetaDeg();
        if (state.angle_toggle === 'radians') return `${formatNum(getThetaRad())} rad`;
        return `${formatNum(deg)}°`;
      };

      const sizeCanvas = (canvas, ctx, height) => {
        if (!canvas || !ctx) return { width: 0, height: 0 };
        const parentEl = canvas.parentElement;
        const parentStyle = parentEl ? window.getComputedStyle(parentEl) : null;
        const horizontalPadding = parentStyle
          ? (parseFloat(parentStyle.paddingLeft) || 0) + (parseFloat(parentStyle.paddingRight) || 0)
          : 0;
        const availableWidth = Math.floor((parentEl ? parentEl.clientWidth : 0) - horizontalPadding);
        const width = Math.max(availableWidth || 0, 160);
        return applyCanvasDpr(canvas, ctx, width, height);
      };

      const drawArrow = (ctx, x1, y1, x2, y2, color) => {
        drawCanvasArrow(ctx, x1, y1, x2, y2, color);
      };

      const drawPlane = () => {
        if (!planeCtx) return;
        const { width, height } = sizeCanvas(planeCanvas, planeCtx, 320);
        planeCtx.clearRect(0, 0, width, height);
        planeCtx.fillStyle = '#ffffff';
        planeCtx.fillRect(0, 0, width, height);
        const originX = width * 0.28;
        const originY = height * 0.72;
        const scale = Math.min(width, height) / 14;
        planeCtx.strokeStyle = '#cbd5e1';
        planeCtx.lineWidth = 1.5;
        planeCtx.beginPath();
        planeCtx.moveTo(32, originY);
        planeCtx.lineTo(width - 18, originY);
        planeCtx.moveTo(originX, 20);
        planeCtx.lineTo(originX, height - 24);
        planeCtx.stroke();

        planeCtx.fillStyle = '#64748b';
        planeCtx.font = '600 14px Inter, sans-serif';
        planeCtx.fillText('Re', width - 34, originY - 10);
        planeCtx.fillText('Im', originX + 10, 30);

        const a = getA();
        const b = getB();
        const px = originX + a * scale;
        const py = originY + b * scale;
        const projY = originY;

        drawArrow(planeCtx, originX, originY, px, projY, '#1d4ed8');
        drawArrow(planeCtx, px, projY, px, py, '#0f766e');
        drawArrow(planeCtx, originX, originY, px, py, '#dc2626');

        planeCtx.fillStyle = '#1d4ed8';
        planeCtx.fillText('a', (originX + px) / 2, projY - 12);
        planeCtx.fillStyle = '#0f766e';
        planeCtx.fillText('-jb', px + 8, (projY + py) / 2);
        planeCtx.fillStyle = '#dc2626';
        planeCtx.fillText('C∠θ', (originX + px) / 2 + 10, (originY + py) / 2 - 10);

        planeCtx.beginPath();
        planeCtx.fillStyle = '#0f172a';
        planeCtx.arc(px, py, 4, 0, Math.PI * 2);
        planeCtx.fill();
      };

      const drawWave = () => {
        if (!waveCtx) return;
        const { width, height } = sizeCanvas(waveCanvas, waveCtx, 220);
        waveCtx.clearRect(0, 0, width, height);
        waveCtx.fillStyle = '#ffffff';
        waveCtx.fillRect(0, 0, width, height);
        const midY = height / 2;
        const left = 24;
        const right = width - 18;
        const top = 18;
        const bottom = height - 24;
        waveCtx.strokeStyle = '#cbd5e1';
        waveCtx.lineWidth = 1.5;
        waveCtx.beginPath();
        waveCtx.moveTo(left, midY);
        waveCtx.lineTo(right, midY);
        waveCtx.moveTo(left, top);
        waveCtx.lineTo(left, bottom);
        waveCtx.stroke();

        const a = getA();
        const b = getB();
        const c = getC();
        const theta = getThetaRad();
        const drawCurve = (fn, color) => {
          waveCtx.beginPath();
          waveCtx.strokeStyle = color;
          waveCtx.lineWidth = 2.5;
          for (let i = 0; i <= 240; i += 1) {
            const t = (i / 240) * Math.PI * 2;
            const x = left + ((right - left) * i) / 240;
            const y = midY - fn(t) * (height * 0.18);
            if (i === 0) waveCtx.moveTo(x, y);
            else waveCtx.lineTo(x, y);
          }
          waveCtx.stroke();
        };
        drawCurve((t) => a * Math.cos(t), '#1d4ed8');
        drawCurve((t) => b * Math.sin(t), '#0f766e');
        drawCurve((t) => c * Math.cos(t + theta), '#dc2626');
      };

      const renderPhasor = () => {
        if (shellEl) {
          shellEl.classList.toggle('is-narrow', shellEl.clientWidth < 760);
        }
        drawPlane();
        drawWave();
        const a = getA();
        const b = getB();
        const c = getC();
        readoutsEl.innerHTML = `
          <div class="phasor-demo-readout"><strong>Phasor:</strong> \\(${formatNum(a)} - j(${formatNum(b)})\\)</div>
          <div class="phasor-demo-readout"><strong>Amplitude:</strong> \\(C = ${formatNum(c)}\\)</div>
          <div class="phasor-demo-readout"><strong>Phase:</strong> \\(\\theta = ${formatAngle()}\\)</div>
        `;
        formulaEl.innerHTML = `
          <div class="phasor-demo-formula-main">\\(x(t) = ${formatNum(c)}\\cos(\\omega_0 t ${getThetaDeg() >= 0 ? '+' : '-'} ${formatNum(Math.abs(state.angle_toggle === 'radians' ? getThetaRad() : getThetaDeg()))}${state.angle_toggle === 'radians' ? '' : '^\\circ'})\\)</div>
          <div class="phasor-demo-formula-sub">Same frequency, new amplitude and phase only.</div>
        `;
        if (window.typesetMath) {
          window.typesetMath(node).catch(() => {});
        }
      };

      controls.forEach((control) => {
        const key = control.id || control.key;
        if (!key || String(control.action || '').startsWith('set ')) return;
        const wrap = document.createElement('label');
        wrap.className = 'phasor-demo-control';
        const label = document.createElement('span');
        label.className = 'phasor-demo-control-label';
        label.textContent = control.label || key;
        wrap.appendChild(label);

        if (Array.isArray(control.options)) {
          const select = document.createElement('select');
          select.className = 'phasor-demo-select';
          control.options.forEach((option) => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            if (state[key] === option) opt.selected = true;
            select.appendChild(opt);
          });
          select.addEventListener('change', () => {
            state[key] = select.value;
            renderPhasor();
          });
          wrap.appendChild(select);
        } else {
          const row = document.createElement('div');
          row.className = 'phasor-demo-slider-row';
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(control.min ?? -5);
          input.max = String(control.max ?? 5);
          input.step = String(control.step ?? 0.1);
          input.value = String(state[key]);
          const value = document.createElement('span');
          value.className = 'phasor-demo-slider-value';
          value.textContent = formatNum(state[key]);
          input.addEventListener('input', () => {
            state[key] = Number(input.value);
            value.textContent = formatNum(state[key]);
            renderPhasor();
          });
          row.appendChild(input);
          row.appendChild(value);
          wrap.appendChild(row);
        }
        controlsEl.appendChild(wrap);
      });

      controls
        .filter((control) => String(control.action || '').startsWith('set '))
        .forEach((control) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'phasor-demo-reset';
          btn.textContent = control.label || 'Reset';
          btn.addEventListener('click', () => {
            state.slider_a = 1;
            state.slider_b = -1.732;
            const sliders = controlsEl.querySelectorAll('input[type="range"]');
            sliders.forEach((input) => {
              if (input.closest('.phasor-demo-control')?.querySelector('.phasor-demo-control-label')?.textContent === 'a') {
                input.value = String(state.slider_a);
                const value = input.parentElement.querySelector('.phasor-demo-slider-value');
                if (value) value.textContent = formatNum(state.slider_a);
              }
              if (input.closest('.phasor-demo-control')?.querySelector('.phasor-demo-control-label')?.textContent === 'b') {
                input.value = String(state.slider_b);
                const value = input.parentElement.querySelector('.phasor-demo-slider-value');
                if (value) value.textContent = formatNum(state.slider_b);
              }
            });
            renderPhasor();
          });
          controlsEl.appendChild(btn);
        });

      const rerender = coalesceFrames(renderPhasor);
      if (window.ResizeObserver && shellEl) {
        const observer = new ResizeObserver(rerender);
        observer.observe(shellEl);
        node._phasorResizeObserver = observer;
      }
      window.addEventListener('resize', rerender, { passive: true });
      // [PH-6] dispose contract: remove the window-level resize listener (which
      // otherwise keeps the whole demo closure + old node alive on every
      // re-hydration) and disconnect the observer when the app tears this demo down.
      window.__ftutorRegisterInteractiveDemoCleanup?.(node, () => {
        window.removeEventListener('resize', rerender);
        if (node._phasorResizeObserver) {
          try { node._phasorResizeObserver.disconnect(); } catch (_) {}
          node._phasorResizeObserver = null;
        }
      });
      renderPhasor();
      return;
}
