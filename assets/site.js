/* Kyle Zellner site. Everything here degrades: if GSAP is missing the page still
   reveals, plays and navigates, it just loses the pinned scenes. */
(function () {
  var doc = document, root = doc.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desktop = matchMedia('(min-width: 901px)');
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };

  /* ---------- split headlines into lines and letters ---------- */
  $$('.split').forEach(function (el) {
    var lines = el.innerHTML.split(/<br\s*\/?>/i), n = 0;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.innerHTML = lines.map(function (line) {
      var text = line.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      var words = text.split(' ').map(function (word) {
        var chars = word.split('').map(function (c) {
          return '<span class="ch" style="transition-delay:' + (n++ * 28) + 'ms">' + '<span class="g">' + (c === '&' ? '&amp;' : c) + '</span></span>';
        }).join('');
        return '<span style="display:inline-block;white-space:nowrap">' + chars + '</span>';
      }).join(' ');
      return '<span class="ln" aria-hidden="true">' + words + '</span>';
    }).join('');
  });

  /* ---------- statement: wrap words so they can light up one by one ---------- */
  $$('.statement p').forEach(function (p) {
    p.innerHTML = p.textContent.trim().split(/\s+/).map(function (w) {
      return '<span class="w">' + w + '</span>';
    }).join(' ');
  });

  /* ---------- reveal on enter ---------- */
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.hasAttribute('data-count')) count(e.target);
      seen.unobserve(e.target);
    });
  }, { threshold: 0.14 });
  $$('.r, .split, .film, [data-count]').forEach(function (el) { seen.observe(el); });

  /* ---------- count up ---------- */
  function count(el) {
    var to = parseFloat(el.getAttribute('data-count')), dec = +(el.getAttribute('data-dec') || 0);
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduce) { el.textContent = to.toFixed(dec) + suffix; return; }
    var t0 = performance.now(), dur = 1700;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = (to * e).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- videos: load when near, play when visible, pause when not ---------- */
  function safePlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  var loader = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.load(); }
        safePlay(v);
      } else if (!v.paused) { v.pause(); }
    });
  }, { rootMargin: '300px 0px' });
  $$('video[data-src]').forEach(function (v) {
    if (v.hasAttribute('data-desktop') && !desktop.matches) return;
    if (v.hasAttribute('data-phone') && desktop.matches) return;
    v.muted = true; loader.observe(v);
  });
  // iOS sometimes refuses the first autoplay; the first touch or scroll kicks it
  function kick() { $$('video[autoplay]').forEach(function (v) { if (v.paused) safePlay(v); }); }
  ['touchstart', 'scroll', 'click'].forEach(function (ev) { addEventListener(ev, kick, { passive: true, once: true }); });

  /* ---------- scroll-linked: progress line, altimeter, word lighting, drift ---------- */
  var bar = $('.progress'), altVal = $('.alt .val'), altFill = $('.alt .rail i');
  var words = $$('.statement .w'), statement = $('.statement');
  var drifts = $$('[data-drift-x], [data-drift-y]');
  var TOP = 13500, ticking = false;
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function frame() {
    ticking = false;
    var max = Math.max(1, root.scrollHeight - innerHeight);
    var p = Math.min(1, Math.max(0, scrollY / max));
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (altVal) altVal.textContent = fmt(Math.round(TOP * (1 - p) / 10) * 10) + ' FT';
    if (altFill) altFill.style.transform = 'scaleX(' + p + ')';
    if (statement && words.length) {
      var r = statement.getBoundingClientRect();
      var sp = (innerHeight * 0.82 - r.top) / (r.height * 0.9);
      var lit = Math.round(Math.min(1, Math.max(0, sp)) * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', reduce || i < lit);
    }
    if (!reduce) drifts.forEach(function (el) {
      var host = el.closest('[data-drift-host]') || el.parentElement;
      var b = host.getBoundingClientRect();
      if (b.bottom < -200 || b.top > innerHeight + 200) return;
      var c = ((b.top + b.height / 2) - innerHeight / 2) / innerHeight; // -1..1 through the viewport
      var x = parseFloat(el.dataset.driftX || 0) * c, y = parseFloat(el.dataset.driftY || 0) * c;
      var s = el.dataset.driftScale || 1;
      el.style.transform = 'translate3d(' + x + 'vw,' + y + '%,0) scale(' + s + ')';
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', onScroll, { passive: true });
  var setScrolled = function () { document.documentElement.classList.toggle('scrolled', scrollY > 24); };
  addEventListener('scroll', setScrolled, { passive: true }); setScrolled();
  addEventListener('resize', onScroll);
  frame();

  /* ---------- accordion ---------- */
  $$('.acc-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var panel = head.nextElementSibling, open = head.getAttribute('aria-expanded') === 'true';
      $$('.acc-head[aria-expanded="true"]').forEach(function (o) {
        o.setAttribute('aria-expanded', 'false'); o.nextElementSibling.style.height = '0px';
      });
      if (!open) { head.setAttribute('aria-expanded', 'true'); panel.style.height = panel.scrollHeight + 'px'; }
    });
  });
  addEventListener('resize', function () {
    var o = $('.acc-head[aria-expanded="true"]');
    if (o) o.nextElementSibling.style.height = o.nextElementSibling.scrollHeight + 'px';
  });

  /* ---------- lightbox ---------- */
  var lb = $('.lb');
  if (lb) {
    var lbv = $('video', lb), lbig = $('.ig a', lb), last = null;
    var close = function () {
      lb.classList.remove('open'); lbv.pause(); lbv.removeAttribute('src'); lbv.load();
      if (last) last.focus();
    };
    $$('[data-lb]').forEach(function (b) {
      b.addEventListener('click', function () {
        last = b; lbv.src = b.dataset.lb; lbv.poster = b.dataset.poster || ''; lbig.href = b.dataset.ig;
        lb.classList.add('open'); safePlay(lbv); $('.x', lb).focus();
      });
    });
    $('.x', lb).addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
  }

  /* ---------- curtain between pages ---------- */
  $$('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!/^[a-z-]+\.html(#.*)?$/.test(href) || a.target === '_blank') return;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduce) return;
      e.preventDefault(); root.classList.add('leaving');
      setTimeout(function () { location.href = href; }, 430);
    });
  });
  addEventListener('pageshow', function (e) { if (e.persisted) root.classList.remove('leaving'); });

  /* ---------- contact form: composes the enquiry in the visitor's own email app ---------- */
  var form = $('#enquiry');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, get = function (n) { return form.elements[n].value.trim(); };
      ['name', 'email', 'message'].forEach(function (n) {
        var bad = !get(n) || (n === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(get(n)));
        form.elements[n].closest('.field').classList.toggle('bad', bad);
        if (bad && ok) { form.elements[n].focus(); ok = false; }
      });
      var msg = $('.form-msg', form);
      if (!ok) { msg.textContent = 'Please add your name, a valid email and a message.'; return; }
      var subject = get('subject') || 'Enquiry from ' + get('name');
      var body = get('message') + '\n\n' + get('name') + '\n' + get('email');
      var url = 'mailto:' + form.dataset.to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      form.dataset.last = url;
      msg.textContent = 'Your email app should have opened with the enquiry ready to send.';
      location.href = url;
    });
  }

  /* ---------- hero: the clips play one after another, each to its end, then cut to the next ---------- */
  var hero = $('.hero');
  if (hero) {
    var slides = $$('.hs', hero), cur = 0, inView = true;
    // wide versions for landscape screens, the full vertical frame for phones
    var kind = matchMedia('(min-aspect-ratio: 1/1)').matches ? 'w' : 't';
    var prep = function (i) {
      var v = $('video', slides[i]);
      // the ?v= changes on every publish, so a phone never mixes a cached older cut with the new file
      var q = v.dataset.v ? '?v=' + v.dataset.v : '';
      if (!v.src) {
        // iPhones paint a video black for a moment between its poster and its first frame. So the still sits
        // behind the video as a background, and the video stays invisible until it is really showing frames.
        var still = v.dataset.hero + '-' + kind + '.jpg' + q;
        slides[i].style.backgroundImage = 'url("' + still + '")';
        v.style.opacity = '0';
        var show = function () { if (v.currentTime > 0.08) { v.style.opacity = '1'; v.removeEventListener('timeupdate', show); } };
        v.addEventListener('timeupdate', show);
        v.muted = true; v.src = v.dataset.hero + '-' + kind + '.mp4' + q; v.load();
      }
      return v;
    };
    var first = prep(0);
    if (slides.length < 2 || reduce) first.loop = true;
    safePlay(first);
    ['touchstart', 'scroll', 'click'].forEach(function (ev) { addEventListener(ev, function () { var v = $('video', slides[cur]); if (v.paused && inView) safePlay(v); }, { passive: true, once: true }); });
    if (!reduce && slides.length > 1) {
      setTimeout(function () { prep(1); }, 2500);          // start fetching the next clip once the first is under way
      var advance = function () {
        var old = cur, next = (cur + 1) % slides.length, ov = $('video', slides[old]), nv = prep(next);
        if (nv.readyState < 2) { try { ov.currentTime = 0; } catch (e) {} safePlay(ov); return; }  // next not buffered: replay this one
        try { nv.currentTime = 0; } catch (e) {}
        safePlay(nv);
        slides[next].classList.add('on'); slides[old].classList.remove('on');
        cur = next;
        setTimeout(function () { if (cur !== old) ov.pause(); }, 700);
        setTimeout(function () { prep((next + 1) % slides.length); }, 2500);
      };
      setInterval(function () {
        if (!inView || document.hidden) return;
        var v = $('video', slides[cur]);
        if (v.ended || (v.duration && v.currentTime >= v.duration - 0.35)) advance();
      }, 150);
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting;
        var v = $('video', slides[cur]);
        if (inView) safePlay(v); else v.pause();
      }).observe(hero);
    }
  }

  /* ---------- pinned scenes (GSAP) ---------- */
  if (hero) setTimeout(function () { var h = $('.split', hero); if (h) h.classList.add('free'); }, 2600);

  if (!window.gsap || !window.ScrollTrigger || reduce) return;
  gsap.registerPlugin(ScrollTrigger);

  if (hero) {
    // GSAP moves the inner .g spans; the outer .ch spans belong to the CSS intro
    var chars = $$('.g', hero);
    var tl = gsap.timeline({
      scrollTrigger: { trigger: hero, start: 'top top', end: '+=85%', scrub: 0.6, pin: true,
        onUpdate: function (st) { if (st.progress > 0.01) { var h = $('.split', hero); if (h) h.classList.add('free'); } } }
    });
    tl.to(chars, {
      transformPerspective: 700,
      z: function () { return gsap.utils.random(120, 380); },
      yPercent: function () { return gsap.utils.random(-170, -50); },
      rotateX: function () { return gsap.utils.random(-70, 70); },
      rotateZ: function () { return gsap.utils.random(-14, 14); },
      ease: 'power2.in', stagger: { each: 0.025, from: 'random' }, duration: 0.7
    }, 0)
      .to(chars, { opacity: 0, ease: 'power1.out', stagger: { each: 0.025, from: 'random' }, duration: 0.42 }, 0.04)
      .to($('.subw', hero), { opacity: 0, y: -20, duration: 0.3 }, 0)
      .to($('.hero-shade', hero), { opacity: 0.2, duration: 0.5 }, 0)
      .fromTo($('.hero-fade', hero), { opacity: 1 }, { opacity: 0.25, duration: 0.35, immediateRender: false }, 0.65);
  }

  // horizontal reel gallery, desktop only; phones get a native swipe carousel
  var gal = $('.gallery[data-pin]');
  if (gal) {
    ScrollTrigger.matchMedia({
      '(min-width: 901px)': function () {
        var track = $('.track', gal);
        var dist = function () { return Math.max(0, track.scrollWidth - innerWidth); };
        gsap.to(track, {
          x: function () { return -dist(); }, ease: 'none',
          scrollTrigger: { trigger: gal, start: 'top top', end: function () { return '+=' + dist(); },
            scrub: 0.5, pin: true, invalidateOnRefresh: true }
        });
      }
    });
  }

  // lead stunt opens through an iris
  var lead = $('.lead');
  if (lead) {
    gsap.fromTo($('.iris', lead), { clipPath: 'circle(14% at 50% 50%)' }, {
      clipPath: 'circle(125% at 50% 50%)', ease: 'none',
      scrollTrigger: { trigger: lead, start: 'top top', end: '+=90%', scrub: 0.5, pin: true }
    });
    gsap.from($('.txt', lead), { opacity: 0, y: 40,
      scrollTrigger: { trigger: lead, start: 'top top', end: '+=90%', scrub: 0.5 } });
  }

  addEventListener('load', function () { ScrollTrigger.refresh(); });
  setTimeout(function () { ScrollTrigger.refresh(); }, 1500);
})();
