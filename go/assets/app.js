// ─────────────────────────────────────────────────────────────────────────────
//  Navigation — dynamic chapter loading
// ─────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  // Map chapter number → file path
  var CHAPTER_FILES = {
    1:  'chapters/01-basic-syntax.html',
    2:  'chapters/02-control-flow.html',
    3:  'chapters/03-functions.html',
    4:  'chapters/04-collections.html',
    5:  'chapters/05-pointers.html',
    6:  'chapters/06-methods-interfaces.html',
    7:  'chapters/07-errors.html',
    8:  'chapters/08-concurrency.html',
    9:  'chapters/09-generics.html',
    10: 'chapters/10-stdlib.html',
    11: 'chapters/11-testing.html',
    12: 'chapters/12-http-server.html',
    13: 'chapters/13-idioms.html',
    14: 'chapters/14-infra-db.html',
    15: 'chapters/15-cheatsheet.html',
    16: 'chapters/16-flashcards.html',
  };

  // Map anchor id → chapter number (built from sidebar subnav)
  var anchorChapter = {};
  document.querySelectorAll('.subnav[data-for]').forEach(function(sn) {
    sn.querySelectorAll('a[href^="#"]').forEach(function(a) {
      anchorChapter[a.getAttribute('href').slice(1)] = Number(sn.dataset.for);
    });
  });

  var chapterRoot = document.getElementById('chapter-root');
  var cache = {};           // { chapterNum: htmlString }
  window._currentChapter = null;

  function updateSidebar(n) {
    document.querySelectorAll('.ch[data-chapter]').forEach(function(el) {
      el.classList.toggle('is-active', el.dataset.chapter === String(n));
    });
    document.querySelectorAll('.subnav[data-for]').forEach(function(el) {
      el.hidden = el.dataset.for !== String(n);
    });
  }

  function initDepthBtns() {
    chapterRoot.querySelectorAll('.depth-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var open = btn.dataset.action === 'expand';
        chapterRoot.querySelectorAll('details.deep').forEach(function(d) { d.open = open; });
      });
    });
  }

  function afterLoad(n) {
    window._currentChapter = n;
    if (window.hljs) {
      chapterRoot.querySelectorAll('pre code').forEach(function(el) {
        hljs.highlightElement(el);
      });
    }
    initDepthBtns();
    if (n === 16) {
      // Flashcards chapter — wait for DOM then init
      if (typeof initFlashcards === 'function') initFlashcards();
    }
    // Scroll to anchor if in hash
    var hash = location.hash.slice(1);
    if (hash) {
      var el = document.getElementById(hash);
      if (el) { setTimeout(function() { el.scrollIntoView({ behavior: 'smooth' }); }, 50); }
    }
  }

  function loadChapter(n) {
    n = Number(n);
    var file = CHAPTER_FILES[n];
    if (!file) return;

    updateSidebar(n);
    window.scrollTo(0, 0);
    location.hash = '';  // clear hash on chapter switch

    if (cache[n]) {
      chapterRoot.dataset.chapter = n;
      chapterRoot.innerHTML = cache[n];
      afterLoad(n);
      return;
    }

    // Show loading state
    chapterRoot.innerHTML = '<p style="padding:32px;opacity:.4">Загрузка…</p>';

    fetch(file)
      .then(function(r) { return r.text(); })
      .then(function(html) {
        cache[n] = html;
        chapterRoot.dataset.chapter = n;
        chapterRoot.innerHTML = html;
        afterLoad(n);
      })
      .catch(function(err) {
        chapterRoot.innerHTML = '<p style="padding:32px;color:red">Ошибка загрузки главы: ' + err.message + '</p>';
      });
  }

  // Expose globally so inline onclick can call it (backwards compat)
  window.selectChapter = loadChapter;

  // Wire sidebar buttons
  document.querySelectorAll('.ch[data-chapter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      loadChapter(Number(btn.dataset.chapter));
    });
  });

  // Load initial chapter from URL hash or default to 1
  var initHash = location.hash.slice(1);
  var initChapter = anchorChapter[initHash] || 1;
  loadChapter(initChapter);

})();


  // ---------- flashcards (глава 16) ----------
  // Called by loadChapter() after chapter 16 HTML is injected into the DOM.
  // Loads flashcard data from assets/flashcards.json (fetch), then initialises the UI.
  function initFlashcards() {
    fetch('assets/flashcards.json')
      .then(function(r) { return r.json(); })
      .then(function(DATA) { _runFlashcards(DATA); })
      .catch(function() { /* flashcards unavailable */ });
  }
  function _runFlashcards(DATA) {
    if (!DATA || !DATA.length) return;

    DATA.forEach(function(d, i){ d.id = i; });

    var CHAPTERS = [];
    DATA.forEach(function(d){ if (CHAPTERS.indexOf(d.ch) === -1) CHAPTERS.push(d.ch); });

    function loadJSON(key, fallback){
      try {
        var v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    }
    function saveJSON(key, val){
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    }

    var progress = loadJSON('gonotes-fc-progress-v1', {});      // {id: 'good'|'bad'}
    var activeChapters = loadJSON('gonotes-fc-filters-v1', CHAPTERS.slice());

    var deck = [];
    var pos = 0;
    var flipped = false;

    var els = {
      filters: document.getElementById('fcFilters'),
      card: document.getElementById('fcCard'),
      qEl: document.getElementById('fcQuestion'),
      aEl: document.getElementById('fcAnswer'),
      srcEl: document.getElementById('fcSource'),
      chFront: document.getElementById('fcChapterFront'),
      chBack: document.getElementById('fcChapterBack'),
      posFront: document.getElementById('fcPosFront'),
      empty: document.getElementById('fcEmpty'),
      progressText: document.getElementById('fcProgressText'),
      progressFill: document.getElementById('fcProgressFill'),
      deckCount: document.getElementById('fcDeckCount'),
      prev: document.getElementById('fcPrev'),
      next: document.getElementById('fcNext'),
      shuffle: document.getElementById('fcShuffle'),
      good: document.getElementById('fcGood'),
      bad: document.getElementById('fcBad'),
      reset: document.getElementById('fcReset')
    };

    function shuffleArr(arr){
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function rebuildDeck(keepOrder){
      var ids = DATA.filter(function(d){ return activeChapters.indexOf(d.ch) !== -1; }).map(function(d){ return d.id; });
      if (!keepOrder) { /* keep natural order by default */ }
      deck = ids;
      pos = 0;
      flipped = false;
      render();
    }

    function renderFilters(){
      els.filters.innerHTML = '';
      var allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'fc-chip' + (activeChapters.length === CHAPTERS.length ? ' is-active' : '');
      allBtn.innerHTML = 'Все <span class="fc-chip-n">' + DATA.length + '</span>';
      allBtn.addEventListener('click', function(){
        activeChapters = CHAPTERS.slice();
        saveJSON('gonotes-fc-filters-v1', activeChapters);
        renderFilters();
        rebuildDeck();
      });
      els.filters.appendChild(allBtn);

      CHAPTERS.forEach(function(ch){
        var n = DATA.filter(function(d){ return d.ch === ch; }).length;
        var btn = document.createElement('button');
        btn.type = 'button';
        var isOn = activeChapters.indexOf(ch) !== -1 && activeChapters.length !== CHAPTERS.length;
        btn.className = 'fc-chip' + (isOn ? ' is-active' : '');
        btn.innerHTML = ch + ' <span class="fc-chip-n">' + n + '</span>';
        btn.addEventListener('click', function(){
          if (activeChapters.length === CHAPTERS.length) {
            activeChapters = [ch]; // isolate
          } else if (activeChapters.indexOf(ch) !== -1) {
            if (activeChapters.length > 1) activeChapters = activeChapters.filter(function(c){ return c !== ch; });
          } else {
            activeChapters = activeChapters.concat([ch]);
          }
          saveJSON('gonotes-fc-filters-v1', activeChapters);
          renderFilters();
          rebuildDeck();
        });
        els.filters.appendChild(btn);
      });
    }

    function updateProgressUI(){
      var knownGlobal = Object.keys(progress).filter(function(k){ return progress[k] === 'good'; }).length;
      els.progressText.textContent = knownGlobal + ' / ' + DATA.length + ' выучено';
      els.progressFill.style.width = (DATA.length ? (knownGlobal / DATA.length * 100) : 0) + '%';
      els.deckCount.textContent = 'в подборке: ' + deck.length;
    }

    function render(){
      updateProgressUI();
      if (!deck.length) {
        els.card.hidden = true;
        els.empty.hidden = false;
        return;
      }
      els.card.hidden = false;
      els.empty.hidden = true;
      var d = DATA[deck[pos]];
      els.qEl.innerHTML = d.q;
      els.aEl.innerHTML = d.a;
      els.srcEl.textContent = d.src ? ('источник: ' + d.src.replace(/<[^>]+>/g, '')) : '';
      els.srcEl.hidden = !d.src;
      els.chFront.textContent = d.ch;
      els.chBack.textContent = d.ch;
      els.posFront.textContent = '· ' + (pos + 1) + '/' + deck.length;
      els.card.classList.toggle('is-flipped', flipped);
    }

    function goTo(newPos){
      if (!deck.length) return;
      pos = ((newPos % deck.length) + deck.length) % deck.length;
      flipped = false;
      render();
    }

    function mark(status){
      if (!deck.length) return;
      var id = deck[pos];
      progress[id] = status;
      saveJSON('gonotes-fc-progress-v1', progress);
      goTo(pos + 1);
    }

    els.card.addEventListener('click', function(){
      flipped = !flipped;
      els.card.classList.toggle('is-flipped', flipped);
    });
    els.prev.addEventListener('click', function(){ goTo(pos - 1); });
    els.next.addEventListener('click', function(){ goTo(pos + 1); });
    els.shuffle.addEventListener('click', function(){ shuffleArr(deck); pos = 0; flipped = false; render(); });
    els.good.addEventListener('click', function(){ mark('good'); });
    els.bad.addEventListener('click', function(){ mark('bad'); });
    els.reset.addEventListener('click', function(){
      if (!confirm('Сбросить весь прогресс по флеш-картам?')) return;
      progress = {};
      saveJSON('gonotes-fc-progress-v1', progress);
      render();
    });

    document.addEventListener('keydown', function(e){
      if (window._currentChapter !== 16) return;
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); flipped = !flipped; els.card.classList.toggle('is-flipped', flipped); }
      else if (e.key === 'ArrowRight') { goTo(pos + 1); }
      else if (e.key === 'ArrowLeft') { goTo(pos - 1); }
    });

    // sanitize any stale chapter names from an older data version
    activeChapters = activeChapters.filter(function(c){ return CHAPTERS.indexOf(c) !== -1; });
    if (!activeChapters.length) activeChapters = CHAPTERS.slice();

    renderFilters();
    rebuildDeck();
  }

  // ---------- панель "реализация" под капотом ----------
  (function(){
    var IMPL_DATA = {
      bool: {
        title: 'bool — под капотом',
        html: `
          <p class="tight"><code class="inline">bool</code> — предопределённый тип с двумя значениями (<code class="inline">true</code>/<code class="inline">false</code>), zero value — <code class="inline">false</code>. Операторов пять: <code class="inline">==</code>, <code class="inline">!=</code>, <code class="inline">&amp;&amp;</code>, <code class="inline">||</code>, <code class="inline">!</code>. Операторов порядка и неявных преобразований в/из чисел нет.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/builtin/builtin.go</span></div>
            <pre><code class="language-go">// bool — заглушка для godoc, реального кода тут нет
type bool bool

// true и false — НЕтипизированные булевы константы,
// выведенные из сравнения, а не заданные литералом:
const (
    true  = 0 == 0 // Untyped bool.
    false = 0 != 0 // Untyped bool.
)</code></pre>
          </div>

          <div class="bytefig">
            <div class="bytefig-label">bool в памяти — 1 байт (8 бит)</div>
            <div class="byterow">
              <span class="byte-state">false</span>
              <div class="bits">
                <span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span>
                <span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit is-highlight">0</span>
              </div>
              <span class="byte-tag">0x00</span>
            </div>
            <div class="byterow">
              <span class="byte-state">true</span>
              <div class="bits">
                <span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span>
                <span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit is-one">1</span>
              </div>
              <span class="byte-tag">0x01</span>
            </div>
          </div>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p><b>Почему байт, а не бит?</b> Память адресуется побайтово — минимальная единица, у которой вообще есть адрес, это байт, а не бит. Если бы <code class="inline">bool</code> занимал 1 бит, взять его адрес (<code class="inline">&amp;flag</code>) было бы физически нечем — «адреса бита» в модели памяти не существует. Команды процессора для чтения/записи (<code class="inline">mov</code>, <code class="inline">ldr</code>/<code class="inline">str</code>) тоже оперируют минимум байтом за одну операцию.</p>
          </div>

          <p class="tight">Упаковка нескольких булов в байт технически возможна (C-битовые поля через <code class="inline">unsigned x : 1</code>), но не бесплатна: чтение бита — «прочитать байт → сдвинуть → замаскировать», запись — read-modify-write всего байта (источник гонки, если разные булевы поля делят байт между горутинами). Go битовых полей не поддерживает — сознательно, ради простоты и дешёвого доступа к каждому полю.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/sync/atomic/type.go</span></div>
            <pre><code class="language-go">// atomic.Bool (Go 1.19+) — типобезопасная обёртка,
// но внутри всё равно не «настоящий» bool, а uint32:
type Bool struct {
    _ noCopy
    v uint32
}

func b32(b bool) uint32 {
    if b {
        return 1
    }
    return 0
}

func (x *Bool) Load() bool     { return LoadUint32(&x.v) != 0 }
func (x *Bool) Store(val bool) { StoreUint32(&x.v, b32(val)) }</code></pre>
          </div>

          <p class="tight">Даже добавив в 2022 «нормальный» атомарный bool, авторы не стали оперировать самим байтом напрямую — атомарные инструкции процессора надёжно определены на размер машинного слова, не на произвольный байт. <code class="inline">atomic.Bool</code> — типобезопасный API поверх той же ручной техники (<code class="inline">uint32</code> + <code class="inline">b32()</code>), которую раньше писали руками.</p>

          <div class="impl-sources">Источники: go.dev/ref/spec#Boolean_types · github.com/golang/go (src/builtin/builtin.go, src/sync/atomic/type.go) · go.dev/doc/go1.19</div>
        `
      },

  // ---------- "int" entry, appended to IMPL_DATA ----------
      int: {
        title: 'Целые числа — под капотом',
        html: `
          <p class="tight"><code class="inline">int8…int64</code>/<code class="inline">uint8…uint64</code> и платформозависимые <code class="inline">int</code>/<code class="inline">uint</code> устроены одинаково, разница только в ширине. Разбираем на <code class="inline">int8</code>, потом смотрим, что меняется при масштабировании.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/builtin/builtin.go</span></div>
            <pre><code class="language-go">// int8 is the set of all signed 8-bit integers.
// Range: -128 through 127.
type int8 int8

// uint8 is the set of all unsigned 8-bit integers.
// Range: 0 through 255.
type uint8 uint8

// int is a signed integer type that is at least 32 bits in size.
// It is a distinct type, however, and not an alias for, say, int32.
type int int</code></pre>
          </div>

          <p class="tight">Спецификация говорит «не меньше 32 бит», а не «32 или 64». На практике везде ровно 32 или 64 бита в зависимости от <code class="inline">GOARCH</code> — но это свойство реализаций, а не гарантия спецификации.</p>

          <div class="bytefig">
            <div class="bytefig-label">int8 в памяти — дополнительный код (two's complement), 1 байт</div>
            <div class="byterow">
              <span class="byte-state">127</span>
              <div class="bits"><div class="bitbyte"><span class="bit is-highlight">0</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span></div></div>
              <span class="byte-tag">0x7F</span>
            </div>
            <div class="byterow">
              <span class="byte-state">-1</span>
              <div class="bits"><div class="bitbyte"><span class="bit is-one is-highlight">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span></div></div>
              <span class="byte-tag">0xFF</span>
            </div>
            <div class="byterow">
              <span class="byte-state">-128</span>
              <div class="bits"><div class="bitbyte"><span class="bit is-one is-highlight">1</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span></div></div>
              <span class="byte-tag">0x80</span>
            </div>
          </div>

          <div class="callout interview">
            <div class="mark">спецификация</div>
            <p>«The value of an n-bit integer is n bits wide and represented using two's complement arithmetic» — старший бит (выделен рамкой) одновременно и знаковый, и часть обычной битовой записи числа, отдельного «флага знака» физически не существует.</p>
          </div>

          <div class="regfig">
            <div class="regfig-label">та же схема, но шире — int32, значение -1 (все биты — единицы)</div>
            <div class="regrow">
              <div class="regrow-bits"><div class="bitbyte"><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span></div><div class="bitbyte"><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span></div></div>
            </div>
            <div class="regrow">
              <div class="regrow-bits"><div class="bitbyte"><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span></div><div class="bitbyte"><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span></div><span class="byte-tag">0xFFFFFFFF</span></div>
            </div>
          </div>
          <p class="tight">Для <code class="inline">int16</code>/<code class="inline">int64</code> — тот же принцип, просто больше байтовых групп. Ничего концептуально нового с ростом ширины.</p>

          <div class="callout warn">
            <div class="mark">переполнение</div>
            <p>Спецификация (раздел «Integer overflow»): для беззнаковых — <code class="inline">+ - * &lt;&lt;</code> считаются по модулю 2ⁿ; для знаковых — результат переполнения «detereministically defined by the signed integer representation, the operation, and its operands» и явно: <b>«Overflow does not cause a run-time panic»</b>. В отличие от C/C++, где переполнение знаковых целых — undefined behavior (компилятор вправе оптимизировать код в предположении, что оно не случится), в Go оно детерминировано специфицировано.</p>
          </div>

          <p class="tight">Конвертация между размерами — отдельная механика. Спецификация («Conversions»): «if the value is a signed integer, it is sign extended to implicit infinite precision; otherwise it is zero extended. It is then truncated to fit in the result type's size». Пример из спецификации по байтам:</p>

          <div class="regfig">
            <div class="regfig-label">uint16(0x10F0) → int8(v) → uint32(...) == 0xFFFFFFF0</div>
            <div class="regrow">
              <div class="regrow-label">uint16(0x10F0)</div>
              <div class="regrow-bits"><div class="bitbyte"><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit is-one">1</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span></div><div class="bitbyte"><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span></div><span class="byte-tag">0x10F0</span></div>
            </div>
            <div class="regrow">
              <div class="regrow-label">int8(v) — усечение до младшего байта</div>
              <div class="regrow-bits"><div class="bitbyte"><span class="bit is-one is-highlight">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit is-one">1</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span><span class="bit">0</span></div><span class="byte-tag">0xF0 (= -16)</span></div>
            </div>
            <div class="regrow">
              <div class="regrow-label">uint32(int8(v)) — знаковое расширение, затем усечение до 32 бит</div>
              <div class="regrow-bits"><div class="bitbyte"><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span></div><div class="bitbyte"><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span></div></div>
            </div>
            <div class="regrow">
              <div class="regrow-bits"><div class="bitbyte"><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span><span class="bit bit-sm is-ext">1</span></div><div class="bitbyte"><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm is-one">1</span><span class="bit bit-sm">0</span><span class="bit bit-sm">0</span><span class="bit bit-sm">0</span><span class="bit bit-sm">0</span></div><span class="byte-tag">0xFFFFFFF0</span></div>
            </div>
            <div class="reg-legend">
              <span><i class="i-one"></i>исходные биты числа</span>
              <span><i class="i-ext"></i>добавлено sign extension (копия знакового бита)</span>
            </div>
          </div>
          <p class="tight">Знаковый бит младшего байта (<code class="inline">1</code> в <code class="inline">0xF0</code>) размножается влево на все новые биты — это и есть «implicit infinite precision»: копирование идёт, пока не наберётся ширина результата, потом всё усекается по ней.</p>

          <div class="callout warn">
            <div class="mark">int128?</div>
            <p>В трекере есть предложение <code class="inline">golang/go#9455</code> добавить встроенные <code class="inline">int128</code>/<code class="inline">uint128</code>. Формально не отклонено, но помечено <code class="inline">Milestone: Unplanned</code> — то есть де-факто не планируется. Для 128-битной арифметики используют <code class="inline">math/bits.Mul64</code>/<code class="inline">Add64</code> вручную либо сторонние пакеты.</p>
          </div>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/builtin/builtin.go</span></div>
            <pre><code class="language-go">// byte is an alias for uint8 — просто другое имя, не отдельный тип
type byte = uint8

// rune is an alias for int32 — тоже просто алиас
type rune = int32</code></pre>
          </div>

          <p class="tight" style="font-size:12.5px;color:var(--text-dim);">Историческая деталь: сама раскладка в памяти не менялась никогда — а вот в Go 1.13 добавили новые форматы литералов (<code class="inline">0b1011</code>, <code class="inline">0o660</code>, разделитель <code class="inline">1_000_000</code>) и убрали требование, чтобы счётчик сдвига в <code class="inline">&lt;&lt;</code> / <code class="inline">&gt;&gt;</code> был обязательно <code class="inline">uint</code>.</p>

          <div class="impl-sources">Источники: go.dev/ref/spec (Numeric types, Integer overflow, Conversions) · github.com/golang/go (src/builtin/builtin.go) · github.com/golang/go/issues/9455 · boldlygo.tech (точные цитаты из спецификации) · go.dev/doc/go1.13</div>
        `
      },

  // ---------- "float" entry, appended to IMPL_DATA ----------
      float: {
        title: 'Float — под капотом',
        html: `
          <p class="tight">В отличие от целых, у <code class="inline">float32</code>/<code class="inline">float64</code> раскладка в памяти — это не Go-специфика, а прямое повторение стандарта IEEE 754. Байты внутри те же, что в любом другом языке, который следует этому стандарту.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/builtin/builtin.go</span></div>
            <pre><code class="language-go">// float32 is the set of all IEEE 754 32-bit floating-point numbers.
type float32 float32

// float64 is the set of all IEEE 754 64-bit floating-point numbers.
type float64 float64</code></pre>
          </div>

          <p class="tight">32 бита делятся на три поля: 1 бит знака, 8 бит экспоненты (со смещением/bias 127) и 23 бита мантиссы. У <code class="inline">float64</code> тот же принцип, только шире — 1 + 11 + 52 = 64 бита, bias экспоненты 1023.</p>

          <div class="regfig">
            <div class="regfig-label">float32(1.5) = 0x3FC00000 — знак · экспонента (bias 127) · мантисса</div>
            <div class="regrow">
              <div class="regrow-bits">
                <div class="bitbyte"><span class="bit bit-sm is-fsign">0</span><span class="bit bit-sm is-fexp">0</span><span class="bit bit-sm is-fexp">1</span><span class="bit bit-sm is-fexp">1</span><span class="bit bit-sm is-fexp">1</span><span class="bit bit-sm is-fexp">1</span><span class="bit bit-sm is-fexp">1</span><span class="bit bit-sm is-fexp">1</span></div><div class="bitbyte"><span class="bit bit-sm is-fexp">1</span><span class="bit bit-sm is-fmant">1</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span></div>
              </div>
            </div>
            <div class="regrow">
              <div class="regrow-bits">
                <div class="bitbyte"><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span></div><div class="bitbyte"><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span><span class="bit bit-sm is-fmant">0</span></div><span class="byte-tag">0x3FC00000</span>
              </div>
            </div>
            <div class="reg-legend">
              <span><i class="i-fsign"></i>знак — 0 = положительное</span>
              <span><i class="i-fexp"></i>экспонента <code class="inline">01111111</code> = 127 → со смещением 127 это степень 2⁰</span>
              <span><i class="i-fmant"></i>мантисса <code class="inline">1.1₂</code> (неявная единица + сохранённая дробная часть)</span>
            </div>
          </div>

          <p class="tight">Итог: <code class="inline">1.1₂ × 2⁰ = 1.5</code>. Неявная единица перед точкой в мантиссу не пишется — это часть формата (нормализованная запись), поэтому 23 бита мантиссы реально кодируют 24 бита точности.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">math</span></div>
            <pre><code class="language-go">func Float32bits(f float32) uint32     // побитовое представление f
func Float32frombits(b uint32) float32 // Float32frombits(Float32bits(x)) == x

func Float64bits(f float64) uint64
func Float64frombits(b uint64) float64

func Signbit(x float64) bool // отрицательное число или отрицательный ноль</code></pre>
          </div>

          <div class="callout warn">
            <div class="mark">+0 и -0</div>
            <p>IEEE 754 различает два нуля на уровне битов — <code class="inline">+0</code> (все биты 0) и <code class="inline">-0</code> (бит знака поднят, остальное 0). Обычное сравнение <code class="inline">+0 == -0</code> даёт <code class="inline">true</code>, но <code class="inline">math.Signbit(x)</code> их различает, а <code class="inline">math.Max(-0, -0) == -0</code> — то есть биты реально разные, просто язык их не разводит через <code class="inline">==</code>.</p>
          </div>

          <div class="callout warn">
            <div class="mark">деньги</div>
            <p><code class="inline">var a, b float64 = 0.1, 0.2; a + b == 0.3</code> — <code class="inline">false</code> (получится <code class="inline">0.30000000000000004</code>). Причина не в багах Go, а в том, что 0.1 и 0.2 не представимы точно в двоичной дроби — как 1/3 не представим точно в десятичной. Стандартный совет для денег — хранить целые копейки/центы как <code class="inline">int64</code> либо использовать <code class="inline">big.Rat</code>/decimal-пакеты, а не <code class="inline">float64</code>.</p>
          </div>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p>Деление на 0 для float — не паника (в отличие от int): <code class="inline">1.0/0.0 = +Inf</code>, <code class="inline">-1.0/0.0 = -Inf</code>, <code class="inline">0.0/0.0 = NaN</code>. При этом <code class="inline">NaN != NaN</code> всегда <code class="inline">true</code> — классический gotcha при сравнениях и при использовании <code class="inline">NaN</code> как ключа <code class="inline">map</code> (положить можно, найти обратно по значению — нельзя).</p>
          </div>

          <div class="impl-sources">Источники: github.com/golang/go (src/builtin/builtin.go) · pkg.go.dev/math (Float32bits/frombits, Float64bits/frombits, Signbit, Max) · IEEE 754 (общий стандарт)</div>
        `
      },

  // ---------- "string" entry, appended to IMPL_DATA ----------
      string: {
        title: 'String — под капотом',
        html: `
          <div class="impl-groupline"><span class="t">Заголовок</span></div>

          <p class="tight"><code class="inline">string</code> — не «байты как есть», а <b>заголовок</b>: маленькая карточка фиксированного размера с координатами данных, без единого байта текста внутри. Карточка лежит там же, где обычная переменная (стек, регистр, поле структуры), а сами байты текста — отдельно, в куче. Это единственный базовый тип, где важнее устройство карточки, а не содержимое ячейки.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/builtin/builtin.go</span></div>
            <pre><code class="language-go">// string is the set of all strings of 8-bit bytes, conventionally but not
// necessarily representing UTF-8-encoded text. A string may be empty, but
// not nil. Values of string type are immutable.
type string string</code></pre>
          </div>

          <p class="tight" style="font-size:11.5px;color:var(--text-dim);">Это лишь заглушка для <code class="inline">godoc</code>. Настоящий заголовок — <code class="inline">stringStruct</code> в исходниках рантайма:</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/runtime/string.go</span></div>
            <pre><code class="language-go">type stringStruct struct {
    str unsafe.Pointer
    len int
}</code></pre>
          </div>

          <p class="tight" style="font-size:11.5px;color:var(--text-dim);">Всего 2 поля, без комментариев в оригинале — разбор ниже мой.</p>

          <p class="tight"><code class="inline">str</code> — <code class="inline">unsafe.Pointer</code>: не массив байт внутри структуры, а просто адрес, сами байты — отдельно в куче. <code class="inline">len</code> — обычный <code class="inline">int</code>, счётчик байт. В заголовке нет ни одного байта текста, только адрес и число.</p>

          <div class="impl-groupline"><span class="t">Длина: как определяется и когда пишется</span></div>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p><b>Как строка узнаёт, где заканчивается?</b> Только по полю <code class="inline">len</code> — счётчику байт в заголовке. В C конец строки определяется терминирующим байтом-нулём (<code class="inline">\0</code>), поэтому такая строка не может содержать байт <code class="inline">0x00</code> как часть данных — он будет принят за конец. Go-строка хранит длину явно и заранее, поэтому внутри неё <code class="inline">0x00</code> — совершенно обычный байт данных, а не признак конца: <code class="inline">len("a\x00b")</code> честно вернёт <code class="inline">3</code>, тогда как эквивалентная C-строка оборвалась бы на первом байте.</p>
          </div>

          <p class="tight" style="font-size:11.5px;color:var(--text-dim);"><code class="inline">len</code> не вычисляется на лету — его пишут один раз, при создании строки, а дальше она неизменяема. Для литерала компилятор знает число байт UTF-8 ещё на этапе сборки и зашивает его в бинарник. Для строки из конкатенации (<code class="inline">s + "!"</code>) — рантайм-функция <code class="inline">concatstrings</code> суммирует длины кусков (<code class="inline">l += len(x)</code>) и пишет сумму как <code class="inline">len</code> результата.</p>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p><b>Почему <code class="inline">len</code> — это <code class="inline">int</code>, а не <code class="inline">uint</code>? Длина ведь не может быть отрицательной.</b> Не может — но всё равно <code class="inline">int</code>, сознательно: сигнатура встроенной <code class="inline">len()</code> буквально <code class="inline">func len(v Type) int</code>. Причина — паттерн обратного цикла <code class="inline">for i := len(a)-1; i >= 0; i--</code>: будь <code class="inline">len</code> типа <code class="inline">uint</code>, при пустом <code class="inline">a</code> выражение <code class="inline">len(a)-1</code> не дало бы -1, а переполнилось бы в огромное число, и <code class="inline">i >= 0</code> стало бы вечной правдой — бесконечный цикл. Плюс общий принцип Go: <code class="inline">uint</code> — для битовых масок, <code class="inline">int</code> — для количеств, даже неотрицательных.</p>
          </div>

          <div class="impl-groupline"><span class="t">Размер заголовка</span></div>

          <p class="tight">2 поля → общий размер (это и есть <code class="inline">unsafe.Sizeof(string)</code> — вес самой переменной, без байт текста в куче). <code class="inline">str</code> — просто число-адрес, но чтобы дотянуться до любого байта в адресном пространстве, оно шириной в <b>машинное слово платформы</b> — разрядность регистров процессора: 4 байта на 32-битных системах, 8 — на 64-битных. Не догадка, а прямое следствие исходников —</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/internal/goarch/goarch.go</span></div>
            <pre><code class="language-go">// PtrSize is the size of a pointer in bytes - unsafe.Sizeof(uintptr(0))
// but as an ideal constant.
// It is also the size of the machine's native word size
// (that is, 4 on 32-bit systems, 8 on 64-bit).
const PtrSize = 4 << (^uintptr(0) >> 63)</code></pre>
          </div>

          <p class="tight">— и <code class="inline">int</code> (поле <code class="inline">len</code>) той же ширины. <code class="inline">int</code> — <b>не</b> <code class="inline">int64</code>: отдельный платформо-зависимый тип (см. таблицу типов выше), который лишь совпадает с <code class="inline">int64</code> на 64-битных системах — на 32-битных оба по 4 байта. Итого: 2 поля × слово → <b>16 байт на 64-битной платформе (amd64/arm64), 8 — на 32-битной (386/arm)</b>. Третьего поля, <code class="inline">cap</code>, как у слайса, здесь нет — строка не растёт по месту, ёмкость не нужна.</p>

          <div class="strfig">
            <div class="strfig-label">string header — 2 слова, указывают на отдельный блок байт (пример на 64-бит)</div>
            <div class="strhead">
              <div class="strfield">
                <div class="strfield-name">str (указатель)</div>
                <div class="strfield-val">0x… (пример, не из реального запуска)</div>
              </div>
              <div class="strfield">
                <div class="strfield-name">len</div>
                <div class="strfield-val">15</div>
              </div>
            </div>
            <div class="strarrow">↓ поле <code class="inline">str</code> хранит адрес именно этой ячейки — байта под индексом 0 (первого байта данных)</div>
            <p class="tight" style="font-size:11.5px;color:var(--text-dim);margin:0 0 8px;">Байты данных — в hex: 1 hex-разряд = 4 бита, байт = 2 hex-цифры. Например <code class="inline">47</code> = <code class="inline">0100 0111</code> = 71 = символ <code class="inline">G</code> по ASCII. Короче, чем 8 бит на байт — поэтому сырые байты обычно смотрят именно в hex (отладчики, <code class="inline">hexdump</code>).</p>

            <p class="tight" style="font-size:11.5px;color:var(--text-dim);margin:0 0 8px;">Биты сами по себе не знаковые и не беззнаковые — знак задаёт тип чтения. Go отдаёт байты строки как <code class="inline">byte</code> (= <code class="inline">uint8</code>), поэтому <code class="inline">D0</code> на схеме — 208, не отрицательное число.</p>
            <div class="strbytes">
              <div class="bits">
                <div class="bitbyte"><span class="bit bit-sm is-highlight">47</span><span class="bit bit-sm">6F</span><span class="bit bit-sm">2C</span><span class="bit bit-sm">20</span><span class="bit bit-sm is-ext">D0</span><span class="bit bit-sm is-ext">B3</span><span class="bit bit-sm is-ext">D0</span><span class="bit bit-sm is-ext">BE</span></div><div class="bitbyte"><span class="bit bit-sm is-ext">D1</span><span class="bit bit-sm is-ext">84</span><span class="bit bit-sm is-ext">D0</span><span class="bit bit-sm is-ext">B5</span><span class="bit bit-sm is-ext">D1</span><span class="bit bit-sm is-ext">80</span><span class="bit bit-sm">21</span></div>
              </div>
              <div class="charrow">
                <div class="bitbyte"><span class="char-sm">G</span><span class="char-sm">o</span><span class="char-sm">,</span><span class="char-sm">␣</span><span class="char-sm">г</span><span class="char-sm">г</span><span class="char-sm">о</span><span class="char-sm">о</span></div><div class="bitbyte"><span class="char-sm">ф</span><span class="char-sm">ф</span><span class="char-sm">е</span><span class="char-sm">е</span><span class="char-sm">р</span><span class="char-sm">р</span><span class="char-sm">!</span></div>
              </div>
              <div class="strlen-brace"></div>
            </div>
            <div class="strlen-label">↑ <code class="inline">len</code> = 15 — здесь и заканчивается строка, ПО СЧЁТЧИКУ, а не потому что встретился какой-то особый байт-«стоп»</div>
            <p class="tight" style="font-size:11.5px;color:var(--text-dim);margin-top:8px;">Под байтами — какой символ они хранят. Сплошная рамка — байт-ASCII, сам по себе символ (<code class="inline">G o , (space) !</code>). Пунктирная — половина кириллического символа в UTF-8 (буквы «г о ф е р» повторяются под парой байтов — это один символ на 2 байта). Итого 15 байт на 10 символов — отсюда разница <code class="inline">len(s)</code> и числа символов.</p>
          </div>

          <div class="impl-groupline"><span class="t">Неизменяемость и []byte ↔ string</span></div>

          <p class="tight">Иммутабельность — гарантия языка, не аппаратная защита: <code class="inline">s[0] = 'x'</code> не компилируется, но байты по <code class="inline">str</code> — обычная память кучи, и через <code class="inline">unsafe</code> их технически можно изменить (уже undefined behavior, но физически ничего не мешает — в отличие от read-only страницы памяти на уровне ОС).</p>

          <p class="tight"><code class="inline">[]byte ↔ string</code> в общем случае обязана копировать — иначе мутация слайса ломала бы иммутабельность расшаренной строки. Но компилятор знает 3 паттерна без копирования:</p>

          <div class="tablewrap">
            <table>
              <tr><th>Паттерн</th><th class="wrap">Почему без аллокации</th></tr>
              <tr><td><code class="inline">m[string(b)]</code></td><td class="wrap">поиск в <code class="inline">map[string]T</code> хеширует байты слайса напрямую</td></tr>
              <tr><td><code class="inline">for i, c := range []byte(s)</code></td><td class="wrap">конвертация только «для чтения по диапазону» не материализуется</td></tr>
              <tr><td><code class="inline">string(b1) == string(b2)</code></td><td class="wrap">сравнение и упорядочивание байтов напрямую, без временных строк</td></tr>
            </table>
          </div>

          <div class="impl-groupline"><span class="t">Конкатенация</span></div>

          <p class="tight"><code class="inline">+</code> компилируется в <code class="inline">runtime.concatstrings</code>: считает суммарную длину и, если результат не «убегает» за пределы стека (это решает escape-анализ компилятора), пишет во временный буфер на стеке, а не в куче:</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/runtime/string.go</span></div>
            <pre><code class="language-go">const tmpStringBufSize = 32

// rawstringtmp использует buf (32 байта на стеке), если результат туда влезает,
// иначе аллоцирует в куче через rawstring(l)
func rawstringtmp(buf *tmpBuf, l int) (s string, b []byte)</code></pre>
          </div>

          <p class="tight">Если строка одна и копировать не нужно — <code class="inline">concatstrings</code> возвращает её как есть, без аллокаций. Частный случай: <code class="inline">[]byte → string</code> в 1 байт вообще не аллоцируется — все 256 однобайтовых строк переиспользуют общий статический массив <code class="inline">staticuint64s</code>.</p>

          <div class="callout warn">
            <div class="mark">камень</div>
            <p><b><code class="inline">+=</code> в цикле</b> — ловушка: строки неизменяемы, каждая итерация копирует всё заново. <code class="inline">O(n²)</code> вместо <code class="inline">O(n)</code>.</p>
          </div>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">concat_slow.go</span></div>
            <pre><code class="language-go">var s string
for _, w := range words {
    s += w // каждая итерация: новая аллокация + копия всего s целиком
}</code></pre>
          </div>

          <p class="tight">Правильно — <code class="inline">strings.Builder</code>: пишет в растущий буфер, <code class="inline">.String()</code> отдаёт готовую строку без лишней копии. <code class="inline">O(n)</code>.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">concat_fast.go</span></div>
            <pre><code class="language-go">var b strings.Builder
for _, w := range words {
    b.WriteString(w) // дозапись в общий буфер
}
s := b.String() // готовая строка, без лишней копии</code></pre>
          </div>

          <div class="tablewrap">
            <table>
              <tr><th>Версия</th><th class="wrap">Что изменилось</th></tr>
              <tr><td>Go 1.10</td><td class="wrap"><code class="inline">strings.Builder</code> (выше) — урезанный аналог <code class="inline">bytes.Buffer</code> специально для сборки строк</td></tr>
              <tr><td>Go 1.18</td><td class="wrap"><code class="inline">strings.Clone(s)</code> — явно копирует строку так, что результат физически не ссылается на память оригинала</td></tr>
              <tr><td>Go 1.20</td><td class="wrap"><code class="inline">unsafe.String(ptr, len)</code> / <code class="inline">unsafe.StringData(s)</code> — безопасный(ее) способ конструировать/разбирать строку из сырых байтов без завязки на внутреннее представление; заодно объявлен deprecated старый <code class="inline">reflect.StringHeader</code></td></tr>
            </table>
          </div>

          <div class="impl-groupline"><span class="t">Подстрока и алиасинг памяти</span></div>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p><b>Подстрока держит в памяти весь оригинал.</b> Слайсинг не копирует байты — <code class="inline">sub := big[:10]</code> создаёт новый заголовок (<code class="inline">str</code>+<code class="inline">len</code>), указывающий в ту же память, что и <code class="inline">big</code>. Пока жив <code class="inline">sub</code>, GC не может освободить весь backing-массив <code class="inline">big</code>, даже если сам <code class="inline">big</code> больше не используется — классический скрытый memory leak: прочитали гигабайтный файл, вытащили 10-байтовый заголовок, а гигабайт всё ещё висит в памяти. Скопировать байты физически — <code class="inline">strings.Clone</code> (Go 1.18+).</p>
          </div>

          <figure>
            <svg viewBox="0 0 600 190" role="img" aria-label="big и sub — два разных заголовка (str, len), указывающие в разные места одного и того же большого блока памяти. Пока жив sub, весь блок big остаётся в памяти.">
              <defs>
                <marker id="arr-str-alias" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
                </marker>
              </defs>
              <rect x="20" y="14" width="170" height="54" rx="9" fill="none" stroke="currentColor" opacity="0.4"/>
              <text x="36" y="36" font-family="JetBrains Mono" font-size="13" fill="currentColor">big</text>
              <text x="36" y="54" font-family="JetBrains Mono" font-size="10.5" fill="currentColor" opacity="0.7">str, len=1 000 000</text>

              <rect x="410" y="14" width="170" height="54" rx="9" fill="none" stroke="currentColor" opacity="0.4"/>
              <text x="426" y="36" font-family="JetBrains Mono" font-size="13" fill="currentColor">sub</text>
              <text x="426" y="54" font-family="JetBrains Mono" font-size="10.5" fill="currentColor" opacity="0.7">str, len=10</text>

              <rect x="20" y="140" width="560" height="30" rx="6" fill="none" stroke="currentColor" opacity="0.4"/>
              <rect x="470" y="140" width="34" height="30" rx="4" style="fill:var(--accent-soft); stroke:var(--accent); stroke-width:1.5;"/>

              <line x1="60" y1="68" x2="35" y2="140" stroke="currentColor" opacity="0.55" marker-end="url(#arr-str-alias)"/>
              <line x1="470" y1="68" x2="487" y2="140" stroke="currentColor" opacity="0.55" marker-end="url(#arr-str-alias)"/>

              <text x="30" y="185" font-family="JetBrains Mono" font-size="10.5" fill="currentColor" opacity="0.7">общий backing-массив, ≈1 000 000 байт</text>
            </svg>
            <figcaption><code class="inline">big</code> и <code class="inline">sub</code> — разные заголовки, указывающие в один и тот же блок памяти на разном смещении. Пока жив хотя бы один, GC не освобождает блок целиком.</figcaption>
          </figure>

          <div class="impl-groupline"><span class="t">UTF-8 и руны</span></div>

          <p class="tight">UTF-8 — это соглашение, а не то, что рантайм проверяет силой: строка — просто байты, туда можно записать что угодно, хоть другую кодировку. Разница видна только когда байты пробуют читать как UTF-8 (<code class="inline">range</code>, <code class="inline">[]rune(s)</code>, <code class="inline">RuneCountInString</code>) — невалидные байты заменяются на <code class="inline">U+FFFD</code> («&#xFFFD;», константа <code class="inline">utf8.RuneError</code>), без паники.</p>

          <p class="tight">Посимвольно — <code class="inline">for i, r := range s</code>: за итерацию декодирует одну руну, без аллокаций. <code class="inline">i</code> — байтовый индекс начала руны, <code class="inline">r</code> — сама руна (<code class="inline">rune</code> = <code class="inline">int32</code>).</p>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p><b><code class="inline">utf8.RuneCountInString(s)</code> vs <code class="inline">len([]rune(s))</code></b> — оба дают число рун. <code class="inline">RuneCountInString</code> просто считает, без аллокаций. <code class="inline">[]rune(s)</code> аллоцирует новый слайс (4 байта на руну) просто чтобы взять <code class="inline">len()</code>. Нужна только цифра — бери <code class="inline">RuneCountInString</code>; <code class="inline">[]rune</code> — если сами руны ещё понадобятся.</p>
          </div>

          <p class="tight"><code class="inline">[]rune(s)</code> — не «байт в руну», а декодирование UTF-8: рантайм разбирает байты по 1–4 за символ, невалидное заменяет на <code class="inline">RuneError</code>. Память растёт: «Go, гофер!» — 15 байт как <code class="inline">string</code>, 40 байт как <code class="inline">[]rune</code> (10 рун × 4 байта).</p>

          <details class="deep">
            <summary>Практика: разворот строки (reverse) <span class="tag">practice</span></summary>
            <div class="deep-body">
              <p class="tight">Наивный разворот байтов ломает многобайтовые символы — порядок байт внутри символа тоже переставляется, UTF-8 портится.</p>

              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">reverse_wrong.go</span></div>
                <pre><code class="language-go">b := []byte(s)
for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
    b[i], b[j] = b[j], b[i]
}
reversed := string(b) // ломает многобайтовые символы</code></pre>
              </div>

              <p class="tight">Правильно — переставлять руны: руна — целый code point фиксированного размера, её можно двигать как единое целое.</p>

              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">reverse_right.go</span></div>
                <pre><code class="language-go">r := []rune(s)
for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
    r[i], r[j] = r[j], r[i]
}
reversed := string(r) // корректно</code></pre>
              </div>

              <p class="tight">Но это разворот рун, не графем: «é» из двух рун (<code class="inline">e</code> + акцент) распадётся неправильно — тут снова нужны библиотеки уровня графем.</p>
            </div>
          </details>

          <p class="tight" style="font-size:11.5px;color:var(--text-dim);">На практике: чаще просто <code class="inline">range</code>. <code class="inline">[]rune</code> — только для доступа по индексу или разворота. <code class="inline">RuneCountInString</code> — если нужна только цифра. <code class="inline">strings.Builder</code> — вместо <code class="inline">+=</code> в цикле.</p>

          <div class="impl-sources">Источники: github.com/golang/go (src/builtin/builtin.go, src/runtime/string.go, src/internal/goarch/goarch.go) · pkg.go.dev/builtin (len) · go.dev/ref/spec#Index_expressions (тип s[i] — byte) · groups.google.com/g/golang-nuts (обсуждение «why len returns int and not uint») · go.dev/wiki/CompilerOptimizations · go.dev/doc/go1.10 · go.dev/doc/go1.18 · go.dev/doc/go1.20 · pkg.go.dev/unsafe · pkg.go.dev/reflect#StringHeader · pkg.go.dev/strings#Builder · pkg.go.dev/unicode/utf8 (RuneError, RuneCountInString) · go.dev/blog/strings</div>
        `
      },

  // ---------- "array" entry ----------
      array: {
        title: 'Массив — под капотом',
        html: `
          <p class="tight">Массив в Go — это просто <b>непрерывный блок памяти</b> фиксированного размера. Никаких заголовков, никаких указателей — только сами данные рядом друг с другом. Это описание именно <em>типа</em> массива (метаданные для компилятора и рефлексии), а не самих данных.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/internal/abi/type.go</span></div>
            <pre><code class="language-go">type ArrayType struct {
    Type        // ① общие метаданные типа
    Elem  *Type // ② тип одного элемента
    Slice *Type // ③ соответствующий слайс-тип
    Len   uintptr // ④ количество элементов
}</code></pre>
          </div>

          <p class="tight"><b>① Type</b> — встроенная структура с общими данными о любом типе: размер в байтах (<code class="inline">Size_</code>), требуемое <span onclick="showTip(event, 'alignment')" style="cursor:help;border-bottom:1px dashed var(--accent);color:var(--accent)">выравнивание</span> (<code class="inline">Align_</code>), флаги (содержит ли указатели — нужно ли GC за ним следить). Для <code class="inline">[3]int32</code>: размер = 12, выравнивание = 4.</p>

          <p class="tight"><b>② Elem *Type</b> — указатель на описание типа одного элемента. Для <code class="inline">[3]int32</code> это будет описание <code class="inline">int32</code>. Нужен компилятору чтобы знать: на сколько байт шагать при обращении <code class="inline">a[i]</code> (адрес = base + i × Elem.Size).</p>

          <p class="tight"><b>③ Slice *Type</b> — указатель на описание соответствующего слайс-типа (<code class="inline">[]int32</code>). Нужен когда компилятор конвертирует массив в слайс: <code class="inline">s := a[:]</code> — он берёт этот тип напрямую, не создаёт заново. <span onclick="showTip(event, 'sliceType')" style="cursor:help;border-bottom:1px dashed var(--accent);color:var(--accent)">пример →</span></p>

          <p class="tight"><b>④ Len uintptr</b> — количество элементов. Это не данные — это часть описания <em>типа</em>. Именно поэтому <code class="inline">[3]int</code> и <code class="inline">[4]int</code> — разные типы: у них разный <code class="inline">Len</code>, а значит разная структура <code class="inline">ArrayType</code>.</p>

          <p class="tight">В памяти <code class="inline">[3]int32</code> выглядит так — три числа подряд, без лишних байт:</p>

          <div class="bytefig">
            <div class="bytefig-label">[3]int32 в памяти — 12 байт</div>
            <div class="byterow">
              <span class="byte-state">[0]</span>
              <div class="bits"><span class="bit">a0</span><span class="bit">a1</span><span class="bit">a2</span><span class="bit">a3</span></div>
              <span class="byte-tag">4 байта</span>
            </div>
            <div class="byterow">
              <span class="byte-state">[1]</span>
              <div class="bits"><span class="bit">b0</span><span class="bit">b1</span><span class="bit">b2</span><span class="bit">b3</span></div>
              <span class="byte-tag">4 байта</span>
            </div>
            <div class="byterow">
              <span class="byte-state">[2]</span>
              <div class="bits"><span class="bit">c0</span><span class="bit">c1</span><span class="bit">c2</span><span class="bit">c3</span></div>
              <span class="byte-tag">4 байта</span>
            </div>
          </div>

          <p class="tight">Адрес элемента <code class="inline">a[i]</code> вычисляется как <code class="inline">base + i × sizeof(Elem)</code> — поэтому доступ по индексу всегда O(1), никакого обхода.</p>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p>Почему массив копируется целиком при передаче в функцию? Потому что он хранится по значению — нет никакого заголовка или указателя, только сами байты. Передать «ссылку» на массив без явного <code class="inline">&amp;arr</code> невозможно. Именно поэтому на практике почти всегда используют слайс — он передаёт только 24-байтный заголовок, а не все данные.</p>
          </div>

          <div class="impl-sources">Источники: github.com/golang/go (src/internal/abi/type.go) · go.dev/ref/spec#Array_types · go.dev/ref/spec#Size_and_alignment_guarantees</div>
        `
      },

  // ---------- "slice" entry ----------
      slice: {
        title: 'Слайс — под капотом',
        html: `
          <p class="tight">Слайс — это <b>маленький заголовок из трёх полей</b>, который лежит на стеке и указывает на массив данных в heap. Сам массив данных нигде внутри слайса не хранится — только адрес на него.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/runtime/slice.go</span></div>
            <pre><code class="language-go">// SliceHeader — это и есть слайс в памяти:
type slice struct {
    array unsafe.Pointer // указатель на первый элемент массива
    len   int            // сколько элементов сейчас «видно»
    cap   int            // сколько элементов в массиве всего (с запасом)
}
// Итого: 8 + 8 + 8 = 24 байта на 64-битной платформе</code></pre>
          </div>

          <div class="bytefig">
            <div class="bytefig-label">[]int{1,2,3} с cap 5 в памяти</div>
            <div class="byterow">
              <span class="byte-state">ptr</span>
              <div class="bits"><span class="bit">→</span><span class="bit is-highlight">heap</span></div>
              <span class="byte-tag">8 байт</span>
            </div>
            <div class="byterow">
              <span class="byte-state">len</span>
              <div class="bits"><span class="bit is-one">3</span></div>
              <span class="byte-tag">8 байт</span>
            </div>
            <div class="byterow">
              <span class="byte-state">cap</span>
              <div class="bits"><span class="bit is-one">5</span></div>
              <span class="byte-tag">8 байт</span>
            </div>
          </div>

          <p class="tight"><b>Рост ёмкости</b> — актуально для Go 1.18+ (функция <code class="inline">nextslicecap</code> в <code class="inline">runtime/slice.go</code>). Порог — <b>256 элементов</b>:</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/runtime/slice.go — nextslicecap</span></div>
            <pre><code class="language-go">func nextslicecap(newLen, oldCap int) int {
    newcap := oldCap
    doublecap := newcap + newcap
    if newLen > doublecap {
        return newLen
    }
    const threshold = 256
    if oldCap < threshold {
        return doublecap            // cap < 256 → удвоение (×2)
    }
    for {
        // cap ≥ 256 → плавный переход к ×1.25
        // формула: (newcap + 3×256) >> 2
        newcap += (newcap + 3*threshold) >> 2
        if uint(newcap) >= uint(newLen) {
            break
        }
    }
    return newcap
}</code></pre>
          </div>

          <p class="tight"><b>Пример — как цикл считает newcap при oldCap = 512, newLen = 513:</b></p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">nextslicecap_trace.go</span></div>
            <pre><code class="language-go">// oldCap = 512, newLen = 513
// 512 >= 256 → идём в цикл for

// итерация 1:
newcap = 512
newcap += (512 + 3*256) >> 2
//       = (512 + 768)  >> 2
//       = 1280         >> 2   // >> 2 это деление на 4
//       = 320
newcap = 512 + 320 = 832
// uint(832) >= uint(513) → break

// результат: новый cap = 832 (рост ≈ ×1.625)

// ещё пример — oldCap = 1000, newLen = 1001:
// итерация 1:
newcap = 1000
newcap += (1000 + 768) >> 2
//       = 1768 >> 2 = 442
newcap = 1000 + 442 = 1442
// uint(1442) >= uint(1001) → break

// результат: новый cap = 1442 (рост ≈ ×1.44)

// при очень большом cap формула даёт всё ближе к ×1.25:
// oldCap = 10000, newLen = 10001:
// newcap += (10000 + 768) >> 2 = 2692
// newcap = 10000 + 2692 = 12692 (рост ≈ ×1.27)</code></pre>
          </div>

          <p class="tight">Чем больше cap — тем меньше коэффициент роста, тем ближе к ×1.25. Это и есть «плавный переход» о котором говорит комментарий в исходнике.</p>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p>Почему <code class="inline">append</code> нужно всегда переприсваивать: <code class="inline">s = append(s, x)</code>? Потому что если cap исчерпан — <code class="inline">append</code> выделяет <b>новый</b> массив, а старый заголовок остаётся указывать на старый. Без переприсваивания новые данные пропадут.</p>
          </div>

          <div class="impl-sources">Источники: github.com/golang/go (src/runtime/slice.go, src/internal/abi/type.go) · go.dev/ref/spec#Slice_types · go.dev/blog/slices-intro</div>
        `
      },

  // ---------- "map" entry ----------
      map: {
        title: 'map — под капотом',
        html: `
          <p class="tight">Map в Go — хеш-таблица, реализованная в runtime. До Go 1.24 — <b>бакетная архитектура (hmap/bmap)</b>, с Go 1.24 — <b>Swiss Tables</b>. Все операции O(1) амортизированно.</p>

          <!-- схема 1: концепция хеш-таблицы -->
          <svg viewBox="0 0 500 130" style="width:100%;margin:10px 0 4px">
            <defs>
              <marker id="ma1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.6"/></marker>
            </defs>
            <!-- ключи -->
            <text x="10" y="14" font-size="10" fill="currentColor" opacity="0.45">ключи</text>
            <rect x="10" y="20" width="70" height="22" rx="4" fill="none" stroke="currentColor" opacity="0.3"/>
            <text x="45" y="35" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="currentColor">"alice"</text>
            <rect x="10" y="48" width="70" height="22" rx="4" fill="none" stroke="currentColor" opacity="0.3"/>
            <text x="45" y="63" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="currentColor">"bob"</text>
            <rect x="10" y="76" width="70" height="22" rx="4" fill="none" stroke="currentColor" opacity="0.3"/>
            <text x="45" y="91" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="currentColor">"carol"</text>

            <!-- hash box -->
            <rect x="120" y="44" width="90" height="34" rx="6" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.5"/>
            <text x="165" y="58" text-anchor="middle" font-size="10" fill="#3b7ec9">hash(key,</text>
            <text x="165" y="70" text-anchor="middle" font-size="10" fill="#3b7ec9">seed)</text>

            <!-- стрелки к hash -->
            <line x1="80" y1="31" x2="118" y2="55" stroke="currentColor" opacity="0.3" marker-end="url(#ma1)"/>
            <line x1="80" y1="59" x2="118" y2="61" stroke="currentColor" opacity="0.3" marker-end="url(#ma1)"/>
            <line x1="80" y1="87" x2="118" y2="67" stroke="currentColor" opacity="0.3" marker-end="url(#ma1)"/>

            <!-- бакеты -->
            <text x="250" y="14" font-size="10" fill="currentColor" opacity="0.45">бакеты</text>
            <rect x="250" y="20" width="80" height="22" rx="3" fill="#3b7ec910" stroke="#3b7ec9" stroke-width="1"/>
            <text x="290" y="35" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#3b7ec9">bucket 0</text>
            <rect x="250" y="46" width="80" height="22" rx="3" fill="#3b7ec910" stroke="#3b7ec9" stroke-width="1"/>
            <text x="290" y="61" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#3b7ec9">bucket 1</text>
            <rect x="250" y="72" width="80" height="22" rx="3" fill="#3b7ec910" stroke="#3b7ec9" stroke-width="1"/>
            <text x="290" y="87" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#3b7ec9">bucket 2</text>
            <rect x="250" y="98" width="80" height="22" rx="3" fill="#3b7ec910" stroke="#3b7ec9" stroke-width="1"/>
            <text x="290" y="113" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#3b7ec9">bucket 3</text>

            <!-- стрелки от hash к бакетам -->
            <line x1="210" y1="55" x2="248" y2="35" stroke="#3b7ec9" opacity="0.5" marker-end="url(#ma1)"/>
            <line x1="210" y1="61" x2="248" y2="83" stroke="#3b7ec9" opacity="0.5" marker-end="url(#ma1)"/>
            <line x1="210" y1="67" x2="248" y2="109" stroke="#3b7ec9" opacity="0.5" marker-end="url(#ma1)"/>

            <!-- значения -->
            <text x="370" y="14" font-size="10" fill="currentColor" opacity="0.45">значения</text>
            <rect x="370" y="20" width="55" height="22" rx="3" fill="none" stroke="currentColor" opacity="0.25"/>
            <text x="397" y="35" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="currentColor">25</text>
            <rect x="370" y="72" width="55" height="22" rx="3" fill="none" stroke="currentColor" opacity="0.25"/>
            <text x="397" y="87" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="currentColor">42</text>
            <rect x="370" y="98" width="55" height="22" rx="3" fill="none" stroke="currentColor" opacity="0.25"/>
            <text x="397" y="113" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="currentColor">7</text>
            <line x1="330" y1="31" x2="368" y2="31" stroke="currentColor" opacity="0.25" marker-end="url(#ma1)"/>
            <line x1="330" y1="83" x2="368" y2="83" stroke="currentColor" opacity="0.25" marker-end="url(#ma1)"/>
            <line x1="330" y1="109" x2="368" y2="109" stroke="currentColor" opacity="0.25" marker-end="url(#ma1)"/>

            <text x="250" y="128" font-size="9.5" fill="currentColor" opacity="0.4">каждый бакет вмещает до 8 пар — поиск внутри O(1)</text>
          </svg>

          <details class="deep" style="margin:10px 0">
            <summary>Старая реализация (до Go 1.24) — hmap / bmap / бакеты <span class="tag">deep</span></summary>
            <div class="deep-body">

              <!-- ══ 1. MapType ══ -->
              <p class="tight"><b><a href="#" onclick="showTip(event,'descriptor');return false;" style="color:var(--accent);text-decoration:underline dotted">Дескриптор типа</a> — MapType:</b> runtime не знает конкретных типов K/V — работает через <code class="inline">unsafe.Pointer</code> и функции из дескриптора. <code class="inline">MapType</code> — описание <em>разновидности</em> map: размер ключа, значения, бакета, функция хеширования. Один <code class="inline">MapType</code> на тип, живёт в <code class="inline">.rodata</code>:</p>
              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/internal/abi/type.go</span></div>
                <pre><code class="language-go">type MapType struct {
    Type                // общие метаданные: size, align, gcdata...
    Key        *Type    // дескриптор типа ключа
    Elem       *Type    // дескриптор типа значения
    Bucket     *Type    // дескриптор сгенерированного bmap
    Hasher     func(unsafe.Pointer, uintptr) uintptr // хеш-функция для K
    KeySize    uint8    // размер слота ключа в байтах
    ValueSize  uint8    // размер слота значения в байтах
    BucketSize uint16   // размер бакета в байтах
    Flags      uint32
}</code></pre>
              </div>

              <!-- ══ 2. hmap ══ -->
              <p class="tight" style="margin-top:14px"><b>Конкретный экземпляр — hmap:</b> создаётся при <code class="inline">make(map[K]V)</code>, хранит живое состояние карты. В куче, один на переменную:</p>
              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/runtime/map.go</span></div>
                <pre><code class="language-go">type hmap struct {
    count      int            // len(m) — кол-во элементов
    flags      uint8
    B          uint8          // log₂ кол-ва бакетов: бакетов = 2^B
    noverflow  uint16         // приблизительное кол-во overflow-бакетов
    hash0      uint32         // случайный seed, генерируется при make(map)
    buckets    unsafe.Pointer // указатель на массив бакетов
    oldbuckets unsafe.Pointer // старый массив во время эвакуации
    nevacuate  uintptr        // счётчик прогресса эвакуации
    extra      *mapextra
}</code></pre>
              </div>

              <!-- схема 2: hmap → массив бакетов -->
              <svg viewBox="0 0 480 120" style="width:100%;margin:8px 0 4px">
                <defs>
                  <marker id="ma2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b7ec9" opacity="0.7"/></marker>
                </defs>
                <rect x="10" y="10" width="140" height="100" rx="6" fill="#3b7ec910" stroke="#3b7ec9" stroke-width="1.5"/>
                <text x="80" y="26" text-anchor="middle" font-size="11" fill="#3b7ec9" font-weight="bold">hmap</text>
                <text x="18" y="42" font-family="JetBrains Mono" font-size="9.5" fill="currentColor">count   int</text>
                <text x="18" y="55" font-family="JetBrains Mono" font-size="9.5" fill="currentColor">B       uint8</text>
                <text x="18" y="68" font-family="JetBrains Mono" font-size="9.5" fill="currentColor">hash0   uint32</text>
                <text x="18" y="81" font-family="JetBrains Mono" font-size="9.5" fill="#3b7ec9">buckets *bmap</text>
                <text x="18" y="94" font-family="JetBrains Mono" font-size="9.5" fill="currentColor" opacity="0.5">oldbuckets</text>
                <text x="18" y="106" font-family="JetBrains Mono" font-size="9.5" fill="currentColor" opacity="0.5">nevacuate</text>
                <line x1="150" y1="81" x2="198" y2="55" stroke="#3b7ec9" stroke-width="1.5" marker-end="url(#ma2)"/>
                <text x="200" y="18" font-size="10" fill="currentColor" opacity="0.45">массив бакетов (2^B штук)</text>
                <rect x="200" y="24" width="64" height="42" rx="4" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="232" y="40" text-anchor="middle" font-size="9" fill="#3b7ec9">bmap 0</text>
                <text x="232" y="52" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="currentColor" opacity="0.5">tophash</text>
                <text x="232" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="currentColor" opacity="0.5">8 k / 8 v</text>
                <rect x="270" y="24" width="64" height="42" rx="4" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="302" y="40" text-anchor="middle" font-size="9" fill="#3b7ec9">bmap 1</text>
                <text x="302" y="52" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="currentColor" opacity="0.5">tophash</text>
                <text x="302" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="currentColor" opacity="0.5">8 k / 8 v</text>
                <rect x="340" y="24" width="64" height="42" rx="4" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="372" y="40" text-anchor="middle" font-size="9" fill="#3b7ec9">bmap 2</text>
                <text x="372" y="52" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="currentColor" opacity="0.5">tophash</text>
                <text x="372" y="62" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="currentColor" opacity="0.5">8 k / 8 v</text>
                <text x="422" y="46" font-size="12" fill="currentColor" opacity="0.35">…</text>
                <rect x="200" y="82" width="64" height="30" rx="4" fill="none" stroke="#f5a623" stroke-width="1" stroke-dasharray="3 2"/>
                <text x="232" y="101" text-anchor="middle" font-size="9" fill="#f5a623">overflow</text>
                <line x1="232" y1="66" x2="232" y2="80" stroke="#f5a623" stroke-dasharray="3 2" opacity="0.6" marker-end="url(#ma2)"/>
                <text x="272" y="101" font-size="9" fill="#f5a623" opacity="0.7">← 9-й элемент</text>
              </svg>
              <p class="tight" style="margin-top:4px;margin-bottom:10px"><code class="inline">hmap</code> — не сами данные. Это управляющая структура с указателем <code class="inline">buckets</code> на массив бакетов в куче.</p>

              <!-- ══ 3. MapType ↔ hmap ══ -->
              <p class="tight"><b>MapType и hmap вместе:</b> <code class="inline">MapType</code> — чертёж (один на тип, в <code class="inline">.rodata</code>), <code class="inline">hmap</code> — экземпляр (один на переменную, в куче). Runtime всегда получает оба — <code class="inline">t</code> говорит <em>как</em> хешировать и сравнивать, <code class="inline">h</code> — <em>где</em> лежат данные:</p>
              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">two_objects.go</span></div>
                <pre><code class="language-go">m1 := make(map[string]int) // hmap#1 ──┐
m2 := make(map[string]int) // hmap#2 ──┼── один общий MapType в .rodata
                           //
mapaccess1(t, h, k)        // t=MapType, h=hmap — всегда оба</code></pre>
              </div>

              <!-- ══ 4. bmap — внутри бакета ══ -->
              <p class="tight" style="margin-top:14px"><b>Внутри одного бакета — bmap:</b> ровно <code class="inline">bucketCnt = 8</code> пар (эмпирически выбранная константа в runtime). Сначала все ключи, потом все значения — чтобы минимизировать padding при выравнивании:</p>

              <!-- схема bmap layout -->
              <svg viewBox="0 0 460 160" style="width:100%;margin:8px 0 4px">
                <defs>
                  <marker id="ma3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.5"/></marker>
                </defs>
                <text x="10" y="14" font-size="10" fill="currentColor" opacity="0.45">bmap (один бакет)</text>
                <text x="10" y="30" font-family="JetBrains Mono" font-size="9" fill="#f5a623">tophash[8]uint8</text>
                <rect x="10" y="34" width="28" height="24" rx="3" fill="#f5a62318" stroke="#f5a623" stroke-width="1.2"/>
                <text x="24" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#f5a623">h₀</text>
                <rect x="38" y="34" width="28" height="24" rx="3" fill="#f5a62318" stroke="#f5a623" stroke-width="1.2"/>
                <text x="52" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#f5a623">h₁</text>
                <rect x="66" y="34" width="28" height="24" rx="3" fill="#f5a62318" stroke="#f5a623" stroke-width="1.2"/>
                <text x="80" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#f5a623">h₂</text>
                <rect x="94" y="34" width="28" height="24" rx="3" fill="#f5a62318" stroke="#f5a623" stroke-width="1.2"/>
                <text x="108" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#f5a623">…</text>
                <rect x="122" y="34" width="28" height="24" rx="3" fill="#f5a62318" stroke="#f5a623" stroke-width="1.2"/>
                <text x="136" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#f5a623">h₇</text>
                <text x="10" y="76" font-family="JetBrains Mono" font-size="9" fill="#3b7ec9">keys[8]K</text>
                <rect x="10" y="80" width="36" height="24" rx="3" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="28" y="96" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#3b7ec9">k₀</text>
                <rect x="46" y="80" width="36" height="24" rx="3" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="64" y="96" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#3b7ec9">k₁</text>
                <rect x="82" y="80" width="36" height="24" rx="3" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="100" y="96" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#3b7ec9">…</text>
                <rect x="118" y="80" width="36" height="24" rx="3" fill="#3b7ec918" stroke="#3b7ec9" stroke-width="1.2"/>
                <text x="136" y="96" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#3b7ec9">k₇</text>
                <text x="10" y="122" font-family="JetBrains Mono" font-size="9" fill="#4caf7d">values[8]V</text>
                <rect x="10" y="126" width="36" height="24" rx="3" fill="#4caf7d18" stroke="#4caf7d" stroke-width="1.2"/>
                <text x="28" y="142" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#4caf7d">v₀</text>
                <rect x="46" y="126" width="36" height="24" rx="3" fill="#4caf7d18" stroke="#4caf7d" stroke-width="1.2"/>
                <text x="64" y="142" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#4caf7d">v₁</text>
                <rect x="82" y="126" width="36" height="24" rx="3" fill="#4caf7d18" stroke="#4caf7d" stroke-width="1.2"/>
                <text x="100" y="142" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#4caf7d">…</text>
                <rect x="118" y="126" width="36" height="24" rx="3" fill="#4caf7d18" stroke="#4caf7d" stroke-width="1.2"/>
                <text x="136" y="142" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#4caf7d">v₇</text>
                <rect x="164" y="126" width="60" height="24" rx="3" fill="none" stroke="currentColor" stroke-dasharray="3 2" opacity="0.4"/>
                <text x="194" y="142" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">overflow*</text>
                <text x="240" y="46" font-size="10" fill="#f5a623">← быстрый pre-filter:</text>
                <text x="240" y="58" font-size="10" fill="#f5a623">   сравниваем 1 байт</text>
                <text x="240" y="70" font-size="10" fill="#f5a623">   до полного compare</text>
                <text x="240" y="98" font-size="10" fill="#3b7ec9">← блочное хранение:</text>
                <text x="240" y="110" font-size="10" fill="#3b7ec9">   нет padding между k и v</text>
                <text x="240" y="142" font-size="10" fill="#4caf7d">← значения отдельным блоком</text>
              </svg>

              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/runtime/map.go</span></div>
                <pre><code class="language-go">const bucketCnt = 8  // жёсткая константа в runtime — всегда 8 слотов

// bmap генерируется компилятором для каждой конкретной map[K]V
type bmap struct {
    tophash  [bucketCnt]uint8  // старшие 8 бит хеша (быстрый pre-filter)
    // далее в памяти (генерируется компилятором):
    // keys     [bucketCnt]K
    // values   [bucketCnt]V
    // overflow *bmap
}

// Почему ключи блоком, а не k0,v0,k1,v1...?
// map[int8]int64: при чередовании после int8 → 7 байт padding под int64
// Блочно: 8×int8 = 8B (нет padding) + 8×int64 = 64B — меньше памяти</code></pre>
              </div>

              <!-- ══ 5. Hash → откуда он берётся ══ -->
              <p class="tight" style="margin-top:16px"><b>Откуда берётся hash?</b> Runtime вызывает <code class="inline">Hasher</code> из <code class="inline">MapType</code>, передавая ключ и случайный seed. Требования: равномерное распределение, скорость, детерминированность (ключ + seed → одинаковый хеш). От Hash Flooding защищает не алгоритм, а случайный <code class="inline">hash0</code> из <code class="inline">hmap</code> — атакующий не знает seed.</p>

              <!-- ══ 6. B + LOB + HOB — как hash приводит к бакету ══ -->
              <p class="tight" style="margin-top:12px"><b>B и количество бакетов:</b> <code class="inline">B</code> — это log₂ количества бакетов. Так, <code class="inline">B=2</code> → 4 бакета, <code class="inline">B=3</code> → 8 бакетов. Хранить логарифм вместо счётчика позволяет заменить дорогое <code class="inline">hash % count</code> на быстрое побитовое <code class="inline">hash &amp; mask</code>:</p>
              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">bucket_mask.go</span></div>
                <pre><code class="language-go">// B = 2 → 4 бакета (количество бакетов = 2^B — всегда степень двойки)
mask := (1 << B) - 1          // 0b011
bucketIndex := hash &amp; mask    // младшие B бит хеша → номер бакета
// & быстрее % потому что 2^B → побитовое AND работает за 1 такт CPU</code></pre>
              </div>

              <p class="tight" style="margin-top:10px"><b>LOB и HOB — как хеш делится на две части:</b> LOB (Low Order Bits) выбирает <em>бакет</em>, HOB (High Order Bits) — <em>слот внутри бакета</em> (tophash). Это две функции одного числа:</p>

              <!-- SVG 1: LOB — конкретный пример выбора бакета -->
              <svg viewBox="0 0 460 158" style="width:100%;margin:8px 0 6px">
                <defs>
                  <marker id="ma_lob" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b7ec9" opacity="0.9"/></marker>
                </defs>

                <!-- заголовок блока -->
                <text x="10" y="15" font-size="10.5" font-weight="bold" fill="#3b7ec9">LOB — Low Order Bits → выбор бакета</text>

                <!-- 4 бакета справа (B=2 → 2^2=4) -->
                <text x="305" y="13" font-size="8.5" fill="currentColor" opacity="0.4">B=2 → 4 бакета</text>
                <rect x="305" y="18" width="34" height="28" rx="5" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.28"/>
                <text x="322" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.35">0</text>
                <text x="322" y="41" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.2">[ ]</text>

                <rect x="339" y="18" width="34" height="28" rx="5" fill="#3b7ec922" stroke="#3b7ec9" stroke-width="2"/>
                <text x="356" y="29" text-anchor="middle" font-size="7.5" fill="#3b7ec9" font-weight="bold">1</text>
                <text x="356" y="41" text-anchor="middle" font-size="11" fill="#3b7ec9">★</text>

                <rect x="373" y="18" width="34" height="28" rx="5" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.28"/>
                <text x="390" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.35">2</text>
                <text x="390" y="41" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.2">[ ]</text>

                <rect x="407" y="18" width="34" height="28" rx="5" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.28"/>
                <text x="424" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.35">3</text>
                <text x="424" y="41" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.2">[ ]</text>

                <!-- разделитель -->
                <line x1="10" y1="54" x2="450" y2="54" stroke="currentColor" opacity="0.08"/>

                <!-- строка 1: Hash(key) -->
                <text x="10" y="70" font-size="10" fill="currentColor" opacity="0.55">Hash(key)</text>
                <text x="96" y="70" font-family="JetBrains Mono" font-size="10.5" fill="currentColor">=</text>
                <text x="112" y="70" font-family="JetBrains Mono" font-size="12" font-weight="bold" fill="currentColor">5461</text>

                <!-- строка 2: 5461 % 4 -->
                <text x="10" y="89" font-size="10" fill="currentColor" opacity="0.5">5461 % 4</text>
                <text x="82" y="89" font-family="JetBrains Mono" font-size="10.5" fill="currentColor">=</text>
                <text x="98" y="89" font-family="JetBrains Mono" font-size="12" font-weight="bold" fill="#3b7ec9">1</text>
                <text x="120" y="89" font-size="9" fill="currentColor" opacity="0.4">← попадаем в бакет 1</text>

                <!-- строка 3: двоичное с выделением LOB -->
                <text x="10" y="108" font-size="9.5" fill="currentColor" opacity="0.5">двоичн.:</text>
                <text x="74" y="108" font-family="JetBrains Mono" font-size="10" fill="currentColor" opacity="0.25">1 0 1 0 1 0 1 0 1 0 1</text>
                <!-- LOB — последние 2 бита выделены -->
                <rect x="220" y="96" width="30" height="16" rx="3" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="1.4"/>
                <text x="235" y="108" text-anchor="middle" font-family="JetBrains Mono" font-size="10" font-weight="bold" fill="#3b7ec9">01</text>

                <!-- LOB label + стрелка к бакету -->
                <text x="10" y="127" font-size="10" fill="#3b7ec9">LOB(Hash) =</text>
                <text x="93" y="127" font-family="JetBrains Mono" font-size="10.5" font-weight="bold" fill="#3b7ec9"> 01</text>
                <text x="116" y="127" font-size="10" fill="#3b7ec9"> = 1  →  бакет 1</text>
                <path d="M 195 116 Q 270 80 340 50" stroke="#3b7ec9" stroke-width="1.5" fill="none" opacity="0.7" marker-end="url(#ma_lob)"/>

                <!-- формула Go -->
                <text x="10" y="146" font-family="JetBrains Mono" font-size="9.5" fill="#3b7ec9">bucketIndex = hash &amp; mask</text>
                <text x="222" y="146" font-size="9.5" fill="currentColor" opacity="0.35">  // mask=(1&lt;&lt;B)-1=0b11</text>
                <text x="10" y="158" font-size="8.5" fill="currentColor" opacity="0.4">&amp; быстрее %, т.к. кол-во бакетов всегда 2^B (степень двойки) → побитовое AND</text>
              </svg>

              <!-- SVG 2: 64-битный обзор — LOB + HOB вместе -->
              <svg viewBox="0 0 460 95" style="width:100%;margin:6px 0 10px">
                <defs>
                  <marker id="ma4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.6"/></marker>
                </defs>

                <!-- заголовок -->
                <text x="10" y="13" font-size="10" fill="currentColor" opacity="0.45">hash (64 бита) — полный обзор:</text>

                <!-- HOB: биты 56–63 (8 бит) -->
                <rect x="10" y="18" width="78" height="30" rx="5" fill="#f5a62320" stroke="#f5a623" stroke-width="1.7"/>
                <text x="49" y="30" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#f5a623">биты 56–63</text>
                <text x="49" y="42" text-anchor="middle" font-size="8.5" fill="#f5a623" opacity="0.8">HOB (8 бит)</text>

                <!-- средние биты -->
                <rect x="88" y="18" width="168" height="30" rx="5" fill="none" stroke="currentColor" opacity="0.12"/>
                <text x="172" y="36" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.22">не используются</text>

                <!-- LOB: биты 0–B -->
                <rect x="256" y="18" width="68" height="30" rx="5" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="1.7"/>
                <text x="290" y="30" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#3b7ec9">биты 0–B</text>
                <text x="290" y="42" text-anchor="middle" font-size="8.5" fill="#3b7ec9" opacity="0.8">LOB (B бит)</text>

                <!-- стрелки и подписи вниз -->
                <line x1="49" y1="48" x2="49" y2="64" stroke="#f5a623" opacity="0.65" marker-end="url(#ma4)"/>
                <text x="49" y="76" text-anchor="middle" font-size="10" font-weight="bold" fill="#f5a623">tophash</text>
                <text x="49" y="88" text-anchor="middle" font-size="8" fill="#f5a623" opacity="0.65">uint8(hash &gt;&gt; 56)</text>

                <line x1="290" y1="48" x2="290" y2="64" stroke="#3b7ec9" opacity="0.65" marker-end="url(#ma4)"/>
                <text x="290" y="76" text-anchor="middle" font-size="10" font-weight="bold" fill="#3b7ec9">bucketIndex</text>
                <text x="290" y="88" text-anchor="middle" font-size="8" fill="#3b7ec9" opacity="0.65">hash &amp; mask</text>

                <!-- пояснение справа -->
                <text x="340" y="32" font-size="9.5" fill="#f5a623">← pre-filter внутри бакета:</text>
                <text x="340" y="44" font-size="9.5" fill="#f5a623">   сравниваем 1 байт до</text>
                <text x="340" y="56" font-size="9.5" fill="#f5a623">   полного compare ключа</text>
                <text x="340" y="72" font-size="9.5" fill="#3b7ec9">← выбор бакета:</text>
                <text x="340" y="84" font-size="9.5" fill="#3b7ec9">   O(1) прыжок в массиве</text>
              </svg>

              <p class="tight" style="margin-top:12px"><b>Алгоритм поиска (mapaccess1):</b></p>
              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">lookup.go (упрощённо)</span></div>
                <pre><code class="language-go">hash := hasher(key, hash0)           // 1. хешируем ключ с seed
mask := (1 << B) - 1
bi   := hash &amp; mask                  // 2. младшие B бит → номер бакета
b    := add(buckets, bi*bucketSize)  // 3. прыжок к бакету (unsafe арифметика)
top  := uint8(hash >> 56)            // 4. старшие 8 бит → tophash

for ; b != nil; b = b.overflow {
    for i := 0; i < 8; i++ {
        if b.tophash[i] != top { continue } // 5. быстрый pre-filter по байту
        if key == b.keys[i] { return &amp;b.values[i] } // 6. полное сравнение
    }
}</code></pre>
              </div>

              <p class="tight" style="margin-top:12px"><b>Go-синтаксис → runtime-функции:</b> компилятор транслирует каждую операцию с map в конкретный вызов:</p>
              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">map_calls.go</span></div>
                <pre><code class="language-go">v := m["k"]       // → mapaccess1(t *maptype, h *hmap, k unsafe.Pointer) unsafe.Pointer
v, ok := m["k"]   // → mapaccess2(t *maptype, h *hmap, k unsafe.Pointer) (unsafe.Pointer, bool)
m["k"] = 9001     // → mapassign(t *maptype, h *hmap, k unsafe.Pointer) unsafe.Pointer
delete(m, "k")    // → mapdelete(t *maptype, h *hmap, k unsafe.Pointer)</code></pre>
              </div>

              <p class="tight" style="margin-top:12px"><b>Переполнение:</b> 9-й элемент в бакет → создаётся <b>overflow bucket</b> (связанный список бакетов):</p>

              <!-- SVG: overflow bucket chain -->
              <svg viewBox="0 0 460 182" style="width:100%;margin:8px 0 6px">
                <defs>
                  <marker id="ma_ov" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.65"/></marker>
                </defs>

                <!-- BUCKET 1 (full, 8/8) -->
                <rect x="10" y="8" width="430" height="86" rx="6" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.3"/>
                <text x="225" y="19" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.38">Bucket</text>

                <!-- index 0-7 -->
                <text x="37" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">0</text>
                <text x="86" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">1</text>
                <text x="135" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">2</text>
                <text x="184" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">3</text>
                <text x="233" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">4</text>
                <text x="282" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">5</text>
                <text x="331" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">6</text>
                <text x="380" y="29" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">7</text>

                <!-- tophash: all 8 filled (HOB Hash) -->
                <rect x="15" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="37" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="37" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="64" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="86" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="86" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="113" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="135" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="135" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="162" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="184" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="184" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="211" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="233" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="233" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="260" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="282" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="282" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="309" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="331" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="331" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="358" y="32" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="380" y="41" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="380" y="49" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>

                <!-- separator -->
                <line x1="15" y1="54" x2="425" y2="54" stroke="currentColor" opacity="0.12"/>

                <!-- K row (8 blue) -->
                <rect x="15" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="37" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="64" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="86" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="113" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="135" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="162" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="184" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="211" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="233" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="260" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="282" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="309" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="331" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>
                <rect x="358" y="57" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.9"/><text x="380" y="67" text-anchor="middle" font-size="8" fill="#3b7ec9">K</text>

                <!-- V row (8 green) -->
                <rect x="15" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="37" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="64" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="86" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="113" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="135" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="162" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="184" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="211" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="233" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="260" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="282" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="309" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="331" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>
                <rect x="358" y="71" width="44" height="12" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.9"/><text x="380" y="81" text-anchor="middle" font-size="8" fill="#4caf7d">V</text>

                <!-- overflow label + arrow -->
                <rect x="184" y="87" width="80" height="14" rx="3" fill="none" stroke="currentColor" stroke-dasharray="3 2" opacity="0.35"/>
                <text x="224" y="98" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.5">Overflow</text>
                <line x1="224" y1="101" x2="224" y2="113" stroke="currentColor" opacity="0.45" stroke-width="1.3" marker-end="url(#ma_ov)"/>

                <!-- BUCKET 2 (overflow, 1 element) -->
                <rect x="10" y="116" width="430" height="62" rx="6" fill="none" stroke="currentColor" stroke-dasharray="4 2" stroke-width="1.1" opacity="0.3"/>
                <text x="225" y="127" text-anchor="middle" font-size="8.5" fill="currentColor" opacity="0.38">Overflow Bucket</text>

                <!-- index 0-7 (overflow bucket) -->
                <text x="37" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.4">0</text>
                <text x="86" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">1</text>
                <text x="135" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">2</text>
                <text x="184" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">3</text>
                <text x="233" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">4</text>
                <text x="282" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">5</text>
                <text x="331" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">6</text>
                <text x="380" y="137" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.25">7</text>

                <!-- slot 0: HOB Hash; slots 1-7: Empty -->
                <rect x="15" y="140" width="44" height="20" rx="3" fill="#f5a62322" stroke="#f5a623" stroke-width="1.2"/><text x="37" y="149" text-anchor="middle" font-size="6.5" fill="#f5a623">HOB</text><text x="37" y="157" text-anchor="middle" font-size="6.5" fill="#f5a623">Hash</text>
                <rect x="64" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="86" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>
                <rect x="113" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="135" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>
                <rect x="162" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="184" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>
                <rect x="211" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="233" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>
                <rect x="260" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="282" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>
                <rect x="309" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="331" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>
                <rect x="358" y="140" width="44" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/><text x="380" y="153" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.28">Empty</text>

                <!-- K+V row in overflow slot 0 -->
                <rect x="15" y="162" width="44" height="12" rx="2" fill="#3b7ec920" stroke="#3b7ec9" stroke-width="0.8"/><text x="37" y="172" text-anchor="middle" font-size="7.5" fill="#3b7ec9">K</text>
                <rect x="15" y="162" width="44" height="12" rx="2" fill="none"/><!-- placeholder so V aligns -->
                <!-- simplified: K row just slot 0, rest empty outline -->
                <rect x="64" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
                <rect x="113" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
                <rect x="162" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
                <rect x="211" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
                <rect x="260" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
                <rect x="309" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
                <rect x="358" y="162" width="44" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.12"/>
              </svg>
              <p class="tight" style="margin-top:4px;opacity:0.55;font-size:0.88em">Указатель <code class="inline">overflow *bmap</code> — последнее поле бакета; <code class="inline">nil</code> если цепочки нет.</p>

              <p class="tight"><b>Рост (эвакуация):</b> <b>load factor</b> = среднее число элементов на бакет по всей map. Когда он превышает <b>6.5</b> — runtime выделяет новый массив вдвое больше (<code class="inline">B++</code>, бакетов становится <code class="inline">2^(B+1)</code>). Переносить всё сразу нельзя — это заморозило бы программу (STW). Поэтому эвакуация <b>инкрементальная</b>: каждый вызов <code class="inline">mapassign</code> или <code class="inline">mapdelete</code> переносит 1–2 бакета из старого массива в новый. Пока эвакуация идёт, <code class="inline">hmap</code> держит оба массива — <code class="inline">buckets</code> (новый) и <code class="inline">oldbuckets</code> (старый), а <code class="inline">nevacuate</code> — счётчик уже перенесённых бакетов. При поиске <code class="inline">mapaccess</code> проверяет оба массива:</p>

              <!-- SVG: evacuation diagram -->
              <svg viewBox="0 0 460 290" style="width:100%;margin:8px 0 6px">
                <defs>
                  <marker id="ma_ev" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4caf7d" opacity="0.7"/></marker>
                  <marker id="ma_ev2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#e04434" opacity="0.7"/></marker>
                </defs>

                <!-- helper: рисует одну ячейку keys+values -->
                <!-- OLD BUCKETS: B=2, 4 штуки -->
                <text x="10" y="11" font-size="8.5" fill="currentColor" opacity="0.38">oldbuckets — B=2, 4 бакета (почти полные)</text>

                <!-- макрос бакета: metadata + 8 пар k/v -->
                <!-- old[0] — evacuated, серый -->
                <g opacity="0.22">
                  <rect x="10" y="16" width="96" height="110" rx="5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
                  <rect x="16" y="20" width="84" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="0.8"/>
                  <text x="58" y="30" text-anchor="middle" font-size="7" fill="currentColor">tophash</text>
                  <!-- 6 пар заполнено -->
                  <rect x="16" y="37" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="58" y="37" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="16" y="48" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="58" y="48" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="16" y="59" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="58" y="59" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="16" y="70" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="58" y="70" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="16" y="81" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="58" y="81" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="16" y="92" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="58" y="92" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="16" y="103" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/><rect x="58" y="103" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/>
                  <rect x="16" y="114" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/><rect x="58" y="114" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/>
                  <text x="35" y="133" text-anchor="middle" font-size="7" fill="currentColor">keys</text><text x="77" y="133" text-anchor="middle" font-size="7" fill="currentColor">vals</text>
                  <text x="58" y="143" text-anchor="middle" font-size="7.5" fill="currentColor">✓ эвакуирован</text>
                </g>

                <!-- old[1] — evacuated, серый -->
                <g opacity="0.22">
                  <rect x="116" y="16" width="96" height="110" rx="5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
                  <rect x="122" y="20" width="84" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="0.8"/>
                  <text x="164" y="30" text-anchor="middle" font-size="7" fill="currentColor">tophash</text>
                  <rect x="122" y="37" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="164" y="37" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="122" y="48" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="164" y="48" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="122" y="59" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="164" y="59" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="122" y="70" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="164" y="70" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="122" y="81" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="164" y="81" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="122" y="92" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.5"/><rect x="164" y="92" width="38" height="8" rx="2" fill="#e07070" opacity="0.5"/>
                  <rect x="122" y="103" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/><rect x="164" y="103" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/>
                  <rect x="122" y="114" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/><rect x="164" y="114" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5"/>
                  <text x="141" y="133" text-anchor="middle" font-size="7" fill="currentColor">keys</text><text x="183" y="133" text-anchor="middle" font-size="7" fill="currentColor">vals</text>
                  <text x="164" y="143" text-anchor="middle" font-size="7.5" fill="currentColor">✓ эвакуирован</text>
                </g>

                <!-- old[2] — сейчас эвакуируется, оранжевый -->
                <rect x="222" y="16" width="96" height="110" rx="5" fill="#f5a62308" stroke="#f5a623" stroke-width="1.5"/>
                <rect x="228" y="20" width="84" height="14" rx="3" fill="#f5a62318" stroke="#f5a623" stroke-width="0.8"/>
                <text x="270" y="30" text-anchor="middle" font-size="7" fill="#f5a623">tophash</text>
                <rect x="228" y="37" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.7"/><rect x="270" y="37" width="38" height="8" rx="2" fill="#e07070" opacity="0.7"/>
                <rect x="228" y="48" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.7"/><rect x="270" y="48" width="38" height="8" rx="2" fill="#e07070" opacity="0.7"/>
                <rect x="228" y="59" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.7"/><rect x="270" y="59" width="38" height="8" rx="2" fill="#e07070" opacity="0.7"/>
                <rect x="228" y="70" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.7"/><rect x="270" y="70" width="38" height="8" rx="2" fill="#e07070" opacity="0.7"/>
                <rect x="228" y="81" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.7"/><rect x="270" y="81" width="38" height="8" rx="2" fill="#e07070" opacity="0.7"/>
                <rect x="228" y="92" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.7"/><rect x="270" y="92" width="38" height="8" rx="2" fill="#e07070" opacity="0.7"/>
                <rect x="228" y="103" width="38" height="8" rx="2" fill="none" stroke="#f5a623" stroke-width="0.6" opacity="0.4"/><rect x="270" y="103" width="38" height="8" rx="2" fill="none" stroke="#f5a623" stroke-width="0.6" opacity="0.4"/>
                <rect x="228" y="114" width="38" height="8" rx="2" fill="none" stroke="#f5a623" stroke-width="0.6" opacity="0.4"/><rect x="270" y="114" width="38" height="8" rx="2" fill="none" stroke="#f5a623" stroke-width="0.6" opacity="0.4"/>
                <text x="247" y="133" text-anchor="middle" font-size="7" fill="#f5a623">keys</text><text x="289" y="133" text-anchor="middle" font-size="7" fill="#f5a623">vals</text>
                <text x="270" y="143" text-anchor="middle" font-size="7.5" fill="#f5a623" font-weight="bold">↓ сейчас</text>

                <!-- old[3] — ждёт -->
                <rect x="328" y="16" width="96" height="110" rx="5" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.4"/>
                <rect x="334" y="20" width="84" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
                <text x="376" y="30" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.4">tophash</text>
                <rect x="334" y="37" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.35"/><rect x="376" y="37" width="38" height="8" rx="2" fill="#e07070" opacity="0.35"/>
                <rect x="334" y="48" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.35"/><rect x="376" y="48" width="38" height="8" rx="2" fill="#e07070" opacity="0.35"/>
                <rect x="334" y="59" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.35"/><rect x="376" y="59" width="38" height="8" rx="2" fill="#e07070" opacity="0.35"/>
                <rect x="334" y="70" width="38" height="8" rx="2" fill="#3b7ec9" opacity="0.35"/><rect x="376" y="70" width="38" height="8" rx="2" fill="#e07070" opacity="0.35"/>
                <rect x="334" y="81" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/><rect x="376" y="81" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
                <rect x="334" y="92" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/><rect x="376" y="92" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
                <rect x="334" y="103" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/><rect x="376" y="103" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
                <rect x="334" y="114" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/><rect x="376" y="114" width="38" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
                <text x="353" y="133" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.4">keys</text><text x="395" y="133" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.4">vals</text>
                <text x="376" y="143" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.35">ждёт</text>

                <!-- nevacuate label -->
                <text x="10" y="154" font-size="8" fill="#e04434" opacity="0.7">nevacuate = 2 — бакеты 0 и 1 перенесены, сейчас переносится bmap[2]</text>

                <!-- стрелка old[2] → new[4] -->
                <line x1="270" y1="160" x2="270" y2="172" stroke="#4caf7d" stroke-width="1.4" stroke-dasharray="3 2" marker-end="url(#ma_ev)"/>

                <!-- NEW BUCKETS: B=3, 8 штук — разреженные -->
                <text x="10" y="170" font-size="8.5" fill="currentColor" opacity="0.38">buckets — B=3, 8 бакетов (каждый ~вдвое свободнее)</text>

                <!-- Макрос для бакета: x, цвет, кол-во заполненных, метка -->
                <!-- green filled: new[0], new[1], new[4], new[5] — из old[0] и old[1] -->
                <!-- orange: new[2], new[6] — из old[2], сейчас заполняется -->
                <!-- gray empty: new[3], new[7] — ждут old[3] -->

                <!-- new[0] green -->
                <rect x="10" y="176" width="50" height="100" rx="4" fill="#4caf7d08" stroke="#4caf7d" stroke-width="1.1"/>
                <rect x="14" y="180" width="42" height="11" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.7"/>
                <text x="35" y="189" text-anchor="middle" font-size="6" fill="#4caf7d">tophash</text>
                <rect x="14" y="194" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="36" y="194" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="14" y="204" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="36" y="204" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="14" y="214" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="36" y="214" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="14" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="36" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="14" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="36" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="14" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="36" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="14" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="36" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="14" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="36" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <text x="23" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">k</text><text x="45" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">v</text>
                <text x="35" y="285" text-anchor="middle" font-size="7" fill="#4caf7d" opacity="0.8">new[0]</text>

                <!-- new[1] green -->
                <rect x="66" y="176" width="50" height="100" rx="4" fill="#4caf7d08" stroke="#4caf7d" stroke-width="1.1"/>
                <rect x="70" y="180" width="42" height="11" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.7"/>
                <text x="91" y="189" text-anchor="middle" font-size="6" fill="#4caf7d">tophash</text>
                <rect x="70" y="194" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="92" y="194" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="70" y="204" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="92" y="204" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="70" y="214" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="92" y="214" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="70" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="92" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="70" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="92" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="70" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="92" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="70" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="92" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="70" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="92" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <text x="79" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">k</text><text x="101" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">v</text>
                <text x="91" y="285" text-anchor="middle" font-size="7" fill="#4caf7d" opacity="0.8">new[1]</text>

                <!-- new[2] orange (из old[2], сейчас заполняется) -->
                <rect x="122" y="176" width="50" height="100" rx="4" fill="#f5a62308" stroke="#f5a623" stroke-width="1.4" stroke-dasharray="3 2"/>
                <rect x="126" y="180" width="42" height="11" rx="2" fill="#f5a62318" stroke="#f5a623" stroke-width="0.7"/>
                <text x="147" y="189" text-anchor="middle" font-size="6" fill="#f5a623">tophash</text>
                <rect x="126" y="194" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.5"/><rect x="148" y="194" width="18" height="7" rx="1" fill="#e07070" opacity="0.5"/>
                <rect x="126" y="204" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="204" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="126" y="214" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="214" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="126" y="224" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="224" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="126" y="234" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="234" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="126" y="244" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="244" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="126" y="254" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="254" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="126" y="264" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="148" y="264" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <text x="135" y="277" text-anchor="middle" font-size="6" fill="#f5a623" opacity="0.7">k</text><text x="157" y="277" text-anchor="middle" font-size="6" fill="#f5a623" opacity="0.7">v</text>
                <text x="147" y="285" text-anchor="middle" font-size="7" fill="#f5a623">new[2] ↑</text>

                <!-- new[3] gray empty (ждёт old[3]) -->
                <rect x="178" y="176" width="50" height="100" rx="4" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/>
                <text x="203" y="230" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.2">new[3]</text>

                <!-- new[4] green (из old[0]) -->
                <rect x="234" y="176" width="50" height="100" rx="4" fill="#4caf7d08" stroke="#4caf7d" stroke-width="1.1"/>
                <rect x="238" y="180" width="42" height="11" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.7"/>
                <text x="259" y="189" text-anchor="middle" font-size="6" fill="#4caf7d">tophash</text>
                <rect x="238" y="194" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="260" y="194" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="238" y="204" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="260" y="204" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="238" y="214" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="260" y="214" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="238" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="260" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="238" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="260" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="238" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="260" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="238" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="260" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="238" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="260" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <text x="247" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">k</text><text x="269" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">v</text>
                <text x="259" y="285" text-anchor="middle" font-size="7" fill="#4caf7d" opacity="0.8">new[4]</text>

                <!-- new[5] green (из old[1]) -->
                <rect x="290" y="176" width="50" height="100" rx="4" fill="#4caf7d08" stroke="#4caf7d" stroke-width="1.1"/>
                <rect x="294" y="180" width="42" height="11" rx="2" fill="#4caf7d18" stroke="#4caf7d" stroke-width="0.7"/>
                <text x="315" y="189" text-anchor="middle" font-size="6" fill="#4caf7d">tophash</text>
                <rect x="294" y="194" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="316" y="194" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="294" y="204" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.6"/><rect x="316" y="204" width="18" height="7" rx="1" fill="#e07070" opacity="0.6"/>
                <rect x="294" y="214" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="316" y="214" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="294" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="316" y="224" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="294" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="316" y="234" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="294" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="316" y="244" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="294" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="316" y="254" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <rect x="294" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/><rect x="316" y="264" width="18" height="7" rx="1" fill="none" stroke="#4caf7d" stroke-width="0.5" opacity="0.3"/>
                <text x="303" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">k</text><text x="325" y="277" text-anchor="middle" font-size="6" fill="#4caf7d" opacity="0.6">v</text>
                <text x="315" y="285" text-anchor="middle" font-size="7" fill="#4caf7d" opacity="0.8">new[5]</text>

                <!-- new[6] orange (из old[2], сейчас заполняется) -->
                <rect x="346" y="176" width="50" height="100" rx="4" fill="#f5a62308" stroke="#f5a623" stroke-width="1.4" stroke-dasharray="3 2"/>
                <rect x="350" y="180" width="42" height="11" rx="2" fill="#f5a62318" stroke="#f5a623" stroke-width="0.7"/>
                <text x="371" y="189" text-anchor="middle" font-size="6" fill="#f5a623">tophash</text>
                <rect x="350" y="194" width="18" height="7" rx="1" fill="#3b7ec9" opacity="0.5"/><rect x="372" y="194" width="18" height="7" rx="1" fill="#e07070" opacity="0.5"/>
                <rect x="350" y="204" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="204" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="350" y="214" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="214" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="350" y="224" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="224" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="350" y="234" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="234" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="350" y="244" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="244" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="350" y="254" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="254" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <rect x="350" y="264" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/><rect x="372" y="264" width="18" height="7" rx="1" fill="none" stroke="#f5a623" stroke-width="0.5" opacity="0.4"/>
                <text x="359" y="277" text-anchor="middle" font-size="6" fill="#f5a623" opacity="0.7">k</text><text x="381" y="277" text-anchor="middle" font-size="6" fill="#f5a623" opacity="0.7">v</text>
                <text x="371" y="285" text-anchor="middle" font-size="7" fill="#f5a623">new[6] ↑</text>

                <!-- new[7] gray empty (ждёт old[3]) -->
                <rect x="402" y="176" width="50" height="100" rx="4" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18"/>
                <text x="427" y="230" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.2">new[7]</text>

                <!-- стрелки: old[2] → new[2] и new[6] -->
                <line x1="242" y1="160" x2="147" y2="174" stroke="#f5a623" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ma_ev)"/>
                <line x1="298" y1="160" x2="371" y2="174" stroke="#f5a623" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ma_ev)"/>
              </svg>
              <p class="tight" style="margin-top:4px;opacity:0.55;font-size:0.88em"><code class="inline">mapaccess</code> проверяет ОБА массива (old + new) пока эвакуация не завершена — нет STW.</p>

              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">evacuation.go (концептуально)</span></div>
                <pre><code class="language-go">// При load factor > 6.5:
// 1. Создаётся новый массив бакетов в 2× больше (B++)
// 2. oldbuckets → старый массив
// 3. Каждый mapassign/mapdelete переносит 1-2 бакета из old в new
// 4. mapaccess проверяет ОБА массива пока эвакуация не завершена
//
// Нет STW (stop-the-world) — перенос растянут по времени</code></pre>
              </div>

              <p class="tight" style="margin-top:12px"><b>Следствия для практики:</b></p>
              <p class="tight">• <b>&amp;m[key] — ошибка компиляции</b>: эвакуация перемещает данные, сохранённый указатель стал бы висячим</p>
              <p class="tight">• <b>Случайный порядок range</b>: <code class="inline">mapiterinit</code> вызывает <code class="inline">fastrand()</code> — выбирает случайный стартовый бакет и слот. Защита от зависимости кода от порядка</p>
              <p class="tight">• <b>fmt.Println кажется отсортированным</b>: пакет <code class="inline">reflect</code> принудительно сортирует ключи перед выводом — это поведение fmt, не map</p>
              <p class="tight">• <b>make(map[K]V, hint)</b>: заранее аллоцирует нужное кол-во бакетов, избегая нескольких циклов эвакуации</p>

              <div class="impl-sources">Источники: runtime/map.go · src/internal/abi/type.go · github.com/golang/go</div>
            </div>
          </details>

          <details class="deep" style="margin:10px 0">
            <summary>Go 1.24+ — Swiss Tables (open addressing) <span class="tag">new</span></summary>
            <div class="deep-body">
              <p class="tight">В старой реализации поиск по бакету шёл последовательно — tophash каждого слота сравнивался по одному, в цикле. Если слот не совпал — следующий, и так до 8 раз. Это работает, но медленно: каждое «нет» — отдельная инструкция сравнения.</p>
              <p class="tight"><b>Главный выигрыш Swiss Tables</b> — все 8 слотов группы проверяются <b>за одну операцию</b>. Каждый слот хранит 7 бит хеша (h2) в компактном <b>control word</b> — 8 байт подряд. При поиске Go сравнивает нужный h2 сразу со всеми 8 байтами одной битовой операцией (SIMD на amd64): слоты, где h2 не совпал, мгновенно отсекаются, до сравнения самого ключа дело доходит только для «кандидатов». Команда Go отмечает это главным источником ускорения. Ещё одно следствие — load factor вырос с ~81% до ~87.5%, то есть меньше памяти тратится впустую на пустые слоты.</p>
              <p class="tight" style="color:var(--text-dim);font-size:12px">
                <b>Жёсткие ограничения из исходников</b> (<code class="inline">internal/runtime/maps</code>, <code class="inline">internal/abi/map.go</code>):<br>
                • <b>Группа</b>: всегда ровно <b>8 слотов</b> (<code class="inline">MapGroupSlots = 1 &lt;&lt; 3</code>). Степень двойки — обязательно: размер группы закодирован сдвигом, битовые маски group-индекса зависят от этого. Нельзя сделать группу из 7 или 9.<br>
                • <b>Таблица</b>: максимум <b>1024 записи</b> (<code class="inline">maxTableCapacity = 1024</code> = 2¹⁰ = 128 групп × 8 слотов). Тоже степень двойки — это предел одной таблицы; если нужно больше, растёт directory, добавляется новая таблица.<br>
                • <b>Directory</b>: размер всегда <code class="inline">1 &lt;&lt; globalDepth</code> — степень двойки. Удваивается только когда <code class="inline">localDepth == globalDepth</code> у разбиваемой таблицы — иначе таблица сплитится без роста directory. Маленькая map (≤8 ключей) вообще не создаёт directory: всё помещается в один inline-group.<br>
                • <b>Load factor</b>: <code class="inline">maxAvgGroupLoad = 7</code> из 8 слотов → 87.5%. Реальная вместимость таблицы = <b>кол-во групп × 7</b>, а не × 8. Пример: 8 групп × 8 слотов = 64 слота физически, но вмещают только <b>56 элементов</b> (8 × 7) — при 57-м таблица начнёт расти. Хочешь прикинуть сколько групп нужно — дели на 7, а не на 8.
              </p>
              <p class="tight" style="color:var(--text-dim);font-size:12px">Цифры: микробенчмарки до +60%, реальные приложения ~+1.5% geometric mean CPU (<a href="https://go.dev/blog/swisstable" target="_blank" style="color:inherit;opacity:.6">go.dev/blog/swisstable</a>).</p>

              <!-- SVG: Swiss Tables structure -->
              <svg viewBox="0 0 690 178" style="width:100%;margin:8px 0 6px">
                <defs>
                  <marker id="ma_sw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.45"/></marker>
                </defs>

                <!-- "Directory" заголовок вверху -->
                <text x="345" y="14" text-anchor="middle" font-size="11" font-weight="bold" fill="currentColor" opacity="0.75">Directory</text>

                <!-- ══ TABLE 0 (4 groups) x=4, w=263 ══ -->
                <rect x="4" y="20" width="263" height="130" rx="5" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2"/>
                <text x="135" y="33" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor" opacity="0.8">Table 0</text>

                <!-- group 0  gx=12 -->
                <rect x="12" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="40" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="12" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="12" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="39" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="14" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="14" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="40" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="40" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 1  gx=75 -->
                <rect x="75" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="103" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="75" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="75" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="102" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="77" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="77" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="103" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="103" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 2  gx=138 -->
                <rect x="138" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="166" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="138" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="138" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="165" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="140" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="140" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="166" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="166" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 3  gx=201 -->
                <rect x="201" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="229" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="201" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="201" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="228" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="203" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="203" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="229" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="229" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group labels T0 -->
                <text x="40" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 0</text>
                <text x="103" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 1</text>
                <text x="166" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 2</text>
                <text x="229" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 3</text>

                <!-- ══ TABLE 1 (4 groups) x=275, w=263 ══ -->
                <rect x="275" y="20" width="263" height="130" rx="5" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2"/>
                <text x="406" y="33" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor" opacity="0.8">Table 1</text>

                <!-- group 0  gx=283 -->
                <rect x="283" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="311" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="283" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="283" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="310" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="285" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="285" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="311" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="311" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 1  gx=346 -->
                <rect x="346" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="374" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="346" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="346" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="373" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="348" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="348" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="374" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="374" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 2  gx=409 -->
                <rect x="409" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="437" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="409" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="409" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="436" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="411" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="411" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="437" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="437" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 3  gx=472 -->
                <rect x="472" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="500" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="472" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="472" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="499" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="474" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="474" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="500" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="500" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group labels T1 -->
                <text x="311" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 0</text>
                <text x="374" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 1</text>
                <text x="437" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 2</text>
                <text x="500" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 3</text>

                <!-- ══ TABLE 2 (2 groups) x=546, w=137 ══ -->
                <rect x="546" y="20" width="137" height="130" rx="5" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2"/>
                <text x="614" y="33" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor" opacity="0.8">Table 2</text>

                <!-- group 0  gx=554 -->
                <rect x="554" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="582" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="554" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="554" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="581" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="556" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="556" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="582" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="582" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group 1  gx=617 -->
                <rect x="617" y="38" width="56" height="10" rx="2" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.7"/>
                <text x="645" y="45.5" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.65">Metadata</text>
                <rect x="617" y="50" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="50" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="60" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="60" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="70" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="70" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="80" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="80" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="90" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="90" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="100" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="100" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="110" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="110" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <rect x="617" y="120" width="25" height="8" rx="2" fill="#3b7ec9" fill-opacity="0.75"/><rect x="644" y="120" width="27" height="8" rx="2" fill="#c04060" fill-opacity="0.75"/>
                <text x="619" y="48.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="48.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="58.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="58.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="68.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="68.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="78.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="78.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="88.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="88.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="98.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="98.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="108.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="108.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="619" y="118.5" font-size="5.5" fill="white" opacity="0.85">Key</text><text x="645" y="118.5" font-size="5.5" fill="white" opacity="0.85">Value</text>
                <text x="645" y="135" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.4">slots</text>

                <!-- group labels T2 -->
                <text x="582" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 0</text>
                <text x="645" y="158" text-anchor="middle" font-size="7.5" fill="currentColor" opacity="0.55">group 1</text>

                <!-- легенда снизу -->
                <text x="10" y="172" font-size="7" fill="currentColor" opacity="0.32">Metadata = ctrl word (8 байт) · каждый слот = Key + Value · H1 → группа · H2 → ctrl byte</text>
              </svg>

              <!-- ── Zoom + Memory layout ── -->
              <div style="display:flex;gap:14px;align-items:flex-start;margin:4px 0 4px">
              <svg viewBox="0 0 200 260" style="width:28%;flex-shrink:0">
                <defs>
                  <!-- градиент-сплит: левая половина Key (синий), правая Value (малиновый) -->
                  <linearGradient id="kv_grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="50%" stop-color="#3b7ec9" stop-opacity="0.78"/>
                    <stop offset="50%" stop-color="#b03060" stop-opacity="0.78"/>
                  </linearGradient>
                </defs>

                <!-- группа-контейнер -->
                <rect x="10" y="4" width="180" height="248" rx="6" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.2" stroke-dasharray="4 3"/>

                <!-- Metadata header -->
                <rect x="18" y="12" width="164" height="22" rx="4" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.3" stroke-width="0.9"/>
                <text x="100" y="26" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">Metadata</text>

                <!-- 8 слотов — Key+Value как один блок (градиент) -->
                <rect x="18" y="38"  width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="62"  width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="86"  width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="110" width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="134" width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="158" width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="182" width="164" height="20" rx="4" fill="url(#kv_grad)"/>
                <rect x="18" y="206" width="164" height="20" rx="4" fill="url(#kv_grad)"/>

                <!-- тонкая центральная черта внутри каждого слота -->
                <line x1="100" y1="38"  x2="100" y2="58"  stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="62"  x2="100" y2="82"  stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="86"  x2="100" y2="106" stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="110" x2="100" y2="130" stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="134" x2="100" y2="154" stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="158" x2="100" y2="178" stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="182" x2="100" y2="202" stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>
                <line x1="100" y1="206" x2="100" y2="226" stroke="white" stroke-opacity="0.25" stroke-width="0.8"/>

                <!-- Key / Value лейблы -->
                <text x="59"  y="52"  text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="52"  text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="76"  text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="76"  text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="100" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="100" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="124" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="124" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="148" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="148" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="172" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="172" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="196" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="196" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>
                <text x="59"  y="220" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Key</text><text x="141" y="220" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Value</text>

                <!-- slots label -->
                <text x="100" y="240" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.4">slots</text>
              </svg>
              <!-- ── Сравнение памяти: лента адресов ── -->
              <svg viewBox="0 0 340 260" style="flex:1;min-width:0">
                <defs>
                  <linearGradient id="kv_cmp" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="50%" stop-color="#3b7ec9" stop-opacity="0.8"/>
                    <stop offset="50%" stop-color="#b03060" stop-opacity="0.8"/>
                  </linearGradient>
                </defs>

                <!-- ══ bmap ══ -->
                <text x="0" y="13" font-size="10" font-weight="bold" fill="currentColor" opacity="0.55">bmap</text>

                <!-- сплошная лента: tophash × 4, keys × 4, values × 4 (все встык) -->
                <!-- ширина блока: t=16, k=26, v=26. total = 4×16 + 4×26 + 4×26 = 64+104+104 = 272 -->
                <!-- t: x=0..63 -->
                <rect x="0"   y="18" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <rect x="16"  y="18" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <rect x="32"  y="18" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <rect x="48"  y="18" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <text x="32"  y="37" text-anchor="middle" font-size="8" fill="white" opacity="0.9">t</text>
                <!-- k: x=64..167 -->
                <rect x="64"  y="18" width="26" height="34" fill="#3b7ec9" fill-opacity="0.75"/>
                <rect x="90"  y="18" width="26" height="34" fill="#3b7ec9" fill-opacity="0.75"/>
                <rect x="116" y="18" width="26" height="34" fill="#3b7ec9" fill-opacity="0.75"/>
                <rect x="142" y="18" width="26" height="34" fill="#3b7ec9" fill-opacity="0.75"/>
                <text x="64"  y="37" font-size="9" font-weight="bold" fill="white">k₀</text>
                <text x="90"  y="37" font-size="9" font-weight="bold" fill="white">k₁</text>
                <text x="116" y="37" font-size="9" font-weight="bold" fill="white">k₂</text>
                <text x="142" y="37" font-size="9" font-weight="bold" fill="white">k₃</text>
                <!-- v: x=168..271 -->
                <rect x="168" y="18" width="26" height="34" fill="#b03060" fill-opacity="0.75"/>
                <rect x="194" y="18" width="26" height="34" fill="#b03060" fill-opacity="0.75"/>
                <rect x="220" y="18" width="26" height="34" fill="#b03060" fill-opacity="0.75"/>
                <rect x="246" y="18" width="26" height="34" fill="#b03060" fill-opacity="0.75"/>
                <text x="168" y="37" font-size="9" font-weight="bold" fill="white">v₀</text>
                <text x="194" y="37" font-size="9" font-weight="bold" fill="white">v₁</text>
                <text x="220" y="37" font-size="9" font-weight="bold" fill="white">v₂</text>
                <text x="246" y="37" font-size="9" font-weight="bold" fill="white">v₃</text>

                <!-- разделительные линии между блоками (тонкие белые) -->
                <line x1="16"  y1="18" x2="16"  y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="32"  y1="18" x2="32"  y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="48"  y1="18" x2="48"  y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="90"  y1="18" x2="90"  y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="116" y1="18" x2="116" y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="142" y1="18" x2="142" y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="194" y1="18" x2="194" y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="220" y1="18" x2="220" y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="246" y1="18" x2="246" y2="52" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>

                <!-- подписи секций -->
                <text x="32"  y="62" text-anchor="middle" font-size="8" fill="#f5a623" opacity="0.7">tophash</text>
                <text x="116" y="62" text-anchor="middle" font-size="8" fill="#3b7ec9" opacity="0.7">keys</text>
                <text x="220" y="62" text-anchor="middle" font-size="8" fill="#b03060" opacity="0.7">values</text>

                <!-- стрелка: k₀ и v₀ далеко -->
                <line x1="77" y1="70" x2="181" y2="70" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.8" marker-end="url(#arr)"/>
                <line x1="181" y1="70" x2="77" y2="70" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.8"/>
                <text x="129" y="80" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.4">k₀ и v₀ далеко</text>

                <!-- ══ Swiss Tables ══ -->
                <text x="0" y="118" font-size="10" font-weight="bold" fill="currentColor" opacity="0.55">Swiss Tables</text>

                <!-- сплошная лента: ctrl × 4, затем [k v] × 4 парами -->
                <!-- ctrl: x=0..63 (4×16) -->
                <rect x="0"   y="124" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <rect x="16"  y="124" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <rect x="32"  y="124" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <rect x="48"  y="124" width="16" height="34" fill="#f5a623" fill-opacity="0.65"/>
                <text x="32"  y="143" text-anchor="middle" font-size="8" fill="white" opacity="0.9">c</text>
                <line x1="16"  y1="124" x2="16"  y2="158" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="32"  y1="124" x2="32"  y2="158" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="48"  y1="124" x2="48"  y2="158" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>

                <!-- [k₀ v₀] [k₁ v₁] [k₂ v₂] [k₃ v₃] — встык -->
                <!-- каждая пара = 52px (k=26 + v=26), итого 4×52=208 -->
                <rect x="64"  y="124" width="52" height="34" fill="url(#kv_cmp)"/>
                <rect x="116" y="124" width="52" height="34" fill="url(#kv_cmp)"/>
                <rect x="168" y="124" width="52" height="34" fill="url(#kv_cmp)"/>
                <rect x="220" y="124" width="52" height="34" fill="url(#kv_cmp)"/>

                <!-- тонкие границы внутри пар (k|v) и между парами -->
                <line x1="90"  y1="124" x2="90"  y2="158" stroke="white" stroke-opacity="0.3" stroke-width="0.8"/>
                <line x1="142" y1="124" x2="142" y2="158" stroke="white" stroke-opacity="0.3" stroke-width="0.8"/>
                <line x1="168" y1="124" x2="168" y2="158" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="194" y1="124" x2="194" y2="158" stroke="white" stroke-opacity="0.3" stroke-width="0.8"/>
                <line x1="220" y1="124" x2="220" y2="158" stroke="white" stroke-opacity="0.15" stroke-width="0.5"/>
                <line x1="246" y1="124" x2="246" y2="158" stroke="white" stroke-opacity="0.3" stroke-width="0.8"/>

                <text x="77"  y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">k₀</text>
                <text x="103" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">v₀</text>
                <text x="129" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">k₁</text>
                <text x="155" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">v₁</text>
                <text x="181" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">k₂</text>
                <text x="207" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">v₂</text>
                <text x="233" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">k₃</text>
                <text x="259" y="143" text-anchor="middle" font-size="9" font-weight="bold" fill="white">v₃</text>

                <!-- подписи -->
                <text x="32"  y="168" text-anchor="middle" font-size="8" fill="#f5a623" opacity="0.7">ctrl</text>
                <text x="168" y="168" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.45">слоты</text>

                <!-- стрелка: k₀ и v₀ рядом -->
                <line x1="64" y1="176" x2="116" y2="176" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.8"/>
                <text x="90" y="186" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.4">k₀ рядом с v₀</text>
              </svg>

              </div>

              <!-- ── Технический SVG: хэш-разбивка + ctrl byte ── -->
              <svg viewBox="0 0 690 118" style="width:100%;margin:4px 0 8px">

                <!-- ══ 1. Hash split bar ══ -->
                <text x="10" y="11" font-size="8.5" fill="currentColor" opacity="0.55" font-weight="bold">hash(key) — 64 бита:</text>

                <!-- globalDepth бит (top) — orange -->
                <rect x="10" y="15" width="72" height="16" rx="2" fill="#f5a623" fill-opacity="0.22" stroke="#f5a623" stroke-width="0.9"/>
                <text x="46" y="26" text-anchor="middle" font-size="7" fill="#f5a623" font-weight="bold">globalDepth бит</text>

                <!-- H1 57 бит — green -->
                <rect x="83" y="15" width="424" height="16" rx="2" fill="#4caf7d" fill-opacity="0.18" stroke="#4caf7d" stroke-width="0.9"/>
                <text x="295" y="26" text-anchor="middle" font-size="7.5" fill="#4caf7d" font-weight="bold">H1 = hash &gt;&gt; 7   (верхние 57 бит)</text>

                <!-- H2 7 бит — blue -->
                <rect x="508" y="15" width="172" height="16" rx="2" fill="#3b7ec9" fill-opacity="0.22" stroke="#3b7ec9" stroke-width="0.9"/>
                <text x="594" y="26" text-anchor="middle" font-size="7.5" fill="#3b7ec9" font-weight="bold">H2 = hash &amp; 0x7F   (7 бит)</text>

                <!-- стрелки вниз -->
                <line x1="46" y1="31" x2="46" y2="40" stroke="#f5a623" stroke-width="1" stroke-dasharray="2 2"/>
                <line x1="295" y1="31" x2="295" y2="40" stroke="#4caf7d" stroke-width="1" stroke-dasharray="2 2"/>
                <line x1="594" y1="31" x2="594" y2="40" stroke="#3b7ec9" stroke-width="1" stroke-dasharray="2 2"/>

                <!-- аннотации -->
                <text x="46" y="49" text-anchor="middle" font-size="7" fill="#f5a623" opacity="0.8">→ индекс в Directory</text>
                <text x="295" y="49" text-anchor="middle" font-size="7" fill="#4caf7d" opacity="0.8">→ квадратичное пробирование групп внутри Table</text>
                <text x="594" y="49" text-anchor="middle" font-size="7" fill="#3b7ec9" opacity="0.8">→ сравнение с ctrl word</text>

                <!-- ══ 2. ctrl byte structure ══ -->
                <text x="10" y="64" font-size="8.5" fill="currentColor" opacity="0.55" font-weight="bold">ctrl byte (один байт на слот в ctrl word):</text>

                <!-- bit 7 -->
                <rect x="10" y="68" width="28" height="18" rx="2" fill="#f5a623" fill-opacity="0.2" stroke="#f5a623" stroke-width="1"/>
                <text x="24" y="79" text-anchor="middle" font-size="8" fill="#f5a623" font-weight="bold">b7</text>
                <!-- bits 6-0 -->
                <rect x="39" y="68" width="196" height="18" rx="2" fill="#3b7ec9" fill-opacity="0.18" stroke="#3b7ec9" stroke-width="1"/>
                <text x="137" y="79" text-anchor="middle" font-size="8" fill="#3b7ec9">b6  b5  b4  b3  b2  b1  b0  (H2)</text>

                <text x="24" y="96" text-anchor="middle" font-size="7" fill="#f5a623" opacity="0.8">1 = занят</text>
                <text x="24" y="105" text-anchor="middle" font-size="7" fill="#f5a623" opacity="0.8">0 = пусто</text>
                <text x="137" y="96" text-anchor="middle" font-size="7" fill="#3b7ec9" opacity="0.8">7 бит H2 — pre-filter: одна SIMD-операция проверяет</text>
                <text x="137" y="105" text-anchor="middle" font-size="7" fill="#3b7ec9" opacity="0.8">все 8 ctrl-байт группы сразу, до обращения к слотам</text>

                <!-- ══ 3. три состояния ctrl byte ══ -->
                <text x="260" y="64" font-size="8.5" fill="currentColor" opacity="0.55" font-weight="bold">Состояния ctrl byte:</text>

                <!-- occupied -->
                <rect x="260" y="68" width="115" height="18" rx="3" fill="#4caf7d" fill-opacity="0.18" stroke="#4caf7d" stroke-width="0.9"/>
                <text x="317" y="78" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#4caf7d">1|H2H2H2H2H2H2H2</text>
                <text x="317" y="93" text-anchor="middle" font-size="7" fill="#4caf7d" opacity="0.8">занят (0x80+)</text>

                <!-- empty -->
                <rect x="385" y="68" width="115" height="18" rx="3" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3" stroke-width="0.9"/>
                <text x="442" y="78" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="currentColor" opacity="0.5">0|0000000  =  0x00</text>
                <text x="442" y="93" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.45">пустой слот</text>

                <!-- tombstone -->
                <rect x="510" y="68" width="172" height="18" rx="3" fill="#e04434" fill-opacity="0.12" stroke="#e04434" stroke-width="0.9"/>
                <text x="596" y="78" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#e04434">1|1111111  =  0xFE</text>
                <text x="596" y="93" text-anchor="middle" font-size="7" fill="#e04434" opacity="0.8">tombstone (удалён, поиск продолжает)</text>

              </svg>

              <div class="codeblock">
                <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/internal/runtime/maps/map.go</span></div>
                <pre><code class="language-go">type Map struct {
    used        uint64         // len(m) — всего элементов
    seed        uintptr        // seed для хеш-функции
    dirPtr      unsafe.Pointer // *[dirLen]*table — directory таблиц
    dirLen      int            // = 1 &lt;&lt; globalDepth
    globalDepth uint8          // кол-во бит для выбора таблицы из directory
    globalShift uint8          // = 64 - globalDepth
}
// hash(key) → верхние globalDepth бит → индекс в directory → *table
// hash(key) → H1 (57 бит) → индекс группы внутри таблицы (пробирование)
// hash(key) → H2 (7 бит)  → ctrl byte слота (параллельный pre-filter)</code></pre>
              </div>

              <p class="tight" style="margin-top:10px"><b>Ключевое отличие от старой реализации:</b> нет overflow bucket'ов. При коллизии — открытая адресация: следующая группа по probe sequence (квадратичный треугольный перебор, гарантированно обходящий все группы). Одна группа проверяется за одну операцию через битовое AND по control word — аналог SIMD.</p>

              <div class="callout interview">
                <div class="mark">собес</div>
                <p><b>Swiss Tables vs старые бакеты:</b> open addressing вместо chaining → нет overflow bucket'ов → лучше cache locality. Control word позволяет сравнить H2 сразу 8 слотов за одну битовую операцию вместо цикла по tophash. Рост отдельной таблицы (не всей map сразу) через directory → меньше пауз.</p>
              </div>

              <figure style="margin-top:16px">
                <svg viewBox="0 0 680 490" style="width:100%;max-width:680px" role="img" aria-label="Swiss Tables: инлайн-группа при ≤8 ключах и переход к полной архитектуре при 9+">
                  <defs>
                    <marker id="st-arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.5"/>
                    </marker>
                  </defs>

                  <!-- ═══ ЛЕВАЯ: ≤8 ключей ═══ -->
                  <text x="130" y="22" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor" font-family="JetBrains Mono, monospace">≤ 8 ключей</text>
                  <text x="130" y="38" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5" font-family="JetBrains Mono, monospace">один инлайн-блок, директории нет</text>

                  <rect x="30" y="48" width="200" height="24" rx="5" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-opacity="0.25" stroke-width="1"/>
                  <text x="130" y="64" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5" font-family="JetBrains Mono, monospace">control word  (8 × h2)</text>

                  <rect x="30" y="76"  width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="92"  text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 1 — key / value</text>
                  <rect x="30" y="104" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="120" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 2 — key / value</text>
                  <rect x="30" y="132" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="148" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 3 — key / value</text>
                  <rect x="30" y="160" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="176" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 4 — key / value</text>
                  <rect x="30" y="188" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="204" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 5 — key / value</text>
                  <rect x="30" y="216" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="232" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 6 — key / value</text>
                  <rect x="30" y="244" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="260" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 7 — key / value</text>
                  <rect x="30" y="272" width="200" height="24" rx="3" fill="#3d9e6a" opacity="0.75"/>
                  <text x="130" y="288" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">slot 8 — key / value</text>

                  <text x="130" y="314" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45" font-family="JetBrains Mono, monospace">8/8 — всё ещё OK</text>

                  <rect x="22" y="40" width="216" height="268" rx="8" fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-width="1.5" stroke-dasharray="5,3"/>
                  <text x="238" y="185" font-size="9" fill="currentColor" opacity="0.3" transform="rotate(-90,238,185)" font-family="JetBrains Mono, monospace">ГРУППА</text>

                  <!-- ═══ СТРЕЛКА ═══ -->
                  <text x="318" y="168" text-anchor="middle" font-size="13" fill="#e05a00" font-weight="700" font-family="JetBrains Mono, monospace">+1</text>
                  <text x="318" y="184" text-anchor="middle" font-size="11" fill="#e05a00" font-family="JetBrains Mono, monospace">(9-й)</text>
                  <text x="318" y="200" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5" font-family="JetBrains Mono, monospace">элемент</text>
                  <text x="318" y="215" text-anchor="middle" font-size="10" fill="#e05a00" font-family="JetBrains Mono, monospace">→ рост</text>
                  <path d="M260,205 Q318,205 360,205" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.5" fill="none" marker-end="url(#st-arr2)"/>

                  <!-- ═══ ПРАВАЯ: полная архитектура ═══ -->
                  <text x="525" y="22" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor" font-family="JetBrains Mono, monospace">9+ ключей → рост</text>
                  <text x="525" y="38" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5" font-family="JetBrains Mono, monospace">директория + таблицы + группы</text>

                  <rect x="460" y="48" width="130" height="32" rx="7" fill="#7b8fa6" opacity="0.85"/>
                  <text x="525" y="68" text-anchor="middle" font-size="11" fill="#fff" font-weight="600" font-family="JetBrains Mono, monospace">Directory</text>

                  <line x1="490" y1="80" x2="430" y2="104" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.2"/>
                  <line x1="525" y1="80" x2="525" y2="104" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.2"/>
                  <line x1="560" y1="80" x2="620" y2="104" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.2"/>

                  <rect x="385" y="104" width="88" height="26" rx="5" fill="#5c85b4" opacity="0.8"/>
                  <text x="429" y="121" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">Table 0</text>
                  <rect x="480" y="104" width="88" height="26" rx="5" fill="#5c85b4" opacity="0.8"/>
                  <text x="524" y="121" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">Table 1</text>
                  <rect x="575" y="104" width="88" height="26" rx="5" fill="#5c85b4" opacity="0.8"/>
                  <text x="619" y="121" text-anchor="middle" font-size="10" fill="#fff" font-family="JetBrains Mono, monospace">Table N</text>

                  <line x1="414" y1="130" x2="414" y2="152" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.2"/>
                  <line x1="444" y1="130" x2="444" y2="152" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.2"/>

                  <rect x="374" y="152" width="76" height="44" rx="5" fill="#7b6ea8" opacity="0.75"/>
                  <text x="412" y="169" text-anchor="middle" font-size="9" fill="#e8e4f5" font-family="JetBrains Mono, monospace">control word</text>
                  <rect x="377" y="178" width="70" height="12" rx="3" fill="#a89fd4" opacity="0.9"/>
                  <text x="412" y="188" text-anchor="middle" font-size="8" fill="#fff" font-family="JetBrains Mono, monospace">8 слотов</text>

                  <rect x="456" y="152" width="76" height="44" rx="5" fill="#7b6ea8" opacity="0.75"/>
                  <text x="494" y="169" text-anchor="middle" font-size="9" fill="#e8e4f5" font-family="JetBrains Mono, monospace">control word</text>
                  <rect x="459" y="178" width="70" height="12" rx="3" fill="#a89fd4" opacity="0.9"/>
                  <text x="494" y="188" text-anchor="middle" font-size="8" fill="#fff" font-family="JetBrains Mono, monospace">8 слотов</text>

                  <text x="430" y="212" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.4" font-family="JetBrains Mono, monospace">Группы (×N)</text>

                  <rect x="378" y="224" width="276" height="52" rx="7" fill="#fdf3e7" stroke="#f5c06a" stroke-width="1" opacity="0.9"/>
                  <text x="516" y="242" text-anchor="middle" font-size="10" fill="#7a5500" font-weight="700" font-family="JetBrains Mono, monospace">Пределы из исходников Go</text>
                  <text x="516" y="257" text-anchor="middle" font-size="9" fill="#7a5500" font-family="JetBrains Mono, monospace">Группа: 8 слотов, эффект. нагрузка 7/8</text>
                  <text x="516" y="270" text-anchor="middle" font-size="9" fill="#7a5500" font-family="JetBrains Mono, monospace">Таблица: макс 1 024 эл. (128 групп)</text>

                  <rect x="30" y="344" width="620" height="50" rx="8" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.15" stroke-width="1"/>
                  <text x="340" y="364" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600" font-family="JetBrains Mono, monospace">Правило нагрузки (многогрупповой режим)</text>
                  <text x="340" y="381" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65" font-family="JetBrains Mono, monospace">8 групп × 7 = 56 эл. → при 57-м таблица растёт</text>

                  <text x="340" y="412" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.35" font-family="JetBrains Mono, monospace">Directory удваивается только если localDepth == globalDepth</text>

                  <text x="130" y="454" text-anchor="middle" font-size="10" fill="#3d9e6a" font-weight="600" font-family="JetBrains Mono, monospace">✓ инлайн: 1 группа, все 8 слотов</text>
                  <text x="525" y="454" text-anchor="middle" font-size="10" fill="#af4433" font-weight="600" font-family="JetBrains Mono, monospace">↑ полная архитектура (9+ эл.)</text>
                </svg>
                <figcaption style="font-size:11px;opacity:.6">Маленькая map (≤8 ключей) — один инлайн-блок без Directory. При 9-м элементе создаётся полная структура. Нагрузка 7/8 применяется к многогрупповым таблицам.</figcaption>
              </figure>

              <!-- growth_left diagram -->
              <div style="margin-top:18px; border-top:1px solid rgba(128,128,128,.2); padding-top:16px;">
                <p class="tight" style="margin-bottom:10px"><b>Рост таблицы: как работает growth_left</b></p>

                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(128,128,128,.06);border:1px solid rgba(128,128,128,.2);border-radius:6px;padding:7px 12px;margin-bottom:14px;font-size:10px;font-family:'JetBrains Mono',monospace;">
                  <code class="inline">growth_left</code>
                  <span style="opacity:.5">=</span>
                  <span><b>groups × 7</b> − inserted</span>
                  <span style="opacity:.5">·</span>
                  <span>сколько элементов ещё влезет до роста</span>
                  <span style="opacity:.5">·</span>
                  <span>достигает <b style="color:#d97706">0</b> → таблица растёт</span>
                </div>

                <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;font-family:'JetBrains Mono',monospace;font-size:10px;">

                  <!-- BEFORE -->
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:9px;opacity:.5;text-align:center;text-transform:uppercase;letter-spacing:.08em;">до роста · 14 элементов</div>
                    <div style="border:1px solid rgba(128,128,128,.4);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:rgba(128,128,128,.04);">
                      <div style="text-align:center;font-size:11px;opacity:.5;">Directory</div>
                      <div style="border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:9px 10px 11px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                          <span style="opacity:.5;">Table</span>
                          <div style="text-align:right;">
                            <div style="font-weight:700;color:#d97706;">growth_left = 0</div>
                            <div style="font-size:8px;opacity:.5;">2×7 − 14 = <b>0</b> → рост!</div>
                          </div>
                        </div>
                        <div style="display:flex;gap:7px;">
                          <div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:6px 5px 3px;width:60px;">
                            <div style="font-size:8px;opacity:.5;text-align:center;margin-bottom:4px;">Group</div>
                            ${Array(8).fill(0).map(()=>'<div style="display:flex;gap:3px;margin-bottom:3px;height:12px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')}
                            <div style="font-size:8px;opacity:.4;text-align:center;margin-top:4px;">1</div>
                          </div>
                          <div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:6px 5px 3px;width:60px;">
                            <div style="font-size:8px;opacity:.5;text-align:center;margin-bottom:4px;">Group</div>
                            ${Array(6).fill(0).map(()=>'<div style="display:flex;gap:3px;margin-bottom:3px;height:12px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')}
                            ${Array(2).fill(0).map(()=>'<div style="display:flex;gap:3px;margin-bottom:3px;height:12px;"><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.4;"></div><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.4;"></div></div>').join('')}
                            <div style="font-size:8px;opacity:.4;text-align:center;margin-top:4px;">2</div>
                          </div>
                        </div>
                        <div style="font-size:9px;opacity:.5;text-align:center;margin-top:6px;">capacity 2×7 = 14 · <b style="color:#d97706">14/14</b></div>
                      </div>
                    </div>
                  </div>

                  <!-- ARROW -->
                  <div style="display:flex;flex-direction:column;align-items:center;padding-top:70px;gap:4px;">
                    <div style="font-size:10px;color:#d97706;text-align:center;line-height:1.5;">split<br>↓<br>×2 групп</div>
                    <svg width="40" height="16" viewBox="0 0 40 16"><defs><marker id="glaw" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#d97706"/></marker></defs><line x1="2" y1="8" x2="34" y2="8" stroke="#d97706" stroke-width="1.5" marker-end="url(#glaw)"/></svg>
                  </div>

                  <!-- AFTER -->
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:9px;opacity:.5;text-align:center;text-transform:uppercase;letter-spacing:.08em;">после роста · те же 10 элементов</div>
                    <div style="display:flex;gap:12px;align-items:flex-start;">

                      <!-- Directory с новой таблицей -->
                      <div style="border:1px solid rgba(128,128,128,.4);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:rgba(128,128,128,.04);">
                        <div style="text-align:center;font-size:11px;opacity:.5;">Directory</div>
                        <div style="border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:9px 10px 11px;">
                          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                            <span style="opacity:.5;font-size:10px;">Table (новая)</span>
                          </div>
                          <div style="display:flex;gap:6px;flex-wrap:wrap;max-width:160px;">
                            ${[3,3,2,2].map((n,i)=>'<div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:6px 5px 3px;width:60px;"><div style="font-size:8px;opacity:.5;text-align:center;margin-bottom:4px;">Group</div>'+Array(n).fill(0).map(()=>'<div style="display:flex;gap:3px;margin-bottom:3px;height:12px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')+Array(8-n).fill(0).map(()=>'<div style="display:flex;gap:3px;margin-bottom:3px;height:12px;"><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.4;"></div><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.4;"></div></div>').join('')+'<div style="font-size:8px;opacity:.4;text-align:center;margin-top:4px;">'+(i+1)+'</div></div>').join('')}
                          </div>
                          <div style="font-size:9px;opacity:.5;text-align:center;margin-top:6px;">capacity 4×7 = 28 · <b style="color:#059669">10/28</b></div>
                          <div style="font-size:8px;color:#059669;text-align:right;margin-top:3px;">growth_left = 18 · 4×7−10</div>
                        </div>
                      </div>

                      <!-- Стрелка "нет ссылок" -->
                      <div style="display:flex;flex-direction:column;align-items:center;padding-top:60px;gap:3px;">
                        <div style="font-size:8px;color:#dc2626;opacity:.7;text-align:center;line-height:1.4;">ссылок<br>нет</div>
                        <svg width="36" height="14" viewBox="0 0 36 14"><defs><marker id="gc-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#dc2626" opacity=".6"/></marker></defs><line x1="2" y1="7" x2="30" y2="7" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="3,2" opacity=".6" marker-end="url(#gc-arr)"/></svg>
                      </div>

                      <!-- Старая таблица — вне Directory, ожидает GC -->
                      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:2px;">
                        <div style="border:1px dashed rgba(220,38,38,.4);border-radius:8px;padding:9px 10px 11px;opacity:.55;">
                          <div style="display:flex;align-items:center;gap:4px;margin-bottom:8px;">
                            <span style="opacity:.6;font-size:10px;">Table (старая)</span>
                          </div>
                          <div style="display:flex;gap:7px;">
                            ${[1,2].map(n=>'<div style="border:1px solid rgba(128,128,128,.25);border-radius:5px;padding:6px 5px 3px;width:60px;"><div style="font-size:8px;opacity:.4;text-align:center;margin-bottom:4px;">Group</div>'+Array(8).fill(0).map(()=>'<div style="display:flex;gap:3px;margin-bottom:3px;height:12px;"><div style="border:1px solid rgba(128,128,128,.25);border-radius:2px;flex:1;opacity:.3;"></div><div style="border:1px solid rgba(128,128,128,.25);border-radius:2px;flex:1;opacity:.3;"></div></div>').join('')+'<div style="font-size:8px;opacity:.3;text-align:center;margin-top:4px;">'+n+'</div></div>').join('')}
                          </div>
                        </div>
                        <div style="font-size:9px;color:#dc2626;opacity:.7;text-align:center;line-height:1.4;">данные перехешированы<br>→ очистится GC</div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

              <!-- global_depth / max-table split diagram -->
              <div style="margin-top:18px; border-top:1px solid rgba(128,128,128,.2); padding-top:16px;">
                <p class="tight" style="margin-bottom:10px"><b>Когда таблица достигает максимума: сплит на 2 + рост Directory</b></p>

                <div style="border:1px solid rgba(124,58,237,.3);border-radius:8px;padding:8px 12px;margin-bottom:14px;background:rgba(124,58,237,.05);font-size:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-family:'JetBrains Mono',monospace;">
                  <code class="inline" style="color:#7c3aed;">global_depth</code>
                  <span style="opacity:.5">—</span>
                  <span>сколько бит хеша = индекс в Directory</span>
                  <span style="opacity:.5">·</span>
                  <span>размер Directory = <b>2<sup>global_depth</sup></b></span>
                  <span style="opacity:.5">·</span>
                  <span>+1 → Directory <b>удваивается</b></span>
                </div>

                <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;font-family:'JetBrains Mono',monospace;font-size:10px;">

                  <!-- BEFORE: таблица на максимуме -->
                  <div style="display:flex;flex-direction:column;gap:5px;">
                    <div style="font-size:9px;opacity:.5;text-align:center;text-transform:uppercase;letter-spacing:.08em;">таблица на максимуме · 896 эл.</div>
                    <div style="border:1px solid rgba(128,128,128,.4);border-radius:10px;padding:11px 13px;background:rgba(128,128,128,.04);">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:11px;opacity:.5;">Directory</span>
                        <span style="font-size:9px;color:#7c3aed;font-weight:700;">global_depth = 0 → 2⁰ = 1 слот</span>
                      </div>
                      <div style="border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:9px 10px 11px;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                          <span style="opacity:.5;font-size:10px;">Table</span>
                          <span style="color:#d97706;font-weight:700;font-size:9px;">growth_left = 0</span>
                        </div>
                        <div style="display:flex;gap:5px;align-items:flex-end;">
                          ${[1,2,3].map(n=>'<div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:5px 4px 3px;width:50px;"><div style="font-size:7px;opacity:.5;text-align:center;margin-bottom:3px;">Group</div>'+Array(7).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')+'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div></div>'+'<div style="font-size:7px;opacity:.4;text-align:center;margin-top:3px;">'+n+'</div></div>').join('')}
                          <div style="font-size:14px;opacity:.4;align-self:center;padding:0 2px;">···</div>
                          <div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:5px 4px 3px;width:50px;">
                            <div style="font-size:7px;opacity:.5;text-align:center;margin-bottom:3px;">Group</div>
                            ${Array(7).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')}
                            <div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div></div>
                            <div style="font-size:7px;color:#d97706;font-weight:700;text-align:center;margin-top:3px;">128</div>
                          </div>
                        </div>
                        <div style="font-size:9px;opacity:.5;text-align:center;margin-top:5px;">128 групп · 7/8 заполнено = <b style="color:#d97706;">896/1024 · growth_left=0</b></div>
                      </div>
                    </div>
                  </div>

                  <!-- ARROW -->
                  <div style="display:flex;flex-direction:column;align-items:center;padding-top:75px;gap:4px;">
                    <div style="font-size:10px;color:#d97706;text-align:center;line-height:1.5;">split<br>на 2<br>↓<br>depth+1</div>
                    <svg width="40" height="16" viewBox="0 0 40 16"><defs><marker id="maxaw" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#d97706"/></marker></defs><line x1="2" y1="8" x2="34" y2="8" stroke="#d97706" stroke-width="1.5" marker-end="url(#maxaw)"/></svg>
                  </div>

                  <!-- AFTER: Directory с 2 таблицами -->
                  <div style="display:flex;flex-direction:column;gap:5px;">
                    <div style="font-size:9px;opacity:.5;text-align:center;text-transform:uppercase;letter-spacing:.08em;">после сплита · данные разделены</div>
                    <div style="border:1px solid rgba(128,128,128,.4);border-radius:10px;padding:11px 13px;background:rgba(128,128,128,.04);">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:11px;opacity:.5;">Directory</span>
                        <span style="font-size:9px;color:#7c3aed;font-weight:700;">global_depth = 1 → 2¹ = 2 слота</span>
                      </div>
                      <div style="display:flex;gap:8px;">
                        ${['Table 0','Table 1'].map((tname,ti)=>`
                        <div style="border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:9px 10px 11px;">
                          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                            <span style="opacity:.5;font-size:10px;">${tname}</span>
                            <span style="color:#059669;font-size:8px;">~448 эл.</span>
                          </div>
                          <div style="display:flex;gap:5px;align-items:flex-end;">
                            ${[1,2].map(n=>'<div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:5px 4px 3px;width:50px;"><div style="font-size:7px;opacity:.5;text-align:center;margin-bottom:3px;">Group</div>'+Array(4).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')+Array(4).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div></div>').join('')+'<div style="font-size:7px;opacity:.4;text-align:center;margin-top:3px;">'+n+'</div></div>').join('')}
                            <div style="font-size:14px;opacity:.4;align-self:center;padding:0 2px;">···</div>
                            <div style="border:1px solid rgba(128,128,128,.4);border-radius:5px;padding:5px 4px 3px;width:50px;">
                              <div style="font-size:7px;opacity:.5;text-align:center;margin-bottom:3px;">Group</div>
                              ${Array(4).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="background:#7ab3d4;border-radius:2px;flex:1;opacity:.85;"></div><div style="background:#d4849a;border-radius:2px;flex:1;opacity:.85;"></div></div>').join('')}
                              ${Array(4).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div><div style="border:1px solid rgba(128,128,128,.3);border-radius:2px;flex:1;opacity:.35;"></div></div>').join('')}
                              <div style="font-size:7px;color:#d97706;font-weight:700;text-align:center;margin-top:3px;">128</div>
                            </div>
                          </div>
                          <div style="font-size:8px;color:#059669;text-align:center;margin-top:5px;">hash-бит[0] = ${ti} → сюда</div>
                        </div>`).join('')}
                      </div>
                    </div>
                  </div>

                  <!-- no-ref arrow + GC -->
                  <div style="display:flex;flex-direction:column;align-items:center;padding-top:65px;gap:3px;">
                    <div style="font-size:8px;color:#dc2626;opacity:.7;text-align:center;line-height:1.4;">ссылок<br>нет</div>
                    <svg width="36" height="14" viewBox="0 0 36 14"><defs><marker id="gc-a3" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#dc2626" opacity=".6"/></marker></defs><line x1="2" y1="7" x2="30" y2="7" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="3,2" opacity=".6" marker-end="url(#gc-a3)"/></svg>
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:5px;padding-top:2px;">
                    <div style="border:1px dashed rgba(220,38,38,.35);border-radius:8px;padding:9px 10px 10px;opacity:.45;">
                      <div style="font-size:10px;opacity:.5;margin-bottom:6px;">Table (старая)</div>
                      <div style="display:flex;gap:5px;">
                        ${[1,128].map(n=>'<div style="border:1px solid rgba(128,128,128,.2);border-radius:5px;padding:5px 4px 3px;width:50px;"><div style="font-size:7px;opacity:.4;text-align:center;margin-bottom:3px;">Group</div>'+Array(8).fill(0).map(()=>'<div style="display:flex;gap:2px;margin-bottom:2px;height:10px;"><div style="border:1px solid rgba(128,128,128,.2);border-radius:2px;flex:1;opacity:.25;"></div><div style="border:1px solid rgba(128,128,128,.2);border-radius:2px;flex:1;opacity:.25;"></div></div>').join('')+'<div style="font-size:7px;opacity:.3;text-align:center;margin-top:3px;">'+n+'</div></div>').join('')}
                      </div>
                    </div>
                    <div style="font-size:9px;color:#dc2626;opacity:.7;text-align:center;line-height:1.5;">перехешировано<br>→ очистится GC</div>
                  </div>

                </div>

                <div style="margin-top:12px;font-size:9px;opacity:.5;line-height:1.8;font-family:'JetBrains Mono',monospace;">
                  Из исходников: maxTableCapacity=1024 (слоты) · 1024/8 = <b>128 групп макс</b> · max элементов = (1024×7)/8 = <b>896</b>
                  &nbsp;·&nbsp; global_depth=0 → 1 слот &nbsp;·&nbsp; global_depth=1 → 2 слота &nbsp;·&nbsp; global_depth=N → 2ᴺ слотов
                </div>
              </div>

              <!-- extendible hashing: 2→3→4 таблицы -->
              <div style="margin-top:18px; border-top:1px solid rgba(128,128,128,.2); padding-top:16px;">
                <p class="tight" style="margin-bottom:8px"><b>Extendible hashing: как сплит через Directory работает</b></p>

                <!-- Концептуальная шапка -->
                <div style="border:1px solid rgba(124,58,237,.3);border-radius:7px;padding:8px 12px;margin-bottom:12px;background:rgba(124,58,237,.05);line-height:1.7;font-size:10px;">
                  <b style="color:#7c3aed">Directory</b> — массив <b>указателей</b> (p1, p2…), размер = 2<sup>global_depth</sup>. Указатель → физическая таблица.<br>
                  <b>Несколько указателей могут смотреть на одну таблицу</b> — когда local_depth таблицы &lt; global_depth.<br>
                  Кол-во указателей на таблицу = 2<sup>(global_depth − local_depth)</sup>&nbsp;·&nbsp;Сплит перераспределяет указатели.<br>
                  local_depth также используется при <b>клонировании мапы</b> (<code class="inline">maps.clone</code> / assign): рантайм обходит Directory и по local_depth определяет уникальные таблицы, чтобы не скопировать одну таблицу дважды через разные указатели.
                </div>

                <!-- SVG-диаграмма: единый, без плывущих блоков -->
                <div style="overflow-x:auto;">
                  <svg viewBox="0 0 1380 294" style="min-width:1550px;display:block;" xmlns="http://www.w3.org/2000/svg" font-family="'JetBrains Mono',monospace">
                    <defs>
                      <marker id="ehA" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="currentColor" opacity=".45"/></marker>
                      <marker id="ehO" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#d97706"/></marker>
                      <marker id="ehB" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#4a9fd4" opacity=".85"/></marker>
                    </defs>

                    <!-- ═══ STAGE 1 ═══ -->
                    <text x="152" y="14" text-anchor="middle" font-size="11" fill="currentColor" opacity=".38" font-weight="600" letter-spacing=".07em">① 2 ТАБЛИЦЫ</text>
                    <rect x="8" y="20" width="288" height="262" rx="8" fill="currentColor" fill-opacity=".025" stroke="currentColor" stroke-opacity=".22" stroke-width="1.2"/>
                    <text x="18" y="40" font-size="12" fill="currentColor" opacity=".42">Directory</text>
                    <text x="292" y="40" font-size="10" fill="#7c3aed" text-anchor="end" font-weight="700">gd=1 · 2 слота</text>
                    <rect x="32" y="48" width="62" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="63" y="65" text-anchor="middle" font-size="12" fill="currentColor">p1</text>
                    <rect x="200" y="48" width="62" height="26" rx="5" fill="none" stroke="#d97706" stroke-width="1.2"/>
                    <text x="231" y="65" text-anchor="middle" font-size="12" fill="#d97706">p2</text>
                    <line x1="63" y1="74" x2="63" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <line x1="231" y1="74" x2="231" y2="94" stroke="#d97706" stroke-width="1.5" opacity=".8" marker-end="url(#ehO)"/>
                    <!-- Table A: 3/8 filled -->
                    <rect x="14" y="95" width="124" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="22" y="108" font-size="12" fill="currentColor" opacity=".48">Table A</text>
                    <text x="135" y="108" font-size="10" fill="#7c3aed" text-anchor="end">ld=1</text>
                    <rect x="18" y="112" width="116" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="22" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="22" y="126" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="76" y="126" width="50" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="22" y="140" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="76" y="140" width="50" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="18" y="168" width="116" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="22" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="22" y="182" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="76" y="182" width="50" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="22" y="196" width="50" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="76" y="196" width="50" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <!-- Table B: 8/8 full -->
                    <rect x="152" y="95" width="124" height="155" rx="7" fill="none" stroke="#d97706" stroke-width="1.2"/>
                    <text x="160" y="108" font-size="12" fill="currentColor" opacity=".48">Table B</text>
                    <text x="273" y="108" font-size="10" fill="#7c3aed" text-anchor="end">ld=1</text>
                    <rect x="156" y="112" width="116" height="53" rx="3" fill="none" stroke="#d97706" stroke-opacity=".4" stroke-width=".8"/>
                    <text x="160" y="122" font-size="8" fill="#d97706" opacity=".6">Group</text>
                    <rect x="160" y="126" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="214" y="126" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="160" y="140" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="214" y="140" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="156" y="168" width="116" height="53" rx="3" fill="none" stroke="#d97706" stroke-opacity=".4" stroke-width=".8"/>
                    <text x="160" y="178" font-size="8" fill="#d97706" opacity=".6">Group</text>
                    <rect x="160" y="182" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="214" y="182" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="160" y="196" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="214" y="196" width="50" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <text x="214" y="264" font-size="10" fill="#d97706" text-anchor="middle">growth_left=0</text>

                    <!-- ═══ ARROW 1 ═══ -->
                    <text x="357" y="105" font-size="11" fill="#d97706" text-anchor="middle">local==global</text>
                    <text x="357" y="120" font-size="11" fill="#d97706" text-anchor="middle">→ удваиваем</text>
                    <text x="357" y="135" font-size="11" fill="#d97706" text-anchor="middle">директорию</text>
                    <line x1="304" y1="151" x2="408" y2="151" stroke="#d97706" stroke-width="2" marker-end="url(#ehO)"/>
                    <text x="357" y="167" font-size="10" fill="currentColor" opacity=".42" text-anchor="middle">B сплитится</text>
                    <text x="357" y="181" font-size="10" fill="currentColor" opacity=".42" text-anchor="middle">A берёт p1+p2</text>

                    <!-- ═══ STAGE 2 ═══ -->
                    <text x="620" y="14" text-anchor="middle" font-size="11" fill="currentColor" opacity=".38" font-weight="600" letter-spacing=".07em">② 3 ТАБЛИЦЫ (НЕ 4!)</text>
                    <rect x="424" y="20" width="392" height="262" rx="8" fill="currentColor" fill-opacity=".025" stroke="currentColor" stroke-opacity=".22" stroke-width="1.2"/>
                    <text x="434" y="40" font-size="12" fill="currentColor" opacity=".42">Directory</text>
                    <text x="812" y="40" font-size="10" fill="#7c3aed" text-anchor="end" font-weight="700">gd=2 · 4 слота</text>
                    <rect x="436" y="48" width="52" height="26" rx="5" fill="none" stroke="#4a9fd4" stroke-width="1.2"/>
                    <text x="462" y="65" text-anchor="middle" font-size="12" fill="#4a9fd4">p1</text>
                    <rect x="498" y="48" width="52" height="26" rx="5" fill="none" stroke="#4a9fd4" stroke-width="1.2"/>
                    <text x="524" y="65" text-anchor="middle" font-size="12" fill="#4a9fd4">p2</text>
                    <rect x="610" y="48" width="52" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="636" y="65" text-anchor="middle" font-size="12" fill="currentColor">p3</text>
                    <rect x="680" y="48" width="52" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="706" y="65" text-anchor="middle" font-size="12" fill="currentColor">p4</text>
                    <line x1="462" y1="74" x2="462" y2="94" stroke="#4a9fd4" stroke-width="1.5" opacity=".78" marker-end="url(#ehB)"/>
                    <line x1="524" y1="74" x2="524" y2="94" stroke="#4a9fd4" stroke-width="1.5" opacity=".78" marker-end="url(#ehB)"/>
                    <line x1="636" y1="74" x2="636" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <line x1="706" y1="74" x2="706" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <!-- Table A: 6/8 filled (почти полная, сейчас сплитится) -->
                    <rect x="430" y="95" width="152" height="155" rx="7" fill="none" stroke="#4a9fd4" stroke-width="1.5"/>
                    <text x="438" y="108" font-size="12" fill="currentColor" opacity=".48">Table A</text>
                    <text x="579" y="108" font-size="10" fill="#7c3aed" text-anchor="end">ld=1</text>
                    <rect x="434" y="112" width="144" height="53" rx="3" fill="none" stroke="#4a9fd4" stroke-opacity=".3" stroke-width=".8"/>
                    <text x="438" y="122" font-size="8" fill="#4a9fd4" opacity=".6">Group</text>
                    <rect x="438" y="126" width="64" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="508" y="126" width="62" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="438" y="140" width="64" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="508" y="140" width="62" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="434" y="168" width="144" height="53" rx="3" fill="none" stroke="#4a9fd4" stroke-opacity=".3" stroke-width=".8"/>
                    <text x="438" y="178" font-size="8" fill="#4a9fd4" opacity=".6">Group</text>
                    <rect x="438" y="182" width="64" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="508" y="182" width="62" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="438" y="196" width="64" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="508" y="196" width="62" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="506" y="264" font-size="9.5" fill="currentColor" opacity=".35" text-anchor="middle">ld&lt;gd · 2 указателя</text>
                    <!-- B1: 4/8 (половина от B's 8) -->
                    <rect x="588" y="95" width="106" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="596" y="108" font-size="12" fill="currentColor" opacity=".48">B1</text>
                    <text x="691" y="108" font-size="10" fill="#059669" text-anchor="end">ld=2</text>
                    <rect x="592" y="112" width="98" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="596" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="596" y="126" width="43" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="643" y="126" width="41" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="596" y="140" width="43" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="643" y="140" width="41" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="592" y="168" width="98" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="596" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="596" y="182" width="43" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="643" y="182" width="41" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="596" y="196" width="43" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="643" y="196" width="41" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <!-- B2: 4/8 (половина от B's 8) -->
                    <rect x="700" y="95" width="106" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="708" y="108" font-size="12" fill="currentColor" opacity=".48">B2</text>
                    <text x="803" y="108" font-size="10" fill="#059669" text-anchor="end">ld=2</text>
                    <rect x="704" y="112" width="98" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="708" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="708" y="126" width="43" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="755" y="126" width="41" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="708" y="140" width="43" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="755" y="140" width="41" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="704" y="168" width="98" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="708" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="708" y="182" width="43" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="755" y="182" width="41" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="708" y="196" width="43" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="755" y="196" width="41" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>

                    <!-- ═══ ARROW 2 ═══ -->
                    <text x="869" y="108" font-size="11" fill="#d97706" text-anchor="middle">Table A</text>
                    <text x="869" y="123" font-size="11" fill="#d97706" text-anchor="middle">заполнилась</text>
                    <line x1="824" y1="138" x2="912" y2="138" stroke="#d97706" stroke-width="2" marker-end="url(#ehO)"/>
                    <text x="869" y="155" font-size="10.5" fill="#059669" text-anchor="middle" font-weight="600">ld(1) &lt; gd(2)</text>
                    <text x="869" y="170" font-size="10.5" fill="#059669" text-anchor="middle" font-weight="600">→ НЕ удваиваем!</text>
                    <text x="869" y="185" font-size="9" fill="currentColor" opacity=".4" text-anchor="middle">делим указатели</text>

                    <!-- ═══ STAGE 3 ═══ -->
                    <text x="1148" y="14" text-anchor="middle" font-size="11" fill="currentColor" opacity=".38" font-weight="600" letter-spacing=".07em">③ 4 ТАБЛИЦЫ</text>
                    <rect x="924" y="20" width="448" height="262" rx="8" fill="currentColor" fill-opacity=".025" stroke="currentColor" stroke-opacity=".22" stroke-width="1.2"/>
                    <text x="934" y="40" font-size="12" fill="currentColor" opacity=".42">Directory</text>
                    <text x="1368" y="40" font-size="10" fill="#7c3aed" text-anchor="end" font-weight="700">gd=2 · 4 слота (не изменился)</text>
                    <rect x="938" y="48" width="62" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="969" y="65" text-anchor="middle" font-size="12" fill="currentColor">p1</text>
                    <rect x="1044" y="48" width="62" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="1075" y="65" text-anchor="middle" font-size="12" fill="currentColor">p2</text>
                    <rect x="1150" y="48" width="62" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="1181" y="65" text-anchor="middle" font-size="12" fill="currentColor">p3</text>
                    <rect x="1256" y="48" width="62" height="26" rx="5" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-width="1.2"/>
                    <text x="1287" y="65" text-anchor="middle" font-size="12" fill="currentColor">p4</text>
                    <line x1="969" y1="74" x2="969" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <line x1="1075" y1="74" x2="1075" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <line x1="1181" y1="74" x2="1181" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <line x1="1287" y1="74" x2="1287" y2="94" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5" marker-end="url(#ehA)"/>
                    <!-- A1: 3/8 (половина от A's 6) -->
                    <rect x="930" y="95" width="102" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="938" y="108" font-size="12" fill="currentColor" opacity=".48">A1</text>
                    <text x="1029" y="108" font-size="10" fill="#059669" text-anchor="end">ld=2</text>
                    <rect x="934" y="112" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="938" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="938" y="126" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="982" y="126" width="40" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="938" y="140" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="982" y="140" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="934" y="168" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="938" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="938" y="182" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="982" y="182" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="938" y="196" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="982" y="196" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <!-- A2: 3/8 (половина от A's 6) -->
                    <rect x="1038" y="95" width="102" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="1046" y="108" font-size="12" fill="currentColor" opacity=".48">A2</text>
                    <text x="1137" y="108" font-size="10" fill="#059669" text-anchor="end">ld=2</text>
                    <rect x="1042" y="112" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="1046" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="1046" y="126" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1090" y="126" width="40" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1046" y="140" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1090" y="140" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1042" y="168" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="1046" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="1046" y="182" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1090" y="182" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1046" y="196" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1090" y="196" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <!-- B1: 4/8 (без изменений из Stage 2) -->
                    <rect x="1144" y="95" width="102" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="1152" y="108" font-size="12" fill="currentColor" opacity=".48">B1</text>
                    <text x="1243" y="108" font-size="10" fill="#059669" text-anchor="end">ld=2</text>
                    <rect x="1148" y="112" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="1152" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="1152" y="126" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1196" y="126" width="40" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1152" y="140" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1196" y="140" width="40" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1148" y="168" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="1152" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="1152" y="182" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1196" y="182" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1152" y="196" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1196" y="196" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <!-- B2: 4/8 (без изменений из Stage 2) -->
                    <rect x="1252" y="95" width="102" height="155" rx="7" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2"/>
                    <text x="1260" y="108" font-size="12" fill="currentColor" opacity=".48">B2</text>
                    <text x="1351" y="108" font-size="10" fill="#059669" text-anchor="end">ld=2</text>
                    <rect x="1256" y="112" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="1260" y="122" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="1260" y="126" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1304" y="126" width="40" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1260" y="140" width="38" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1304" y="140" width="40" height="11" rx="2" fill="#7ab3d4" fill-opacity=".62"/>
                    <rect x="1256" y="168" width="94" height="53" rx="3" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <text x="1260" y="178" font-size="8" fill="currentColor" opacity=".35">Group</text>
                    <rect x="1260" y="182" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1304" y="182" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1260" y="196" width="38" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                    <rect x="1304" y="196" width="40" height="11" rx="2" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".18" stroke-width=".8"/>
                  </svg>
                </div>

                <!-- Правило снизу -->
                <div style="margin-top:10px;font-size:9px;opacity:.5;line-height:1.9;font-family:'JetBrains Mono',monospace;">
                  <b>Правило сплита:</b>&nbsp;
                  local_depth == global_depth → удваиваем Directory, сплитим таблицу (несплитившиеся получают 2× указателей)&nbsp;·&nbsp;
                  local_depth &lt; global_depth → <b>Directory не трогаем</b>, перераспределяем указатели&nbsp;·&nbsp;
                  указателей на таблицу = 2<sup>(gd−ld)</sup>
                </div>
              </div>

              <!-- theme-aware styles for hash routing + probing sections -->
              <style>
                .impl-sec{margin:16px 0;border:1px solid var(--border,#e0e0e0);border-radius:10px;overflow:hidden;}
                .impl-sec-hdr{padding:8px 14px;border-bottom:1px solid var(--border,#e0e0e0);font-size:11px;font-weight:700;color:var(--text,#1d1d1d);background:var(--bg,#f5f5f5);}
                .impl-sec-body{padding:14px;}
                .mhs-wrap{font-family:'JetBrains Mono',monospace;font-size:11px;min-width:700px;}
                .mhs-hdr{color:var(--text,#1d1d1d);font-size:11px;margin-bottom:10px;}
                .mhs-hdr-val{color:var(--text-dim,#666);}
                .mhs-section{background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:7px;padding:10px 14px;margin-bottom:8px;}
                .mhs-lbl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#888);opacity:.7;margin-bottom:8px;}
                .mhs-code{background:var(--surface,#fff);border:1px solid var(--border,#e0e0e0);border-radius:4px;padding:5px 10px;display:inline-block;font-size:11px;margin-bottom:6px;}
                .mhs-note{font-size:10px;color:var(--text-dim,#666);line-height:1.7;}
                .mhs-note-border{font-size:9.5px;color:var(--text-dim,#666);border-left:2px solid var(--border,#ddd);padding-left:8px;line-height:1.7;margin-top:8px;}
                .mhs-code-comment{color:var(--text-dim,#888);}
                .mhs-and-box{font-size:10px;line-height:1.9;background:var(--surface,#f5f5f5);border:1px solid var(--border,#e8e8e8);border-radius:5px;padding:8px 10px;}
                .mhs-and-sep{border-top:1px solid var(--border,#ddd);margin:2px 0 2px 52px;}
                .mhs-bit-faded{color:var(--text-dim,#bbb);}
                .mhs-bit-faded2{color:var(--border,#ddd);}
                .mhs-summary{margin-top:10px;padding:8px 12px;background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:5px;font-size:10px;color:var(--text-dim,#666);line-height:2;}
                .mhs-toggle-lbl{font-size:10px;color:var(--text-dim,#666);}
                .mhs-btn{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:4px;color:var(--text-dim,#888);font-family:monospace;font-size:11px;padding:4px 12px;cursor:pointer;}
                .mhs-btn-active{background:rgba(52,211,153,.1);border-color:#34d399;color:#34d399;}
                /* probing */
                .prob-outer{margin-top:18px;padding:14px;background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:10px;}
                .prob-title{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim,#888);margin-bottom:12px;}
                .prob-formula{display:flex;align-items:center;gap:14px;background:var(--surface,#fff);border:1px solid var(--border,#e0e0e0);border-radius:7px;padding:12px 16px;margin-bottom:14px;}
                .prob-formula-lbl{font-size:9px;color:var(--text-dim,#888);white-space:nowrap;}
                .prob-mod{color:var(--text-dim,#888);}
                .prob-formula-desc{margin-left:auto;font-size:9px;color:var(--text-dim,#888);line-height:1.7;text-align:right;}
                .prob-card{flex:1;background:var(--surface,#fff);border:1px solid var(--border,#e0e0e0);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;}
                .prob-card-go{background:rgba(52,211,153,.06);border-color:#34d399;}
                .prob-num{font-size:8px;color:var(--text-dim,#aaa);letter-spacing:.1em;text-transform:uppercase;}
                .prob-name{font-size:12px;font-weight:700;color:var(--text,#1d1d1d);}
                .prob-eq{background:var(--bg,#f5f5f5);border-radius:5px;padding:7px 10px;font-size:12px;text-align:center;}
                .prob-seq-lbl{font-size:8px;color:var(--text-dim,#888);}
                .prob-step-val{color:var(--text-dim,#888);}
                .prob-step-num{font-weight:700;font-size:9px;color:var(--text,#1d1d1d);}
                .prob-slot{width:22px;height:22px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:1px solid var(--border,#e0e0e0);background:var(--bg,#f5f5f5);color:var(--text-dim,#bbb);}
                .prob-slot-lin{border-color:#4a9fd4!important;background:rgba(74,159,212,.12)!important;color:#4a9fd4!important;}
                .prob-slot-quad{border-color:#a78bfa!important;background:rgba(167,139,250,.12)!important;color:#a78bfa!important;}
                .prob-slot-tri{border-color:#34d399!important;background:rgba(52,211,153,.12)!important;color:#34d399!important;}
                .prob-slot-occ{background:var(--bg,#f0f0f0)!important;color:var(--text-dim,#bbb)!important;}
              </style>

              <div class="impl-sec">
                <div class="impl-sec-hdr">Как хэш маршрутизируется: Table → Group → control byte</div>
                <div class="impl-sec-body">
                <div style="overflow-x:auto;">
                  <div class="mhs-wrap">

                    <!-- hash header -->
                    <div class="mhs-hdr">
                      <span style="color:var(--text);">hash("hello")</span> = <span style="color:#d97706;">14333275774295595135</span> &nbsp;(64 bit)
                    </div>

                    <!-- bit strip -->
                    <div style="display:flex;gap:1px;margin-bottom:4px;flex-wrap:nowrap;overflow-x:auto;" id="mapHashStrip">${[1,1,0,0,0,0,1,1,0,1,1,1,1,0,1,0,1,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,1,0,1,0,0,1,1,0,0,1,1,1,0,1,1,1,1,1,1,1,1,1].map((b,i)=>'<div style="width:9px;height:18px;border-radius:2px;flex-shrink:0;line-height:18px;text-align:center;font-size:6px;font-weight:700;color:rgba(0,0,0,.7);background:'+(i<2?'#d97706':i<57?'#4a9fd4':'#a78bfa')+'">'+b+'</div>').join('')}</div>
                    <div style="display:flex;gap:14px;font-size:9px;margin-bottom:10px;">
                      <span style="color:#d97706">█ table index</span>
                      <span style="color:#4a9fd4">█ h1 → group</span>
                      <span style="color:#a78bfa">█ h2 → control byte</span>
                    </div>

                    <!-- toggle -->
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:18px;">
                      <span class="mhs-toggle-lbl">global_depth =</span>
                      <button id="mapGdBtn1" class="mhs-btn" onclick="(function(){var s=document.getElementById('mapHashStrip');if(s)Array.from(s.children).forEach(function(d,i){d.style.background=i<1?'#d97706':i<57?'#4a9fd4':'#a78bfa';});var b1=document.getElementById('mapGdBtn1'),b2=document.getElementById('mapGdBtn2');if(b1){b1.className='mhs-btn';}if(b2){b2.className='mhs-btn mhs-btn-active';}})()">1 &nbsp;(2 таблицы)</button>
                      <button id="mapGdBtn2" class="mhs-btn mhs-btn-active" onclick="(function(){var s=document.getElementById('mapHashStrip');if(s)Array.from(s.children).forEach(function(d,i){d.style.background=i<2?'#d97706':i<57?'#4a9fd4':'#a78bfa';});var b1=document.getElementById('mapGdBtn1'),b2=document.getElementById('mapGdBtn2');if(b1){b1.className='mhs-btn mhs-btn-active';}if(b2){b2.className='mhs-btn';}})()">2 &nbsp;(4 таблицы)</button>
                    </div>

                    <!-- Section 1 -->
                    <div class="mhs-section">
                      <div class="mhs-lbl">① Table index</div>
                      <div class="mhs-code" style="margin-bottom:6px;">
                        tableIdx = hash <span style="color:#34d399">&gt;&gt;</span> (64 − <span style="color:#d97706">globalDepth</span>)
                        <span class="mhs-code-comment" style="margin-left:8px;">// топ-N бит → номер таблицы</span>
                      </div>
                      <div class="mhs-note">
                        gd=1 → 2 таблицы, нужен 1 бит &nbsp;·&nbsp; gd=2 → 4 таблицы, нужно 2 бита<br>
                        <span style="color:#34d399">&gt;&gt;</span> — 1 инструкция CPU, цикл по 64 битам = 64 шага
                      </div>
                    </div>

                    <!-- Section 2: AND table -->
                    <div class="mhs-section">
                      <div class="mhs-lbl">② Group index — h1 + маска</div>
                      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                        <div class="mhs-code">h1 = hash <span style="color:#34d399">&gt;&gt;</span> 7</div>
                        <div class="mhs-code">
                          groupIdx = h1 <span style="color:#34d399">&amp;</span> (numGroups − 1)
                          <span class="mhs-code-comment" style="margin-left:6px;">// 1024−1 = 0x3FF</span>
                        </div>
                      </div>
                      <div class="mhs-and-box">
                        <div><span style="color:#4a9fd4;display:inline-block;width:52px;">h1&nbsp;:</span><span class="mhs-bit-faded">0 0 0 0 0 0 0 &nbsp;1 1 0 0 0 …</span>&nbsp;<span style="color:#4a9fd4">1 1 0 0 1 1 1 0 1 1</span></div>
                        <div><span class="mhs-bit-faded" style="display:inline-block;width:52px;">&amp;&nbsp;mask:</span><span class="mhs-bit-faded2">0 0 0 0 0 0 0 &nbsp;0 0 0 0 0 …</span>&nbsp;<span style="color:#34d399">1 1 1 1 1 1 1 1 1 1</span></div>
                        <div class="mhs-and-sep"></div>
                        <div><span style="color:#34d399;display:inline-block;width:52px;">idx&nbsp;:</span><span class="mhs-bit-faded2">0 0 0 0 0 0 0 &nbsp;0 0 0 0 0 …</span>&nbsp;<span style="background:rgba(52,211,153,.12);color:#34d399;padding:1px 4px;border-radius:3px;">1 1 0 0 1 1 1 0 1 1</span>&nbsp;<span style="color:#34d399">= group #827</span></div>
                      </div>
                      <div class="mhs-note-border">
                        Почему не ещё <span style="color:#34d399">&gt;&gt;</span>: уже убрали h2, ещё раз — потеряем средние биты.<br>
                        Почему не <span style="color:#34d399">&lt;&lt;</span>: вытолкнет старшие биты, средние не вытащить.<br>
                        Маска <span style="color:#34d399">0x3FF</span> = 11&nbsp;1111&nbsp;1111 — берёт нижние 10 бит h1 за 1 такт.
                      </div>
                    </div>

                    <!-- Section 3: h2 -->
                    <div class="mhs-section" style="margin-bottom:0;">
                      <div class="mhs-lbl">③ h2 — 7-битный fingerprint</div>
                      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
                        <div class="mhs-code" style="flex-shrink:0;">
                          h2 = hash <span style="color:#34d399">&amp;</span> 0x7F &nbsp;<span class="mhs-code-comment">// нижние 7 бит</span>
                        </div>
                        <div class="mhs-note">
                          Хранится в control bytes каждого слота группы.<br>
                          При поиске: сравниваем <span style="color:#a78bfa">h2</span> со всеми 8 control bytes сразу (SIMD).<br>
                          Полное сравнение ключа — только если h2 совпал.
                        </div>
                      </div>
                      <div style="margin-top:10px;display:inline-flex;align-items:center;gap:7px;background:rgba(167,139,250,.07);border:1px dashed rgba(167,139,250,.3);border-radius:5px;padding:5px 12px;font-size:10px;color:#a78bfa;">
                        <span>↓</span>
                        как устроена Group изнутри, control bytes и SIMD-поиск — <b>разберём подробнее ниже</b>
                      </div>
                    </div>

                    <!-- summary -->
                    <div class="mhs-summary">
                      <span style="color:#d97706">hash &gt;&gt; (64−gd)</span> → tableIdx &nbsp;·&nbsp;
                      <span style="color:#4a9fd4">(hash &gt;&gt; 7) &amp; 0x3FF</span> → groupIdx &nbsp;·&nbsp;
                      <span style="color:#a78bfa">hash &amp; 0x7F</span> → h2
                    </div>
                  </div>
                </div>
              <div class="prob-outer" style="margin-top:14px;margin-bottom:0;border-radius:8px;">
                <div class="prob-title">пробирование при коллизии</div>

                <!-- Base formula -->
                <div class="prob-formula">
                  <div class="prob-formula-lbl">общая<br>формула</div>
                  <div style="font-size:14px;letter-spacing:.02em;">
                    <span style="color:#4a9fd4">slot</span>
                    &nbsp;=&nbsp;
                    (<span style="color:#f0c352">h</span> + <span style="color:#34d399">f(i)</span>)
                    &nbsp;<span class="prob-mod">mod</span>&nbsp;
                    <span style="color:#a78bfa">N</span>
                  </div>
                  <div class="prob-formula-desc">
                    <span style="display:block"><span style="color:#f0c352">h</span> — начальный слот (hash mod N)</span>
                    <span style="display:block"><span style="color:#34d399">f(i)</span> — функция шага, i = 0, 1, 2 …</span>
                    <span style="display:block"><span style="color:#a78bfa">N</span> — размер таблицы</span>
                  </div>
                </div>

                <!-- 3 cards -->
                <div style="display:flex;gap:10px;">

                  <!-- Linear -->
                  <div class="prob-card">
                    <div class="prob-num">① вариант</div>
                    <div class="prob-name">Линейное</div>
                    <div class="prob-eq"><span style="color:#34d399">f(i)</span> = <span style="color:#fb923c">i</span></div>
                    <div class="prob-seq-lbl">N=16, h=5, занято 5,6,7</div>
                    <div style="display:flex;gap:3px;flex-wrap:wrap;">${Array.from({length:16},(_,i)=>{
                      const hit=[8].includes(i), occ=[5,6,7].includes(i);
                      return '<div class="prob-slot'+(hit?' prob-slot-lin':occ?' prob-slot-occ':'')+'">'+( occ?'×':i)+'</div>';
                    }).join('')}</div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=0</span><span class="prob-step-val">5+0 =</span><span class="prob-step-num">5</span><span style="color:#d97706">✗</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=1</span><span class="prob-step-val">5+1 =</span><span class="prob-step-num">6</span><span style="color:#d97706">✗</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=2</span><span class="prob-step-val">5+2 =</span><span class="prob-step-num">7</span><span style="color:#d97706">✗</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=3</span><span class="prob-step-val">5+3 =</span><span class="prob-step-num">8</span><span style="color:#4a9fd4">✓</span></div>
                    </div>
                    <div style="font-size:8px;color:#d97706;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.2);border-radius:4px;padding:5px 7px;line-height:1.5;">⚠ первичная кластеризация — занятые слоты слипаются в длинные цепочки</div>
                  </div>

                  <!-- Quadratic -->
                  <div class="prob-card">
                    <div class="prob-num">② вариант</div>
                    <div class="prob-name">Квадратичное</div>
                    <div class="prob-eq"><span style="color:#34d399">f(i)</span> = <span style="color:#fb923c">i</span><sup style="font-size:8px;color:#a78bfa">2</sup></div>
                    <div class="prob-seq-lbl">N=16, h=5, занято 5,6</div>
                    <div style="display:flex;gap:3px;flex-wrap:wrap;">${Array.from({length:16},(_,i)=>{
                      const hit=[9,14].includes(i), occ=[5,6].includes(i);
                      return '<div class="prob-slot'+(hit?' prob-slot-quad':occ?' prob-slot-occ':'')+'">'+( occ?'×':i)+'</div>';
                    }).join('')}</div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=0</span><span class="prob-step-val">5+0 =</span><span class="prob-step-num">5</span><span style="color:#d97706">✗</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=1</span><span class="prob-step-val">5+1 =</span><span class="prob-step-num">6</span><span style="color:#d97706">✗</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=2</span><span class="prob-step-val">5+4 =</span><span class="prob-step-num">9</span><span style="color:#a78bfa">✓</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=3</span><span class="prob-step-val">5+9 =</span><span class="prob-step-num">14</span><span style="color:#a78bfa">✓</span></div>
                    </div>
                    <div style="font-size:8px;color:#a78bfa;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);border-radius:4px;padding:5px 7px;line-height:1.5;">лучше линейного, но не гарантирует обход всех слотов — можно застрять в цикле</div>
                  </div>

                  <!-- Triangular — Go -->
                  <div class="prob-card prob-card-go" style="position:relative;">
                    <div style="position:absolute;top:9px;right:9px;background:#34d399;color:#0a1a12;font-size:8px;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:100px;">Go ✓</div>
                    <div class="prob-num">③ вариант</div>
                    <div class="prob-name" style="color:#34d399;">Треугольное</div>
                    <div class="prob-eq" style="background:rgba(52,211,153,.06);"><span style="color:#34d399">f(i)</span> = <span style="color:#34d399">i·(i+1)</span> / <span style="color:#a78bfa">2</span></div>
                    <div class="prob-seq-lbl">треугольные числа:</div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">${[0,1,3,6,10,15].map(n=>'<span style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);border-radius:3px;padding:2px 5px;color:#34d399;font-size:8px;">'+n+'</span>').join('')}<span class="prob-seq-lbl" style="align-self:center;margin-left:2px;">…</span></div>
                    <div class="prob-seq-lbl">N=16, h=5</div>
                    <div style="display:flex;gap:3px;flex-wrap:wrap;">${Array.from({length:16},(_,i)=>{
                      const hit=[5,6,8,11].includes(i);
                      return '<div class="prob-slot'+(hit?' prob-slot-tri':'')+'">'+i+'</div>';
                    }).join('')}</div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=0</span><span class="prob-step-val">5+0 =</span><span class="prob-step-num">5</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=1</span><span class="prob-step-val">5+1 =</span><span class="prob-step-num">6</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=2</span><span class="prob-step-val">5+3 =</span><span class="prob-step-num">8</span></div>
                      <div style="display:flex;align-items:baseline;gap:5px;font-size:8px;"><span style="color:#fb923c;min-width:18px;">i=3</span><span class="prob-step-val">5+6 =</span><span class="prob-step-num">11</span></div>
                    </div>
                    <div style="font-size:8px;color:#34d399;background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.2);border-radius:4px;padding:5px 7px;line-height:1.5;">✓ при N = 2ⁿ гарантирует обход <b>всех</b> N слотов — математически доказано</div>
                  </div>

                </div>

                <!-- GROUPS ANIMATION -->
                <style>
                  .pgv-wrap{margin-top:16px;padding:14px;background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:8px;}
                  .pgv-title{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#888);margin-bottom:12px;}
                  .pgv-row{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;}
                  .pgv-group{flex:0 0 auto;width:64px;border:2px solid var(--border,#e0e0e0);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:4px;position:relative;transition:border-color .2s,box-shadow .2s;}
                  .pgv-glbl{font-size:7.5px;font-weight:700;color:var(--text-dim,#888);text-align:center;letter-spacing:.04em;}
                  .pgv-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;}
                  .pgv-slot{height:8px;border-radius:1px;}
                  .pgv-slot-on{background:#4a9fd4;opacity:.7;}
                  .pgv-slot-off{background:var(--border,#e0e0e0);}
                  .pgv-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:7.5px;font-weight:700;white-space:nowrap;opacity:0;transition:opacity .3s;}
                  .pgv-step-lbl{font-size:7.5px;text-align:center;color:var(--text-dim,#aaa);margin-top:2px;}
                  /* probe animations — 8s loop, 4 steps of 2s each */
                  /* step 1: G0 active 0-25% */
                  @keyframes pgv-a0{0%{border-color:#4a9fd4;box-shadow:0 0 0 3px rgba(74,159,212,.18);}24%{border-color:#4a9fd4;box-shadow:0 0 0 3px rgba(74,159,212,.18);}25%,100%{border-color:var(--border,#e0e0e0);box-shadow:none;}}
                  @keyframes pgv-b0{0%{opacity:1;}24%{opacity:1;}25%,100%{opacity:0;}}
                  /* step 2: G1 active 25-50% */
                  @keyframes pgv-a1{0%,25%{border-color:var(--border,#e0e0e0);box-shadow:none;}25.5%{border-color:#4a9fd4;box-shadow:0 0 0 3px rgba(74,159,212,.18);}49%{border-color:#4a9fd4;box-shadow:0 0 0 3px rgba(74,159,212,.18);}50%,100%{border-color:var(--border,#e0e0e0);box-shadow:none;}}
                  @keyframes pgv-b1{0%,25%{opacity:0;}25.5%{opacity:1;}49%{opacity:1;}50%,100%{opacity:0;}}
                  /* step 3: G3 active 50-75% */
                  @keyframes pgv-a3{0%,50%{border-color:var(--border,#e0e0e0);box-shadow:none;}50.5%{border-color:#4a9fd4;box-shadow:0 0 0 3px rgba(74,159,212,.18);}74%{border-color:#4a9fd4;box-shadow:0 0 0 3px rgba(74,159,212,.18);}75%,100%{border-color:var(--border,#e0e0e0);box-shadow:none;}}
                  @keyframes pgv-b3{0%,50%{opacity:0;}50.5%{opacity:1;}74%{opacity:1;}75%,100%{opacity:0;}}
                  /* step 4: G6 active 75-100% — green (found!) */
                  @keyframes pgv-a6{0%,75%{border-color:var(--border,#e0e0e0);box-shadow:none;}75.5%,100%{border-color:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.2);}}
                  @keyframes pgv-b6{0%,75%{opacity:0;}75.5%,100%{opacity:1;}}
                  /* slot fill animation for G6 at step 4 */
                  @keyframes pgv-insert{0%,75%{background:#4a9fd4;opacity:.7;}76%{background:#34d399;opacity:1;}100%{background:#34d399;opacity:1;}}
                  #pgv-g0{animation:pgv-a0 8s infinite;}#pgv-b0{animation:pgv-b0 8s infinite;color:#4a9fd4;}
                  #pgv-g1{animation:pgv-a1 8s infinite;}#pgv-b1{animation:pgv-b1 8s infinite;color:#4a9fd4;}
                  #pgv-g3{animation:pgv-a3 8s infinite;}#pgv-b3{animation:pgv-b3 8s infinite;color:#4a9fd4;}
                  #pgv-g6{animation:pgv-a6 8s infinite;}#pgv-b6{animation:pgv-b6 8s infinite;color:#34d399;}
                  #pgv-ins{animation:pgv-insert 8s infinite;}
                  /* probe arrow row */
                  .pgv-arrow-row{display:flex;align-items:center;gap:0;margin-top:10px;font-size:8.5px;font-family:'JetBrains Mono',monospace;flex-wrap:wrap;gap:4px;}
                  .pgv-ar-step{display:flex;align-items:center;gap:4px;}
                  .pgv-ar-g{padding:2px 7px;border-radius:4px;font-weight:700;font-size:9px;}
                  .pgv-ar-arrow{color:var(--text-dim,#aaa);}
                  /* load factor note */
                  .pgv-note{margin-top:12px;font-size:9px;line-height:1.7;color:var(--text-dim,#666);border-left:2px solid #34d399;padding-left:10px;}
                </style>

                <div class="pgv-wrap">
                  <div class="pgv-title">пробирование по группам (треугольное, 8 групп)</div>
                  <div class="pgv-row">${(()=>{
                    // slots per group: 1=occupied, 0=free
                    const gs=[
                      [1,1,1,1,1,1,1,1], // G0 full  → skip ①
                      [1,1,1,1,1,1,1,1], // G1 full  → skip ②
                      [1,1,1,1,1,1,0,0], // G2 6/8
                      [1,1,1,1,1,1,1,1], // G3 full  → skip ③
                      [1,1,1,1,1,1,0,0], // G4 6/8
                      [1,1,1,1,1,1,1,0], // G5 7/8
                      [1,1,1,1,1,0,0,0], // G6 5/8 → INSERT ④
                      [1,1,1,1,1,1,1,0], // G7 7/8
                    ];
                    const probeSteps=[0,1,3,6]; // triangular mod 8
                    return gs.map((slots,gi)=>{
                      const stepIdx=probeSteps.indexOf(gi);
                      const isProbed=stepIdx!==-1;
                      const isFound=gi===6;
                      const stepNum=stepIdx+1;
                      const slotsHtml=slots.map((s,si)=>{
                        const isInsertSlot=isFound&&s===0&&si===5; // first free slot in G6
                        return '<div class="pgv-slot '+(isInsertSlot?'" id="pgv-ins"':s?'pgv-slot-on"':'pgv-slot-off"')+'></div>';
                      }).join('');
                      const badgeId=isProbed?'id="pgv-b'+gi+'"':'';
                      const groupId=isProbed?'id="pgv-g'+gi+'"':'';
                      const badgeTxt=isFound?'✓ вставка!':'✗ занято';
                      const stepLabel=isProbed?'<div class="pgv-step-lbl">i='+(stepIdx)+'→G'+gi+'</div>':'<div class="pgv-step-lbl" style="opacity:0">–</div>';
                      return '<div class="pgv-group" '+groupId+'>'
                        +'<div class="pgv-badge" '+badgeId+'>'+badgeTxt+'</div>'
                        +'<div class="pgv-glbl">G'+gi+'</div>'
                        +'<div class="pgv-slots">'+slotsHtml+'</div>'
                        +stepLabel
                        +'</div>';
                    }).join('');
                  })()}</div>

                  <!-- probe sequence -->
                  <div class="pgv-arrow-row">
                    <div class="pgv-ar-step"><span class="pgv-ar-g" style="background:rgba(74,159,212,.12);color:#4a9fd4;">G0</span><span class="pgv-ar-arrow">→ все заняты →</span></div>
                    <div class="pgv-ar-step"><span class="pgv-ar-g" style="background:rgba(74,159,212,.12);color:#4a9fd4;">G1</span><span class="pgv-ar-arrow">→ все заняты →</span></div>
                    <div class="pgv-ar-step"><span class="pgv-ar-g" style="background:rgba(74,159,212,.12);color:#4a9fd4;">G3</span><span class="pgv-ar-arrow">→ все заняты →</span></div>
                    <div class="pgv-ar-step"><span class="pgv-ar-g" style="background:rgba(52,211,153,.12);color:#34d399;border:1px solid rgba(52,211,153,.3);">G6</span><span style="color:#34d399;font-weight:700;font-size:9px;">✓ есть место — вставляем!</span></div>
                  </div>

                  <div class="pgv-note">
                    Треугольное пробирование при N=2ⁿ группах гарантирует обход <b>всех</b> N групп — поэтому поиск свободного места всегда завершится.<br>
                    Но чем больше групп заполнено → тем длиннее цепочка до первой свободной.<br>
                    Поэтому Go <b>растит таблицу при заполнении 7/8</b> — так в среднем хватает 1–2 шагов пробирования.
                  </div>
                </div>
                <!-- /GROUPS ANIMATION -->

                </div>
              </div>
              <!-- /PROBING SECTION -->
                </div><!-- /impl-sec-body: hash routing + probing -->
              </div><!-- /impl-sec -->

              <!-- GROUP STRUCTURE LOOKUP SECTION -->
              <style>
                /* layout */
                .grp-top{display:flex;align-items:flex-start;gap:14px;margin-bottom:12px;}
                .grp-h2box{background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:7px;padding:10px 14px;flex-shrink:0;}
                .grp-h2lbl{font-size:8px;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;}
                .grp-h2val{font-size:17px;font-weight:700;letter-spacing:.04em;color:#a78bfa;}
                .grp-h2bits{display:flex;gap:2px;margin-top:4px;}
                .grp-bit{width:13px;height:13px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:5.5px;font-weight:700;background:var(--border,#e0e0e0);color:var(--text-dim,#bbb);border:1px solid var(--border,#ddd);}
                .grp-bit-on{background:rgba(167,139,250,.18);border-color:#a78bfa;color:#a78bfa;}
                .grp-stepbox{flex:1;background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:7px;padding:10px 14px;min-height:58px;}
                .grp-stepnum{font-size:8px;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;}
                /* step texts shown via CSS */
                .grp-st{display:none;font-size:10px;line-height:1.65;color:var(--text,#1d1d1d);}
                #grpW[data-step="0"] .grp-st[data-s="0"],
                #grpW[data-step="1"] .grp-st[data-s="1"],
                #grpW[data-step="2"] .grp-st[data-s="2"],
                #grpW[data-step="3"] .grp-st[data-s="3"]{display:block;}
                #grpW[data-step="0"] .grp-stepnum::after{content:"ШАГ 1 / 4";}
                #grpW[data-step="1"] .grp-stepnum::after{content:"ШАГ 2 / 4";}
                #grpW[data-step="2"] .grp-stepnum::after{content:"ШАГ 3 / 4";}
                #grpW[data-step="3"] .grp-stepnum::after{content:"ШАГ 4 / 4";}
                /* group box */
                .grp-box{background:var(--surface,#fff);border:1px solid var(--border,#e0e0e0);border-radius:8px;overflow:hidden;}
                .grp-hdr{background:var(--bg,#f5f5f5);border-bottom:1px solid var(--border,#e0e0e0);padding:5px 12px;font-size:9px;color:var(--text-dim,#888);display:flex;align-items:center;justify-content:space-between;}
                .grp-hdr b{color:var(--text,#1d1d1d);}
                .grp-cwrow{display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border,#e0e0e0);gap:6px;overflow-x:auto;}
                .grp-cwlbl{font-size:8.5px;color:var(--text-dim,#888);width:28px;flex-shrink:0;}
                .grp-cwbytes{display:flex;gap:4px;}
                .grp-cwbyte{width:68px;flex-shrink:0;background:var(--bg,#f5f5f5);border:1.5px solid var(--border,#e0e0e0);border-radius:4px;padding:3px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;transition:border-color .25s,background .25s,box-shadow .25s;}
                .grp-cwbits{display:flex;gap:1px;}
                .grp-cwbit{width:6.5px;height:6.5px;border-radius:1px;display:flex;align-items:center;justify-content:center;font-size:5px;font-weight:700;}
                .gcb-h2{background:rgba(167,139,250,.2);color:#a78bfa;}
                .gcb-flag{background:rgba(74,159,212,.15);color:#4a9fd4;}
                .gcb-empty{background:var(--border,#ddd);color:var(--text-dim,#bbb);opacity:.5;}
                .grp-cwtag{font-size:6px;color:var(--text-dim,#bbb);}
                .grp-cwbyte{transition:border-color .25s,background .25s,box-shadow .25s;}
                /* CW highlights per step */
                #grpW[data-step="1"] .gcw[data-i="0"],
                #grpW[data-step="2"] .gcw[data-i="0"],
                #grpW[data-step="3"] .gcw[data-i="0"]{border-color:#a78bfa;background:rgba(167,139,250,.08);box-shadow:0 0 0 2px rgba(167,139,250,.15);}
                #grpW[data-step="1"] .gcw[data-i="1"],
                #grpW[data-step="1"] .gcw[data-i="2"],
                #grpW[data-step="1"] .gcw[data-i="3"]{border-color:#4a9fd4;background:rgba(74,159,212,.06);}
                #grpW[data-step="1"] .gcw[data-i="4"],
                #grpW[data-step="1"] .gcw[data-i="5"],
                #grpW[data-step="1"] .gcw[data-i="6"],
                #grpW[data-step="1"] .gcw[data-i="7"]{opacity:.35;}
                /* slots */
                .grp-slot{display:flex;align-items:center;padding:5px 12px;border-bottom:1px solid var(--border,#e0e0e0);gap:6px;}
                .grp-slot:last-child{border-bottom:none;}
                .grp-slbl{font-size:8.5px;color:var(--text-dim,#888);width:40px;flex-shrink:0;}
                .grp-skey{width:100px;flex-shrink:0;padding:3px 7px;border-radius:4px;font-size:9px;font-weight:700;text-align:center;border:1px solid transparent;transition:all .25s;}
                .grp-sval{flex:1;padding:3px 7px;border-radius:4px;font-size:9px;text-align:center;border:1px solid transparent;transition:all .25s;}
                .grp-slot-full .grp-skey{background:rgba(147,197,253,.15);color:#60a5fa;border-color:rgba(147,197,253,.25);}
                .grp-slot-full .grp-sval{background:rgba(252,165,165,.12);color:#f87171;border-color:rgba(252,165,165,.25);}
                .grp-slot-empty .grp-skey,.grp-slot-empty .grp-sval{background:var(--bg,#f5f5f5);color:var(--text-dim,#bbb);border-color:var(--border,#e0e0e0);}
                /* slot 0 highlights */
                #grpW[data-step="2"] .gs[data-i="0"] .grp-skey,
                #grpW[data-step="3"] .gs[data-i="0"] .grp-skey{background:rgba(52,211,153,.13);border-color:#34d399;color:#34d399;}
                #grpW[data-step="2"] .gs[data-i="0"] .grp-sval{background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.3);color:#34d399;}
                #grpW[data-step="3"] .gs[data-i="0"] .grp-sval{background:rgba(52,211,153,.18);border-color:#34d399;color:#34d399;font-weight:700;}
                /* value toggle */
                .gsv-new{display:none;}
                #grpW[data-step="3"] .gsv-orig{display:none;}
                #grpW[data-step="3"] .gsv-new{display:inline;}
                /* result */
                .grp-result{display:none;margin-top:8px;padding:6px 12px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.25);border-radius:6px;font-size:9.5px;color:#34d399;line-height:1.6;}
                #grpW[data-step="3"] .grp-result{display:block;}
                .grp-simd{margin-top:8px;padding:5px 10px;background:rgba(167,139,250,.05);border:1px dashed rgba(167,139,250,.25);border-radius:5px;font-size:8.5px;color:#a78bfa;line-height:1.5;}
                /* controls */
                .grp-controls{display:flex;align-items:center;gap:10px;margin-top:10px;}
                .grp-btn{padding:4px 13px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:9.5px;cursor:pointer;border:1px solid var(--border,#e0e0e0);background:var(--surface,#fff);color:var(--text,#1d1d1d);transition:border-color .15s,color .15s;}
                .grp-btn:hover{border-color:#4a9fd4;color:#4a9fd4;}
                .grp-btn:disabled{opacity:.35;cursor:default;}
                .grp-btn-go{border-color:#34d399;color:#34d399;background:rgba(52,211,153,.06);}
                .grp-dots{display:flex;gap:5px;}
                .grp-dot{width:6px;height:6px;border-radius:50%;background:var(--border,#ddd);transition:background .2s;}
                /* cw legend */
                .grp-cwlegend{padding:6px 12px 7px;border-bottom:1px solid var(--border,#e0e0e0);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:flex-start;}
                .grp-cwleg-ttl{font-size:7.5px;color:var(--text-dim,#888);align-self:center;white-space:nowrap;margin-right:2px;}
                .grp-cwleg-entry{display:flex;align-items:center;gap:4px;}
                .grp-cwleg-bits{display:flex;gap:1px;}
                .grp-cwleg-badge{font-size:7px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;}
                .gcb-set{background:rgba(239,68,68,.15);color:#ef4444;}
                .gcb-tomb{background:rgba(245,158,11,.15);color:#f59e0b;}
                .gcb-tomb-last{background:rgba(245,158,11,.07);color:#f59e0b;}
                /* bit role bar */
                .grp-bitrole{display:flex;align-items:center;gap:0;padding:4px 12px 0;margin-left:34px;}
                .grp-bitrole-flag{font-size:6px;color:#4a9fd4;text-align:center;padding:0 2px;border-top:1px solid rgba(74,159,212,.5);border-left:1px solid rgba(74,159,212,.5);border-right:1px solid rgba(74,159,212,.5);white-space:nowrap;min-width:8.5px;}
                .grp-bitrole-h2{font-size:6px;color:#a78bfa;text-align:center;flex:1;padding:0 2px;border-top:1px solid rgba(167,139,250,.5);border-left:1px solid rgba(167,139,250,.5);border-right:1px solid rgba(167,139,250,.5);white-space:nowrap;}
                #grpW[data-step="0"] .gd[data-i="0"],
                #grpW[data-step="1"] .gd[data-i="1"],
                #grpW[data-step="2"] .gd[data-i="2"],
                #grpW[data-step="3"] .gd[data-i="3"]{background:#34d399;}
                #grpBN::after{content:"далее →";}
                #grpW[data-step="3"] #grpBN::after{content:"готово ✓";}
              </style>

              <div class="impl-sec">
                <div class="impl-sec-hdr">Структура Group: control bytes и поиск/обновление по ключу</div>
                <div class="impl-sec-body">
                <div id="grpW" data-step="0" style="font-family:'JetBrains Mono',monospace;font-size:11px;">

                  <div class="grp-top">
                    <div class="grp-h2box">
                      <div class="grp-h2lbl">h2 (fingerprint)</div>
                      <div class="grp-h2val">1111111</div>
                      <div class="grp-h2bits">${[1,1,1,1,1,1,1].map(b=>'<div class="grp-bit'+(b?' grp-bit-on':'')+'">'+b+'</div>').join('')}</div>
                      <div style="font-size:8px;color:var(--text-dim,#888);margin-top:4px;">ключ: <span style="color:#60a5fa">"hello"</span></div>
                    </div>
                    <div class="grp-stepbox">
                      <div class="grp-stepnum"></div>
                      <div class="grp-st" data-s="0">Группа <b style="color:#4a9fd4">944</b> найдена пробированием. Внутри — 8 слотов и <b>control bytes (CW)</b>: по одному байту на слот. Хотим обновить значение для ключа <b style="color:#60a5fa">"hello"</b>.</div>
                      <div class="grp-st" data-s="1">Берём <b style="color:#a78bfa">h2 = 1111111</b> и сравниваем нижние 7 бит каждого CW. Совпадение: <b>CW[0] = 0<span style="color:#a78bfa">1111111</span></b> — возможно это наш ключ!</div>
                      <div class="grp-st" data-s="2">CW совпал → проверяем <b>полный ключ</b> в Slot 0. <b style="color:#60a5fa">"hello"</b> == <b style="color:#60a5fa">"hello"</b> <b style="color:#34d399">✓</b> — нашли!</div>
                      <div class="grp-st" data-s="3">Ключ совпал → <b>обновляем значение</b>: <span style="color:#d97706">"world"</span> → <b style="color:#34d399">"go"</b>. Операция завершена!</div>
                    </div>
                  </div>

                  <div class="grp-box">
                    <div class="grp-hdr"><div>Group <b>944</b></div><div style="font-size:8px;">8 слотов · 4 занято</div></div>
                    <div class="grp-cwlegend">
                      <span class="grp-cwleg-ttl">control byte:</span>
                      <div class="grp-cwleg-entry">
                        <div class="grp-cwleg-bits"><div class="grp-cwbit gcb-flag">0</div>${Array(7).fill('<div class="grp-cwbit gcb-h2">h</div>').join('')}</div>
                        <span class="grp-cwleg-badge" style="color:#34d399;background:rgba(52,211,153,.1);">full</span>
                        <span style="font-size:7px;color:var(--text-dim,#888);">слот занят</span>
                      </div>
                      <div class="grp-cwleg-entry">
                        <div class="grp-cwleg-bits"><div class="grp-cwbit gcb-set">1</div>${Array(7).fill('<div class="grp-cwbit gcb-empty">0</div>').join('')}</div>
                        <span class="grp-cwleg-badge" style="color:var(--text-dim,#888);background:var(--bg,#f5f5f5);">empty</span>
                        <span style="font-size:7px;color:var(--text-dim,#888);">пустой</span>
                      </div>
                      <div class="grp-cwleg-entry">
                        <div class="grp-cwleg-bits"><div class="grp-cwbit gcb-set">1</div>${Array(6).fill('<div class="grp-cwbit gcb-tomb">1</div>').join('')}<div class="grp-cwbit gcb-tomb-last">0</div></div>
                        <span class="grp-cwleg-badge" style="color:#f59e0b;background:rgba(245,158,11,.1);">deleted</span>
                        <span style="font-size:7px;color:var(--text-dim,#888);">tombstone</span>
                      </div>
                    </div>
                    <div class="grp-bitrole">
                      <div class="grp-bitrole-flag">флаг</div>
                      <div class="grp-bitrole-h2">h2 fingerprint (7 бит)</div>
                    </div>
                    <div class="grp-cwrow">
                      <div class="grp-cwlbl">CW</div>
                      <div class="grp-cwbytes">${(function(){
                        var data=[['01111111','full'],['01100110','full'],['00101101','full'],['00011110','full'],['10000000','empty'],['10000000','empty'],['10000000','empty'],['10000000','empty']];
                        return data.map(function(d,i){
                          var bits=d[0].split('').map(function(b,bi){
                            var cls=bi===0?'gcb-flag':(d[1]==='empty'?'gcb-empty':'gcb-h2');
                            return '<div class="grp-cwbit '+cls+'">'+b+'</div>';
                          }).join('');
                          return '<div class="grp-cwbyte gcw" data-i="'+i+'"><div class="grp-cwbits">'+bits+'</div><div class="grp-cwtag">'+d[1]+'</div></div>';
                        }).join('');
                      })()}</div>
                    </div>
                    ${(function(){
                      var data=[
                        ['"hello"','<span class="gsv-orig">"world"</span><span class="gsv-new" style="color:#34d399;font-weight:700">"go"</span>','full'],
                        ['"apple"','"fruit"','full'],['"wheel"','"round"','full'],['"sky"','"blue"','full'],
                        ['','','empty'],['','','empty'],['','','empty'],['','','empty']
                      ];
                      return data.map(function(d,i){
                        return '<div class="grp-slot gs grp-slot-'+d[2]+'" data-i="'+i+'">'
                          +'<div class="grp-slbl">Slot '+i+'</div>'
                          +'<div class="grp-skey">'+d[0]+'</div>'
                          +'<div class="grp-sval">'+d[1]+'</div>'
                          +'</div>';
                      }).join('');
                    })()}
                  </div>

                  <div class="grp-result">&#10003; ключ "hello" найден &#183; значение обновлено &#183; <b>полное сравнение ключа: 1 раз</b> (CW отфильтровал лишние слоты)</div>
                  <div class="grp-simd">&#128161; сравнение h2 со всеми 8 CW &#8212; за 1 такт CPU (SIMD) &#183; разберём подробнее ниже</div>

                  <div class="grp-controls">
                    <button class="grp-btn" id="grpBP" disabled onclick="(function(){var w=document.getElementById('grpW');var n=Math.max(0,parseInt(w.getAttribute('data-step')||'0')-1);w.setAttribute('data-step',n);document.getElementById('grpBP').disabled=n<=0;document.getElementById('grpBN').disabled=false;})()">&#8592; назад</button>
                    <div class="grp-dots">${[0,1,2,3].map(function(i){return '<div class="grp-dot gd" data-i="'+i+'"></div>';}).join('')}</div>
                    <button class="grp-btn grp-btn-go" id="grpBN" onclick="(function(){var w=document.getElementById('grpW');var n=Math.min(3,parseInt(w.getAttribute('data-step')||'0')+1);w.setAttribute('data-step',n);document.getElementById('grpBP').disabled=false;document.getElementById('grpBN').disabled=n>=3;})()"></button>
                  </div>
                </div>
              </div>
                </div><!-- /impl-sec-body -->
              </div><!-- /impl-sec: group structure -->
              <!-- /GROUP STRUCTURE LOOKUP SECTION -->

              <!-- SLOT SIZE / POINTER / DELETE SECTION -->
              <style>
                .slt-wrap{margin:0;background:transparent;border:none;border-radius:0;overflow:visible;}
                .slt-hdr{display:none;}
                .slt-body{padding:11px 14px;display:flex;flex-direction:column;gap:9px;}
                .slt-row{display:flex;gap:10px;align-items:flex-start;}
                .slt-badge{font-size:8.5px;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;margin-top:2px;flex-shrink:0;}
                .sb-inline{background:rgba(52,211,153,.12);color:#34d399;}
                .sb-ptr{background:rgba(74,159,212,.12);color:#4a9fd4;}
                .slt-text{font-size:10px;line-height:1.65;color:var(--text,#1d1d1d);}
                .slt-ic{font-family:'JetBrains Mono',monospace;font-size:9px;background:var(--surface,#fff);border:1px solid var(--border,#e0e0e0);border-radius:3px;padding:1px 5px;}
                .slt-sep{border-top:1px solid var(--border,#e0e0e0);margin:2px 0;}
                .slt-bonus{font-size:10px;line-height:1.65;color:var(--text,#1d1d1d);}
                .slt-bonus b{color:#a78bfa;}
                .slt-del{padding:10px 14px;border-top:1px solid var(--border,#e0e0e0);}
                .slt-del-hdr{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#888);margin-bottom:7px;}
                .slt-del-row{display:flex;gap:7px;align-items:baseline;font-size:9.5px;margin-bottom:3px;}
                .sdr-type{font-family:'JetBrains Mono',monospace;font-size:9px;color:#a78bfa;min-width:110px;flex-shrink:0;}
                .sdr-arr{color:var(--text-dim,#bbb);}
                .sdr-val{font-family:'JetBrains Mono',monospace;font-size:9px;color:#34d399;}
                .sdr-why{color:var(--text-dim,#888);font-size:8.5px;}
                .slt-del-tip{margin-top:6px;font-size:9px;color:var(--text-dim,#888);border-left:2px solid var(--border,#ddd);padding-left:8px;line-height:1.6;}
              </style>
              <div class="impl-sec">
                <div class="impl-sec-hdr">Слоты · 128 байт · inline vs указатель · delete()</div>
                <div class="impl-sec-body">
              <div class="slt-wrap">
                <div class="slt-hdr">слоты · 128 байт · inline vs указатель</div>
                <div class="slt-body">
                  <div class="slt-row">
                    <span class="slt-badge sb-inline">inline</span>
                    <div class="slt-text">
                      Если <b>sizeof(key) ≤ 128</b> и <b>sizeof(val) ≤ 128</b> — ключ и значение хранятся прямо в слоте.
                      Большинство типов вмещаются: <span class="slt-ic">int</span>, <span class="slt-ic">string</span> (16 байт), <span class="slt-ic">bool</span>, небольшие struct.
                    </div>
                  </div>
                  <div class="slt-row">
                    <span class="slt-badge sb-ptr">via *ptr</span>
                    <div class="slt-text">
                      Если тип крупнее — Go ставит флаг <span class="slt-ic">IndirectKey</span> / <span class="slt-ic">IndirectElem</span> при компиляции:
                      слот хранит <b>указатель</b>, сам объект живёт в куче.<br>
                      Пример: <span class="slt-ic">map[string]UserData</span> — если <span class="slt-ic">UserData</span> &gt; 128 байт, слот содержит <span class="slt-ic">*UserData</span>.
                    </div>
                  </div>
                  <div class="slt-sep"></div>
                  <div class="slt-bonus">
                    <b>При росте таблицы</b> сами объекты в куче <b>не перемещаются</b> — rehash копирует только слоты (ключи + указатели/значения). Переаллокации крупных структур не происходит.
                  </div>
                </div>
                <div class="slt-del">
                  <div class="slt-del-hdr">delete() зануляет значение — Go очищает ссылки для GC</div>
                  <div class="slt-del-row"><span class="sdr-type">string</span><span class="sdr-arr">→</span><span class="sdr-val">""</span><span class="sdr-why">пустая строка</span></div>
                  <div class="slt-del-row"><span class="sdr-type">*T, interface{}</span><span class="sdr-arr">→</span><span class="sdr-val">nil</span><span class="sdr-why">объект отвязывается — GC может его собрать</span></div>
                  <div class="slt-del-row"><span class="sdr-type">int, bool, …</span><span class="sdr-arr">→</span><span class="sdr-val">0 / false</span><span class="sdr-why">нулевое значение (без указателей — GC не нужен)</span></div>
                  <div class="slt-del-tip">ключ зануляется только если содержит указатели; CW-байт слота → tombstone <span class="slt-ic" style="font-size:8px;">0xFE</span> — сам ключ трогать необязательно</div>
                </div>
              </div>
                </div><!-- /impl-sec-body -->
              </div><!-- /impl-sec: slots -->
              <!-- /SLOT SIZE / POINTER / DELETE SECTION -->

              <!-- TOMBSTONE SECTION -->
              <style>
                .tomb-st{display:none;font-size:10px;line-height:1.65;color:var(--text,#1d1d1d);}
                #tombW[data-step="0"] .tomb-st[data-s="0"],
                #tombW[data-step="1"] .tomb-st[data-s="1"],
                #tombW[data-step="2"] .tomb-st[data-s="2"],
                #tombW[data-step="3"] .tomb-st[data-s="3"]{display:block;}
                #tombW[data-step="0"] .tomb-stepnum::after{content:"ШАГ 1 / 4";}
                #tombW[data-step="1"] .tomb-stepnum::after{content:"ШАГ 2 / 4";}
                #tombW[data-step="2"] .tomb-stepnum::after{content:"ШАГ 3 / 4";}
                #tombW[data-step="3"] .tomb-stepnum::after{content:"ШАГ 4 / 4";}
                .tomb-stepnum{font-size:8px;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;}
                .tomb-cwrow{display:flex;align-items:flex-start;padding:8px 12px;border-bottom:1px solid var(--border,#e0e0e0);gap:5px;overflow-x:auto;}
                .tomb-cwlbl{font-size:8.5px;color:var(--text-dim,#888);width:28px;flex-shrink:0;padding-top:6px;}
                .tomb-cwbytes{display:flex;gap:3px;}
                .tomb-cwbyte{min-width:62px;flex-shrink:0;background:var(--bg,#f5f5f5);border:1.5px solid var(--border,#e0e0e0);border-radius:4px;padding:3px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .25s;font-family:'JetBrains Mono',monospace;}
                .tomb-cwpat{font-size:7.5px;font-weight:700;letter-spacing:.04em;}
                .tomb-cwtag{font-size:6px;color:var(--text-dim,#bbb);}
                .tcv{display:none;flex-direction:column;align-items:center;gap:2px;}
                #tombW[data-step="0"] .tcv-init{display:flex;}
                #tombW[data-step="1"] .tcv-empty{display:flex;}
                #tombW[data-step="2"] .tcv-tomb{display:flex;}
                #tombW[data-step="3"] .tcv-tomb{display:flex;}
                #tombW[data-step="0"] .tb-cw1{border-color:#a78bfa;background:rgba(167,139,250,.08);}
                #tombW[data-step="1"] .tb-cw1{border-color:#ef4444;background:rgba(239,68,68,.07);}
                #tombW[data-step="2"] .tb-cw1,#tombW[data-step="3"] .tb-cw1{border-color:#f59e0b;background:rgba(245,158,11,.07);}
                #tombW[data-step="1"] .tb-cw2-later{opacity:.18;}
                #tombW[data-step="2"] .tb-cw2,#tombW[data-step="3"] .tb-cw2{border-color:#34d399;background:rgba(52,211,153,.08);}
                .tomb-stop-badge{display:none;font-size:7px;color:#ef4444;font-weight:700;margin-top:1px;}
                #tombW[data-step="1"] .tb-cw1 .tomb-stop-badge{display:block;}
                .tb-s1-full,.tb-s1-gone{display:none;}
                #tombW[data-step="0"] .tb-s1-full{display:flex;}
                #tombW[data-step="1"] .tb-s1-gone,
                #tombW[data-step="2"] .tb-s1-gone,
                #tombW[data-step="3"] .tb-s1-gone{display:flex;}
                #tombW[data-step="1"] .tb-s2{opacity:.18;}
                #tombW[data-step="2"] .tb-s2 .grp-skey,
                #tombW[data-step="3"] .tb-s2 .grp-skey{background:rgba(52,211,153,.13);border-color:#34d399;color:#34d399;}
                .tomb-note{display:none;margin-top:7px;padding:5px 10px;border-radius:6px;font-size:9px;line-height:1.55;}
                .tomb-note-bad{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);color:#ef4444;}
                .tomb-note-ok{background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.25);color:#34d399;}
                .tomb-note-tip{background:rgba(167,139,250,.05);border:1px dashed rgba(167,139,250,.3);color:#a78bfa;}
                #tombW[data-step="1"] .tomb-note-bad{display:block;}
                #tombW[data-step="2"] .tomb-note-ok{display:block;}
                #tombW[data-step="3"] .tomb-note-tip{display:block;}
                .tomb-controls{display:flex;align-items:center;gap:10px;margin-top:10px;}
                .tomb-btn{padding:4px 13px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:9.5px;cursor:pointer;border:1px solid var(--border,#e0e0e0);background:var(--surface,#fff);color:var(--text,#1d1d1d);transition:border-color .15s,color .15s;}
                .tomb-btn:hover{border-color:#4a9fd4;color:#4a9fd4;}
                .tomb-btn:disabled{opacity:.35;cursor:default;}
                .tomb-btn-go{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.06);}
                .tomb-dots{display:flex;gap:5px;}
                .tomb-dot{width:6px;height:6px;border-radius:50%;background:var(--border,#ddd);transition:background .2s;}
                #tombW[data-step="0"] .td[data-i="0"],
                #tombW[data-step="1"] .td[data-i="1"],
                #tombW[data-step="2"] .td[data-i="2"],
                #tombW[data-step="3"] .td[data-i="3"]{background:#f59e0b;}
                #tombBN::after{content:"далее →";}
                #tombW[data-step="3"] #tombBN::after{content:"понял ✓";}
              </style>

              <div class="impl-sec">
                <div class="impl-sec-hdr">Tombstone при удалении: зачем и когда</div>
                <div class="impl-sec-body">
                <div id="tombW" data-step="0" style="font-family:'JetBrains Mono',monospace;font-size:11px;">
                  <div class="grp-top">
                    <div class="grp-stepbox">
                      <div class="tomb-stepnum"></div>
                      <div class="tomb-st" data-s="0">delete(m, <b style="color:#60a5fa">"apple"</b>) → h2 = <b style="color:#a78bfa">1100110</b>. Проверяем все CW: <b>CW[1] = 0<span style="color:#a78bfa">1100110</span></b> — совпадение! Slot 1 = "apple". Все 8 слотов заняты (нет ни одного empty в группе).</div>
                      <div class="tomb-st" data-s="1">Ставим CW[1] = <b style="color:#ef4444">10000000</b> (empty). Ищем <b style="color:#60a5fa">"wheel"</b> (h2=0101101): натыкаемся на CW[1]=empty → <b style="color:#ef4444">стоп!</b> CW[2]="wheel" так и не проверен — ключ «потерян». Это баг!</div>
                      <div class="tomb-st" data-s="2">Правильно: CW[1] = <b style="color:#f59e0b">11111110</b> (tombstone). Ищем <b style="color:#60a5fa">"wheel"</b>: tombstone → пропускаем, продолжаем → CW[2] совпал → <b style="color:#34d399">"wheel" найден ✓</b>. Цепочка не оборвалась.</div>
                      <div class="tomb-st" data-s="3">При <b>вставке</b>: первый tombstone-слот запоминается. Если ключ не найден — вставляем туда. <b>Tombstone не нужен</b>, если в группе уже есть хоть один empty-слот: цепочка проб и так остановилась бы на нём, значит ничего «за ним» не могло оказаться по этому проходу.</div>
                    </div>
                  </div>

                  <div class="grp-box">
                    <div class="grp-hdr"><div>Group <b>944</b> — все 8 слотов заняты</div><div style="font-size:8px;color:#60a5fa;">delete("apple")</div></div>
                    <div class="tomb-cwrow">
                      <div class="tomb-cwlbl">CW</div>
                      <div class="tomb-cwbytes">${(function(){
                        var cws=['01111011','01100110','00101101','00011110','01110111','00010011','01111000','00100010'];
                        return cws.map(function(pat,i){
                          if(i===1){
                            return '<div class="tomb-cwbyte tb-cw1">'
                              +'<div class="tcv tcv-init"><div class="tomb-cwpat" style="color:#a78bfa">01100110</div><div class="tomb-cwtag">full · h2</div></div>'
                              +'<div class="tcv tcv-empty"><div class="tomb-cwpat" style="color:#ef4444">10000000</div><div class="tomb-cwtag" style="color:#ef4444">empty?!</div><div class="tomb-stop-badge">STOP</div></div>'
                              +'<div class="tcv tcv-tomb"><div class="tomb-cwpat" style="color:#f59e0b">11111110</div><div class="tomb-cwtag" style="color:#f59e0b">deleted</div></div>'
                              +'</div>';
                          }
                          var cls = i===2 ? 'tb-cw2' : (i>1 ? 'tb-cw2-later' : '');
                          var col = i===2 ? '#34d399' : 'var(--text,#1d1d1d)';
                          var tag = i===0?'full':i===2?'wheel h2':'full';
                          return '<div class="tomb-cwbyte '+cls+'">'
                            +'<div class="tomb-cwpat" style="color:'+col+'">'+pat+'</div>'
                            +'<div class="tomb-cwtag">'+tag+'</div>'
                            +'</div>';
                        }).join('');
                      })()}</div>
                    </div>
                    ${(function(){
                      var rows=[
                        {slot:0,key:'"door"',val:'"lock"'},
                        {slot:2,key:'"wheel"',val:'"round"',cls:'tb-s2'},
                        {slot:3,key:'"sky"',val:'"blue"'},
                        {slot:4,key:'"star"',val:'"bright"'},
                        {slot:5,key:'"channel"',val:'"open"'},
                        {slot:6,key:'"ice"',val:'"cold"'},
                        {slot:7,key:'"code"',val:'"logic"'}
                      ];
                      var slot1Full='<div class="grp-slot gs grp-slot-full tb-s1-full" data-i="1">'
                        +'<div class="grp-slbl">Slot 1</div>'
                        +'<div class="grp-skey">"apple"</div>'
                        +'<div class="grp-sval">"fruit"</div></div>';
                      var slot1Gone='<div class="grp-slot gs grp-slot-empty tb-s1-gone" data-i="1">'
                        +'<div class="grp-slbl">Slot 1</div>'
                        +'<div class="grp-skey" style="color:var(--text-dim,#bbb);">—</div>'
                        +'<div class="grp-sval" style="color:var(--text-dim,#bbb);font-size:8px;">удалено</div></div>';
                      var out=rows.slice(0,1).map(function(d){
                        return '<div class="grp-slot gs grp-slot-full '+(d.cls||'')+'" data-i="'+d.slot+'">'
                          +'<div class="grp-slbl">Slot '+d.slot+'</div>'
                          +'<div class="grp-skey">'+d.key+'</div>'
                          +'<div class="grp-sval">'+d.val+'</div></div>';
                      }).join('');
                      out+=slot1Full+slot1Gone;
                      out+=rows.slice(1).map(function(d){
                        return '<div class="grp-slot gs grp-slot-full '+(d.cls||'')+'" data-i="'+d.slot+'">'
                          +'<div class="grp-slbl">Slot '+d.slot+'</div>'
                          +'<div class="grp-skey">'+d.key+'</div>'
                          +'<div class="grp-sval">'+d.val+'</div></div>';
                      }).join('');
                      return out;
                    })()}
                  </div>

                  <div class="tomb-note tomb-note-bad">✗ empty обрывает цепочку — "wheel" в Slot 2 никогда не найти. Поломанная карта.</div>
                  <div class="tomb-note tomb-note-ok">✓ tombstone пропускается при поиске, не обрывая цепочку. "wheel" найден. Карта работает корректно.</div>
                  <div class="tomb-note tomb-note-tip">Tombstone переиспользуется при вставке — он лучше empty (меньше движений при rehash). Если в группе уже есть empty — можно сразу поставить empty без tombstone: probe chain и без того оборвётся на нём.</div>

                  <div class="tomb-controls">
                    <button class="tomb-btn" id="tombBP" disabled onclick="(function(){var w=document.getElementById('tombW');var n=Math.max(0,parseInt(w.getAttribute('data-step')||'0')-1);w.setAttribute('data-step',n);document.getElementById('tombBP').disabled=n<=0;document.getElementById('tombBN').disabled=false;})()">← назад</button>
                    <div class="tomb-dots">${[0,1,2,3].map(function(i){return '<div class="tomb-dot td" data-i="'+i+'"></div>';}).join('')}</div>
                    <button class="tomb-btn tomb-btn-go" id="tombBN" onclick="(function(){var w=document.getElementById('tombW');var n=Math.min(3,parseInt(w.getAttribute('data-step')||'0')+1);w.setAttribute('data-step',n);document.getElementById('tombBP').disabled=false;document.getElementById('tombBN').disabled=n>=3;})()"></button>
                  </div>
                </div>
              </div><!-- /tombW -->
              </div><!-- /impl-sec-body -->
              </div><!-- /impl-sec: tombstone -->
              <!-- /TOMBSTONE SECTION -->

              <!-- TOMBSTONE CLEANUP SECTION -->
              <style>
                .clean-st{display:none;font-size:10px;line-height:1.65;color:var(--text,#1d1d1d);}
                #cleanW[data-step="0"] .clean-st[data-s="0"],
                #cleanW[data-step="1"] .clean-st[data-s="1"],
                #cleanW[data-step="2"] .clean-st[data-s="2"],
                #cleanW[data-step="3"] .clean-st[data-s="3"]{display:block;}
                #cleanW[data-step="0"] .clean-stepnum::after{content:"ШАГ 1 / 4";}
                #cleanW[data-step="1"] .clean-stepnum::after{content:"ШАГ 2 / 4";}
                #cleanW[data-step="2"] .clean-stepnum::after{content:"ШАГ 3 / 4";}
                #cleanW[data-step="3"] .clean-stepnum::after{content:"ШАГ 4 / 4";}
                .clean-stepnum{font-size:8px;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;}
                .clean-table{display:flex;gap:3px;overflow-x:auto;padding:2px 0 4px;}
                .clean-group{display:flex;flex-direction:column;align-items:center;gap:3px;}
                .clean-gbox{border:1.5px solid var(--border,#e0e0e0);border-radius:5px;padding:3px 4px;background:var(--surface,#fff);display:flex;flex-direction:column;gap:1.5px;transition:all .3s;min-width:44px;}
                .clean-gnum{font-size:8px;color:var(--text-dim,#888);text-align:center;font-family:'JetBrains Mono',monospace;}
                .clean-slot-row{height:7px;display:flex;gap:1.5px;}
                .csr-k{flex:1;background:#7ab3d4;border-radius:1.5px;}
                .csr-v{flex:1;background:#d4849a;border-radius:1.5px;}
                .csr-t{flex:2;background:rgba(245,158,11,.2);border:1px dashed rgba(245,158,11,.7);border-radius:1.5px;display:flex;align-items:center;justify-content:center;font-size:5.5px;color:#f59e0b;transition:all .35s;}
                .csr-e{flex:2;border:1px solid var(--border,#ddd);border-radius:1.5px;background:var(--bg,#f5f5f5);}
                #cleanW[data-step="1"] .csr-t{opacity:.18;background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.35);}
                #cleanW[data-step="2"] .cg-needed,
                #cleanW[data-step="3"] .cg-needed{border-color:#f59e0b;background:rgba(245,158,11,.05);}
                #cleanW[data-step="2"] .cg-target,
                #cleanW[data-step="3"] .cg-target{border-color:#34d399;background:rgba(52,211,153,.05);}
                #cleanW[data-step="2"] .cg-prunable,
                #cleanW[data-step="3"] .cg-prunable{border-color:#a78bfa;background:rgba(167,139,250,.05);}
                .clean-probe{display:none;align-items:center;gap:4px;margin-top:8px;padding:5px 10px;background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:6px;flex-wrap:wrap;}
                #cleanW[data-step="2"] .clean-probe,
                #cleanW[data-step="3"] .clean-probe{display:flex;}
                .cp-grp{padding:2px 7px;border-radius:4px;font-size:8px;font-weight:700;font-family:'JetBrains Mono',monospace;}
                .cp-arrow{font-size:9px;color:var(--text-dim,#888);}
                .cp-needed{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);}
                .cp-target{background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.3);}
                .clean-legend{display:none;margin-top:6px;align-items:center;gap:8px;flex-wrap:wrap;}
                #cleanW[data-step="2"] .clean-legend,
                #cleanW[data-step="3"] .clean-legend{display:flex;}
                .cl-item{display:flex;align-items:center;gap:3px;font-size:8px;}
                .cl-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0;}
                .clean-rule{display:none;margin-top:8px;padding:6px 10px;background:var(--bg,#f5f5f5);border:1px solid var(--border,#e0e0e0);border-radius:6px;font-size:9px;line-height:1.8;}
                #cleanW[data-step="3"] .clean-rule{display:block;}
                .cr-yes{color:#34d399;font-weight:700;}
                .cr-no{color:#a78bfa;font-weight:700;}
                .clean-controls{display:flex;align-items:center;gap:10px;margin-top:10px;}
                .clean-btn{padding:4px 13px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:9.5px;cursor:pointer;border:1px solid var(--border,#e0e0e0);background:var(--surface,#fff);color:var(--text,#1d1d1d);transition:border-color .15s,color .15s;}
                .clean-btn:hover{border-color:#4a9fd4;color:#4a9fd4;}
                .clean-btn:disabled{opacity:.35;cursor:default;}
                .clean-btn-go{border-color:#a78bfa;color:#a78bfa;background:rgba(167,139,250,.06);}
                .clean-dots{display:flex;gap:5px;}
                .clean-dot{width:6px;height:6px;border-radius:50%;background:var(--border,#ddd);transition:background .2s;}
                #cleanW[data-step="0"] .cd[data-i="0"],
                #cleanW[data-step="1"] .cd[data-i="1"],
                #cleanW[data-step="2"] .cd[data-i="2"],
                #cleanW[data-step="3"] .cd[data-i="3"]{background:#a78bfa;}
                #cleanBN::after{content:"далее →";}
                #cleanW[data-step="3"] #cleanBN::after{content:"готово ✓";}
              </style>

              <div class="impl-sec">
                <div class="impl-sec-hdr">Очистка tombstone'ов: два механизма</div>
                <div class="impl-sec-body">
                <div id="cleanW" data-step="0" style="font-family:'JetBrains Mono',monospace;font-size:11px;">
                  <div class="grp-top">
                    <div class="grp-stepbox">
                      <div class="clean-stepnum"></div>
                      <div class="clean-st" data-s="0">Tombstone'ы (<b style="color:#f59e0b">†</b>) накапливаются после удалений: занимают слоты и замедляют поиск. Два способа избавиться: <b>рост таблицы</b> или <b>prune на месте</b>.</div>
                      <div class="clean-st" data-s="1"><b>Механизм 1 — рост таблицы (tombstone removal).</b> При rehash копируем только live-ключи. Tombstone'ы (<b style="color:#34d399">†</b> исчезают) не переносятся — новая таблица чистая. Но дорого: O(n) + новая память.</div>
                      <div class="clean-st" data-s="2"><b>Механизм 2 — prune in place.</b> Ключ в <b style="color:#34d399">G6</b> попал туда через G0→G1→G3→G6. Эти группы <b style="color:#f59e0b">protected</b>: их tombstone'ы нельзя чистить, иначе поиск оборвётся раньше. <b style="color:#a78bfa">G5</b> — не на чьей-то цепочке, можно.</div>
                      <div class="clean-st" data-s="3"><b>Когда запускать prune?</b> Алгоритм дорогой — O(n). Смотрим: <code style="background:var(--bg,#f5f5f5);padding:0 4px;border-radius:3px;">num_tombstones >= 10% of max_growth_left</code>. Если нет — ждём следующего роста, tombstone'ы умрут при rehash сами.</div>
                    </div>
                  </div>

                  <div class="grp-box" style="padding:8px 12px 10px;">
                    ${(function(){
                      var groups=[
                        {n:'0',s:['f','f','f','t','f','f','t','f'],cls:'cg-needed'},
                        {n:'1',s:['f','t','f','f','f','t','f','f'],cls:'cg-needed'},
                        {n:'2',s:['f','f','f','f','e','e','e','e'],cls:''},
                        {n:'3',s:['f','f','t','f','f','f','f','f'],cls:'cg-needed'},
                        {n:'4',s:['f','f','f','e','e','e','e','e'],cls:''},
                        {n:'5',s:['f','t','t','f','f','e','e','e'],cls:'cg-prunable'},
                        {n:'6',s:['f','f','f','f','f','f','f','e'],cls:'cg-target'},
                        {n:'7',s:['f','f','e','e','e','e','e','e'],cls:''}
                      ];
                      var html='<div class="clean-table">';
                      groups.forEach(function(g){
                        var slots=g.s.map(function(s){
                          if(s==='f') return '<div class="clean-slot-row"><div class="csr-k"></div><div class="csr-v"></div></div>';
                          if(s==='t') return '<div class="clean-slot-row"><div class="csr-t">†</div></div>';
                          return '<div class="clean-slot-row"><div class="csr-e"></div></div>';
                        }).join('');
                        html+='<div class="clean-group"><div class="clean-gbox '+g.cls+'">'+slots+'</div><div class="clean-gnum">'+g.n+'</div></div>';
                      });
                      return html+'</div>';
                    })()}
                  </div>

                  <div class="clean-probe">
                    <span style="font-size:7.5px;color:var(--text-dim,#888);margin-right:2px;">probe chain:</span>
                    <span class="cp-grp cp-needed">G0</span>
                    <span class="cp-arrow">→</span>
                    <span class="cp-grp cp-needed">G1</span>
                    <span class="cp-arrow">→</span>
                    <span class="cp-grp cp-needed">G3</span>
                    <span class="cp-arrow">→</span>
                    <span class="cp-grp cp-target">G6 ✓</span>
                    <span style="font-size:7.5px;color:var(--text-dim,#888);margin-left:6px;">i, i+1, i+3, i+6 (треугольное)</span>
                  </div>

                  <div class="clean-legend">
                    <div class="cl-item"><div class="cl-dot" style="background:rgba(245,158,11,.2);border:1px solid #f59e0b;"></div><span style="color:#f59e0b;">protected — нельзя чистить</span></div>
                    <div class="cl-item"><div class="cl-dot" style="background:rgba(52,211,153,.2);border:1px solid #34d399;"></div><span style="color:#34d399;">target — ключ найден здесь</span></div>
                    <div class="cl-item"><div class="cl-dot" style="background:rgba(167,139,250,.2);border:1px solid #a78bfa;"></div><span style="color:#a78bfa;">prunable — tombstone'ы можно чистить</span></div>
                  </div>

                  <div class="clean-rule">
                    <div style="margin-bottom:4px;color:var(--text-dim,#888);font-size:8.5px;">num_tombstones >= 10% of max_growth_left ?</div>
                    <div><span class="cr-yes">→ да:</span> запускаем prune — чистим tombstone'ы на месте без роста</div>
                    <div><span class="cr-no">→ нет:</span> не трогаем — при следующем rehash уйдут сами</div>
                  </div>

                  <div class="clean-controls">
                    <button class="clean-btn" id="cleanBP" disabled onclick="(function(){var w=document.getElementById('cleanW');var n=Math.max(0,parseInt(w.getAttribute('data-step')||'0')-1);w.setAttribute('data-step',n);document.getElementById('cleanBP').disabled=n<=0;document.getElementById('cleanBN').disabled=false;})()">← назад</button>
                    <div class="clean-dots">${[0,1,2,3].map(function(i){return '<div class="clean-dot cd" data-i="'+i+'"></div>';}).join('')}</div>
                    <button class="clean-btn clean-btn-go" id="cleanBN" onclick="(function(){var w=document.getElementById('cleanW');var n=Math.min(3,parseInt(w.getAttribute('data-step')||'0')+1);w.setAttribute('data-step',n);document.getElementById('cleanBP').disabled=false;document.getElementById('cleanBN').disabled=n>=3;})()"></button>
                  </div>
                </div>
              </div><!-- /cleanW -->
              </div><!-- /impl-sec-body -->
              </div><!-- /impl-sec: cleanup -->
              <!-- /TOMBSTONE CLEANUP SECTION -->

              <!-- H2 LOOKUP ALGORITHM SECTION -->
              <style>
                .h2w-nav{display:flex;align-items:center;gap:8px;padding:8px 0 10px;}
                .h2w-btn{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:5px;padding:3px 12px;font-size:10px;cursor:pointer;color:var(--text-dim,#888);font-family:'JetBrains Mono',monospace;}
                .h2w-btn:hover{background:var(--bg,#f5f5f5);}
                .h2w-btn:disabled{opacity:.35;cursor:default;}
                .h2w-btn.h2w-primary{border-color:#7F77DD;color:#534AB7;}
                .h2w-dots{display:flex;gap:5px;flex:1;justify-content:center;}
                .h2w-dot{width:6px;height:6px;border-radius:50%;background:var(--border,#ddd);transition:background .2s;}
                .h2w-dot.h2w-on{background:#7F77DD;}
                .h2w-snum{font-size:8px;color:var(--text-dim,#888);font-family:'JetBrains Mono',monospace;}
                .h2w-step{display:none;}
                .h2w-step.h2w-on{display:block;}
                .h2brow{display:flex;gap:3px;align-items:flex-end;margin:5px 0;overflow-x:auto;}
                .h2brow-lbl{font-size:9px;color:var(--text-dim,#888);min-width:110px;flex-shrink:0;padding-bottom:2px;}
                .h2byte{display:flex;flex-direction:column;align-items:center;gap:2px;}
                .h2bv{font-size:8.5px;padding:2px 3px;border-radius:3px;border:1px solid var(--border,#ddd);background:var(--bg,#f5f5f5);color:var(--text,#1d1d1d);letter-spacing:.02em;white-space:nowrap;font-family:'JetBrains Mono',monospace;}
                .h2bv.h2m{border-color:#1D9E75;background:rgba(29,158,117,.1);color:#0F6E56;}
                .h2bv.h2e{color:var(--text-dim,#bbb);}
                .h2bv.h2d{opacity:.3;}
                .h2bv.h2hi{border-color:#7F77DD;background:rgba(127,119,221,.1);color:#534AB7;}
                .h2bidx{font-size:7px;color:var(--text-dim,#aaa);}
                .h2op{font-size:9px;color:var(--text-dim,#888);padding:1px 0 1px 114px;}
                .h2op-sym{font-size:11px;color:#7F77DD;font-weight:700;}
                .h2hr{border:0;border-top:1px solid var(--border,#ddd);margin:3px 0 3px 114px;}
                .h2note{font-size:9.5px;color:var(--text-dim,#777);line-height:1.6;margin-top:7px;}
                .h2note b{color:var(--text,#1d1d1d);}
                .h2note .h2ok{color:#0F6E56;font-weight:700;}
                .h2code{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:5px;padding:8px 12px;font-size:9.5px;color:var(--text,#1d1d1d);margin:8px 0;line-height:1.8;font-family:'JetBrains Mono',monospace;}
                .h2cdim{color:var(--text-dim,#aaa);}
                .h2cpu{color:#534AB7;}
                .h2cgr{color:#0F6E56;}
                .h2var-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0;}
                .h2vcard{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px;padding:10px 12px;}
                .h2vcard.h2vf{border-color:#7F77DD;}
                .h2vtag{font-size:8px;padding:1px 7px;border-radius:20px;margin-bottom:6px;display:inline-block;}
                .h2vtag.h2vs{background:rgba(127,119,221,.12);color:#3C3489;}
                .h2vtag.h2vb{background:var(--bg,#f5f5f5);border:1px solid var(--border,#ddd);color:var(--text-dim,#888);}
                .h2vtitle{font-size:10px;font-weight:700;color:var(--text,#1d1d1d);margin-bottom:3px;}
                .h2vdesc{font-size:9px;color:var(--text-dim,#888);line-height:1.6;}
                .h2vstep-note{font-size:9px;color:var(--text-dim,#888);margin-top:8px;border-top:1px solid var(--border,#ddd);padding-top:6px;line-height:1.5;}
                .h2ext-row{display:flex;align-items:center;gap:7px;margin:5px 0;font-size:9.5px;}
                .h2ext-eq{color:var(--text-dim,#bbb);}
                .h2ext-val{color:#534AB7;font-family:'JetBrains Mono',monospace;}
                .h2ext-res{color:#0F6E56;font-family:'JetBrains Mono',monospace;font-weight:700;}
                .h2ext-lbl{color:var(--text-dim,#888);}
                .h2iter{background:var(--bg,#f5f5f5);border:1px solid var(--border,#ddd);border-radius:5px;padding:7px 10px;margin-top:8px;font-size:9.5px;line-height:1.8;color:var(--text-dim,#777);}
                .h2iter b{color:var(--text,#1d1d1d);}
              </style>
              <div class="impl-sec">
                <div class="impl-sec-hdr">Поиск h2 внутри группы — ctrlGroupMatchH2</div>
                <div class="impl-sec-body">
                <p class="tight" style="font-size:10.5px;line-height:1.6;color:var(--text,#1d1d1d);margin:0 0 12px;">
                  Это <b>самая горячая операция</b> в map: при каждом <code style="font-size:10px;">m[key]</code> нужно найти, в каком из 8 слотов группы лежит нужный ключ.
                  Наивный подход — 8 сравнений подряд. Go делает это <b>за 1 инструкцию</b> на ARM/x86 с SIMD,
                  или через <b>битовые трюки</b> на остальных архитектурах — сравнивая все 8 control bytes одновременно как один <code style="font-size:10px;">uint64</code>.
                  Именно здесь Swiss Table выигрывает у классического hashmap.
                </p>
                <div class="h2w-nav">
                  <button class="h2w-btn" id="h2Prev" onclick="(function(){var w=document.getElementById('h2mW');var s=parseInt(w.getAttribute('data-step')||'0');s=Math.max(0,s-1);w.setAttribute('data-step',s);document.getElementById('h2Prev').disabled=s<=0;document.getElementById('h2Next').disabled=false;document.getElementById('h2Next').textContent=s>=4?'готово ✓':'далее →';document.getElementById('h2Snum').textContent=s+' / 4';document.querySelectorAll('.h2w-dot').forEach(function(d,i){d.className='h2w-dot'+(i===s?' h2w-on':'');});document.querySelectorAll('.h2w-step').forEach(function(d,i){d.className='h2w-step'+(i===s?' h2w-on':'');});})()">← назад</button>
                  <div class="h2w-dots" id="h2Dots">
                    <div class="h2w-dot h2w-on"></div>
                    <div class="h2w-dot"></div>
                    <div class="h2w-dot"></div>
                    <div class="h2w-dot"></div>
                    <div class="h2w-dot"></div>
                  </div>
                  <span class="h2w-snum" id="h2Snum">0 / 4</span>
                  <button class="h2w-btn h2w-primary" id="h2Next" onclick="(function(){var w=document.getElementById('h2mW');var s=parseInt(w.getAttribute('data-step')||'0');s=Math.min(4,s+1);w.setAttribute('data-step',s);document.getElementById('h2Prev').disabled=false;document.getElementById('h2Next').disabled=s>=4;document.getElementById('h2Next').textContent=s>=4?'готово ✓':'далее →';document.getElementById('h2Snum').textContent=s+' / 4';document.querySelectorAll('.h2w-dot').forEach(function(d,i){d.className='h2w-dot'+(i===s?' h2w-on':'');});document.querySelectorAll('.h2w-step').forEach(function(d,i){d.className='h2w-step'+(i===s?' h2w-on':'');});})()">далее →</button>
                </div>
                <div id="h2mW" data-step="0" style="background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px;padding:12px 14px;min-height:180px;">

                  <div class="h2w-step h2w-on">
                    <div class="h2var-grid">
                      <div class="h2vcard h2vf">
                        <span class="h2vtag h2vs">Вариант 1 — SIMD</span>
                        <div class="h2vtitle">Одна инструкция, 8 байт</div>
                        <div class="h2code"><span class="h2cdim">// AVX2 (x86)</span>
_mm256_cmpeq_epi8(vctrls, vq)
<span class="h2cdim">// ARM NEON</span>
vceqq_u8(vctrls, vq)</div>
                        <div class="h2vdesc">CPU сравнивает все 8 CW-байт одновременно за ~1 такт. x86 AVX2, ARM NEON.</div>
                      </div>
                      <div class="h2vcard">
                        <span class="h2vtag h2vb">Вариант 2 — bit tricks</span>
                        <div class="h2vtitle">Чистая битовая арифметика</div>
                        <div class="h2code"><span class="h2cpu">v</span> := uint64(g) ^
  (bitsetLSB * uint64(h))
<span class="h2cgr">return</span> bitset(
  ((v - bitsetLSB) &amp;^ v)
  &amp; bitsetMSB)</div>
                        <div class="h2vdesc">Generic fallback — работает на любом 64-битном CPU без SIMD. ~5 операций.</div>
                      </div>
                    </div>
                    <div class="h2vstep-note">Go 1.24 выбирает вариант при компиляции. Шаги 1–4 — разбор варианта 2 пошагово.</div>
                  </div>

                  <div class="h2w-step">
                    <div class="h2note" style="margin-bottom:8px;">Группа: 4 занятых слота + 4 пустых. Ищем h2 = <b>1111111</b> (0x7F).</div>
                    <div class="h2brow">
                      <div class="h2brow-lbl">g (CW-байты):</div>
                      <div class="h2byte"><div class="h2bv h2m">01111111</div><div class="h2bidx">CW[0]</div></div>
                      <div class="h2byte"><div class="h2bv">01100110</div><div class="h2bidx">CW[1]</div></div>
                      <div class="h2byte"><div class="h2bv">00101101</div><div class="h2bidx">CW[2]</div></div>
                      <div class="h2byte"><div class="h2bv">00011110</div><div class="h2bidx">CW[3]</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div><div class="h2bidx">CW[4]</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div><div class="h2bidx">CW[5]</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div><div class="h2bidx">CW[6]</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div><div class="h2bidx">CW[7]</div></div>
                    </div>
                    <div class="h2note"><b>CW[0] = 01111111</b> — флаг=0 (занято), h2=1111111. Потенциальный матч.<br>CW[4..7] = 10000000 — пустые слоты.<br>Ищем: <span style="font-family:'JetBrains Mono',monospace;color:#534AB7;">01111111</span></div>
                  </div>

                  <div class="h2w-step">
                    <div class="h2note" style="margin-bottom:6px;"><b>v = g ^ (bitsetLSB × h)</b> — broadcast h2 во все 8 байт, XOR с g. Нулевой байт = совпадение.</div>
                    <div class="h2brow">
                      <div class="h2brow-lbl">g:</div>
                      <div class="h2byte"><div class="h2bv h2m">01111111</div></div>
                      <div class="h2byte"><div class="h2bv">01100110</div></div>
                      <div class="h2byte"><div class="h2bv">00101101</div></div>
                      <div class="h2byte"><div class="h2bv">00011110</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div></div>
                      <div class="h2byte"><div class="h2bv h2e">10000000</div></div>
                    </div>
                    <div class="h2op"><span class="h2op-sym">^</span> broadcast (bitsetLSB×h):</div>
                    <div class="h2brow">
                      <div class="h2brow-lbl"></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                      <div class="h2byte"><div class="h2bv h2hi">01111111</div></div>
                    </div>
                    <div class="h2hr"></div>
                    <div class="h2brow">
                      <div class="h2brow-lbl">v:</div>
                      <div class="h2byte"><div class="h2bv h2m">00000000</div></div>
                      <div class="h2byte"><div class="h2bv">00011001</div></div>
                      <div class="h2byte"><div class="h2bv">01010010</div></div>
                      <div class="h2byte"><div class="h2bv">01100001</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                    </div>
                    <div class="h2note"><span class="h2ok">00000000</span> — CW[0] совпал с h2. Остальные ненулевые → нет матча.</div>
                  </div>

                  <div class="h2w-step">
                    <div class="h2note" style="margin-bottom:6px;"><b>(v − bitsetLSB) &amp;^ v &amp; bitsetMSB</b> — нулевые байты превращаются в 10000000.</div>
                    <div class="h2brow">
                      <div class="h2brow-lbl">v:</div>
                      <div class="h2byte"><div class="h2bv h2m">00000000</div></div>
                      <div class="h2byte"><div class="h2bv">00011001</div></div>
                      <div class="h2byte"><div class="h2bv">01010010</div></div>
                      <div class="h2byte"><div class="h2bv">01100001</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                      <div class="h2byte"><div class="h2bv h2d">11111111</div></div>
                    </div>
                    <div class="h2op"><span class="h2op-sym">−</span> bitsetLSB, <span class="h2op-sym">&amp;^</span> v, <span class="h2op-sym">&amp;</span> bitsetMSB:</div>
                    <div class="h2hr"></div>
                    <div class="h2brow">
                      <div class="h2brow-lbl">bitset:</div>
                      <div class="h2byte"><div class="h2bv h2m">10000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                    </div>
                    <div class="h2note"><span class="h2ok">10000000</span> в байте CW[0] — матч на слоте 0. Пустые байты (0xFF) фильтруются &amp;^v. Один бит на каждый совпавший слот.</div>
                  </div>

                  <div class="h2w-step">
                    <div class="h2note" style="margin-bottom:8px;"><b>Извлекаем индекс слота, итерируем.</b></div>
                    <div class="h2brow">
                      <div class="h2brow-lbl">bitset:</div>
                      <div class="h2byte"><div class="h2bv h2m">10000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                      <div class="h2byte"><div class="h2bv h2d">00000000</div></div>
                    </div>
                    <div class="h2ext-row" style="margin-top:8px;">
                      <span class="h2ext-lbl">TrailingZeros64(bitset)</span>
                      <span class="h2ext-eq">=</span>
                      <span class="h2ext-val">7</span>
                    </div>
                    <div class="h2ext-row">
                      <span class="h2ext-lbl">slot = 7 >> 3</span>
                      <span class="h2ext-eq">=</span>
                      <span class="h2ext-res">0</span>
                      <span class="h2ext-lbl">→ сравниваем ключ слота 0</span>
                    </div>
                    <div class="h2iter">
                      <b>Если ключ совпал</b> → нашли значение.<br>
                      <b>Итерация:</b> <span style="font-family:'JetBrains Mono',monospace;">match &amp;= match - 1</span> — сбрасываем младший бит → следующий матч.<br>
                      <b>Ложные срабатывания</b> редки (только при h2 = 2ⁿ), корректности не нарушают — key comparison отсеивает.
                    </div>
                  </div>

                </div>
              </div>
                </div><!-- /impl-sec-body -->
              </div><!-- /impl-sec: h2 lookup -->
              <!-- /H2 LOOKUP ALGORITHM SECTION -->

              <div class="impl-sources">Источники: src/internal/runtime/maps/map.go · src/internal/runtime/maps/table.go · go.dev/doc/go1.24 · abseil.io/about/design/swisstables</div>
            </div>
          </details>

        `
      },

  // ---------- "struct" entry ----------
      struct: {
        title: 'struct — под капотом',
        html: `
          <p class="tight">Struct — это <b>набор именованных полей, уложенных в памяти подряд</b> с учётом выравнивания. Компилятор может вставлять <b>padding</b> (байты-заглушки) между полями, чтобы каждое поле начиналось по адресу, кратному его размеру.</p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">src/internal/abi/type.go</span></div>
            <pre><code class="language-go">type StructType struct {
    Type            // общие метаданные (размер, выравнивание)
    PkgPath Name    // пакет, где объявлен тип
    Fields  []StructField
}

type StructField struct {
    Name   Name    // имя поля
    Typ    *Type   // тип поля
    Offset uintptr // байтовое смещение от начала структуры
}</code></pre>
          </div>

          <p class="tight"><b>Пример с padding:</b></p>

          <div class="codeblock">
            <div class="tab"><div class="dots"><span></span><span></span><span></span></div><span class="fname">padding.go</span></div>
            <pre><code class="language-go">// Плохой порядок — 24 байта из-за padding
type Bad struct {
    a bool   // 1 байт + 7 байт padding
    b int64  // 8 байт
    c bool   // 1 байт + 7 байт padding
} // итого: 24 байта

// Хороший порядок — 16 байт
type Good struct {
    b int64  // 8 байт
    a bool   // 1 байт
    c bool   // 1 байт + 6 байт padding до кратного 8
} // итого: 16 байт</code></pre>
          </div>

          <p class="tight">Поля нужно <b>сортировать от большего к меньшему</b> чтобы минимизировать padding и размер структуры.</p>

          <div class="callout interview">
            <div class="mark">собес</div>
            <p><code class="inline">struct{}</code> — пустая структура занимает <b>0 байт</b>. Это единственный тип в Go с нулевым размером. Используется как значение в <code class="inline">map[T]struct{}</code> (множество без лишней памяти) и как тип канала-сигнала <code class="inline">chan struct{}</code> (только факт события, без данных).</p>
          </div>

          <div class="impl-sources">Источники: github.com/golang/go (src/internal/abi/type.go) · go.dev/ref/spec#Struct_types · go.dev/ref/spec#Size_and_alignment_guarantees · pkg.go.dev/unsafe#Sizeof</div>
        `
      },

    };

    var TIP_DATA = {
      sliceType: `<b>Slice *Type — пример</b><br><br>Когда пишешь <code>s := a[:]</code>, компилятор не строит новый тип <code>[]int32</code> с нуля — он берёт его прямо из поля <code>Slice</code> структуры <code>ArrayType</code>:<br><br><pre style="font-size:11px;line-height:1.6;margin:6px 0">a := [3]int32{1, 2, 3}  // тип: [3]int32
s := a[:]               // тип: []int32
//  ↑ компилятор берёт []int32
//    из ArrayType.Slice — уже готов</pre>Без этого поля пришлось бы каждый раз заново создавать описание слайс-типа в рантайме. <code>Slice *Type</code> — это кеш на уровне типа.<br><br><a href="https://github.com/golang/go/blob/master/src/internal/abi/type.go" target="_blank" style="color:var(--accent)">→ src/internal/abi/type.go на GitHub</a>`,
      descriptor: `<b>Дескриптор типа (Type descriptor)</b> — структура в памяти, которую компилятор создаёт для каждого типа один раз. Хранит всё что нужно рантайму чтобы работать с данными этого типа не зная его статически.<br><br><pre style="font-size:11px;line-height:1.6;margin:6px 0">// src/internal/abi/type.go
type Type struct {
    Size_       uintptr  // сколько байт занимает значение
    PtrBytes    uintptr  // сколько байт содержат указатели (для GC)
    Hash_       uint32   // хеш типа (для быстрого сравнения типов)
    Tflag       Tflag    // флаги: есть ли методы, comparable и т.д.
    Align_      uint8    // выравнивание значения
    FieldAlign_ uint8    // выравнивание в структуре
    Kind_       uint8    // вид типа: int, slice, map, struct…
    Equal  func(unsafe.Pointer, unsafe.Pointer) bool // ==
    GCData *byte        // битовая маска указателей для GC
    Str_   NameOff      // имя типа ("int", "[]string"…)
    PtrToThis TypeOff   // *T для этого типа
}</pre>Все конкретные типы (MapType, SliceType, ArrayType…) <b>встраивают</b> Type и добавляют свои поля. Рантайм всегда начинает с общего Type, а потом кастует к нужному через <code>unsafe.Pointer</code>.<br><br><a href="https://github.com/golang/go/blob/go1.23.0/src/internal/abi/type.go" target="_blank" style="color:var(--accent)">→ src/internal/abi/type.go на GitHub</a>`,
      alignment: `<b>Выравнивание (alignment)</b> — правило: данные должны начинаться по адресу, кратному их размеру. <code>int32</code> (4 байта) — только по адресам 0, 4, 8, 12…<br><br><b>Что будет если нет:</b><br><br><b>x86</b> — читает в два приёма:<pre style="font-size:11px;line-height:1.6;margin:6px 0;overflow-x:auto">адреса: 0    4    8
память: [....][..XX|XX..][....]
                ↑↑↑↑
         int32 разбит на два слова
→ два чтения вместо одного</pre><b>ARM</b> — падает с <code>SIGBUS</code>: шина просто не умеет читать невыровненный адрес.<br><br>Компилятор вставляет байты-заглушки (padding) чтобы это никогда не случилось.`,
    };

    window.showTip = function(event, key) {
      var html = TIP_DATA[key] || key;
      var pop = document.getElementById('tipPopover');
      document.getElementById('tipText').innerHTML = html;
      pop.style.display = 'block';
      var rect = event.target.getBoundingClientRect();
      var left = rect.left;
      var top = rect.bottom + 8;
      // не выйти за правый край
      if (left + 316 > window.innerWidth) left = window.innerWidth - 320;
      if (left < 8) left = 8;
      // не выйти за нижний край — показать выше элемента если не влезает снизу
      var popH = Math.min(pop.scrollHeight, window.innerHeight * 0.7);
      if (top + popH > window.innerHeight - 16) {
        top = Math.max(8, rect.top - popH - 8);
      }
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      event.stopPropagation();
    };
    document.addEventListener('click', function() {
      var pop = document.getElementById('tipPopover');
      if (pop) pop.style.display = 'none';
    });

    var overlay = document.getElementById('implOverlay');
    var panel = document.getElementById('implPanel');
    var body = document.getElementById('implBody');
    var titleEl = document.getElementById('implTitle');
    var closeBtn = document.getElementById('implClose');

    if (overlay && panel && body && titleEl && closeBtn) {
      var openImpl = function(key){
        var data = IMPL_DATA[key];
        titleEl.textContent = data ? data.title : (key + ' — скоро');
        body.innerHTML = data ? data.html : '<p class="tight">Разбор этого типа ещё не готов — скоро появится.</p>';
        overlay.classList.add('is-open');
        panel.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        if (window.hljs) { body.querySelectorAll('pre code').forEach(function(el){ hljs.highlightElement(el); }); }
        closeBtn.focus();
      };
      var closeImpl = function(){
        overlay.classList.remove('is-open');
        panel.classList.remove('is-open');
        document.body.style.overflow = '';
      };
      window.openImpl = openImpl;
      closeBtn.addEventListener('click', closeImpl);
      overlay.addEventListener('click', closeImpl);
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeImpl(); });
    }
  })();
