// lesson-render.js — extracted from app.js as seam B4 of the Workstream B
// refactor (2026-06-26). See docs/B4_LESSON_RENDER_PLAN.md for the boundary
// analysis; docs/REFACTOR_DONE.md for the overall refactor log.
//
// Cross-scope reads/writes that stay in app.js (must NOT be redeclared here):
//   - learnKnowledgePoints / currentKnowledgePointIndex / currentFullLessonHtml /
//     currentLessonTrailingHtml (KP-state lets @ app.js)
//   - learnPages / learnPageIndex / learnSectionId / learnSectionTitle /
//     learnWebData / learnAbort / learnRequestSeq / learnParentOverviewContext
//     (session lets @ app.js)
//   - _learnLayoutMode / currentBookPageIndex (orchestration lets @ app.js)
//   - compactWhitespace / parseSectionTitleParts / escapeHtml / detectLang /
//     getActiveLearnTrack (utils that stay in app.js)
//   - DOM consts: learnKpTitle / learnKpPrevBtn / learnKpNextBtn /
//     learnExplainScroll / learnExplainContent / learnBody / ...
//   - markdownToHtml / inlineFormat / decodeHtmlEntities / parseMdTable
//     (markdown-engine.js, loaded before app.js)
//   - userMemory (clerk-auth.js)
//   - parseBase64JsonAttr / decodeBase64Utf8 / decodeInlineMarkdownFragment
//     (defined in app.js util island)
//   - hydrateInteractiveDemos (dispatcher.js, loaded before app.js)
//   - lecturePrevOverlayBtn / lectureNextOverlayBtn (DOM consts @ app.js — read
//     by animateLectureNavButton which STAYS)
//
// State that moves WITH the engine (engine-exclusive writers; cross-scope reads
// from app.js are safe at runtime):
//   - learnPageTurnTimer / learnPageTurnMidTimer / isLearnPageTurning
//     (read cross-scope by staying code in app.js — runtime only, safe)
//
// Load order: included BEFORE app.js so engine entry points are defined when
// app.js binds handlers / runs orchestration.

function getTeachingRoleLabel(role) {
  switch (role) {
    case 'concept_anchor': return 'Concept anchor';
    case 'example_support': return 'Worked example';
    case 'trap_exposure': return 'Common trap';
    case 'comparison_anchor': return 'Comparison';
    case 'exam_pattern_anchor': return 'Exam pattern';
    default: return compactWhitespace(String(role || '').replace(/_/g, ' '));
  }
}

function getVisualKindPriority(kind, plan) {
  const anchor = plan && plan.primary_anchor;
  if (anchor === 'book_figure') return kind === 'book_image' ? 2 : 1;
  if (anchor === 'matplotlib') return kind === 'generate_image' ? 2 : 1;
  if (anchor === 'both') return kind === 'book_image' ? 2 : (kind === 'generate_image' ? 2 : 1);
  return 1;
}

function findNextLessonImage(metaNode) {
  let el = metaNode ? metaNode.nextElementSibling : null;
  while (el) {
    const img = (el.matches && el.matches('img.lesson-img')) ? el : (el.querySelector ? el.querySelector('img.lesson-img') : null);
    if (img) {
      // Skip placeholder/unavailable images (src starts with # or contains 'figure-unavailable')
      const src = img.getAttribute('src') || '';
      if (src.startsWith('#') || src.includes('figure-unavailable')) {
        el = el.nextElementSibling;
        continue;
      }
      return img;
    }
    if (el.classList && el.classList.contains('kc-visual-meta')) return null;
    el = el.nextElementSibling;
  }
  return null;
}

function isStandaloneVisualCaption(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.classList.contains('learn-visual-chip-row') || node.classList.contains('kc-visual-meta')) return false;
  if (node.querySelector && node.querySelector('img.lesson-img, .kc-visual-meta, .lesson-test-banner, .kc-quiz-plan')) return false;
  const text = compactWhitespace(node.textContent || '');
  if (!text || text.length > 220) return false;
  if (node.tagName === 'P') {
    return !!node.querySelector('em') || /^\*.*\*$/.test(text);
  }
  if (node.tagName === 'DIV') {
    return !!node.querySelector('em');
  }
  return false;
}

function getVisualBlockNodes(entry) {
  const host = entry.img.closest('p, div, figure') || entry.img;
  const nodes = [];
  const chipRow = entry.chipRow || (host.previousElementSibling && host.previousElementSibling.classList && host.previousElementSibling.classList.contains('learn-visual-chip-row')
    ? host.previousElementSibling
    : null);
  if (chipRow) nodes.push(chipRow);
  nodes.push(host);
  const captionNode = host.nextElementSibling;
  if (isStandaloneVisualCaption(captionNode)) nodes.push(captionNode);
  return nodes;
}


function getPairedVisualSubtitle(track, bookEntry, genEntry) {
  const bookRole = getTeachingRoleLabel(bookEntry?.role || '').toLowerCase();
  const genRole = getTeachingRoleLabel(genEntry?.role || '').toLowerCase();

  switch (track) {
    case 'cram':
      return `Start with the textbook figure, then use the generated visual to recognize the exam pattern fast${genRole ? ` through a clearer ${genRole}` : ''}.`;
    case 'top_score':
      return `Compare the canonical textbook figure with the generated interpretation to spot subtle distinctions, traps, and higher-precision reasoning${bookRole ? ` around the ${bookRole}` : ''}.`;
    case 'standard':
    default:
      return `Read the textbook figure first, then use the generated visual to make the core idea intuitive${genRole ? ` through a clearer ${genRole}` : ''}.`;
  }
}

function getPairedVisualPanelTitle(track, side) {
  if (side === 'book') {
    switch (track) {
      case 'cram': return 'Textbook pattern';
      case 'top_score': return 'Canonical figure';
      case 'standard':
      default: return 'From the textbook';
    }
  }

  switch (track) {
    case 'cram': return 'Fast recognition view';
    case 'top_score': return 'High-precision interpretation';
    case 'standard':
    default: return 'Clarified visual';
  }
}

