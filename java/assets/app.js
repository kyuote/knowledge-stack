function buildDocxToc(container) {
  const h2s = container.querySelectorAll('h2, h3');
  if (h2s.length < 2) return; // not enough structure to bother

  // Assign ids to all headings that need them
  let n = 0;
  container.querySelectorAll('h1, h2, h3, h4').forEach(h => {
    if (!h.id) h.id = 'jh' + (n++);
  });

  // Build TOC from H2, H3, H4
  const entries = Array.from(container.querySelectorAll('h2, h3, h4'));

  const nav = document.createElement('nav');
  nav.className = 'docx-toc';
  const ul = document.createElement('ul');
  entries.forEach(h => {
    const li = document.createElement('li');
    li.className = h.tagName === 'H4' ? 'toc-h4' : h.tagName === 'H3' ? 'toc-h3' : 'toc-h2';
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    a.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
  nav.appendChild(ul);

  // Insert after H1 (or at start if no H1)
  const h1 = container.querySelector('h1');
  if (h1) h1.insertAdjacentElement('afterend', nav);
  else container.prepend(nav);
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
  const firstH1 = container.querySelector('h1, h2, h3');
  if (firstH1) {
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
      const parent = p.parentNode;
      const anchor = paras[j] && paras[j].parentNode === parent ? paras[j] : null;
      const row = makeRow(group);
      if (firstGroup && firstHeading && group.length >= 1) {
        firstHeading.insertAdjacentElement('afterend', row);
        firstGroup = false;
      } else {
        parent.insertBefore(row, anchor);
      }
      i = j;
    } else {
      i++;
    }
  }
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
  const JAVA_START = /^[\s\t]*(public|private|protected|static |final |abstract |class |interface |enum |import |package |@\w|\w[\w<>,\s]*\s+[a-z_]\w*\s*[=({\[]|return |throw |new |if\s*\(|for\s*\(|while\s*\(|try[\s{]|catch\s*\(|switch\s*\(|\}|\{|\/\/|\w[\w.<>]*\s*\()/;

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
    return JAVA_START.test(first) || /[{};]/.test(first);
  }

  function paraText(el) {
    // Do NOT trim — leading spaces are indentation in code blocks
    return el.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\r/g, '');
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
        const t = paraText(paras[j]);
        if (depth > 0 || isCodeStart(t)) {
          block.push(t);
          depth += (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;
          j++;
        } else {
          break;
        }
      }

      if (block.length > 1 || /[{};]/.test(text)) {
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

  function loadDocx(btn) {
    setActive(btn);
    root.innerHTML = '<p style="color:var(--text-dim);padding:40px">Загрузка документа…</p>';
    window.scrollTo(0, 0);

    fetch(btn.dataset.docx + '?v=' + Date.now())
      .then(r => r.arrayBuffer())
      .then(buf => mammoth.convertToHtml({
        arrayBuffer: buf,
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
        ]
      }))
      .then(result => {
        root.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'docx-mammoth';
        if (btn.dataset.images) {
          const imgWrap = document.createElement('div');
          imgWrap.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px';
          btn.dataset.images.split(',').forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = 'flex:1;min-width:260px;max-width:100%;border-radius:8px;border:1px solid var(--border)';
            imgWrap.appendChild(img);
          });
          container.appendChild(imgWrap);
        }
        container.insertAdjacentHTML('beforeend', result.value);
        // Remove Word built-in TOC entries (text + tab + page number)
        container.querySelectorAll('p').forEach(p => {
          if (/\t\d+\s*$/.test(p.textContent)) p.remove();
        });
        cleanAnchorLeaks(container);
        detectAndWrapCode(container);
        linkifyInPage(container);
        wrapDocxImageRows(container);
        buildDocxToc(container);
        root.appendChild(container);
        window.scrollTo(0, 0);
      })
      .catch(e => {
        root.innerHTML = `<p style="color:var(--text-dim);padding:40px">Ошибка загрузки: ${e.message}</p>`;
      });
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
})();
