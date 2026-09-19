(function () {
  const root = document.getElementById('chapter-root');
  const chBtns = Array.from(document.querySelectorAll('.ch[data-file]'));

  function setActive(btn) {
    chBtns.forEach(b => b.classList.remove('is-active'));
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
        // handle anchor links inside chapter
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

  chBtns.forEach(btn => {
    btn.addEventListener('click', () => loadChapter(btn));
  });

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
})();