function decorateLectureContent(root) {
  if (!root || root.dataset.lectureDecorated === '1') return;

  const cardTypeForHeading = (text) => {
    const t = compactWhitespace(String(text || '')).toLowerCase();
    if (!t) return '';
    if (
      t.includes('example')
      || t.includes('worked example')
      || t.includes('representative example')
      || t.includes('minimal example')
      || t.includes('quick example')
      || t.includes('quick check')
      || t.includes('interactive check')
      || t.includes('interactive demo')
      || t.includes('near-miss')
    ) return 'example';
    if (
      t.includes('common mistake')
      || t.includes('common misuse')
      || t.includes('common trap')
      || t.includes('exam trap')
      || t === 'warning'
      || t.includes('warning:')
    ) return 'warning';
    if (
      t.includes('exam note')
      || t.includes('exam trigger')
      || t.includes('exam tip')
      || t.includes('key exam habit')
      || t.includes('key exam point')
    ) return 'exam';
    if (
      t.includes('quick reading rule')
      || t.includes('when to use it')
      || t.includes('bridge note')
      || t.includes('checklist')
      || t.includes('recipe')
    ) return 'rule';
    if (t.includes('important formulas') || t.includes('formula') || t.includes('identity')) return 'formula';
    return '';
  };

  const trimLeadingWhitespace = (node) => {
    while (node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE && !node.firstChild.textContent.trim()) {
      node.firstChild.remove();
    }
    if (node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE) {
      node.firstChild.textContent = node.firstChild.textContent.replace(/^[\s:：-]+/, '');
    }
  };

  const wrapInlineCallout = (paragraph) => {
    if (!paragraph || paragraph.closest('.lecture-note-card')) return;
    const firstElement = paragraph.firstElementChild;
    if (!firstElement || firstElement.tagName !== 'STRONG') return;
    let probe = paragraph.firstChild;
    while (probe && probe !== firstElement) {
      if (probe.nodeType !== Node.TEXT_NODE || probe.textContent.trim()) return;
      probe = probe.nextSibling;
    }
    const label = compactWhitespace(firstElement.textContent || '').replace(/[:：]\s*$/, '');
    const type = cardTypeForHeading(label);
    if (!type) return;
    const parent = paragraph.parentNode;
    if (!parent) return;
    const card = document.createElement('section');
    card.className = `lecture-note-card lecture-note-card-${type} lecture-note-card-compact`;
    const heading = document.createElement('h4');
    heading.textContent = label;
    parent.insertBefore(card, paragraph);
    firstElement.remove();
    trimLeadingWhitespace(paragraph);
    paragraph.classList.add('lecture-inline-callout-body');
    card.appendChild(heading);
    card.appendChild(paragraph);
  };

  const wrapHeadingCard = (heading) => {
    const type = cardTypeForHeading(heading.textContent || '');
    if (!type || heading.closest('.lecture-note-card')) return;
    const card = document.createElement('section');
    card.className = `lecture-note-card lecture-note-card-${type}`;
    const parent = heading.parentNode;
    if (!parent) return;
    const headingLevel = Number(String(heading.tagName || '').replace(/^H/i, '')) || 3;
    parent.insertBefore(card, heading);
    card.appendChild(heading);
    let sibling = card.nextSibling;
    while (sibling) {
      const next = sibling.nextSibling;
      if (sibling.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(sibling.tagName)) {
        const siblingLevel = Number(String(sibling.tagName || '').replace(/^H/i, '')) || headingLevel;
        if (siblingLevel <= headingLevel || cardTypeForHeading(sibling.textContent || '')) break;
      }
      card.appendChild(sibling);
      sibling = next;
    }
  };

  Array.from(root.querySelectorAll('p')).forEach(wrapInlineCallout);
  Array.from(root.querySelectorAll('h3, h4')).forEach(wrapHeadingCard);

  root.querySelectorAll('h2').forEach((h2) => {
    const next = h2.nextElementSibling;
    if (next && (next.tagName === 'P' || next.tagName === 'BLOCKQUOTE')) {
      next.classList.add('lecture-section-lead');
    }
  });

  const isTakeawayHeadingNode = (node) => {
    const text = compactWhitespace(node.textContent || '');
    return /^📌\s*Key Takeaways$/i.test(text) || /^Key Takeaways$/i.test(text);
  };
  const takeawayHeading = Array.from(root.querySelectorAll('h1, h2, h3, p')).find(isTakeawayHeadingNode);
  if (takeawayHeading && !root.querySelector('.lecture-note-card-summary')) {
    const takeawayNodes = [];
    let cursor = takeawayHeading.nextElementSibling;
    while (cursor) {
      if (/^H[1-6]$/.test(cursor.tagName)) break;
      if (cursor.querySelector('.kc-quiz-plan, .lesson-test-banner')) break;
      const text = compactWhitespace(cursor.textContent || '');
      if (/^next[,.:;]\s+/i.test(text)) break;
      if ((cursor.tagName === 'P' || cursor.tagName === 'LI') && text && !cursor.querySelector('img, table, .kc-quiz-plan, .lesson-test-banner')) {
        takeawayNodes.push(cursor);
      }
      if ((cursor.tagName === 'UL' || cursor.tagName === 'OL') && !cursor.querySelector('img, table, .kc-quiz-plan, .lesson-test-banner')) {
        Array.from(cursor.children || []).forEach((child) => {
          if (child.tagName === 'LI' && compactWhitespace(child.textContent || '')) takeawayNodes.push(child);
        });
      }
      cursor = cursor.nextElementSibling;
    }

    if (takeawayNodes.length >= 1) {
      const summaryCard = document.createElement('section');
      summaryCard.className = 'lecture-note-card lecture-note-card-summary';
      const list = document.createElement('ol');
      list.className = 'learn-key-takeaways-list';
      takeawayNodes.forEach((node, index) => {
        const li = document.createElement('li');
        const marker = document.createElement('span');
        marker.className = 'takeaway-index';
        marker.textContent = String(index + 1);
        const copy = document.createElement('div');
        copy.className = 'takeaway-copy';
        copy.innerHTML = node.innerHTML;
        li.append(marker, copy);
        list.appendChild(li);
      });
      takeawayHeading.parentNode.insertBefore(summaryCard, takeawayHeading);
      if (/^H[1-6]$/.test(takeawayHeading.tagName)) {
        summaryCard.appendChild(takeawayHeading);
      } else {
        const heading = document.createElement('h2');
        heading.innerHTML = takeawayHeading.innerHTML;
        summaryCard.appendChild(heading);
        takeawayHeading.remove();
      }
      summaryCard.appendChild(list);
      const removedParents = new Set();
      takeawayNodes.forEach((node) => {
        const parent = node.parentNode;
        if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')) removedParents.add(parent);
        else node.remove();
      });
      removedParents.forEach((node) => node.remove());
    }
  }

  root.dataset.lectureDecorated = '1';
}

