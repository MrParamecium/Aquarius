// brief-fallback — extracted from app.js Phase 3 PR #21 (hydrateInteractiveDemos dispatcher split).
// Loaded as a classic <script> BEFORE app.js. Reaches into the shared script-global
// lexical env for helpers (no bundler, no IIFE, no module.exports).
//
// External globals used at call time:
//   - escapeHtml, decodeInlineMarkdownFragment, getInteractiveDemoTitle, getInteractiveDemoText (app.js)
//
// Public surface (free-name lookup from the dispatcher in app.js):
//   - the top-level function defined below

function renderBriefDemoFallback(node, demo, family = 'brief') {
  const title = getInteractiveDemoTitle(demo, 'Interactive demo');
  const subtitle = getInteractiveDemoSubtitle(demo);
  const spec = getInteractiveDemoSpec(demo);
  const teachingEmphasis = compactWhitespace(
    spec.student_prompt
    || spec.description
    || spec.what_to_notice
    || subtitle
    || ''
  );

  node.innerHTML = `
    <section class="interactive-demo-shell interactive-demo-shell--brief interactive-demo-shell--${escapeHtml(family)}">
      <div class="interactive-demo-head">
        <div class="interactive-demo-title">${escapeHtml(title)}</div>
        <div class="interactive-demo-subtitle">${escapeHtml(subtitle || 'This section is ready to teach, with a compact brief instead of a blank panel.')}</div>
      </div>
      <div class="interactive-demo-brief-card">
        <div class="interactive-demo-brief-label">Teaching emphasis</div>
        <div class="interactive-demo-brief-copy">${escapeHtml(teachingEmphasis)}</div>
      </div>
      <div class="interactive-demo-readouts">
        ${spec.note_below_demo ? `<div class="interactive-demo-readout"><strong>Note:</strong> ${decodeInlineMarkdownFragment(escapeHtml(spec.note_below_demo))}</div>` : ''}
        ${spec.student_prompt ? `<div class="interactive-demo-readout"><strong>Prompt:</strong> ${escapeHtml(spec.student_prompt)}</div>` : ''}
        ${spec.observation_prompt ? `<div class="interactive-demo-readout"><strong>Observe:</strong> ${escapeHtml(spec.observation_prompt)}</div>` : ''}
      </div>
    </section>
  `;

  const shellEl = node.querySelector('.interactive-demo-shell');
  if (shellEl) shellEl.classList.toggle('is-narrow', shellEl.clientWidth < 760);
}
