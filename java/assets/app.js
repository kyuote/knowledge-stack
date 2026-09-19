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

  // Post-process <p> elements: group consecutive pure-code lines into <pre><code>
  const JAVA_LINE = /^[\s\t]*(public|private|protected|static |final |abstract |class |interface |enum |import |package |@\w|\w[\w<>[\],\s]*\s+\w+\s*[=({\[]|return |throw |new |\/\/|if\s*\(|for\s*\(|while\s*\(|try\s*\{|catch\s*\(|\}|\{|.*[;{]$)/;
  const HAS_CYRILLIC = /[а-яёА-ЯЁ]/;

  function isCodeLine(text) {
    if (!text.trim()) return false;
    if (HAS_CYRILLIC.test(text)) return false;
    return JAVA_LINE.test(text.trim()) || /[{};]/.test(text);
  }

  const paras = Array.from(container.querySelectorAll('p'));
  let i = 0;
  while (i < paras.length) {
    const el = paras[i];
    if (!container.contains(el)) { i++; continue; }
    const text = el.textContent;
    if (isCodeLine(text)) {
      const block = [text];
      let j = i + 1;
      while (j < paras.length && container.contains(paras[j]) && isCodeLine(paras[j].textContent)) {
        block.push(paras[j].textContent);
        j++;
      }
      // Only wrap multi-line blocks or single lines with clear Java syntax
      if (block.length > 1 || /[{};]/.test(text)) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'language-java';
        code.textContent = block.join('\n');
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

    fetch(btn.dataset.docx)
      .then(r => r.arrayBuffer())
      .then(buf => mammoth.convertToHtml({
        arrayBuffer: buf,
        styleMap: [
          "p[style-name='Preformatted Text'] => pre:fresh",
          "p[style-name='Code'] => pre:fresh",
          "p[style-name='code'] => pre:fresh",
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
        detectAndWrapCode(container);
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
