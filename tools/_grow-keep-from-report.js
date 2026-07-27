#!/usr/bin/env node
/**
 * _grow-keep-from-report.js — TEMP scratch (Phase 3.6a iteration helper).
 *
 * Read the latest _view-cascade-report.md, parse flips, and grow
 * _keep-important.json with every candidate from _view-important.json that
 * could plausibly explain each flip:
 *   - candidate.prop matches the flipped prop (or rect-flip → ALL geometry props
 *     touching that element), AND
 *   - candidate.selector contains ANY token from the flipped element's
 *     `tagName`, `#id`, or `.class` set.
 *
 * This OVER-keeps (a candidate may not be the actual cascade winner before strip),
 * but over-keeping is the safe direction: we miss true strippables (lower
 * conversion %), we never strip a load-bearing rule. The loop converges as the
 * keep-set monotonically grows and re-strip + re-check narrows the flip set.
 *
 *   1. node tools/_strip-view-important.js --view=feedback
 *   2. node tools/_view-cascade-probe.js --check       # writes _view-cascade-report.md
 *   3. node tools/_grow-keep-from-report.js            # grows _keep-important.json
 *   4. goto 1 until PASS
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPORT = path.join(__dirname, '_view-cascade-report.md');
const KEEP = path.join(__dirname, '_keep-important.json');
const CAND = path.join(__dirname, '_view-important.json');

const FORCE_MIXED = process.argv.includes('--force-mixed');
const report = fs.existsSync(REPORT) ? fs.readFileSync(REPORT, 'utf8') : '';
const cand = JSON.parse(fs.readFileSync(CAND, 'utf8'));
const keep = new Set(fs.existsSync(KEEP) ? JSON.parse(fs.readFileSync(KEEP, 'utf8')) : []);
const startSize = keep.size;

// Flatten candidates with target-view tag.
const candidates = [];
for (const [view, list] of Object.entries(cand)) {
  for (const d of list) candidates.push({ view, ...d });
}

// CSS-token word-boundary regex. A token is `.sidebar`, `#settingsView`, etc.;
// it must NOT match `.sidebar-collapsed`, `.sidebar-toggle`, `.app-sidebar`,
// or `#settingsSaveBtnIcon`. CSS identifier chars are [A-Za-z0-9_-]; a token
// match ends at any non-ident char (space, `.`, `#`, `:`, `>`, `+`, `~`, `,`,
// `[`, `{`, end-of-string). The leading boundary is start-of-string or any
// non-ident char EXCEPT `.`/`#` (those are part of token's own leading char).
function tokenRe(token) {
  // Token already begins with `.` or `#`; we just need a trailing boundary.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped + '(?![A-Za-z0-9_-])');
}
function selectorMatchesToken(selector, token) {
  return tokenRe(token).test(selector);
}

// --force-mixed: pre-load the keep-set with every candidate whose selector has
// a non-target arm (cross-cutting grouped rules). Stripping !important from
// such a rule affects every arm (cascade-arbiter would only catch the flips
// on probed subtrees), so force-keep them up front.
if (FORCE_MIXED) {
  let mixedAdded = 0;
  for (const c of candidates) {
    const arms = c.selector.split(',').map(s => s.trim()).filter(Boolean);
    const target = c.view;          // e.g. '.sidebar' or '#settingsView'
    // Use word-boundary matching: `.sidebar-collapsed` arm is NOT a `.sidebar`
    // arm (different element). `:root[data-theme=...]` and `@media` wrappers
    // count as target-arms (they affect the same subtree's cascade context).
    const isMixed = arms.some(arm =>
      !selectorMatchesToken(arm, target)
      && !arm.startsWith(':root')
      && !arm.startsWith('@'));
    if (isMixed && !keep.has(c.line)) { keep.add(c.line); mixedAdded++; }
  }
  console.log(`[grow-keep --force-mixed] force-kept ${mixedAdded} cross-cutting candidates`);
}

// Parse element-desc tokens from `tagName[#id][.class.class…]`.
// We deliberately DO NOT use tagName as a token because every candidate is
// anchored on a view-root token already, and tag-matches (`div` in particular)
// over-keep wildly (any candidate selector containing `div` matches every
// flipping div). #id and .class tokens are precise enough.
//
// `viewRoot` is the candidate's c.view (e.g. `.sidebar` or `#settingsView`) —
// for tagless elements, that's the only safe fallback so the sentinel matches
// the view's own root rules instead of being hardcoded to feedback.
function tokensOf(desc, viewRoot) {
  const tokens = new Set();
  for (const id of desc.matchAll(/#([A-Za-z][A-Za-z0-9_-]*)/g)) {
    tokens.add('#' + id[1]);
  }
  for (const cl of desc.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) {
    tokens.add('.' + cl[1]);
  }
  // For tagless elements (e.g. plain `div`), fall back to the surface's own
  // root token — a plain `div` flip without identifying classes IS the view
  // root or a structural wrapper styled via the view's root selector. The
  // A hardcoded view root breaks convergence on tagless flips from other surfaces.
  if (tokens.size === 0) tokens.add(viewRoot);
  return tokens;
}

// Parse the report's flip lines: `- state | [idx] desc | (prop:|rect |::pe)`.
const propLineRe = /^- (?<state>.+?) \| \[(?<idx>\d+)\] (?<desc>.+?) \| (?<prop>[\w-]+(?:-[\w-]+)*): "/;
const rectLineRe = /^- (?<state>.+?) \| \[(?<idx>\d+)\] (?<desc>.+?) \| rect /;
const pseudoLineRe = /^- (?<state>.+?) \| \[(?<idx>\d+)\] (?<desc>.+?) \| ::(?<pe>before|after|placeholder) /;

// Geometry/layout props grouped together — a rect flip on element X means we
// should keep every !important on X's layout-affecting props (any of these can
// have driven the box change).
const RECT_PROPS = new Set([
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border', 'border-width', 'border-style', 'border-left', 'border-right',
  'top', 'right', 'bottom', 'left', 'inset',
  'display', 'position', 'box-sizing', 'flex', 'flex-basis', 'flex-direction',
  'flex-grow', 'flex-shrink', 'flex-wrap', 'gap', 'grid-column', 'grid-row',
  'grid-template-columns', 'align-items', 'align-self', 'justify-content',
  'justify-self', 'place-items', 'overflow', 'overflow-y', 'visibility',
  'transform', 'font-size', 'line-height', 'letter-spacing',
]);
// Pseudo flips ⇒ keep ::before/::after-relevant props on the element.
const PSEUDO_PROPS = new Set([
  'content', 'background', 'background-image', 'background-color', 'color',
  'opacity', 'transform', 'box-shadow', 'border-color', 'width', 'height',
  'display', 'top', 'left', 'right', 'bottom', 'position',
]);

// `desc` lives in a state row like `sidebar-expanded | dawn | 1280 | rest | [N] desc`;
// derive the candidate-view from the state's first segment so tagless fallback
// uses the right view root. The state-prefix is the probe's view.id (e.g.
// `sidebar-expanded`, `sidebar-collapsed`) while `c.view` is the candidate
// selector (for example `.sidebar`). They typically share a descriptive substring.
// Match by case-insensitive substring containment so a contributor adding a
// new view doesn't have to update this mapping. Sort candidate views by stripped-
// length DESC so the LONGEST-matching candidate wins (avoids `sidebar` losing to
// a hypothetical `side` candidate inserted earlier).
const VIEW_KEYS = [...new Set(candidates.map(c => c.view))]
  .map(v => ({ view: v, lc: v.replace(/^[#.]/, '').toLowerCase() }))
  .sort((a, b) => b.lc.length - a.lc.length);
function viewRootFor(state) {
  const first = state.split('|')[0].trim().toLowerCase();
  for (const { view, lc } of VIEW_KEYS) {
    if (first.includes(lc) || lc.includes(first)) return view;
  }
  // No view matched — should not happen in practice; return a sentinel that
  // won't accidentally match real selectors (so tagless flips on unknown
  // states simply add no candidates rather than poisoning a real view's set).
  return '__unknown_view__';
}

// elementFlips key is `desc`; we also need to remember which STATE each
// element came from so we can pick the right viewRoot. Rebuild as (state, desc).
const flipsByStateDesc = new Map();
for (const raw of report.split('\n')) {
  if (!raw.startsWith('- ')) continue;
  let m = raw.match(propLineRe);
  let prop;
  let state;
  let desc;
  if (m) { prop = m.groups.prop; state = m.groups.state; desc = m.groups.desc; }
  else if ((m = raw.match(rectLineRe))) { prop = '__rect__'; state = m.groups.state; desc = m.groups.desc; }
  else if ((m = raw.match(pseudoLineRe))) { prop = '__pseudo__'; state = m.groups.state; desc = m.groups.desc; }
  else continue;
  const key = state + ' || ' + desc;
  if (!flipsByStateDesc.has(key)) flipsByStateDesc.set(key, { state, desc, props: new Set() });
  flipsByStateDesc.get(key).props.add(prop);
}

let kept = 0;
for (const { state, desc, props } of flipsByStateDesc.values()) {
  const viewRoot = viewRootFor(state);
  const tokens = tokensOf(desc, viewRoot);
  const wantProps = new Set();
  for (const p of props) {
    if (p === '__rect__') for (const q of RECT_PROPS) wantProps.add(q);
    else if (p === '__pseudo__') for (const q of PSEUDO_PROPS) wantProps.add(q);
    else wantProps.add(p);
  }
  for (const c of candidates) {
    if (!wantProps.has(c.prop)) continue;
    // Selector must mention at least one of the element's tokens AT A CSS
    // WORD BOUNDARY — `.sidebar-collapsed` must NOT match the `.sidebar` token.
    let hit = false;
    for (const t of tokens) {
      if (selectorMatchesToken(c.selector, t)) { hit = true; break; }
    }
    if (!hit) continue;
    if (!keep.has(c.line)) { keep.add(c.line); kept++; }
  }
}

const out = [...keep].sort((a, b) => a - b);
fs.writeFileSync(KEEP, JSON.stringify(out, null, 2));
console.log(`[grow-keep] state-element flips: ${flipsByStateDesc.size}`);
console.log(`[grow-keep] keep-set: ${startSize} → ${keep.size} (+${kept})`);
console.log(`[grow-keep] wrote ${KEEP}`);
