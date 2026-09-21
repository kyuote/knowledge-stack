function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^a-zа-яё0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function addHeadingAnchors(container) {
  const counts = {};
  container.querySelectorAll('h1,h2,h3,h4,h5').forEach(h => {
    const base = slugify(h.textContent);
    counts[base] = (counts[base] || 0) + 1;
    h.dataset.anchor = counts[base] > 1 ? `${base}-${counts[base]}` : base;
  });
}

function removeTocDuplicateList(container) {
  const toc = container.querySelector('.docx-toc');
  if (!toc) return;
  const tocTexts = new Set(
    Array.from(toc.querySelectorAll('a, li, p')).map(el => el.textContent.trim().toLowerCase().slice(0, 45))
  );
  if (tocTexts.size < 3) return;
  // Remove any UL/OL before the first H2 whose items mostly match TOC entries
  const firstH2 = container.querySelector('h2');
  if (!firstH2) return;
  let el = firstH2.previousElementSibling;
  while (el) {
    const prev = el.previousElementSibling;
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      const items = Array.from(el.querySelectorAll('li'));
      if (items.length >= 3) {
        const matched = items.filter(li => tocTexts.has(li.textContent.trim().toLowerCase().slice(0, 45))).length;
        if (matched / items.length > 0.5) el.remove();
      }
    }
    el = prev;
  }
}