function enhanceVisualMetadataUI(root) {
  if (!root) return;
  const track = getActiveLearnTrack();
  const planNode = root.querySelector('.kc-visual-plan');
  const plan = planNode
    ? (parseBase64JsonAttr(planNode.dataset.visualPlanB64 || planNode.getAttribute('data-visual-plan-b64')) || {})
    : null;

  if (planNode) {
    // Keep blueprint metadata available for parsing, but do not surface planner-facing
    // strategy copy to the student UI.
    planNode.remove();
  }

  root.querySelectorAll('.learn-visual-chip-row').forEach((node) => node.remove());

  const visualEntries = [];
  root.querySelectorAll('.kc-visual-meta').forEach((metaNode) => {
    const img = findNextLessonImage(metaNode);
    const role = metaNode.dataset.teachingRole || metaNode.getAttribute('data-teaching-role') || '';
    const kind = metaNode.dataset.visualKind || metaNode.getAttribute('data-visual-kind') || '';
    if (!img) return;
    visualEntries.push({ metaNode, img, role, kind });
  });

  if (plan && plan.primary_anchor && plan.primary_anchor !== 'both' && visualEntries.length >= 2) {
    const groups = new Map();
    visualEntries.forEach((entry) => {
      const key = entry.img.parentNode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });

    groups.forEach((entries, parent) => {
      const ordered = entries.slice().sort((a, b) => getVisualKindPriority(b.kind, plan) - getVisualKindPriority(a.kind, plan));
      const current = entries.map(e => e.img);
      const desired = ordered.map(e => e.img);
      const changed = current.length === desired.length && current.some((img, idx) => img !== desired[idx]);
      if (!changed) return;
      const anchorNode = current[0];
      desired.forEach((img) => {
        if (img !== anchorNode) parent.insertBefore(img, anchorNode);
      });
    });
  }

  visualEntries.forEach((entry) => {
    const { metaNode } = entry;
    if (metaNode.dataset.uiBound === '1') return;
    metaNode.dataset.uiBound = '1';
  });

  if (plan && plan.primary_anchor === 'both' && visualEntries.length >= 2 && !root.querySelector('.learn-visual-pair-shell')) {
    const orderedEntries = visualEntries.slice().sort((a, b) => {
      if (a.metaNode === b.metaNode) return 0;
      const pos = a.metaNode.compareDocumentPosition(b.metaNode);
      return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    const used = new Set();

    for (let i = 0; i < orderedEntries.length; i += 1) {
      if (used.has(i)) continue;
      const leftEntry = orderedEntries[i];
      let matchIndex = -1;
      for (let j = i + 1; j < orderedEntries.length; j += 1) {
        if (used.has(j)) continue;
        const rightEntry = orderedEntries[j];
        const sameParent = (leftEntry.img.parentNode === rightEntry.img.parentNode)
          || ((leftEntry.img.closest('p, div, figure') || leftEntry.img).parentNode === (rightEntry.img.closest('p, div, figure') || rightEntry.img).parentNode);
        if (sameParent && leftEntry.kind !== rightEntry.kind) {
          matchIndex = j;
          break;
        }
      }
      if (matchIndex === -1) continue;

      const rightEntry = orderedEntries[matchIndex];
      const bookEntry = leftEntry.kind === 'book_image' ? leftEntry : rightEntry;
      const genEntry = leftEntry.kind === 'generate_image' ? leftEntry : rightEntry;
      const bookNodes = getVisualBlockNodes(bookEntry);
      const genNodes = getVisualBlockNodes(genEntry);
      if (!bookNodes.length || !genNodes.length) continue;

      const shell = document.createElement('section');
      shell.className = 'learn-visual-pair-shell';
      const head = document.createElement('div');
      head.className = 'learn-visual-pair-head';
      head.textContent = 'Textbook figure + generated visual';

      const subtitle = document.createElement('div');
      subtitle.className = 'learn-visual-pair-subtitle';
      subtitle.textContent = getPairedVisualSubtitle(track, bookEntry, genEntry);

      const grid = document.createElement('div');
      grid.className = 'learn-visual-pair-grid';

      const bookCard = document.createElement('div');
      bookCard.className = 'learn-visual-pair-card learn-visual-pair-card-book';
      const genCard = document.createElement('div');
      genCard.className = 'learn-visual-pair-card learn-visual-pair-card-generated';

      const bookTitle = document.createElement('div');
      bookTitle.className = 'learn-visual-pair-card-title';
      bookTitle.textContent = getPairedVisualPanelTitle(track, 'book');
      const genTitle = document.createElement('div');
      genTitle.className = 'learn-visual-pair-card-title';
      genTitle.textContent = getPairedVisualPanelTitle(track, 'generated');

      bookCard.appendChild(bookTitle);
      genCard.appendChild(genTitle);
      bookNodes.forEach((node) => bookCard.appendChild(node));
      genNodes.forEach((node) => genCard.appendChild(node));

      grid.appendChild(bookCard);
      grid.appendChild(genCard);
      shell.appendChild(head);
      shell.appendChild(subtitle);
      shell.appendChild(grid);

      const anchorNode = bookNodes[0];
      if (anchorNode && anchorNode.parentNode) {
        const parent = anchorNode.parentNode;
        // Verify we aren't accidentally putting the parent inside itself (e.g. DOM overlap issues)
        if (parent !== shell && !shell.contains(parent)) {
          parent.insertBefore(shell, anchorNode);
        }
      }

      used.add(i);
      used.add(matchIndex);
    }
  }
}

function resetLearnKnowledgePointState() {
  learnKnowledgePoints = [];
  currentKnowledgePointIndex = 0;
  currentFullLessonHtml = '';
  currentLessonTrailingHtml = '';
  if (learnKpTitle) learnKpTitle.textContent = 'Preparing lesson...';
  if (learnKpPrevBtn) learnKpPrevBtn.disabled = true;
  if (learnKpNextBtn) learnKpNextBtn.disabled = true;
}

// Lesson rendering rules enforced on the client so the first overview stays concise
// and visually distinct concepts do not collapse into one merged presentation block.
const LESSON_RENDER_RULES = Object.freeze({
  compactOverview: true,
  maxOverviewConcepts: 6,
  conceptNamesOnly: true,
  splitDiagonalIdentityVisuals: true
});

function isDiagonalIdentityCombinedTitle(title) {
  const text = compactWhitespace(title).toLowerCase();
  return (
    (text.includes('对角矩阵') && text.includes('单位矩阵'))
    || (text.includes('diagonal') && text.includes('identity'))
  );
}

function normalizeOverviewConceptLabel(value) {
  const text = compactWhitespace(value);
  if (!text) return '';

  const lower = text.toLowerCase();
  const rules = [
    { match: /read\s+a[_{]?ij[}\s]*as row/i, en: 'matrix entry notation', zh: '矩阵元素记号' },
    { match: /diagonal means|diagonal matrix|off-diagonal/i, en: 'diagonal matrix', zh: '对角矩阵' },
    { match: /identity is|identity matrix/i, en: 'identity matrix', zh: '单位矩阵' },
    { match: /zero means|zero matrix/i, en: 'zero matrix', zh: '零矩阵' },
    { match: /symmetric means|symmetric matrix/i, en: 'symmetric matrix', zh: '对称矩阵' },
    { match: /transpose swaps|transpose/i, en: 'transpose', zh: '转置' },
    { match: /row vector/i, en: 'row vector', zh: '行向量' },
    { match: /column vector/i, en: 'column vector', zh: '列向量' },
    { match: /square matrix/i, en: 'square matrix', zh: '方阵' },
    { match: /matrix equality/i, en: 'matrix equality', zh: '矩阵相等' }
  ];

  for (const rule of rules) {
    if (rule.match.test(lower)) {
      return detectLang(text) === 'zh' ? rule.zh : rule.en;
    }
  }

  const trimmed = text
    .replace(/^[-*•]\s*/, '')
    .replace(/^concepts?(?: in this section)?[:：]?\s*/i, '')
    .replace(/\b(means|is|are|when|where|with|that)\b[\s\S]*$/i, '')
    .replace(/[,:;].*$/, '')
    .trim();

  return compactWhitespace(trimmed || text);
}

function inferLessonChunkTitle(chunkHtml, fallbackTitle = 'Core Lesson', chunkIndex = 0) {
  const temp = document.createElement('div');
  temp.innerHTML = chunkHtml || '';
  const text = compactWhitespace(temp.textContent || '');
  const heading = Array.from(temp.querySelectorAll('h1, h2, h3')).find((node) => compactWhitespace(node.textContent || ''));
  if (heading) return compactWhitespace(heading.textContent || '');
  if (/a\s*:\s*b\s*:\s*c|0\s*:\s*2\s*:\s*11|colon notation|stop value|termination value/i.test(text)) {
    return '1. Colon notation creates stored vectors';
  }
  if (/w_k|cube roots|three unique cube roots|k\s*=\s*0\s*:\s*2|exp\(1j/i.test(text)) {
    return '2. Vectorize the cube roots';
  }
  if (/f\(1\)|indexing starts|first stored|function input|storage position|k\(5\)/i.test(text)) {
    return '3. Index position is not function input';
  }
  if (/sampled sinusoid|time vector|0\.2\/500|10\s*hz|sinusoidal signal|frequency in hertz/i.test(text)) {
    return '4. Build a sampled sinusoid vector';
  }
  return `${fallbackTitle || 'Core Lesson'} ${chunkIndex + 1}`;
}

function buildInlineMatrixVisual(kind = 'diagonal') {
  const isIdentity = kind === 'identity';
  const values = isIdentity
    ? [['1', '0', '0'], ['0', '1', '0'], ['0', '0', '1']]
    : [['2', '0', '0'], ['0', '-1', '0'], ['0', '0', '5']];

  const rowsHtml = values.map((row, rowIndex) => `
    <tr>
      ${row.map((cell, colIndex) => {
        const diagonal = rowIndex === colIndex;
        const bg = diagonal ? (isIdentity ? '#DBEAFE' : '#DCFCE7') : '#FFFFFF';
        const border = diagonal ? (isIdentity ? '#60A5FA' : '#4ADE80') : '#CBD5E1';
        return `<td style="min-width:34px;height:34px;padding:0 8px;text-align:center;font-size:18px;font-weight:700;color:#0F172A;background:${bg};border:1px solid ${border};border-radius:8px;">${cell}</td>`;
      }).join('')}
    </tr>
  `).join('');

  return `
    <div style="display:flex;justify-content:center;margin:14px 0 6px;">
      <div style="padding:10px 16px;border:1px solid #E2E8F0;border-radius:16px;background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%);">
        <table style="border-collapse:separate;border-spacing:6px 8px;margin:0 auto;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

function buildDiagonalIdentitySplitHtml(block) {
  const title = compactWhitespace(block?.title || '');
  const isZh = detectLang(title) === 'zh';
  const headingTag = /^h1$/i.test(block?.headingTag || '') ? 'h1' : 'h2';
  const headingHtml = `<${headingTag}>${escapeHtml(title || (isZh ? '对角矩阵和单位矩阵' : 'Diagonal and Identity Matrices'))}</${headingTag}>`;

  const diagonalTitle = isZh ? '对角矩阵' : 'Diagonal Matrix';
  const diagonalCopy = isZh
    ? '主对角线以外的元素全为 0，主对角线上的元素可以是任意实数。'
    : 'All off-diagonal entries are zero, while diagonal entries can be any real numbers.';
  const identityTitle = isZh ? '单位矩阵' : 'Identity Matrix';
  const identityCopy = isZh
    ? '主对角线上的元素全为 1，因此它是对角矩阵的一个特殊情况。'
    : 'All diagonal entries are 1, so it is a special case of a diagonal matrix.';

  return `
    ${headingHtml}
    <div class="lecture-note-card lecture-note-card-rule">
      <h3>${diagonalTitle}</h3>
      <p>${diagonalCopy}</p>
      ${buildInlineMatrixVisual('diagonal')}
    </div>
    <div class="lecture-note-card lecture-note-card-example">
      <h3>${identityTitle}</h3>
      <p>${identityCopy}</p>
      ${buildInlineMatrixVisual('identity')}
    </div>
  `;
}

function isMatrixEqualityTitle(title) {
  const text = compactWhitespace(title).toLowerCase();
  return text.includes('matrix equality') || text.includes('矩阵相等');
}

function buildMatrixEqualityExampleHtml(title = '') {
  const isZh = detectLang(title) === 'zh';
  return `
    <div class="lecture-note-card lecture-note-card-example">
      <h3>${isZh ? '最小例子' : 'Minimal Example'}</h3>
      <p>${isZh
        ? '例如，若'
        : 'For example, if'}
      \\(
      \\begin{bmatrix}
      x & 2 \\\\
      3 & y
      \\end{bmatrix}
      =
      \\begin{bmatrix}
      1 & 2 \\\\
      3 & 4
      \\end{bmatrix}
      \\)，
      ${isZh
        ? '就按对应位置逐个比较，得到'
        : 'compare corresponding entries one by one to get'}
      \\(x=1\\) ${isZh ? '且' : 'and'} \\(y=4\\)。</p>
    </div>
  `;
}

function applyLessonRenderRulesToKnowledgePoint(block) {
  if (!block) return '';
  if (LESSON_RENDER_RULES.splitDiagonalIdentityVisuals && isDiagonalIdentityCombinedTitle(block.title || '')) {
    return buildDiagonalIdentitySplitHtml(block);
  }
  let html = block.html || '';
  if (isMatrixEqualityTitle(block.title || '') && !/Minimal Example|最小例子/i.test(html)) {
    html = html.replace(/(<h3[^>]*>.*?(Exam Trigger|考试触发).*?<\/h3>)/i, `${buildMatrixEqualityExampleHtml(block.title || '')}$1`);
    if (!/Minimal Example|最小例子/i.test(html)) {
      html += buildMatrixEqualityExampleHtml(block.title || '');
    }
  }
  return html;
}

function buildLessonOverviewHtml(nodes) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  if (!sourceNodes.length) return '';

  const topLevel = sourceNodes
    .map((node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
      return {
        tag: node.tagName,
        text: compactWhitespace(node.textContent || ''),
        html: node.innerHTML || ''
      };
    })
    .filter(Boolean);

  let objective = '';
  let collectingConcepts = false;
  const concepts = [];
  const stopCollectingConcepts = (entry) => {
    if (!entry) return false;
    const text = entry.text || '';
    if (!text) return false;
    if (/^After this overview/i.test(text) || /^After this section/i.test(text) || /^The next page/i.test(text)) {
      return true;
    }
    if (entry.tag === 'TABLE') return true;
    if (/^H[1-6]$/.test(entry.tag || '')) return true;
    if (entry.html && /lesson-img|kc-visual-meta|kc-container|kc-quiz-plan|lesson-test-banner|<img\b|<table\b|<details\b/i.test(entry.html)) {
      return true;
    }
    if (entry.tag === 'P') {
      if (/^[-*]\s+/.test(text)) return false;
      if (text.length > 90) return true;
      if (/[.:;!?]/.test(text) && text.length > 48) return true;
    }
    return false;
  };

  const isShortConceptLikeText = (text) => {
    const value = compactWhitespace(text || '');
    if (!value) return false;
    if (value.length > 60) return false;
    if (/[.!?;:]/.test(value)) return false;
    return true;
  };

  const pushConcept = (value) => {
    const rawText = compactWhitespace(value);
    const text = LESSON_RENDER_RULES.conceptNamesOnly ? normalizeOverviewConceptLabel(rawText) : rawText;
    if (!text) return;
    if (concepts.some((item) => item.toLowerCase() === text.toLowerCase())) return;
    concepts.push(text);
  };

  topLevel.forEach((entry) => {
    const text = entry.text;
    if (!text) return;

    if (!objective) {
      const objectiveMatch = text.match(/^>?\s*Section Objective[:：]?\s*(.+)$/i);
      if (objectiveMatch) {
        objective = compactWhitespace(objectiveMatch[1]);
        return;
      }
    }

    if (/^In this section, you will meet[:：]?$/i.test(text) || /^Concepts?(?: in this section)?[:：]?$/i.test(text)) {
      collectingConcepts = true;
      return;
    }

    if (collectingConcepts) {
      if (stopCollectingConcepts(entry)) {
        collectingConcepts = false;
        return;
      }

      if (entry.tag === 'UL' || entry.tag === 'OL') {
        const temp = document.createElement(entry.tag);
        temp.innerHTML = entry.html;
        Array.from(temp.querySelectorAll('li')).forEach((li) => pushConcept(li.textContent || ''));
        return;
      }

      if (entry.tag === 'P' && isShortConceptLikeText(text)) {
        pushConcept(text);
        return;
      }

      collectingConcepts = false;
    }
  });

  if (!objective) {
    const firstParagraph = topLevel.find((entry) => entry.tag === 'P' && entry.text.length > 20);
    if (firstParagraph) objective = firstParagraph.text;
  }

  if (!concepts.length) {
    const listNodes = topLevel.filter((entry) => entry.tag === 'UL' || entry.tag === 'OL');
    listNodes.forEach((entry) => {
      const temp = document.createElement(entry.tag);
      temp.innerHTML = entry.html;
      Array.from(temp.querySelectorAll('li')).forEach((li) => pushConcept(li.textContent || ''));
    });
  }

  if (!objective && !concepts.length) return '';

  const limitedConcepts = concepts.slice(0, LESSON_RENDER_RULES.maxOverviewConcepts);
  return `
    <div class="lecture-note-card lecture-note-card-example">
      <h3>Section Objective</h3>
      <p>${inlineFormat(objective || 'Understand the key idea of this section before moving into the detailed steps.')}</p>
    </div>
    <div class="lecture-note-card lecture-note-card-rule">
      <h3>Concepts In This Section</h3>
      <ol>
        ${limitedConcepts.map((item) => `<li>${inlineFormat(item)}</li>`).join('')}
      </ol>
    </div>
  `;
}

function parseLessonKnowledgePoints(html) {
  const source = String(html || '').trim();
  if (!source) return { points: [], trailingHtml: '' };

  const wrapper = document.createElement('div');
  wrapper.innerHTML = source;
  const nodes = Array.from(wrapper.childNodes);
  const points = [];
  let current = null;
  let summaryPage = null;
  const quizParts = [];
  const introNodes = [];
  let sawPrimaryHeading = false;
  let overviewInserted = false;
  let pendingLeadingKnowledgeHtml = '';

  const toHtml = (node) => node.outerHTML || node.textContent || '';
  const getNodeText = (node) => compactWhitespace(node?.textContent || '').trim();

  const isSectionTitleHeading = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== 'H1') return false;
    const text = getNodeText(node);
    return /^(?:[A-Z]\.?\d+|\d+)(?:[-.]\d+)*\s+/.test(text);
  };

  const isPrimaryKnowledgeHeading = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.tagName !== 'H2') return false;
    const text = getNodeText(node);
    return /^\d+[.)]\s+/.test(text) || /^[A-Z]\d+(?:[-.]\d+)*\s+/.test(text);
  };

  const isQuizNode = (node) => {
    return node
      && node.nodeType === Node.ELEMENT_NODE
      && (
        node.classList.contains('lesson-test-banner')
        || node.classList.contains('kc-quiz-plan')
      );
  };

  const isSummaryStart = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const text = getNodeText(node);
    // Match with or without bold markers / emoji variants
    return /^📌\s*Key Takeaways$/i.test(text)
      || /^Key Takeaways$/i.test(text)
      || /^\*{0,2}📌\s*Key Takeaways\*{0,2}$/i.test(text)
      || /^\*{0,2}Key Takeaways\*{0,2}$/i.test(text);
  };

  const hasMeaningfulKnowledgeBody = (html) => {
    const raw = String(html || '').trim();
    if (!raw) return false;
    const temp = document.createElement('div');
    temp.innerHTML = raw;

    Array.from(temp.querySelectorAll('h1, h2, h3, h4, h5, h6')).forEach((heading) => heading.remove());

    if (temp.querySelector('img, .lesson-img, .math-block, pre, blockquote, ul, ol, table, details, .kc-visual-meta, .kc-container, .lesson-test-banner, .kc-quiz-plan')) {
      return true;
    }

    const text = compactWhitespace(temp.textContent || '').trim();
    return Boolean(text);
  };

  const estimateLessonNodeWeight = (node) => {
    if (!node) return 0;
    if (node.nodeType === Node.TEXT_NODE) {
      return compactWhitespace(node.textContent || '').length / 420;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return 0;
    const textLength = compactWhitespace(node.textContent || '').length;
    let weight = Math.max(0.2, textLength / 420);
    const tag = node.tagName || '';
    if (/^H[1-6]$/.test(tag)) weight += 0.35;
    if (node.classList.contains('math-block') || tag === 'PRE') weight += 1.2;
    if (node.querySelector && node.querySelector('img, .lesson-img')) weight += 2.3;
    if (tag === 'UL' || tag === 'OL') weight += Math.min(1.8, Array.from(node.children || []).length * 0.35);
    if (node.querySelector && node.querySelector('table, details, .kc-container')) weight += 1.6;
    return weight;
  };

  const isMajorLessonSplitAnchor = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.classList.contains('math-block')) {
      const text = compactWhitespace(node.textContent || '');
      if (!text || text.length < 6) return false;
      if (/^f\s*\(\s*0\s*\)\s*=/.test(text)) return false;
      return true;
    }
    if (/^H[2-3]$/.test(node.tagName || '')) return true;
    return false;
  };

  const splitAutoKnowledgePoint = (point) => {
    if (!point || point.type !== 'knowledge' || !point.autoSplit) return [point];
    const temp = document.createElement('div');
    temp.innerHTML = point.html || '';
    const children = Array.from(temp.childNodes);
    if (children.length < 8) return [point];

    const chunks = [];
    let chunkNodes = [];
    let chunkWeight = 0;

    const flushChunk = () => {
      const html = chunkNodes.map(toHtml).join('').trim();
      if (hasMeaningfulKnowledgeBody(html)) chunks.push(html);
      chunkNodes = [];
      chunkWeight = 0;
    };

    children.forEach((node) => {
      const shouldSplitBefore = isMajorLessonSplitAnchor(node)
        && chunkNodes.length > 0
        && chunkWeight >= 3.8;
      if (shouldSplitBefore) flushChunk();
      chunkNodes.push(node.cloneNode(true));
      chunkWeight += estimateLessonNodeWeight(node);
    });
    flushChunk();

    if (chunks.length <= 1) return [point];

    return chunks.map((chunkHtml, chunkIndex) => ({
      ...point,
      autoSplit: false,
      title: inferLessonChunkTitle(chunkHtml, point.title, chunkIndex),
      html: chunkHtml
    }));
  };

  const addParsedPoint = (point) => {
    splitAutoKnowledgePoint(point).forEach((entry) => {
      const cleanEntry = { ...entry };
      delete cleanEntry.autoSplit;
      points.push(cleanEntry);
    });
  };

  const pushCurrent = () => {
    if (!current) return;
    const content = current.parts.join('').trim();
    const plain = content.replace(/<[^>]+>/g, '').trim();
    const shouldKeep = current.type === 'overview'
      || current.type === 'summary'
      || current.type === 'quiz'
      || hasMeaningfulKnowledgeBody(content);
    if (content && plain && shouldKeep) addParsedPoint({
      type: current.type || 'knowledge',
      label: current.label || 'Knowledge Point',
      title: current.title,
      headingTag: current.headingTag || 'h2',
      html: content,
      autoSplit: Boolean(current.autoSplit)
    });
    current = null;
  };

  const ensureSummaryPage = () => {
    if (!summaryPage) {
      summaryPage = { type: 'summary', label: 'Summary', title: '📌 Key Takeaways', parts: [] };
    }
    return summaryPage;
  };

  const flushIntroNodes = ({ keepRemainderAsKnowledge = false } = {}) => {
    if (!introNodes.length) return;
    const objectiveNodes = [];
    const remainderNodes = [];
    let foundObjective = false;
    let collectingConcepts = false;
    let conceptsConsumed = false;

    const isConceptMarker = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
      const text = compactWhitespace(node.textContent || '');
      return /^In this section, you will meet[:：]?$/i.test(text)
        || /^Concepts?(?: in this section)?[:：]?$/i.test(text);
    };

    const isConceptListNode = (node) => {
      return node && node.nodeType === Node.ELEMENT_NODE && /^(UL|OL)$/i.test(node.tagName || '');
    };

    const isIntroConceptParagraph = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== 'P') return false;
      const text = compactWhitespace(node.textContent || '');
      if (!text) return false;
      if (text.length > 60) return false;
      if (/[.:;!?]/.test(text)) return false;
      return true;
    };

    introNodes.forEach((node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      if (isSectionTitleHeading(node)) return;
      const text = compactWhitespace(node.textContent || '');
      const html = node.outerHTML || node.textContent || '';
      const isObjectiveNode = !foundObjective && /^>?\s*Section Objective[:：]?\s*(.+)$/i.test(text);

      if (isObjectiveNode) {
        foundObjective = true;
        objectiveNodes.push(node);
        return;
      }

      if (isConceptMarker(node)) {
        collectingConcepts = true;
        conceptsConsumed = true;
        objectiveNodes.push(node);
        return;
      }

      if (collectingConcepts) {
        if (isConceptListNode(node) || isIntroConceptParagraph(node)) {
          objectiveNodes.push(node);
          return;
        }
        collectingConcepts = false;
      }

      if (!conceptsConsumed && isConceptListNode(node)) {
        objectiveNodes.push(node);
        conceptsConsumed = true;
        return;
      }

      remainderNodes.push(html);
    });

    const overviewHtml = buildLessonOverviewHtml(objectiveNodes);
    if (overviewHtml) {
      points.push({ type: 'overview', label: 'Overview', title: 'Section Overview', html: overviewHtml });
      overviewInserted = true;
    }

    if (keepRemainderAsKnowledge) {
      const remainderHtml = remainderNodes.join('').trim();
      if (hasMeaningfulKnowledgeBody(remainderHtml)) {
        addParsedPoint({
          type: 'knowledge',
          label: 'Knowledge Point',
          title: 'Core Lesson',
          headingTag: 'h2',
          html: remainderHtml,
          autoSplit: true
        });
      }
    } else {
      const remainderHtml = remainderNodes.join('').trim();
      if (hasMeaningfulKnowledgeBody(remainderHtml)) {
        pendingLeadingKnowledgeHtml = `${pendingLeadingKnowledgeHtml}${remainderHtml}`;
      }
    }

    introNodes.length = 0;
  };

  nodes.forEach((node) => {
    if (isQuizNode(node)) {
      pushCurrent();
      quizParts.push(toHtml(node));
      return;
    }

    if (isSummaryStart(node)) {
      if (!sawPrimaryHeading && introNodes.length) {
        flushIntroNodes({ keepRemainderAsKnowledge: true });
      }
      pushCurrent();
      ensureSummaryPage().parts.push(toHtml(node));
      current = ensureSummaryPage();
      return;
    }

    if (isPrimaryKnowledgeHeading(node)) {
      if (!sawPrimaryHeading && introNodes.length) {
        flushIntroNodes({ keepRemainderAsKnowledge: false });
      }
      sawPrimaryHeading = true;
      pushCurrent();
      current = {
        type: 'knowledge',
        label: 'Knowledge Point',
        title: getNodeText(node) || 'Knowledge Point',
        headingTag: String(node.tagName || 'H2').toLowerCase(),
        parts: [toHtml(node)]
      };
      if (pendingLeadingKnowledgeHtml) {
        current.parts.push(pendingLeadingKnowledgeHtml);
        pendingLeadingKnowledgeHtml = '';
      }
      return;
    }

    if (current && current.type === 'summary') {
      current.parts.push(toHtml(node));
      return;
    }

    if (!sawPrimaryHeading) {
      introNodes.push(node.cloneNode(true));
      return;
    }

    if (!current) {
      current = {
        type: 'knowledge',
        label: 'Knowledge Point',
        title: 'Knowledge Point',
        headingTag: 'h2',
        parts: [],
        autoSplit: true
      };
    }
    current.parts.push(toHtml(node));
  });

  if (!sawPrimaryHeading && introNodes.length) {
    flushIntroNodes({ keepRemainderAsKnowledge: true });
  }

  pushCurrent();

  if (summaryPage) {
    const content = summaryPage.parts.join('').trim();
    if (hasMeaningfulKnowledgeBody(content)) {
      const existingSummaryIndex = points.findIndex((point) => point.type === 'summary');
      const normalizedSummary = {
        type: 'summary',
        label: 'Summary',
        title: '📌 Key Takeaways',
        headingTag: 'h2',
        html: content
      };
      if (existingSummaryIndex >= 0) points[existingSummaryIndex] = normalizedSummary;
      else addParsedPoint(normalizedSummary);
    }
  }

  while (points.length && !String((points[0].html || '')).replace(/<[^>]+>/g, '').trim()) {
    points.shift();
  }

  // Add the quiz page at the very end
  const quizHtml = quizParts.join('').trim();
  if (quizHtml) {
    addParsedPoint({ type: 'quiz', label: 'Quiz', title: 'Knowledge Check', html: quizHtml });
  }

  return {
    points,
    trailingHtml: ''
  };
}

function isBadLessonPageTitle(title) {
  const text = compactWhitespace(title || '');
  if (!text) return true;
  if (/\\(sin|left|right|frac|pi|cdot|texttt|begin|end|quad|sqrt|exp|big|sum|int)\b/i.test(text)) return true;
  if (/[\{\}\\]/.test(text)) return true;
  if (/\$\$|\$|\\\(|\\\)/.test(text)) return true;
  if (/=\s*\\?[a-z]+/i.test(text) && text.length > 24) return true;
  return false;
}

function getLessonPageDisplayTitle(block, index) {
  if (!block || block.type !== 'knowledge') return '';
  const title = compactWhitespace(block.title || '');
  if (!title || /^Knowledge Point$/i.test(title) || /^Core Lesson$/i.test(title) || isBadLessonPageTitle(title)) {
    const inferred = inferLessonChunkTitle(block.html || '', '', index);
    if (inferred && !/^Core Lesson\s+\d+$/i.test(inferred)) return inferred;
    return `${index + 1}. Knowledge Point`;
  }
  return title;
}

function stripDuplicatePageHeading(innerHtml, displayTitle) {
  const html = String(innerHtml || '');
  const normalizedTitle = compactWhitespace(String(displayTitle || '').replace(/<[^>]+>/g, ''));
  if (!html || !normalizedTitle) return html;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const children = Array.from(temp.children || []);
  const firstHeading = children.find((child) => {
    if (child.classList && (child.classList.contains('kc-visual-plan') || child.classList.contains('kc-visual-meta'))) return false;
    return /^H[1-3]$/.test(child.tagName || '');
  });
  if (firstHeading && compactWhitespace(firstHeading.textContent || '') === normalizedTitle) {
    firstHeading.remove();
  }
  return temp.innerHTML;
}

function buildLessonPageFrameHtml(innerHtml, block, index, total) {
  const rawType = compactWhitespace(block?.type || 'lesson').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const extraHtml = String(block?.extraHtml || '').trim();
  const displayTitle = getLessonPageDisplayTitle(block, index);
  const pageBodyHtml = displayTitle ? stripDuplicatePageHeading(innerHtml, displayTitle) : String(innerHtml || '');
  const titleHtml = displayTitle
    ? `<header class="lesson-page-heading"><h2>${inlineFormat(displayTitle)}</h2></header>`
    : '';
  return `
    <article class="lesson-page-frame lesson-page-frame-${rawType}" data-lesson-page="${index + 1}">
      ${titleHtml}
      <div class="lesson-page-content">
        ${pageBodyHtml || '<p class="ghost">No explanation available.</p>'}
      </div>
      ${extraHtml ? `<div class="lesson-page-extra">${extraHtml}</div>` : ''}
    </article>
  `;
}

// §11 lesson-settle sentinel — the app's own "layout has stabilized" signal.
// dataset.lessonLayoutStable: '0' = a lesson render is in flight, '1' = MathJax
// typeset + idle + 2×rAF have all resolved. The visual harness gates on it
// (test-utils.settleLesson) instead of re-deriving from MathJax + rAFs, removing
// the sidebar-drift capture nondeterminism. window.__ftutorLessonRenderGen is a
// monotonic counter so a superseded render's late tail can't stamp '1' onto a
// newer render still mid-typeset.
function beginLessonRenderGen() {
  const gen = (window.__ftutorLessonRenderGen = (window.__ftutorLessonRenderGen || 0) + 1);
  document.documentElement.dataset.lessonLayoutStable = '0';
  return gen;
}
function markLessonLayoutStable(gen) {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 0));
  idle(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (gen === window.__ftutorLessonRenderGen) {
      document.documentElement.dataset.lessonLayoutStable = '1';
    }
  })), { timeout: 2000 });
}
window.__ftutorBeginLessonRenderGen = beginLessonRenderGen;
window.__ftutorMarkLessonLayoutStable = markLessonLayoutStable;

function renderCurrentKnowledgePoint() {
  const learnExplainContent = document.getElementById('learnExplainContent');
  const learnExplainScroll = document.getElementById('learnExplainScroll');
  if (!learnExplainContent) return;
  const lessonRenderGen = beginLessonRenderGen();
  if (!learnKnowledgePoints.length) {
    learnExplainContent.innerHTML = buildLessonPageFrameHtml(currentFullLessonHtml || '<p class="ghost">No explanation available.</p>', { type: 'full' }, 0, 1);
    delete learnExplainContent.dataset.lectureDecorated;
    if (learnExplainScroll) learnExplainScroll.scrollTop = 0;
    bindExpandableLessonImages(learnExplainContent);
    decorateLectureContent(learnExplainContent);
    enhanceVisualMetadataUI(learnExplainContent);
    const learnKpTitle = document.getElementById('learnKpTitle');
    if (learnKpTitle) learnKpTitle.textContent = 'Full Lesson';
    const learnKpPrevBtn = document.getElementById('learnKpPrevBtn');
    const learnKpNextBtn = document.getElementById('learnKpNextBtn');
    if (learnKpPrevBtn) learnKpPrevBtn.disabled = true;
    if (learnKpNextBtn) learnKpNextBtn.disabled = true;
    window.__ftutorRefreshPager?.();
    markLessonLayoutStable(lessonRenderGen);
    return;
  }
  currentKnowledgePointIndex = Math.max(0, Math.min(currentKnowledgePointIndex, learnKnowledgePoints.length - 1));
  const block = learnKnowledgePoints[currentKnowledgePointIndex];
  const pageHtml = applyLessonRenderRulesToKnowledgePoint(block) || '<p class="ghost">No explanation available.</p>';
  learnExplainContent.innerHTML = buildLessonPageFrameHtml(pageHtml, block, currentKnowledgePointIndex, learnKnowledgePoints.length);
  delete learnExplainContent.dataset.lectureDecorated;
  bindExpandableLessonImages(learnExplainContent);
  decorateLectureContent(learnExplainContent);
  enhanceVisualMetadataUI(learnExplainContent);
  hydrateInteractiveDemos(learnExplainContent);
  bindOverviewSubsectionCards();
  
  const learnKpTitle = document.getElementById('learnKpTitle');
  if (learnKpTitle) learnKpTitle.textContent = block.title || '';
  const labelEl = document.querySelector('.learn-kp-label');
  if (labelEl) labelEl.textContent = '';
  
  const learnKpPrevBtn = document.getElementById('learnKpPrevBtn');
  const learnKpNextBtn = document.getElementById('learnKpNextBtn');
  const lecturePrevOverlayBtn = document.getElementById('lecturePrevOverlayBtn');
  const lectureNextOverlayBtn = document.getElementById('lectureNextOverlayBtn');
  if (learnKpPrevBtn) learnKpPrevBtn.disabled = currentKnowledgePointIndex === 0;
  if (learnKpNextBtn) learnKpNextBtn.disabled = currentKnowledgePointIndex === learnKnowledgePoints.length - 1;
  if (lecturePrevOverlayBtn) lecturePrevOverlayBtn.disabled = currentKnowledgePointIndex === 0;
  if (lectureNextOverlayBtn) lectureNextOverlayBtn.disabled = currentKnowledgePointIndex === learnKnowledgePoints.length - 1;

  window.__ftutorRefreshPager?.();

  if (learnExplainScroll) learnExplainScroll.scrollTop = 0;

  const startTestBtn = learnExplainContent.querySelector('#startTestBtn');
  if (startTestBtn) {
    const banner = startTestBtn.closest('.lesson-test-banner');
    if (banner) {
      banner.style.cssText = "margin-top: 40px; padding: 24px; background: #ffffff; border-radius: 20px; border: 3px solid #cbd5e1; text-align: center; margin-bottom: 40px; box-shadow: 0 8px 0 #f1f5f9, 0 8px 0 1px #cbd5e1; font-family:'Nunito', sans-serif;";
      const h3 = banner.querySelector('h3');
      if (h3) {
        h3.style.fontFamily = "'Quicksand', sans-serif"; h3.style.fontWeight = "800"; h3.style.color = "#1e293b"; h3.style.fontSize = "20px";
        h3.innerHTML = '<span>🎯</span> ' + h3.textContent.trim();
      }
      const p = banner.querySelector('p');
      if (p) { p.style.fontWeight = "600"; p.style.color = "#64748b"; }
    }
    startTestBtn.style.cssText = "padding: 12px 28px; background: #38bdf8; color: #fff; border: 2px solid #0284c7; border-radius: 14px; font-family: 'Quicksand', sans-serif; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 0px #0284c7; transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);";
    startTestBtn.onmouseover = function() { if(!this.disabled){this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 0px #0284c7';}};
    startTestBtn.onmouseout = function() { if(!this.disabled){this.style.transform='none';this.style.boxShadow='0 4px 0px #0284c7';}};
  }
  setTimeout(() => {
    // [ST-5] decouple the sentinel emit from the MathJax-loaded guard: MathJax
    // loads async from a CDN and may be unattached on the first lesson of a
    // fresh page — the Promise.resolve() branch still reaches the sentinel.
    const typeset = (window.MathJax && window.MathJax.typesetPromise)
      ? window.MathJax.typesetPromise([learnExplainContent])
      : Promise.resolve();
    typeset.then(() => markLessonLayoutStable(lessonRenderGen),
                 () => markLessonLayoutStable(lessonRenderGen));
    buildTocFromContent(learnExplainContent);
    bindStartTestBtnIfPresent();
    if (learnExplainScroll) learnExplainScroll.scrollTop = 0;
    requestAnimationFrame(() => {
      if (learnExplainScroll) learnExplainScroll.scrollTop = 0;
    });
  }, 60);
}

function bindStartTestBtnIfPresent() {
  const buttons = Array.from(document.querySelectorAll('#startTestBtn'));
  if (!buttons.length) return;

  buttons.forEach((startTestBtn) => {
    if (!startTestBtn || startTestBtn._bound) return;
    startTestBtn._bound = true;

    startTestBtn.addEventListener('click', () => {
      let opened = false;
      const root = (learnExplainContent && learnExplainContent.contains(startTestBtn))
        ? learnExplainContent
        : document;
      const testBannerCard = startTestBtn.closest('#testBannerCard') || root.querySelector('#testBannerCard');
      const quizPlanNode = root.querySelector('.kc-quiz-plan') || document.querySelector('.kc-quiz-plan');
      const pregenCards = root.querySelectorAll('.kc-container');

      if (quizPlanNode && window.openQuizPlanModal) {
        try {
          const rawB64 = quizPlanNode.dataset.quizB64 || quizPlanNode.getAttribute('data-quiz-b64');
          let plan = null;
          if (rawB64) {
            plan = parseBase64JsonAttr(rawB64);
          } else {
            let raw = quizPlanNode.dataset.quiz || quizPlanNode.getAttribute('data-quiz') || '';
            const decode = (s) => { let v=s; for(let i=0;i<4;i++){const p=v;v=v.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');if(v===p)break;} return v; };
            plan = JSON.parse(decode(raw));
          }
          if (plan && Array.isArray(plan.knowledge_points) && plan.knowledge_points.length) {
            window.openQuizPlanModal(plan, learnSectionId, learnSectionTitle);
            opened = true;
          }
        } catch (err) { console.error('[QuizPlan] parse failed:', err); }
      }

      if (!opened && pregenCards.length > 0) {
        const card = pregenCards[0];
        if (window.openKCModal) {
          window.openKCModal(
            card.dataset.question || card.getAttribute('data-question') || '(No question found)',
            card.dataset.answer || card.getAttribute('data-answer') || '',
            card.dataset.hint || card.getAttribute('data-hint') || '',
            learnSectionId, learnSectionTitle
          );
          opened = true;
        }
      }

      if (!opened) {
        startTestBtn.innerText = 'Generating challenge...';
        startTestBtn.disabled = true;
        sendLearnFollowup('I have finished reading this section. Give me an exam-oriented quiz plan for this section. Cover the important knowledge points, use mostly multiple-choice questions, and only use short-answer when necessary.')
          .then(() => { if (testBannerCard) testBannerCard.style.display = 'none'; })
          .catch(() => { startTestBtn.innerText = 'Error - try again'; startTestBtn.disabled = false; });
      }
    });
  });
}

function setLearnLessonContent(fullHtml, options = {}) {
  currentFullLessonHtml = String(fullHtml || '');
  try {
    const parsed = parseLessonKnowledgePoints(currentFullLessonHtml);
    learnKnowledgePoints = parsed.points;
    currentLessonTrailingHtml = parsed.trailingHtml;
    currentKnowledgePointIndex = Math.max(0, Math.min(options.index || 0, Math.max(learnKnowledgePoints.length - 1, 0)));
    renderCurrentKnowledgePoint();
  } catch (err) {
    console.error('[LessonRender] setLearnLessonContent failed:', err);
    learnKnowledgePoints = [];
    currentLessonTrailingHtml = '';
    currentKnowledgePointIndex = 0;
    if (learnExplainContent) {
      learnExplainContent.innerHTML = `<div class="error-box"><strong>Lesson render failed</strong><p>${escapeHtml(err?.message || 'Unknown render error')}</p></div>`;
    }
  }
}

let learnPageTurnTimer = null;
let learnPageTurnMidTimer = null;
let isLearnPageTurning = false;

function clearLearnPageTurnClasses() {
  const targets = [learnBody, learnExplainScroll, learnExplainContent].filter(Boolean);
  targets.forEach((el) => {
    el.classList.remove(
      'learn-page-turn-active',
      'learn-page-turn-next',
      'learn-page-turn-prev',
      'learn-page-turn-reveal'
    );
  });
  isLearnPageTurning = false;
}

function runLearnPageTurn(direction = 1, commit = () => {}) {
  const dir = Number(direction) < 0 ? -1 : 1;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!learnExplainContent || prefersReducedMotion) {
    commit();
    return true;
  }
  if (isLearnPageTurning) return false;

  if (learnPageTurnTimer) window.clearTimeout(learnPageTurnTimer);
  if (learnPageTurnMidTimer) window.clearTimeout(learnPageTurnMidTimer);
  clearLearnPageTurnClasses();
  isLearnPageTurning = true;

  const turnClass = dir < 0 ? 'learn-page-turn-prev' : 'learn-page-turn-next';
  [learnBody, learnExplainScroll, learnExplainContent].filter(Boolean).forEach((el) => {
    el.classList.add('learn-page-turn-active', turnClass);
  });

  learnPageTurnMidTimer = window.setTimeout(() => {
    try {
      commit();
    } finally {
      window.requestAnimationFrame(() => {
        if (learnExplainContent) learnExplainContent.classList.add('learn-page-turn-reveal');
      });
    }
  }, 255);

  learnPageTurnTimer = window.setTimeout(() => {
    clearLearnPageTurnClasses();
    learnPageTurnTimer = null;
    learnPageTurnMidTimer = null;
  }, 720);

  return true;
}

function getOverviewPreludeFallbackTitle(markdownHeading = '', index = 0) {
  const text = compactWhitespace(String(markdownHeading || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^[A-Z]\d+(?:[-.]\d+)*\s+/, '')
    .replace(/[*_`#]/g, ''));
  return text || `Chapter note ${index + 1}`;
}

function buildOverviewPreludePointsFromMarkdown(markdown = '', chooserHtml = '') {
  const source = String(markdown || '').trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const introLines = [];
  const chunks = [];
  let current = null;
  const isPrimaryHeading = (line) => /^##\s+(?:\d+[.)]\s+|[A-Z]\d+(?:[-.]\d+)*\s+)/i.test(String(line || '').trim());

  lines.forEach((line) => {
    if (isPrimaryHeading(line)) {
      if (current && current.lines.length) chunks.push(current);
      current = {
        title: getOverviewPreludeFallbackTitle(line, chunks.length),
        lines: [line]
      };
      return;
    }
    if (current) current.lines.push(line);
    else introLines.push(line);
  });
  if (current && current.lines.length) chunks.push(current);

  if (!chunks.length) return [];

  const points = [];
  const introHtmlRaw = markdownToHtml(introLines.join('\n'));
  const introMount = document.createElement('div');
  introMount.innerHTML = introHtmlRaw;
  const overviewHtml = buildLessonOverviewHtml(Array.from(introMount.childNodes)) || introHtmlRaw;
  const introText = compactWhitespace(introMount.textContent || '');

  if (introText || introMount.querySelector('img, .kc-visual-plan, .kc-visual-meta, .math-block, table')) {
    points.push({
      type: 'overview',
      label: 'Overview',
      title: 'Section Overview',
      html: overviewHtml,
      extraHtml: chooserHtml
    });
  }

  chunks.forEach((chunk, idx) => {
    const html = markdownToHtml(chunk.lines.join('\n'));
    const temp = document.createElement('div');
    temp.innerHTML = html;
    if (!compactWhitespace(temp.textContent || '') && !temp.querySelector('img, .math-block, table, .kc-visual-meta, .kc-container')) return;
    points.push({
      type: 'knowledge',
      label: 'Knowledge Point',
      title: chunk.title || `Chapter note ${idx + 1}`,
      headingTag: 'h2',
      html
    });
  });

  if (points.length > 1) {
    points.push({
      type: 'quiz',
      label: 'Quiz',
      title: 'Knowledge Check',
      html: buildLessonTestBannerHtml()
    });
  }

  return points.length > 1 ? points : [];
}

// Returns false when the move was a no-op. The "no-op" reason is overloaded:
// it can mean (a) no knowledge points loaded, (b) a page-turn animation is in
// flight, or (c) we're already at the boundary. Callers MUST NOT treat false
// as "at boundary" — gate boundary-triggered actions (e.g. cross-subsection
// advance) on an explicit index check first.
function moveLearnKnowledgePoint(delta) {
  if (!learnKnowledgePoints.length) return false;
  if (isLearnPageTurning) return false;
  const nextIndex = Math.max(0, Math.min(currentKnowledgePointIndex + delta, learnKnowledgePoints.length - 1));
  if (nextIndex === currentKnowledgePointIndex) return false;
  return runLearnPageTurn(delta, () => {
    currentKnowledgePointIndex = nextIndex;
    renderCurrentKnowledgePoint();
  });
}

function buildLessonTestBannerHtml() {
  return `
    <div class="lesson-test-banner" id="testBannerCard" style="margin-top: 40px; padding: 24px; background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); border-radius: 12px; border: 1px solid #E2E8F0; text-align: center; margin-bottom: 40px;">
      <h3 style="margin: 0 0 8px 0; color: #0F172A; font-size: 18px; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/></svg>
        Ready to test your knowledge?
      </h3>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px;">Take the adaptive quick check to expose any blind spots.</p>
      <button id="startTestBtn" style="background: #2563EB; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">Start Quick Check</button>
    </div>
  `;
}
