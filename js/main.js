/* Rare Tech — landing page
   Lenis + GSAP/ScrollTrigger: preloader, cursor, scramble, revelação
   por linha, scroll horizontal com pin, HUD. Degrada sem JS. */

(function () {
  'use strict';

  /* ==========================================================
     0. AMBIENTE
     ========================================================== */
  var HAS_GSAP    = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  var REDUCED     = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE_HOVER  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var ANIMATE     = HAS_GSAP && !REDUCED;

  var preloader = document.getElementById('preloader');

  if (!ANIMATE) {
    if (preloader) preloader.remove();
  }
  if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

  /* ==========================================================
     1. LENIS — scroll suave sincronizado com o ScrollTrigger
     ========================================================== */
  var lenis = null;
  if (ANIMATE && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    document.documentElement.style.scrollBehavior = REDUCED ? 'auto' : 'smooth';
  }

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    else {
      var top = target.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' });
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMobileMenu();
      scrollToTarget(target);
    });
  });

  /* ==========================================================
     2. SCRAMBLE — anagrama do próprio texto, travando da
        esquerda para a direita (~1 caractere por quadro)
        ========================================================== */
  function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.random() * (i + 1) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function scramble(el, lockStart, force) {
    if (REDUCED) return;
    if (el.dataset.running) {
      /* já rodando: só reinicia se o texto-alvo mudou (ex.: seção do HUD) */
      if (!force) return;
      clearInterval(el._scrambleId);
      delete el.dataset.running;
    }
    el.style.width = '';
    el.style.height = '';

    var final = el.dataset.text || (el.dataset.text = el.textContent);
    if (final.length < 2) return;
    lockStart = lockStart || 0;
    el.dataset.running = '1';

    /* trava a caixa: com fonte proporcional o anagrama muda a largura a cada
       quadro e o elemento treme */
    var lockW = el.offsetWidth, lockH = el.offsetHeight;
    if (lockW) { el.style.width = lockW + 'px'; el.style.height = lockH + 'px'; }

    var pool = final.slice(lockStart).replace(/\s/g, '').split('');
    var locked = lockStart;

    var id = el._scrambleId = setInterval(function () {
      var rest = shuffleArr(pool.slice());
      var k = 0;
      el.textContent = final.split('').map(function (c, i) {
        if (c === ' ') return ' ';
        if (i < locked) return final[i];
        return rest[k++] || c;
      }).join('');

      if (++locked > final.length) {
        clearInterval(id);
        el.textContent = final;               // data-text é a fonte da verdade
        el.style.width = '';
        el.style.height = '';
        delete el.dataset.running;
      }
    }, 35);
  }

  if (FINE_HOVER && !REDUCED) {
    document.querySelectorAll('[data-scramble]').forEach(function (el) {
      el.dataset.text = el.textContent;
      var lock = parseInt(el.getAttribute('data-scramble-lock') || '0', 10);
      var trigger = el.closest('summary') || el;
      trigger.addEventListener('mouseenter', function () { scramble(el, lock); });
    });
  }

  /* ==========================================================
     3. SPLIT DE LINHAS (nativo, agrupando por posição vertical)
        Preserva os <span class="brace"> das chaves.
        ========================================================== */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tokenize(el) {
    var tokens = [];
    var glue = false;
    function push(html, canGlue) {
      if (canGlue && tokens.length) tokens[tokens.length - 1] += html;
      else tokens.push(html);
    }
    Array.prototype.forEach.call(el.childNodes, function (node) {
      if (node.nodeType === 3) {
        var raw = node.nodeValue;
        raw.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { glue = false; return; }
          push(esc(p), glue);
          glue = true;
        });
        if (/\s$/.test(raw)) glue = false;
      } else if (node.nodeType === 1) {
        /* o elemento (ex.: <span class="brace">) também é dividido em palavras,
           senão trechos coloridos longos nunca quebram de linha */
        var cls = node.getAttribute('class');
        var open = '<span' + (cls ? ' class="' + cls + '"' : '') + '>';
        var txt = node.textContent;
        txt.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { glue = false; return; }
          push(open + esc(p) + '</span>', glue);
          glue = true;
        });
        if (/\s$/.test(txt)) glue = false;
      }
    });
    return tokens;
  }

  function splitLines(el) {
    if (!el.dataset.original) el.dataset.original = el.innerHTML;
    else el.innerHTML = el.dataset.original;

    var tokens = tokenize(el);
    if (!tokens.length) return [];

    el.innerHTML = tokens.map(function (t) { return '<span class="w">' + t + '</span>'; }).join(' ');

    var words = Array.prototype.slice.call(el.querySelectorAll(':scope > .w'));
    var lines = [];
    var currentTop = null;

    words.forEach(function (w, i) {
      var top = Math.round(w.offsetTop);
      if (currentTop === null || Math.abs(top - currentTop) > 2) { lines.push([]); currentTop = top; }
      lines[lines.length - 1].push(tokens[i]);
    });

    el.innerHTML = lines.map(function (l) {
      return '<div class="line-mask"><span class="split-line">' + l.join(' ') + '</span></div>';
    }).join('');

    return Array.prototype.slice.call(el.querySelectorAll('.split-line'));
  }

  /* ==========================================================
     4. REVELAÇÃO POR LINHA + entrada de parágrafos
        (o estado escondido só é aplicado depois que o JS confirma
        que vai animar — sem JS, tudo fica visível)
        ========================================================== */
  var SHORT = function () { return window.innerWidth < 768 ? .7 : 1; };
  var splitTargets = Array.prototype.slice.call(document.querySelectorAll('[data-split]'));
  var revealTriggers = [];
  var heroPlayed = false;

  function buildReveals() {
    revealTriggers.forEach(function (t) { t.kill(); });
    revealTriggers = [];

    splitTargets.forEach(function (el) {
      var inHero = !!el.closest('.hero');
      var s2      = el.closest('.s2-viewport') ? el.closest('.s2') : null;
      var lines  = splitLines(el);
      if (!lines.length) return;

      var done = (inHero && heroPlayed) || el.dataset.revealed === '1';
      gsap.set(lines, { yPercent: done ? 0 : 110 });

      if (inHero || done) return;       // o hero tem a própria timeline

      revealTriggers.push(ScrollTrigger.create({
        trigger: s2 || el,              // painel pinado: gatilho na seção
        start: 'top 80%',
        once: true,
        onEnter: function () {
          el.dataset.revealed = '1';
          gsap.to(lines, { yPercent: 0, duration: .9 * SHORT(), ease: 'power3.out', stagger: .09 * SHORT() });
        }
      }));
    });

    document.querySelectorAll('[data-reveal-item]').forEach(function (el) {
      if (el.closest('.hero')) return;
      if (el.dataset.revealed === '1') { gsap.set(el, { opacity: 1, y: 0 }); return; }
      gsap.set(el, { opacity: 0, y: 24 });
      revealTriggers.push(ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          el.dataset.revealed = '1';
          gsap.to(el, { opacity: 1, y: 0, duration: .8 * SHORT(), ease: 'power3.out', delay: .15 });
        }
      }));
    });

    document.querySelectorAll('[data-scramble-once]').forEach(function (el) {
      if (el.closest('.s2-viewport')) return;
      el.dataset.text = el.textContent;
      var lock = parseInt(el.getAttribute('data-scramble-lock') || '0', 10);
      revealTriggers.push(ScrollTrigger.create({
        trigger: el, start: 'top 85%', once: true,
        onEnter: function () { scramble(el, lock); }
      }));
    });
  }

  /* ==========================================================
     5. HERO — entrada cinematográfica + globo pixelado
        ========================================================== */
  var GLOBE_COLS = 14, GLOBE_ROWS = 14;
  var maskCells = [];

  function buildGlobeMask() {
    var mask = document.getElementById('artMask');
    if (!mask) return;
    mask.style.gridTemplateColumns = 'repeat(' + GLOBE_COLS + ',1fr)';
    mask.style.gridTemplateRows = 'repeat(' + GLOBE_ROWS + ',1fr)';
    var html = '';
    for (var i = 0; i < GLOBE_COLS * GLOBE_ROWS; i++) html += '<i></i>';
    mask.innerHTML = html;
    maskCells = Array.prototype.slice.call(mask.children);
  }

  function heroItems() {
    return [
      document.querySelector('.hero .eyebrow'),
      document.querySelector('.hero .lead'),
      document.querySelector('.hero-actions')
    ].filter(Boolean);
  }

  /* estado escondido aplicado logo no init, antes do preloader sair */
  function armHero() {
    gsap.set(heroItems(), { opacity: 0, y: 24 });
    if (maskCells.length) gsap.set(maskCells, { opacity: 1 });
  }

  function heroIntro() {
    heroPlayed = true;
    var eyebrow = document.querySelector('.hero .eyebrow');
    var h1Lines = document.querySelectorAll('.hero h1 .split-line');
    var lead    = document.querySelector('.hero .lead');
    var actions = document.querySelector('.hero-actions');

    var tl = gsap.timeline({ delay: .05 });

    if (maskCells.length) {
      tl.to(maskCells, {
        opacity: 0, duration: .5, ease: 'power2.out',
        stagger: { amount: 1.2, from: 'center', grid: [GLOBE_ROWS, GLOBE_COLS] }
      }, 0);
      tl.add(startGlobeIdle, '>-0.2');
    }

    tl.to(eyebrow, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, .1);
    if (h1Lines.length) tl.to(h1Lines, { yPercent: 0, duration: .9, ease: 'power3.out', stagger: .09 }, '<0.12');
    tl.to(lead,    { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, '<0.12');
    tl.to(actions, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, '<0.12');
  }

  /* idle: o globo "respira" — sinal vivo, sem pisca-pisca */
  function startGlobeIdle() {
    var globe = document.getElementById('heroGlobe');
    if (!globe) return;
    gsap.to(globe, {
      opacity: .86,
      duration: 2.6,
      repeat: -1, yoyo: true, ease: 'sine.inOut'
    });
  }

  /* parallax leve do globo seguindo o mouse (máx. 12px) */
  function globeParallax() {
    var art = document.querySelector('.hero-art');
    if (!art || !FINE_HOVER) return;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', function (e) {
      tx = ((e.clientX / window.innerWidth) - .5) * 24;
      ty = ((e.clientY / window.innerHeight) - .5) * 24;
    });
    gsap.ticker.add(function () {
      cx += (tx - cx) * .06;
      cy += (ty - cy) * .06;
      gsap.set(art, { x: cx, y: cy });
    });
  }

  /* ==========================================================
     6. CARDS — sequência fixada no scroll
        ========================================================== */
  function buildCardsSequence(mm) {
    var section = document.querySelector('.generic');
    if (!section) return;
    var cards = Array.prototype.slice.call(section.querySelectorAll('.card'));
    if (!cards.length) return;

    /* >= 768px: os cards acompanham o scroll (scrub) e os degraus da
       sombra se abrem conforme o card entra */
    mm.add('(min-width: 768px)', function () {
      cards.forEach(function (card) {
        var right = card.classList.contains('card--right');
        var s1 = card.querySelector('.card-step--1');
        var s2 = card.querySelector('.card-step--2');

        gsap.set(card, { opacity: 0, x: right ? 60 : -60 });
        gsap.set([s1, s2], { x: 0, y: 0 });

        gsap.timeline({
          scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 55%', scrub: 0.8 }
        })
        .to(card, { opacity: 1, x: 0, ease: 'none' }, 0)
        .to(s1, { x: -8,  y: 8,  ease: 'none' }, 0)
        .to(s2, { x: -16, y: 16, ease: 'none' }, 0);
      });

      return function () {
        gsap.set(cards, { clearProps: 'opacity,transform' });
        cards.forEach(function (card) {
          gsap.set(card.querySelectorAll('.card-step'), { clearProps: 'transform' });
        });
      };
    });

    /* < 768px: sem scrub — slide curto, uma vez, 30% mais rápido */
    mm.add('(max-width: 767px)', function () {
      cards.forEach(function (card) {
        var s1 = card.querySelector('.card-step--1');
        var s2 = card.querySelector('.card-step--2');
        gsap.set(card, { opacity: 0, y: 24 });
        gsap.set([s1, s2], { x: 0, y: 0 });

        ScrollTrigger.create({
          trigger: card, start: 'top 88%', once: true,
          onEnter: function () {
            gsap.to(card, { opacity: 1, y: 0, duration: .56, ease: 'power3.out' });
            gsap.to(s1, { x: -6,  y: 6,  duration: .56, ease: 'power3.out' });
            gsap.to(s2, { x: -12, y: 12, duration: .56, ease: 'power3.out' });
          }
        });
      });

      return function () {
        gsap.set(cards, { clearProps: 'opacity,transform' });
        cards.forEach(function (card) {
          gsap.set(card.querySelectorAll('.card-step'), { clearProps: 'transform' });
        });
      };
    });

    /* hover: card e degraus se afastam mais 4px */
    if (FINE_HOVER) {
      cards.forEach(function (card) {
        var s1 = card.querySelector('.card-step--1');
        var s2 = card.querySelector('.card-step--2');
        card.addEventListener('mouseenter', function () {
          gsap.to(s1, { x: -12, y: 12, duration: .24, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(s2, { x: -20, y: 20, duration: .24, ease: 'power3.out', overwrite: 'auto' });
        });
        card.addEventListener('mouseleave', function () {
          gsap.to(s1, { x: -8,  y: 8,  duration: .24, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(s2, { x: -16, y: 16, duration: .24, ease: 'power3.out', overwrite: 'auto' });
        });
      });
    }
  }

  /* ==========================================================
     7. SECTION 02 — pin + scroll horizontal
        ========================================================== */
  function buildSection02(mm) {
    mm.add('(min-width: 1025px)', function () {
      var track   = document.getElementById('s2Track');
      var section = document.querySelector('.s2');
      var bar     = document.getElementById('s2ProgressBar');
      var wrapBar = document.getElementById('s2Progress');
      var counter = document.getElementById('s2Counter');
      if (!track || !section) return;

      section.classList.add('is-pinned');   // desliga o scroll horizontal nativo
      var distance = function () { return track.scrollWidth - window.innerWidth; };

      var tween = gsap.to(track, {
        x: function () { return -distance(); },
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: function () { return '+=' + distance(); },
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onToggle: function (self) {
            wrapBar.classList.toggle('is-live', self.isActive);
            counter.classList.toggle('is-live', self.isActive);
          },
          onUpdate: function (self) {
            bar.style.width = (self.progress * 100).toFixed(2) + '%';
            var idx = Math.min(4, Math.max(1, Math.ceil(self.progress * 4) || 1));
            var label = ('0' + idx) + ' / 04';
            if (counter.textContent !== label) counter.textContent = label;
          }
        }
      });

      /* painéis entram conforme cruzam a viewport horizontalmente */
      gsap.utils.toArray('.s2-intro, .s2-col').forEach(function (panel) {
        gsap.from(panel, {
          opacity: 0, x: 60, duration: .8, ease: 'power3.out',
          scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 85%', once: true }
        });
      });

      /* divisórias crescem de scaleY 0 → 1, com origem no topo */
      track.classList.add('dividers-armed');
      gsap.utils.toArray('.s2-viewport .s2-col:not(:first-child)').forEach(function (col) {
        ScrollTrigger.create({
          trigger: col, containerAnimation: tween, start: 'left 92%', once: true,
          onEnter: function () { col.classList.add('divider-in'); }
        });
      });

      /* títulos das colunas embaralham uma vez ao entrar */
      gsap.utils.toArray('.s2-viewport [data-scramble-once]').forEach(function (el) {
        el.dataset.text = el.textContent;
        ScrollTrigger.create({
          trigger: el, containerAnimation: tween, start: 'left 88%', once: true,
          onEnter: function () { scramble(el, 0); }
        });
      });

      return function () {
        section.classList.remove('is-pinned');
        wrapBar.classList.remove('is-live');
        counter.classList.remove('is-live');
        track.classList.remove('dividers-armed');
        gsap.set(track, { clearProps: 'transform' });
      };
    });
  }

  /* ==========================================================
     8. FUNDO BINÁRIO + WORDMARK HORIZONTAL
        ========================================================== */
  function buildBinaryBg() {
    var bg = document.getElementById('binaryBg');
    if (!bg) return;
    var rows = 26, cols = 90, html = '';
    for (var r = 0; r < rows; r++) {
      var s = '';
      for (var c = 0; c < cols; c++) s += (Math.random() < .5 ? '0' : '1') + ((c % 8 === 7) ? ' ' : '');
      html += '<div>' + s + '</div>';
    }
    bg.innerHTML = html;
  }

  function buildParallax() {
    var bg = document.getElementById('binaryBg');
    if (bg) {
      gsap.to(bg, {
        yPercent: 12, ease: 'none',
        scrollTrigger: { trigger: '.binary', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
  }

  /* ==========================================================
     9. CURSOR CUSTOMIZADO
        ========================================================== */
  function buildCursor() {
    if (!FINE_HOVER || REDUCED) return;
    var wrap  = document.getElementById('cursor');
    var dot   = document.getElementById('cursorDot');
    var ring  = document.getElementById('cursorRing');
    var label = document.getElementById('cursorLabel');
    if (!wrap) return;

    document.documentElement.style.cursor = 'none';

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;
    var shown = false;

    window.addEventListener('mousemove', function (e) {
      if (!shown) { shown = true; wrap.style.display = 'block'; }
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    });

    function loop() {
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    }
    loop();

    var HOVERABLE = 'a, button, summary, .card, .faq-item';
    document.querySelectorAll(HOVERABLE).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        wrap.classList.add('is-hover');
        var txt = el.getAttribute('data-cursor');
        if (txt) { label.textContent = txt; wrap.classList.add('is-label'); }
      });
      el.addEventListener('mouseleave', function () {
        wrap.classList.remove('is-hover', 'is-label');
        label.textContent = '';
      });
    });
  }

  /* ==========================================================
     10. HEADER — encolhe, borra e some ao descer
         ========================================================== */
  function buildHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    var last = 0;
    function onScroll() {
      var y = window.pageYOffset;
      header.classList.toggle('is-stuck', y > 80);
      if (y > 200 && y > last + 4) header.classList.add('is-hidden');
      else if (y < last - 4 || y < 200) header.classList.remove('is-hidden');
      last = y;
    }
    if (lenis) lenis.on('scroll', onScroll);
    else window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  var mobileMenu = document.getElementById('mobileMenu');
  var burger = document.getElementById('burger');
  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
  }
  if (mobileMenu) {
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMobileMenu();
    });
  }
  if (burger) {
    burger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMobileMenu();
  });

  /* ==========================================================
     11. FAQ — abertura com altura animada
         (sem JS, o <details> nativo continua funcionando)
         ========================================================== */
  function buildFaq() {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var summary = item.querySelector('summary');
      var panel   = item.querySelector('.faq-a');
      if (!summary || !panel) return;

      summary.addEventListener('click', function (e) {
        if (!ANIMATE) return;                       // deixa o comportamento nativo
        e.preventDefault();
        if (item.dataset.busy) return;
        item.dataset.busy = '1';

        if (item.open) {
          gsap.to(panel, {
            height: 0, duration: .4, ease: 'power3.inOut',
            onComplete: function () {
              item.open = false;
              gsap.set(panel, { height: 'auto' });
              delete item.dataset.busy;
              ScrollTrigger.refresh();
            }
          });
        } else {
          item.open = true;
          gsap.fromTo(panel, { height: 0 }, {
            height: 'auto', duration: .5, ease: 'power3.out',
            onComplete: function () {
              delete item.dataset.busy;
              ScrollTrigger.refresh();
            }
          });
        }
      });
    });
  }

  /* ==========================================================
     12. HUD DE SCROLL — progresso em binário + seção atual
         ========================================================== */
  /* seção sob o meio da viewport — hit-test imune ao pin da section 02 */
  var hudZones = [];
  function currentZone() {
    var mid = window.innerHeight / 2, found = null;
    hudZones.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) found = el;
    });
    return found;
  }

  /* header transparente: o logo troca de cor conforme a seção por baixo.
     roda sempre, inclusive sem GSAP e com reduced motion */
  function buildThemeWatch() {
    hudZones = Array.prototype.slice.call(document.querySelectorAll('[data-hud]'));
    function sync() {
      var z = currentZone();
      if (!z) return;
      document.body.classList.toggle('on-light', z.getAttribute('data-theme') === 'light');
    }
    if (lenis) lenis.on('scroll', sync);
    else window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  function buildHud() {
    var hud     = document.getElementById('hud');
    var bits    = document.getElementById('hudBits');
    var section = document.getElementById('hudSection');
    if (!hud) return;

    var currentName = null;

    function syncSection() {
      var found = currentZone();
      if (!found) return;
      var name  = found.getAttribute('data-hud');
      hud.classList.toggle('is-light', found.getAttribute('data-theme') === 'light');
      if (name !== currentName) {
        currentName = name;
        section.dataset.text = name;
        section.textContent = name;
        scramble(section, 0, true);
      }
    }

    /* o pin da section 02 distorce o progresso de um ScrollTrigger global,
       então o HUD lê o scroll direto */
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var prog = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
      var b = Math.round(prog * 255).toString(2);
      while (b.length < 8) b = '0' + b;
      if (bits.textContent !== b) bits.textContent = b;
      syncSection();
    }

    if (lenis) lenis.on('scroll', update);
    else window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ==========================================================
     13. PRELOADER — grade pixelada, máximo 1.8s, 1x por sessão
         ========================================================== */
  function runPreloader(done) {
    if (!ANIMATE || !preloader) { if (preloader) preloader.remove(); done(); return; }

    var seen = false;
    try { seen = sessionStorage.getItem('rt-preloader') === '1'; } catch (err) { seen = false; }
    if (seen) { preloader.remove(); done(); return; }
    try { sessionStorage.setItem('rt-preloader', '1'); } catch (err) {}

    preloader.style.display = 'flex';

    var grid = document.getElementById('preloaderGrid');
    var cols = Math.ceil(window.innerWidth / 40);
    var rows = Math.ceil(window.innerHeight / 40);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
    grid.style.gridTemplateRows = 'repeat(' + rows + ',1fr)';
    var html = '';
    for (var i = 0; i < cols * rows; i++) html += '<i class="px"></i>';
    grid.innerHTML = html;

    var logo = preloader.querySelector('.preloader-logo');
    var curtain = document.getElementById('preloaderCurtain');
    var bars = curtain.children;

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      preloader.remove();
      done();
    }

    var tl = gsap.timeline({ onComplete: finish });
    gsap.set(logo, { opacity: 0, scale: .92 });
    gsap.set(bars, { yPercent: 0 });

    tl.to('.px', { opacity: 1, duration: .45, stagger: { amount: 1.0, from: 'random' } }, 0)
      .to(logo,  { opacity: 1, scale: 1, duration: .8, ease: 'power3.out' }, .3)
      .to('.px', { opacity: 0, duration: .4, stagger: { amount: .6, from: 'random' } }, 1.7)
      .to(logo,  { opacity: 0, duration: .4, ease: 'power2.in' }, 2.3)
      .to(bars,  { yPercent: -100, duration: .7, ease: 'power3.inOut', stagger: .1 }, 2.5);

    /* rede de segurança: nunca prender o usuário */
    setTimeout(finish, 4200);
  }

  /* ==========================================================
     14. INIT
         ========================================================== */
  function init() {
    buildBinaryBg();
    buildFaq();
    buildHeader();
    buildThemeWatch();

    if (!ANIMATE) return;

    buildGlobeMask();
    buildCursor();
    buildReveals();
    armHero();
    buildParallax();
    buildHud();

    var mm = gsap.matchMedia();
    buildCardsSequence(mm);
    buildSection02(mm);
    ScrollTrigger.refresh();

    runPreloader(function () {
      heroIntro();
      globeParallax();
      ScrollTrigger.refresh();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        buildReveals();
        ScrollTrigger.refresh();
      });
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        buildReveals();
        ScrollTrigger.refresh();
      }, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
