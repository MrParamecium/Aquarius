// sinusoid-phasor — extracted from app.js Phase 3 PR #21 (hydrateInteractiveDemos dispatcher split).
// Loaded as a classic <script> BEFORE app.js. Reaches into the shared script-global lexical env.
//
// External globals used at call time:
//   - escapeHtml                                                            (app.js)
//   - applyCanvasDpr, drawCanvasArrow, coalesceFrames                       (helpers.js — Phase 3 Step F)
//   - window.typesetMath, window.ResizeObserver                             (CDN / browser)
//
// Public surface (free-name lookup from the dispatcher in app.js):
//   - renderSinusoidPhasorDemo(node, demo, demoControls)
// Preserve `node._sinusoidResizeObserver` — introspected by external callers.

function renderSinusoidPhasorDemo(node, demo, demoControls) {
      // SP-5: honour authored controls (demo.controls / demoSpec.controls, plumbed
      // as demoControls by the dispatcher) instead of hardcoded defaults. Matching
      // is permissive (case-insensitive over id + label) because authored demos use
      // heterogeneous labels ('theta slider', 'Omega slider', …); unmatched fields
      // fall back to the original literals so unauthored demos stay byte-identical.
      // NOTE: matching convention is UNVERIFIED against real authored sinusoid
      // content — the one cached sinusoid demo (b.2) authors no controls.
      const _controls = Array.isArray(demoControls) ? demoControls : [];
      const _num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
      const _resolveControl = (re, def) => {
        const c = _controls.find((ctrl) => ctrl && (re.test(String(ctrl.id || ctrl.key || '')) || re.test(String(ctrl.label || ''))));
        if (!c) return def;
        return {
          value: _num(c.default != null ? c.default : c.value, def.value),
          min: _num(c.min, def.min),
          max: _num(c.max, def.max),
          step: _num(c.step, def.step),
        };
      };
      const ampC = _resolveControl(/amplitude|\bamp\b/i, { value: 2, min: 0.5, max: 4, step: 0.1 });
      const freqC = _resolveControl(/frequency|\bfreq\b|f_?0/i, { value: 1, min: 0.25, max: 3, step: 0.05 });
      let phaseC = _resolveControl(/phase|theta|θ/i, { value: Math.PI / 3, min: -3.14, max: 3.14, step: 0.05 });
      // Phase is kept in radians internally (display converts to degrees). Degrees
      // vs radians is genuinely ambiguous without a unit field (demos supply none),
      // so we convert to radians only when the range is clearly beyond ~2π (looks
      // like degrees); a NARROW authored degree range (e.g. ±5°) is indistinguishable
      // from radians and is assumed radians. Acceptable: the matching is best-effort
      // /UNVERIFIED (see header) and no cached sinusoid demo authors controls today.
      if (Math.abs(phaseC.min) > 6.5 || Math.abs(phaseC.max) > 6.5) {
        const _toRad = (d) => (d * Math.PI) / 180;
        phaseC = { value: _toRad(phaseC.value), min: _toRad(phaseC.min), max: _toRad(phaseC.max), step: _toRad(phaseC.step) };
      }
      const state = {
        amplitude: ampC.value,
        frequency: freqC.value,
        phase: phaseC.value,
        running: true,
        start: performance.now(),
        pausedAt: 0
      };

      node.innerHTML = `
        <section class="sinusoid-demo-shell">
          <div class="sinusoid-demo-head">
            <div>
              <div class="sinusoid-demo-title">${escapeHtml(demo.title || 'Interactive sinusoid and phasor demo')}</div>
              <div class="sinusoid-demo-subtitle">The rotating phasor's horizontal projection is the cosine waveform.</div>
            </div>
            <button type="button" class="sinusoid-demo-play" aria-label="Pause or play demo">Pause</button>
          </div>
          <div class="sinusoid-demo-grid">
            <div class="sinusoid-demo-controls">
              <label class="sinusoid-demo-control">
                <span>C amplitude</span>
                <input type="range" min="${ampC.min}" max="${ampC.max}" step="${ampC.step}" data-demo-control="amplitude" value="${ampC.value}">
                <strong data-demo-value="amplitude">2</strong>
              </label>
              <label class="sinusoid-demo-control">
                <span>f₀ frequency</span>
                <input type="range" min="${freqC.min}" max="${freqC.max}" step="${freqC.step}" data-demo-control="frequency" value="${freqC.value}">
                <strong data-demo-value="frequency">1</strong>
              </label>
              <label class="sinusoid-demo-control">
                <span>θ phase</span>
                <input type="range" min="${phaseC.min}" max="${phaseC.max}" step="${phaseC.step}" data-demo-control="phase" value="${phaseC.value}">
                <strong data-demo-value="phase">60°</strong>
              </label>
              <button type="button" class="sinusoid-demo-reset">Reset</button>
            </div>
            <div class="sinusoid-demo-stage">
              <canvas class="sinusoid-demo-canvas sinusoid-demo-wave"></canvas>
              <canvas class="sinusoid-demo-canvas sinusoid-demo-phasor"></canvas>
            </div>
          </div>
          <div class="sinusoid-demo-readout">
            <div class="sinusoid-demo-formula"></div>
            <div class="sinusoid-demo-note">Watch the red dot on the real axis. As the vector rotates, that horizontal projection becomes the red dot moving on the cosine wave.</div>
          </div>
        </section>
      `;

      const shell = node.querySelector('.sinusoid-demo-shell');
      const waveCanvas = node.querySelector('.sinusoid-demo-wave');
      const phasorCanvas = node.querySelector('.sinusoid-demo-phasor');
      const waveCtx = waveCanvas && waveCanvas.getContext ? waveCanvas.getContext('2d') : null;
      const phasorCtx = phasorCanvas && phasorCanvas.getContext ? phasorCanvas.getContext('2d') : null;
      const formulaEl = node.querySelector('.sinusoid-demo-formula');
      const playBtn = node.querySelector('.sinusoid-demo-play');
      let lastFormulaHtml = '';

      const formatValue = (value) => Number((Math.abs(value) < 1e-9 ? 0 : value).toFixed(2)).toString();
      const formatPhase = () => `${Math.round((state.phase * 180) / Math.PI)}°`;
      const elapsedSeconds = (now) => state.running
        ? state.pausedAt + ((now - state.start) / 1000)
        : state.pausedAt;
      const sizeCanvas = (canvas, ctx, fallbackHeight) => {
        if (!canvas || !ctx) return { width: 0, height: 0 };
        const rect = canvas.getBoundingClientRect();
        const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
        const width = Math.max(Math.floor(rect.width || parentWidth || 0), 180);
        return applyCanvasDpr(canvas, ctx, width, fallbackHeight);
      };
      const drawArrow = (ctx, x1, y1, x2, y2, color, width = 3) => {
        drawCanvasArrow(ctx, x1, y1, x2, y2, color, { width });
      };
      const drawGrid = (ctx, width, height, left, right, top, bottom, midY) => {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let x = left; x <= right; x += 44) {
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, bottom);
          ctx.stroke();
        }
        for (let y = top; y <= bottom; y += 34) {
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
          ctx.stroke();
        }
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(left, midY);
        ctx.lineTo(right, midY);
        ctx.stroke();
      };
      const drawDemo = (now = performance.now()) => {
        if (!node.isConnected) return;
        const t = elapsedSeconds(now);
        const omega = 2 * Math.PI * state.frequency;
        const angle = omega * t + state.phase;
        const value = state.amplitude * Math.cos(angle);
        const period = 1 / state.frequency;
        const phaseDeg = Math.round((state.phase * 180) / Math.PI);

        if (formulaEl) {
          const nextFormulaHtml = `\\(x(t) = ${formatValue(state.amplitude)}\\cos(2\\pi\\cdot ${formatValue(state.frequency)}t ${state.phase >= 0 ? '+' : '-'} ${Math.abs(phaseDeg)}^\\circ)\\), \\(T_0=${formatValue(period)}\\text{s}\\)`;
          if (nextFormulaHtml !== lastFormulaHtml) {
            lastFormulaHtml = nextFormulaHtml;
            formulaEl.innerHTML = nextFormulaHtml;
            if (window.typesetMath) window.typesetMath(formulaEl).catch(() => {});
          }
        }

        if (waveCtx) {
          const { width, height } = sizeCanvas(waveCanvas, waveCtx, 260);
          const left = 42;
          const right = width - 18;
          const top = 22;
          const bottom = height - 34;
          const midY = (top + bottom) / 2;
          const yScale = (bottom - top) / 8;
          const windowSeconds = 3;
          waveCtx.clearRect(0, 0, width, height);
          waveCtx.fillStyle = '#ffffff';
          waveCtx.fillRect(0, 0, width, height);
          drawGrid(waveCtx, width, height, left, right, top, bottom, midY);
          waveCtx.strokeStyle = '#0ea5e9';
          waveCtx.lineWidth = 2;
          waveCtx.beginPath();
          for (let i = 0; i <= 360; i += 1) {
            const localT = (i / 360) * windowSeconds;
            const x = left + ((right - left) * i) / 360;
            const y = midY - state.amplitude * Math.cos(omega * localT + state.phase) * yScale;
            if (i === 0) waveCtx.moveTo(x, y);
            else waveCtx.lineTo(x, y);
          }
          waveCtx.stroke();
          const dotT = t % windowSeconds;
          const dotX = left + ((right - left) * dotT) / windowSeconds;
          const dotY = midY - value * yScale;
          waveCtx.strokeStyle = '#ef4444';
          waveCtx.setLineDash([5, 5]);
          waveCtx.beginPath();
          waveCtx.moveTo(dotX, midY);
          waveCtx.lineTo(dotX, dotY);
          waveCtx.stroke();
          waveCtx.setLineDash([]);
          waveCtx.fillStyle = '#ef4444';
          waveCtx.beginPath();
          waveCtx.arc(dotX, dotY, 6, 0, Math.PI * 2);
          waveCtx.fill();
          waveCtx.fillStyle = '#475569';
          waveCtx.font = '700 13px Quicksand, sans-serif';
          waveCtx.fillText('cosine wave', left, top + 16);
          waveCtx.fillText('t', right - 8, midY - 8);
          waveCtx.fillText('x(t)', left + 6, top + 2);
        }

        if (phasorCtx) {
          const phasorRect = phasorCanvas.getBoundingClientRect();
          const phasorHeight = Math.max(240, Math.min(300, Math.floor(phasorRect.width || 260)));
          const { width, height } = sizeCanvas(phasorCanvas, phasorCtx, phasorHeight);
          const cx = width / 2;
          const cy = height / 2 + 4;
          const radius = Math.min(width, height) * 0.32;
          const px = cx + radius * Math.cos(angle);
          const py = cy - radius * Math.sin(angle);
          const projX = cx + radius * Math.cos(angle);
          phasorCtx.clearRect(0, 0, width, height);
          phasorCtx.fillStyle = '#ffffff';
          phasorCtx.fillRect(0, 0, width, height);
          phasorCtx.strokeStyle = '#dbeafe';
          phasorCtx.lineWidth = 2;
          phasorCtx.beginPath();
          phasorCtx.arc(cx, cy, radius, 0, Math.PI * 2);
          phasorCtx.stroke();
          phasorCtx.strokeStyle = '#94a3b8';
          phasorCtx.lineWidth = 1.5;
          phasorCtx.beginPath();
          phasorCtx.moveTo(cx - radius - 18, cy);
          phasorCtx.lineTo(cx + radius + 18, cy);
          phasorCtx.moveTo(cx, cy - radius - 18);
          phasorCtx.lineTo(cx, cy + radius + 18);
          phasorCtx.stroke();
          phasorCtx.strokeStyle = '#ef4444';
          phasorCtx.setLineDash([5, 5]);
          phasorCtx.beginPath();
          phasorCtx.moveTo(px, py);
          phasorCtx.lineTo(projX, cy);
          phasorCtx.stroke();
          phasorCtx.setLineDash([]);
          drawArrow(phasorCtx, cx, cy, px, py, '#1d4ed8', 3);
          phasorCtx.fillStyle = '#ef4444';
          phasorCtx.beginPath();
          phasorCtx.arc(projX, cy, 6, 0, Math.PI * 2);
          phasorCtx.fill();
          phasorCtx.fillStyle = '#475569';
          phasorCtx.font = '700 13px Quicksand, sans-serif';
          phasorCtx.fillText('phasor inset', 16, 24);
          phasorCtx.fillText('Re projection', cx - 38, cy + radius + 28);
        }
      };
      const updateControlLabels = () => {
        // [SP-3] null-guard each readout span (guarded block, NOT `?.textContent =`
        // which is a parse-time SyntaxError) so a template variant that omits any
        // data-demo-value span can't throw "Cannot set properties of null".
        const ampEl = node.querySelector('[data-demo-value="amplitude"]');
        if (ampEl) ampEl.textContent = formatValue(state.amplitude);
        const freqEl = node.querySelector('[data-demo-value="frequency"]');
        if (freqEl) freqEl.textContent = formatValue(state.frequency);
        const phaseEl = node.querySelector('[data-demo-value="phase"]');
        if (phaseEl) phaseEl.textContent = formatPhase();
      };
      node.querySelectorAll('[data-demo-control]').forEach((input) => {
        input.addEventListener('input', () => {
          const key = input.dataset.demoControl;
          state[key] = Number(input.value);
          updateControlLabels();
          drawDemo();
        });
      });
      // Resume playback + restore the Play/Pause label. Shared by the reset handler
      // ([SP-2]) and the play/pause toggle so the "running=true ⇒ label='Pause'"
      // pairing lives in one place and can't drift between the two call sites.
      const resume = () => {
        state.start = performance.now();
        state.running = true;
        if (playBtn) playBtn.textContent = 'Pause';
      };
      node.querySelector('.sinusoid-demo-reset')?.addEventListener('click', () => {
        state.amplitude = ampC.value;
        state.frequency = freqC.value;
        state.phase = phaseC.value;
        // Guard these like SP-3 so a missing control input can't throw and abort the
        // reset BEFORE the running=true / label restore below (which would re-freeze
        // the demo — the exact SP-2 symptom).
        const ampCtl = node.querySelector('[data-demo-control="amplitude"]');
        if (ampCtl) ampCtl.value = String(state.amplitude);
        const freqCtl = node.querySelector('[data-demo-control="frequency"]');
        if (freqCtl) freqCtl.value = String(state.frequency);
        const phaseCtl = node.querySelector('[data-demo-control="phase"]');
        if (phaseCtl) phaseCtl.value = String(state.phase);
        state.pausedAt = 0;
        // [SP-2] resume animation on reset (the demo autoplays initially). Without
        // this, Pause→Reset left running=false + pausedAt=0, so elapsedSeconds
        // returned 0 forever and the wave stayed frozen until the user hit Play.
        resume();
        updateControlLabels();
        drawDemo();
      });
      playBtn?.addEventListener('click', () => {
        if (state.running) {
          state.pausedAt = elapsedSeconds(performance.now());
          state.running = false;
          playBtn.textContent = 'Play';
        } else {
          resume();
        }
      });
      const rerender = coalesceFrames(drawDemo);
      if (window.ResizeObserver && shell) {
        const observer = new ResizeObserver(rerender);
        observer.observe(shell);
        node._sinusoidResizeObserver = observer;
      }
      const tick = (now) => {
        if (!node.isConnected) return;
        drawDemo(now);
        state.raf = window.requestAnimationFrame(tick);   // [SP-1] track the LIVE id
      };
      // [SP-1/PH-6] dispose contract: cancel the rAF loop + disconnect the observer
      // when the app tears this demo down (before an innerHTML replace), so a
      // re-hydration can never leave a second tick loop racing the first. The id is
      // reassigned at BOTH the kickoff and the recursive site so cancelAnimationFrame
      // always targets the loop's live frame, not a stale first-frame id.
      window.__ftutorRegisterInteractiveDemoCleanup?.(node, () => {
        if (state.raf) window.cancelAnimationFrame(state.raf);
        state.raf = 0;
        if (node._sinusoidResizeObserver) {
          try { node._sinusoidResizeObserver.disconnect(); } catch (_) {}
          node._sinusoidResizeObserver = null;
        }
      });
      updateControlLabels();
      state.raf = window.requestAnimationFrame(tick);      // [SP-1] track the LIVE id
      return;
}
