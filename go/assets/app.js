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
                • <b>Directory</b>: размер всегда <code class="inline">1 &lt;&lt; globalDepth</code> — степень двойки, удваивается при каждом росте. Маленькая map (≤8 ключей) вообще не создаёт directory: всё помещается в один inline-group.<br>
                • <b>Load factor</b>: <code class="inline">maxAvgGroupLoad = 7</code> из 8 слотов → 87.5%. Когда заполненность группы превышает 7 занятых слотов, таблица растёт.
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

              <div class="impl-sources">Источники: src/internal/runtime/maps/map.go · src/internal/runtime/maps/table.go · go.dev/doc/go1.24 · abseil.io/about/design/swisstables</div>
            </div>
          </details>

          <p class="tight" style="margin-top:8px"><b>map нельзя сравнить через ==</b> — только с <code class="inline">nil</code>. <b>Не потокобезопасна</b> — конкурентные чтение+запись вызовут панику; нужен <code class="inline">sync.Map</code> или мьютекс.</p>
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