function buildDocxToc(container) {
  const h2s = container.querySelectorAll('h2, h3');
  if (h2s.length < 2) return;

  let n = 0;
  container.querySelectorAll('h1, h2, h3, h4').forEach(h => {
    if (!h.id) h.id = 'jh' + (n++);
  });

  const entries = Array.from(container.querySelectorAll('h2, h3, h4'));
  const h2Count = entries.filter(h => h.tagName === 'H2').length;

  let tocEl;

  if (h2Count > 50) {
    // Many Q&A questions: group by topic using text triggers
    const TRIGGERS = [
      ['fail-fast',            'Iterator и Iterable'],
      ['arraylist от vector',  'List: ArrayList и LinkedList'],
      ['queue и deque',        'Queue, Deque, Stack'],
      ['зачем нужен hashmap',  'Map: HashMap и другие'],
      ['отличия treeset',      'Set'],
      ['способы перебирать',   'Практические вопросы'],
    ];

    const wrapper = document.createElement('div');
    wrapper.className = 'docx-toc toc-sections';
    const groups = new Map();
    let curSec = 'Общее о JCF';

    entries.filter(h => h.tagName === 'H2').forEach(h => {
      const txt = h.textContent.toLowerCase().replace(/\s/g, ' ');
      for (const [trigger, name] of TRIGGERS) {
        if (txt.includes(trigger)) { curSec = name; break; }
      }
      if (!groups.has(curSec)) groups.set(curSec, []);
      groups.get(curSec).push(h);
    });

    for (const [sec, headings] of groups) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'toc-group';
      const hdr = document.createElement('div');
      hdr.className = 'toc-group-header';
      hdr.textContent = sec;
      groupDiv.appendChild(hdr);
      const grid = document.createElement('div');
      grid.className = 'toc-grid';
      headings.forEach(h => {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.trim();
        a.addEventListener('click', e => {
          e.preventDefault();
          h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        p.appendChild(a);
        grid.appendChild(p);
      });
      groupDiv.appendChild(grid);
      wrapper.appendChild(groupDiv);
    }
    tocEl = wrapper;
  } else {
    // Hierarchical structure: flat nav with h2/h3/h4 indent levels
    const nav = document.createElement('nav');
    nav.className = 'docx-toc';
    const ul = document.createElement('ul');
    entries.forEach(h => {
      const text = h.textContent.trim();
      const li = document.createElement('li');
      li.className = h.tagName === 'H4' ? 'toc-h4' : h.tagName === 'H3' ? 'toc-h3' : 'toc-h2';
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = text;
      a.addEventListener('click', e => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    tocEl = nav;
  }

  container.prepend(tocEl);
}

function linkifyInPage(container) {
  const norm = t => t.toLowerCase().replace(/\s+/g, ' ').replace(/[?!.:]+$/, '').trim();

  const all = Array.from(container.querySelectorAll('p, h1, h2, h3'));
  const contentStart = all.findIndex(el => /^H[123]$/.test(el.tagName));
  if (contentStart === -1) return;

  // Build index from content-section headings + bold-? paragraphs
  const index = new Map();
  function addToIndex(key, el) { if (key && !index.has(key)) index.set(key, el); }
  for (let i = contentStart; i < all.length; i++) {
    const el = all[i];
    const key = norm(el.textContent);
    if (/^H[123]$/.test(el.tagName)) {
      addToIndex(key, el);
      addToIndex(key.substring(0, 35), el);
    } else if (el.tagName === 'P' && el.querySelector('strong') && el.textContent.trim().endsWith('?')) {
      addToIndex(key, el);
    }
  }

  function bestMatch(text) {
    const key = norm(text);
    if (index.has(key)) return index.get(key);
    const pre = key.substring(0, 35);
    if (index.has(pre)) return index.get(pre);
    for (const [k, v] of index) { if (k.startsWith(pre) || pre.startsWith(k.substring(0, 35))) return v; }
    return null;
  }

  let idN = 0;
  const toRemove = [];

  // Process each TOC paragraph (before first heading)
  all.slice(0, contentStart).filter(el => el.tagName === 'P').forEach(para => {
    const githubLinks = Array.from(para.querySelectorAll('a[href*="github"]'));
    if (githubLinks.length > 0) {
      const target = bestMatch(para.textContent);
      if (target) {
        if (!target.id) target.id = 'q' + (idN++);
        githubLinks.forEach(a => a.setAttribute('href', '#' + target.id));
      } else {
        toRemove.push(para); // no matching heading → remove from TOC
      }
    } else if (!para.querySelector('a') && para.textContent.trim().endsWith('?')) {
      const target = bestMatch(para.textContent);
      if (target) {
        if (!target.id) target.id = 'q' + (idN++);
        const a = document.createElement('a');
        a.href = '#' + target.id;
        a.textContent = para.textContent;
        para.textContent = '';
        para.appendChild(a);
      } else {
        toRemove.push(para); // no matching heading → remove from TOC
      }
    }
  });

  // Remove unmatched TOC entries
  toRemove.forEach(el => el.remove());

  // Add TOC entries for h1s in content that have no link yet (question headings only)
  // Skip when buildDocxToc already built the nav (avoids duplicate TOC sections)
  const firstH1 = container.querySelector('h1, h2, h3');
  const hasDocxToc = !!container.querySelector('.docx-toc');
  if (firstH1 && !hasDocxToc) {
    for (let i = contentStart; i < all.length; i++) {
      const el = all[i];
      if (/^H[123]$/.test(el.tagName) && !el.id && el.textContent.trim().endsWith('?')) {
        el.id = 'q' + (idN++);
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = '#' + el.id;
        a.textContent = el.textContent.trim();
        p.appendChild(a);
        firstH1.parentNode.insertBefore(p, firstH1);
      }
    }
  }

  // Group TOC into named sections using text triggers, 2-col per group
  const firstHeading = container.querySelector('h1, h2, h3');
  if (firstHeading) {
    // Each trigger fires when combined text of a TOC href contains the pattern
    const TRIGGERS = [
      ['«интерфейс»',                          'Интерфейсы и абстрактные классы'],
      ['может ли объект получить доступ к члену', 'ООП, наследование, static'],
      ['какие типы классов бывают',              'Вложенные классы'],
      ['heap и stack',                           'Память, GC и типы'],
      ['особенности класса string',              'String'],
      ['класс object? какие',                    'Класс Object, ClassLoader, Reflection'],
      ['зачем нужен equals',                     'equals() и hashCode()'],
      ['клонирование объектов',                  'Клонирование'],
      ['иерархию исключений',                    'Исключения'],
      ['что такое generics',                     'Generics'],
    ];

    // Collect TOC paragraphs; combine texts per href so split-links merge
    const hrefTexts = new Map();
    const tocParas = [];
    let node = container.firstElementChild;
    while (node && node !== firstHeading) {
      if (node.tagName === 'P') {
        const a = node.querySelector('a[href^="#"]');
        if (a) {
          const id = a.getAttribute('href').slice(1);
          hrefTexts.set(id, (hrefTexts.get(id) || '') + ' ' + node.textContent.toLowerCase());
          tocParas.push({ el: node, id });
        }
      }
      node = node.nextElementSibling;
    }

    if (tocParas.length > 0) {
      // Walk unique ids in order; fire trigger → switch section
      const seen = new Set();
      const hrefSection = new Map();
      let curSec = 'Базовый синтаксис и модификаторы';
      for (const { id } of tocParas) {
        if (seen.has(id)) continue;
        seen.add(id);
        const txt = hrefTexts.get(id) || '';
        for (const [trigger, name] of TRIGGERS) {
          if (txt.includes(trigger)) { curSec = name; break; }
        }
        hrefSection.set(id, curSec);
      }

      // Build ordered groups
      const groups = new Map();
      for (const { el, id } of tocParas) {
        const sec = hrefSection.get(id);
        if (!groups.has(sec)) groups.set(sec, []);
        groups.get(sec).push(el);
      }

      // Render
      const wrapper = document.createElement('div');
      wrapper.className = 'toc-sections';
      for (const [sec, paras] of groups) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'toc-group';
        const hdr = document.createElement('div');
        hdr.className = 'toc-group-header';
        hdr.textContent = sec;
        groupDiv.appendChild(hdr);
        const grid = document.createElement('div');
        grid.className = 'toc-grid';
        paras.forEach(p => grid.appendChild(p));
        groupDiv.appendChild(grid);
        wrapper.appendChild(groupDiv);
      }
      firstHeading.parentNode.insertBefore(wrapper, firstHeading);
    }
  }

  // Smooth scroll for all in-page links
  container.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function wrapDocxImageRows(container) {
  // Find first heading — images that belong "before content" go right after it
  const firstHeading = container.querySelector('h1, h2, h3');

  function makeRow(group) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px';
    group.forEach(gp => {
      gp.style.cssText = 'flex:1;min-width:260px;margin:0';
      const img = gp.querySelector('img');
      if (img) img.style.cssText = 'max-width:100%;border-radius:8px;border:1px solid var(--border)';
      row.appendChild(gp);
    });
    return row;
  }

  const paras = Array.from(container.querySelectorAll('p'));
  let firstGroup = true;
  let i = 0;
  while (i < paras.length) {
    const p = paras[i];
    if (p.parentNode !== container) { i++; continue; }
    const imgs = p.querySelectorAll('img');
    if (imgs.length === 1 && p.textContent.trim() === '') {
      const group = [p];
      let j = i + 1;
      while (j < paras.length && paras[j].parentNode === container) {
        const pj = paras[j];
        if (pj.querySelectorAll('img').length === 1 && pj.textContent.trim() === '') {
          group.push(pj); j++;
        } else break;
      }
      if (firstGroup && firstHeading && group.length >= 1) {
        firstGroup = false;
        // Only relocate images that sit BEFORE the first heading in the source
        const isBeforeHeading = !!(firstHeading.compareDocumentPosition(group[0]) & Node.DOCUMENT_POSITION_PRECEDING);
        if (isBeforeHeading) {
          const row = makeRow(group);
          firstHeading.insertAdjacentElement('afterend', row);
        } else {
          group.forEach(gp => {
            const img = gp.querySelector('img');
            if (img) img.style.cssText = 'max-width:100%;border-radius:8px;border:1px solid var(--border)';
          });
        }
      } else {
        // For all other images — just style them individually, no flex row
        group.forEach(gp => {
          const img = gp.querySelector('img');
          if (img) img.style.cssText = 'max-width:100%;border-radius:8px;border:1px solid var(--border)';
        });
      }
      i = j;
    } else {
      i++;
    }
  }
}

function indentLeadingSpaceParas(container) {
  const paras = Array.from(container.querySelectorAll('p')).filter(p => !p.closest('.toc-sections,.docx-toc'));
  const indented = paras.filter(p => {
    const fc = p.textContent.charCodeAt(0);
    return fc === 32 || fc === 160;
  });
  if (indented.length < 8) return;
  indented.forEach(p => {
    const fc = p.textContent.charCodeAt(0);
    const preview = p.textContent.slice(1, 110);
    // strip leading whitespace from first text node (may be inside <em>/<strong>)
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) first.textContent = first.textContent.replace(/^[\s ]+/, '');
    // NBSP → always deep; space → deep if has "word — desc" pattern (implementation), else top-level
    const isDeep = fc === 160 || /\s[-–—]\s/.test(preview);
    p.classList.add(isDeep ? 'list-item-deep' : 'list-item');
  });
}

function stripWholeParagraphBold(container) {
  const paras = Array.from(container.querySelectorAll('p'));
  const boldOnes = paras.filter(p =>
    p.children.length === 1 && p.firstElementChild.tagName === 'STRONG'
  );
  if (boldOnes.length < paras.length * 0.4) return;
  boldOnes.forEach(p => {
    const s = p.firstElementChild;
    while (s.firstChild) p.insertBefore(s.firstChild, s);
    s.remove();
  });
}

function cleanAnchorLeaks(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let t = node.textContent;
    // Strip URL-encoded Word anchor slugs (2+ %XX sequences) leaked as text
    t = t.replace(/[A-Za-z0-9_-]*(?:%[A-Fa-f0-9]{2}[A-Za-z0-9_-]*){2,}"/g, '');
    // Strip pure kebab-slug anchors with double hyphens
    t = t.replace(/[a-z][a-z0-9]*(?:--[a-z][a-z0-9]*)+"/g, '');
    if (t !== node.textContent) node.textContent = t;
  });
}

function detectAndWrapCode(container) {
  // Highlight <pre> blocks already mapped by mammoth styleMap
  container.querySelectorAll('pre').forEach(pre => {
    const code = document.createElement('code');
    code.className = 'language-java';
    code.textContent = pre.textContent;
    pre.innerHTML = '';
    pre.appendChild(code);
    if (window.hljs) hljs.highlightElement(code);
  });

  // Post-process <p> elements: group consecutive code lines into <pre><code>
  const JAVA_START = /^[\s\t“”"]*(public|private|protected|static |final |abstract |class |interface |enum |import |package |@\w|\w[\w<>,\s]*\s+[a-z_]\w*\s*[=({\[]|return |throw |new |if\s*\(|for\s*\(|while\s*\(|try[\s{]|catch\s*\(|switch\s*\(|\}|\{|\/\/|\w[\w.<>]*\s*\()/;

  function stripStringsAndComments(text) {
    return text.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
               .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
               .replace(/\/\/.*$/gm, '//');
  }

  function normalizeIndent(code) {
    const IND = '    ';
    let depth = 0;
    return code.split('\n').map(line => {
      const s = line.trim();
      if (!s) return '';
      const bare = stripStringsAndComments(s).replace(/\/\/.*$/, '');
      const leading = (s.match(/^\}+/) || [''])[0];
      depth = Math.max(0, depth - leading.length);
      const out = IND.repeat(depth) + s;
      const rest = bare.slice(leading.length);
      depth += (rest.match(/\{/g) || []).length - (rest.match(/\}/g) || []).length;
      depth = Math.max(0, depth);
      return out;
    }).join('\n');
  }

  function isCodeStart(text) {
    const first = text.split('\n')[0].trim();
    if (!first) return false;
    // Cyrillic outside strings/comments → not code
    if (/[а-яёА-ЯЁ]/.test(stripStringsAndComments(first))) return false;
    if (JAVA_START.test(first) || /[{};]/.test(text)) return true;
    // Method chain: next non-empty line starts with .letter — e.g. "Stream\n.of(...)"
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length > 1 && /^\.[a-zA-Z_]/.test(lines[1]);
  }

  function paraText(el) {
    // Use a temp div so the browser decodes &lt; &gt; &amp; etc. while stripping tags
    const div = document.createElement('div');
    div.innerHTML = el.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    return div.textContent.replace(/\r/g, '');
  }

  function hasBlockBetween(p1, p2) {
    if (!p1 || !p2 || p1.parentElement !== p2.parentElement) return true;
    let cursor = p1.nextElementSibling;
    while (cursor && cursor !== p2) {
      if (/^(H[1-6]|UL|OL|HR|PRE)$/.test(cursor.tagName)) return true;
      cursor = cursor.nextElementSibling;
    }
    return false;
  }

  const paras = Array.from(container.querySelectorAll('p'));
  let i = 0;
  while (i < paras.length) {
    const el = paras[i];
    if (!container.contains(el)) { i++; continue; }
    const text = paraText(el);

    if (isCodeStart(text)) {
      const block = [text];
      // Track brace depth — stay in block while unbalanced
      let depth = (text.match(/\{/g) || []).length - (text.match(/\}/g) || []).length;
      let j = i + 1;

      while (j < paras.length && container.contains(paras[j])) {
        if (hasBlockBetween(paras[j - 1], paras[j])) break;
        const t = paraText(paras[j]);
        if (depth > 0 || isCodeStart(t)) {
          block.push(t);
          depth += (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;
          j++;
        } else {
          break;
        }
      }

      if (block.length > 1 || /[{};]/.test(text) || text.includes('\n')) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'language-java';
        code.textContent = normalizeIndent(block.join('\n'));
        pre.appendChild(code);
        el.parentNode.insertBefore(pre, el);
        for (let k = i; k < j; k++) paras[k].remove();
        if (window.hljs) hljs.highlightElement(code);
      }
      i = j;
    } else {
      i++;
    }
  }
}

(function () {
  const root = document.getElementById('chapter-root');
  const allBtns = Array.from(document.querySelectorAll('.ch'));
  const chBtns  = allBtns.filter(b => b.dataset.file);
  const matBtns = allBtns.filter(b => b.dataset.docx);

  function setActive(btn) {
    allBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.querySelectorAll('.subnav').forEach(n => { n.hidden = true; });
    const sub = document.querySelector(`.subnav[data-for="${btn.dataset.chapter}"]`);
    if (sub) sub.hidden = false;
  }

  function loadChapter(btn) {
    setActive(btn);
    fetch(btn.dataset.file)
      .then(r => r.text())
      .then(html => {
        root.innerHTML = html;
        root.dataset.chapter = btn.dataset.chapter;
        if (window.hljs) root.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
        if (btn.dataset.file && btn.dataset.file.includes('flashcards')) initFlashcards();
        root.scrollTop = 0;
        window.scrollTo(0, 0);
        const hash = location.hash;
        if (hash) {
          const el = root.querySelector(hash);
          if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .catch(() => {
        root.innerHTML = '<p style="color:var(--text-dim);padding:40px">Не удалось загрузить главу.</p>';
      });
  }

  function renderDocxBuf(buf) {
    let patchedBuf = buf;
    if (typeof fflate !== 'undefined') {
      try {
        const files = fflate.unzipSync(new Uint8Array(buf));
        if (files['word/document.xml']) {
          let xml = new TextDecoder().decode(files['word/document.xml']);
          xml = xml.replace(
            /(<pPr>)(\s*<pBdr>\s*<bottom color="D1D9E0")([\s\S]{0,900}?<\/pPr>)(\s*<\/p>)/g,
            '$1$2$3<r><t>§HR§</t></r>$4'
          );
          files['word/document.xml'] = fflate.strToU8(xml);
          patchedBuf = fflate.zipSync(files).buffer;
        }
      } catch (e) { /* use original */ }
    }
    return mammoth.convertToHtml({
      arrayBuffer: patchedBuf,
      styleMap: [
        "p[style-name='Preformatted Text'] => pre:fresh",
        "p[style-name='Code'] => pre:fresh",
        "p[style-name='code'] => pre:fresh",
        "p[style-name='TOC 1'] => p.word-toc:fresh",
        "p[style-name='TOC 2'] => p.word-toc:fresh",
        "p[style-name='TOC 3'] => p.word-toc:fresh",
        "p[style-name='TOC 4'] => p.word-toc:fresh",
        "p[style-name='TOC 5'] => p.word-toc:fresh",
        "p[style-name='Содержание 1'] => p.word-toc:fresh",
        "p[style-name='Содержание 2'] => p.word-toc:fresh",
        "p[style-name='Содержание 3'] => p.word-toc:fresh",
        "p[style-name='Содержание 4'] => p.word-toc:fresh",
        "r[strike] => ",
      ]
    }).then(result => {
      const container = document.createElement('div');
      container.className = 'docx-mammoth';
      container.insertAdjacentHTML('beforeend', result.value);
      container.querySelectorAll('p').forEach(p => {
        if (/\t\d+\s*$/.test(p.textContent)) p.remove();
      });
      container.querySelectorAll('s, del, strike').forEach(el => {
        el.replaceWith(...el.childNodes);
      });
      container.querySelectorAll('p').forEach(p => {
        if (p.textContent.trim() === '§HR§') p.replaceWith(document.createElement('hr'));
      });
      indentLeadingSpaceParas(container);
      stripWholeParagraphBold(container);
      cleanAnchorLeaks(container);
      detectAndWrapCode(container);
      buildDocxToc(container);
      removeTocDuplicateList(container);
      linkifyInPage(container);
      wrapDocxImageRows(container);
      addHeadingAnchors(container);
      return container;
    });
  }

  function loadDocx(btn) {
    setActive(btn);
    root.innerHTML = '<p style="color:var(--text-dim);padding:40px">Загрузка документа…</p>';
    window.scrollTo(0, 0);

    fetch(btn.dataset.docx + '?v=' + Date.now())
      .then(r => r.arrayBuffer())
      .then(buf => renderDocxBuf(buf))
      .then(container => {
        if (btn.dataset.images) {
          const imgWrap = document.createElement('div');
          imgWrap.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px';
          btn.dataset.images.split(',').forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'flex:1;min-width:260px;max-width:100%;border-radius:8px;border:1px solid var(--border)';
            imgWrap.appendChild(img);
          });
          container.prepend(imgWrap);
        }
        root.innerHTML = '';
        root.appendChild(container);
        window.scrollTo(0, 0);
      })
      .catch(e => {
        root.innerHTML = `<p style="color:var(--text-dim);padding:40px">Ошибка загрузки: ${e.message}</p>`;
      });
  }

  function initFlashcards() {
    fetch('assets/flashcards.json')
      .then(r => r.json())
      .then(DATA => runFlashcards(DATA))
      .catch(() => {});
  }

  function runFlashcards(DATA) {
    if (!DATA || !DATA.length) return;
    DATA.forEach((d, i) => { d.id = i; });
    const CHAPTERS = [...new Set(DATA.map(d => d.ch))];

    function loadJ(key, fb) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch(e) { return fb; } }
    function saveJ(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} }

    let progress = loadJ('javanotes-fc-progress-v1', {});
    let activeChapters = loadJ('javanotes-fc-filters-v1', CHAPTERS.slice());
    let activeSections = loadJ('javanotes-fc-sections-v1', []);
    let deck = [], pos = 0;

    // chapters that have multi-level section data
    const SECTIONED_CHAPTERS = [...new Set(DATA.filter(d => d.section).map(d => d.ch))];
    function getSections(ch) {
      return [...new Set(DATA.filter(d => d.ch === ch && d.section).map(d => d.section))];
    }

    const CHAPTER_DOCX = {
      'Collections': 'java-file/JavaCollectionsFramework.docx',
      'Java Core': 'java-file/java-core.docx',
      'JVM': 'java-file/JVM-DOC.docx',
      'Java IO / NIO': 'java-file/JavaIO.docx',
      'Java 8': 'java-file/java8 (1).docx',
    };
    const containerCache = {};

    function getChapterContainer(ch) {
      if (containerCache[ch]) return containerCache[ch];
      const path = CHAPTER_DOCX[ch];
      if (!path) return Promise.resolve(null);
      containerCache[ch] = fetch(path + '?cb=' + Date.now())
        .then(r => r.arrayBuffer())
        .then(buf => renderDocxBuf(buf))
        .catch(() => null);
      return containerCache[ch];
    }

    function normQ(s) {
      return s.toLowerCase().replace(/[\s ​]+/g, ' ').replace(/[.,;:!?«»""''*]+/g, '').trim();
    }

    function extractSection(container, questionText) {
      const qn = normQ(questionText);
      const headings = [...container.querySelectorAll('h1,h2,h3')];
      let target = null;

      // 1. exact normalised match
      for (const h of headings) {
        if (normQ(h.textContent) === qn) { target = h; break; }
      }
      // 2. 50-char prefix
      if (!target) {
        const p50 = qn.slice(0, 50);
        for (const h of headings) {
          if (normQ(h.textContent).slice(0, 50) === p50) { target = h; break; }
        }
      }
      // 3. first 6 words
      if (!target) {
        const w6 = qn.split(' ').slice(0, 6).join(' ');
        for (const h of headings) {
          if (normQ(h.textContent).split(' ').slice(0, 6).join(' ') === w6) { target = h; break; }
        }
      }
      if (!target) return null;

      const wrap = document.createElement('div');
      wrap.className = 'docx-mammoth';
      // skip the H2 itself — already shown in fcModalQ above the divider
      let el = target.nextElementSibling;
      while (el && !/^H[123]$/.test(el.tagName)) {
        wrap.appendChild(el.cloneNode(true));
        el = el.nextElementSibling;
      }
      return wrap;
    }

    const els = {
      filters: document.getElementById('fcFilters'),
      card: document.getElementById('fcCard'),
      qEl: document.getElementById('fcQuestion'),
      chEl: document.getElementById('fcChapter'),
      posEl: document.getElementById('fcPos'),
      empty: document.getElementById('fcEmpty'),
      progressText: document.getElementById('fcProgressText'),
      progressFill: document.getElementById('fcProgressFill'),
      deckCount: document.getElementById('fcDeckCount'),
      prev: document.getElementById('fcPrev'),
      next: document.getElementById('fcNext'),
      shuffle: document.getElementById('fcShuffle'),
      reset: document.getElementById('fcReset'),
      good: document.getElementById('fcGood'),
      bad: document.getElementById('fcBad'),
    };
    if (!els.card) return;

    // Single chapter selected with sections → show section sub-filters
    function activeSectionedChapter() {
      if (activeChapters.length !== 1) return null;
      const ch = activeChapters[0];
      return SECTIONED_CHAPTERS.includes(ch) ? ch : null;
    }

    function rebuildDeck() {
      const secCh = activeSectionedChapter();
      deck = DATA.filter(d => {
        if (!activeChapters.includes(d.ch)) return false;
        if (secCh && activeSections.length && d.section)
          return activeSections.includes(d.section);
        return true;
      }).map(d => d.id);
      pos = 0; render();
    }

    function renderFilters() {
      els.filters.innerHTML = '';

      // ── Chapter chips ──
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'fc-chip' + (activeChapters.length === CHAPTERS.length ? ' is-active' : '');
      allBtn.innerHTML = `Все <span class="fc-chip-n">${DATA.length}</span>`;
      allBtn.addEventListener('click', () => {
        activeChapters = CHAPTERS.slice();
        activeSections = [];
        saveJ('javanotes-fc-filters-v1', activeChapters);
        saveJ('javanotes-fc-sections-v1', activeSections);
        renderFilters(); rebuildDeck();
      });
      els.filters.appendChild(allBtn);

      CHAPTERS.forEach(ch => {
        const n = DATA.filter(d => d.ch === ch).length;
        const btn = document.createElement('button');
        btn.type = 'button';
        const isOn = activeChapters.includes(ch) && activeChapters.length !== CHAPTERS.length;
        btn.className = 'fc-chip' + (isOn ? ' is-active' : '');
        btn.innerHTML = `${ch} <span class="fc-chip-n">${n}</span>`;
        btn.addEventListener('click', () => {
          if (activeChapters.length === CHAPTERS.length) {
            activeChapters = [ch];
          } else if (activeChapters.includes(ch)) {
            if (activeChapters.length > 1) activeChapters = activeChapters.filter(c => c !== ch);
          } else {
            activeChapters = [...activeChapters, ch];
          }
          activeSections = [];
          saveJ('javanotes-fc-filters-v1', activeChapters);
          saveJ('javanotes-fc-sections-v1', activeSections);
          renderFilters(); rebuildDeck();
        });
        els.filters.appendChild(btn);
      });

      // ── Section chips (only when single sectioned chapter selected) ──
      const secCh = activeSectionedChapter();
      if (secCh) {
        const sections = getSections(secCh);
        if (sections.length > 1) {
          const row = document.createElement('div');
          row.className = 'fc-section-row';

          const allSecBtn = document.createElement('button');
          allSecBtn.type = 'button';
          allSecBtn.className = 'fc-chip fc-chip-sec' + (!activeSections.length ? ' is-active' : '');
          const totalSec = DATA.filter(d => d.ch === secCh).length;
          allSecBtn.innerHTML = `Все разделы <span class="fc-chip-n">${totalSec}</span>`;
          allSecBtn.addEventListener('click', () => {
            activeSections = [];
            saveJ('javanotes-fc-sections-v1', activeSections);
            renderFilters(); rebuildDeck();
          });
          row.appendChild(allSecBtn);

          sections.forEach(sec => {
            const n = DATA.filter(d => d.ch === secCh && d.section === sec).length;
            const btn = document.createElement('button');
            btn.type = 'button';
            const isOn = activeSections.includes(sec);
            btn.className = 'fc-chip fc-chip-sec' + (isOn ? ' is-active' : '');
            btn.innerHTML = `${sec} <span class="fc-chip-n">${n}</span>`;
            btn.addEventListener('click', () => {
              if (!activeSections.length) {
                activeSections = [sec];
              } else if (activeSections.includes(sec)) {
                activeSections = activeSections.filter(s => s !== sec);
              } else {
                activeSections = [...activeSections, sec];
              }
              saveJ('javanotes-fc-sections-v1', activeSections);
              renderFilters(); rebuildDeck();
            });
            row.appendChild(btn);
          });
          els.filters.appendChild(row);
        }
      }
    }

    function updateProgressUI() {
      const known = Object.values(progress).filter(v => v === 'good').length;
      els.progressText.textContent = `${known} / ${DATA.length} выучено`;
      els.progressFill.style.width = (DATA.length ? known / DATA.length * 100 : 0) + '%';
      els.deckCount.textContent = `в подборке: ${deck.length}`;
    }

    function render() {
      updateProgressUI();
      if (!deck.length) { els.card.hidden = true; els.empty.hidden = false; return; }
      els.card.hidden = false; els.empty.hidden = true;
      const d = DATA[deck[pos]];
      els.qEl.textContent = d.q;
      els.chEl.textContent = d.ch;
      els.posEl.textContent = `${pos + 1} / ${deck.length}`;
    }

    function openInDrawer() {
      if (!deck.length) return;
      const d = DATA[deck[pos]];
      const drawer = document.getElementById('mat-drawer');
      const drawerBody = document.getElementById('mat-drawer-body');
      const drawerTitle = document.getElementById('mat-drawer-title');
      const backdrop = document.getElementById('mat-drawer-backdrop');
      if (!drawer) return;

      drawerTitle.textContent = d.ch;
      drawerBody.innerHTML = '<p style="color:var(--text-dim);padding:16px 0">Загрузка…</p>';
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');

      getChapterContainer(d.ch).then(container => {
        if (!drawer.classList.contains('is-open')) return;
        drawerBody.innerHTML = '';
        const clone = container.cloneNode(true);
        drawerBody.appendChild(clone);
        const target = d.anchor ? clone.querySelector(`[data-anchor="${d.anchor}"]`) : null;
        if (target) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
      });
    }

    function goTo(n) {
      if (!deck.length) return;
      pos = ((n % deck.length) + deck.length) % deck.length;
      render();
    }
    function mark(status) {
      if (!deck.length) return;
      progress[deck[pos]] = status;
      saveJ('javanotes-fc-progress-v1', progress);
      goTo(pos + 1);
    }

    els.card.addEventListener('click', openInDrawer);
    els.good.addEventListener('click', () => mark('good'));
    els.bad.addEventListener('click', () => mark('bad'));
    els.prev.addEventListener('click', () => goTo(pos - 1));
    els.next.addEventListener('click', () => goTo(pos + 1));
    els.shuffle.addEventListener('click', () => {
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      pos = 0; render();
    });
    els.reset.addEventListener('click', () => {
      if (!confirm('Сбросить весь прогресс по флеш-картам?')) return;
      progress = {}; saveJ('javanotes-fc-progress-v1', progress); render();
    });
    document.addEventListener('keydown', e => {
      if (!document.getElementById('fcCard')) return;
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); openInDrawer(); }
      else if (e.key === 'ArrowRight') goTo(pos + 1);
      else if (e.key === 'ArrowLeft') goTo(pos - 1);
    });

    activeChapters = activeChapters.filter(c => CHAPTERS.includes(c));
    if (!activeChapters.length) activeChapters = CHAPTERS.slice();
    renderFilters(); rebuildDeck();
  }

  chBtns.forEach(btn => btn.addEventListener('click', () => loadChapter(btn)));
  matBtns.forEach(btn => btn.addEventListener('click', () => loadDocx(btn)));

  // subnav anchor clicks
  document.querySelectorAll('.subnav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const el = root.querySelector('#' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // load first chapter on start
  const first = chBtns[0];
  if (first) loadChapter(first);

  // lightbox
  const lbOverlay = document.getElementById('lb-overlay');
  const lbImg     = document.getElementById('lb-img');
  const lbClose   = document.getElementById('lb-close');
  let lbScale = 1;

  root.addEventListener('click', e => {
    const img = e.target.closest('img');
    if (!img) return;
    lbImg.src = img.src;
    lbScale = 1;
    lbImg.style.transform = 'scale(1)';
    lbOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });

  lbImg.addEventListener('click', e => {
    e.stopPropagation();
    lbScale = lbScale < 1.8 ? lbScale + 0.4 : 1;
    lbImg.style.transform = `scale(${lbScale})`;
    lbImg.style.cursor = lbScale > 1 ? 'zoom-out' : 'zoom-in';
  });

  function closeLb() {
    lbOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  lbOverlay.addEventListener('click', closeLb);
  lbClose.addEventListener('click', e => { e.stopPropagation(); closeLb(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  // Material drawer
  const matDrawer    = document.getElementById('mat-drawer');
  const matDrawerClose  = document.getElementById('mat-drawer-close');
  const matDrawerBackdrop = document.getElementById('mat-drawer-backdrop');

  function closeDrawer() {
    matDrawer.classList.remove('is-open');
    matDrawerBackdrop.classList.remove('is-open');
  }

  matDrawerClose.addEventListener('click', closeDrawer);
  matDrawerBackdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
})();
