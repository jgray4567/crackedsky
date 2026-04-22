/* ==========================================================================
   CRACKED SKY — main.js
   YouTube background (play-once, freeze on last frame),
   sticky nav, scroll reveals, gallery lightbox, video modal.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Lightning Effect — canvas drawn over the hero background
   Generates randomised forked bolts with a realistic flash-then-fade sequence.
   -------------------------------------------------------------------------- */
(function () {
  var hero = document.getElementById('hero');
  if (!hero) return;

  /* Inject canvas as first child of hero */
  var canvas    = document.createElement('canvas');
  canvas.id     = 'lightning-canvas';
  hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext('2d');
  var W, H;

  function resize() {
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ------------------------------------------------------------------
     Midpoint-displacement bolt generator.
     Returns an array of [x,y] points that form the jagged path.
  ------------------------------------------------------------------ */
  function generatePath(x1, y1, x2, y2, spread, depth) {
    if (depth <= 0) return [[x2, y2]];
    var mx = (x1 + x2) / 2 + (Math.random() - 0.5) * spread;
    var my = (y1 + y2) / 2 + (Math.random() - 0.5) * spread * 0.2;
    var left  = generatePath(x1, y1, mx, my, spread * 0.55, depth - 1);
    var right = generatePath(mx, my, x2, y2, spread * 0.55, depth - 1);
    return left.concat(right);
  }

  /* Draw a single bolt path with glow */
  function drawPath(points, alpha, lineW, rgb) {
    if (!points.length) return;
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.lineCap      = 'round';
    ctx.lineJoin     = 'round';

    /* Outer glow pass */
    ctx.shadowBlur   = 18;
    ctx.shadowColor  = 'rgba(' + rgb + ',0.9)';
    ctx.strokeStyle  = 'rgba(' + rgb + ',0.6)';
    ctx.lineWidth    = lineW * 3;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();

    /* Core bright pass */
    ctx.shadowBlur   = 6;
    ctx.shadowColor  = 'rgba(255,255,255,1)';
    ctx.strokeStyle  = '#ffffff';
    ctx.lineWidth    = lineW;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var j = 1; j < points.length; j++) ctx.lineTo(points[j][0], points[j][1]);
    ctx.stroke();

    ctx.restore();
  }

  /* ------------------------------------------------------------------
     One full strike: flash → bolt → fade
  ------------------------------------------------------------------ */
  function strike() {
    var startX   = W * (0.15 + Math.random() * 0.70);
    var endX     = startX + (Math.random() - 0.5) * W * 0.40;
    var endY     = H * (0.55 + Math.random() * 0.35);
    var spread   = W * 0.28;
    var depth    = 7;

    var main     = generatePath(startX, 0, endX, endY, spread, depth);

    /* 1–3 branches forking from random mid-points */
    var branches = [];
    var numB     = 1 + Math.floor(Math.random() * 2);
    for (var b = 0; b < numB; b++) {
      var idx  = Math.floor(main.length * (0.25 + Math.random() * 0.45));
      var bx   = main[idx][0];
      var by   = main[idx][1];
      var bex  = bx + (Math.random() - 0.5) * W * 0.28;
      var bey  = by + H * (0.08 + Math.random() * 0.18);
      branches.push(generatePath(bx, by, bex, bey, spread * 0.45, depth - 2));
    }

    /* Timing (ms) */
    var T_FLASH  = 70;
    var T_HOLD   = 110;
    var T_FADE   = 340;
    var T_TOTAL  = T_FLASH + T_HOLD + T_FADE;
    var t0       = null;

    function frame(ts) {
      if (!t0) t0 = ts;
      var e = ts - t0;
      ctx.clearRect(0, 0, W, H);

      if (e < T_FLASH) {
        /* Build-up flash */
        var p = e / T_FLASH;
        ctx.fillStyle = 'rgba(210,235,255,' + (p * 0.48) + ')';
        ctx.fillRect(0, 0, W, H);

      } else if (e < T_FLASH + T_HOLD) {
        /* Peak flash + bolt fully visible */
        var q = (e - T_FLASH) / T_HOLD;
        ctx.fillStyle = 'rgba(210,235,255,' + (0.48 * (1 - q * 0.6)) + ')';
        ctx.fillRect(0, 0, W, H);
        drawPath(main, 1,   2.2, '200,225,255');
        branches.forEach(function (br) { drawPath(br, 0.75, 1.4, '200,225,255'); });

      } else if (e < T_TOTAL) {
        /* Fade out */
        var a = 1 - (e - T_FLASH - T_HOLD) / T_FADE;
        drawPath(main, a,        2.2, '200,225,255');
        branches.forEach(function (br) { drawPath(br, a * 0.75, 1.4, '200,225,255'); });

      } else {
        ctx.clearRect(0, 0, W, H);
        return; /* done */
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     Random scheduling — 3.5 to 10 seconds between strikes.
     Occasional quick double-strike for realism.
  ------------------------------------------------------------------ */
  function schedule() {
    window.setTimeout(function () {
      strike();
      if (Math.random() > 0.62) {
        window.setTimeout(strike, 180 + Math.random() * 380);
      }
      schedule();
    }, 3500 + Math.random() * 6500);
  }

  /* First strike shortly after load, then keep scheduling */
  window.setTimeout(function () { strike(); schedule(); }, 1800);
}());

/* --------------------------------------------------------------------------
   Hero reveal — fires on load
   -------------------------------------------------------------------------- */
function revealHero () {
  var el = document.querySelector('.hero-content');
  if (el) el.classList.add('visible');
}

window.addEventListener('load', function () {
  window.setTimeout(revealHero, 300);
});

/* --------------------------------------------------------------------------
   Navigation
   - Adds .scrolled class (dark bg) after 60px scroll
   - Mobile hamburger toggle
   - Smooth-scroll to anchored sections
   -------------------------------------------------------------------------- */
(function () {
  var nav       = document.getElementById('nav');
  var toggle    = document.querySelector('.nav-toggle');
  var linksList = document.querySelector('.nav-links');
  var links     = document.querySelectorAll('.nav-links a');

  /* Sticky bg on scroll */
  window.addEventListener('scroll', function () {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  /* Mobile toggle */
  if (toggle && linksList) {
    toggle.addEventListener('click', function () {
      var open = linksList.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* Close mobile menu when a link is clicked */
  links.forEach(function (link) {
    link.addEventListener('click', function () {
      if (linksList) linksList.classList.remove('open');
      if (toggle)    { toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
      document.body.style.overflow = '';
    });
  });

  /* Smooth scroll (CSS scroll-behavior fallback for older browsers) */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 72;
      var top  = target.getBoundingClientRect().top + window.pageYOffset - navH;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
}());

/* --------------------------------------------------------------------------
   Intersection Observer — scroll-reveal (.reveal elements)
   -------------------------------------------------------------------------- */
(function () {
  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold:  0.1,
    rootMargin: '0px 0px -36px 0px'
  });

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });
}());

/* --------------------------------------------------------------------------
   Gallery Lightbox
   - Opens on gallery cell click
   - Keyboard arrow navigation
   - Closes on ESC, close button, or backdrop click
   -------------------------------------------------------------------------- */
(function () {
  var cells      = document.querySelectorAll('.gallery-cell');
  var lightbox   = document.getElementById('lightbox');
  var lbImg      = document.getElementById('lb-img');
  var lbClose    = document.querySelector('.lb-close');
  var lbPrev     = document.querySelector('.lb-prev');
  var lbNext     = document.querySelector('.lb-next');
  var images     = [];
  var currentIdx = 0;

  if (!lightbox || !lbImg) return;

  /* Build image list from gallery cells */
  cells.forEach(function (cell) {
    var img = cell.querySelector('img');
    if (img) images.push({ src: img.src, alt: img.alt || '' });
  });

  function openAt(idx) {
    currentIdx = ((idx % images.length) + images.length) % images.length;
    lbImg.src = images[currentIdx].src;
    lbImg.alt = images[currentIdx].alt;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function close() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  function prev() { openAt(currentIdx - 1); }
  function next() { openAt(currentIdx + 1); }

  /* Wire click handlers on cells */
  cells.forEach(function (cell, i) {
    cell.addEventListener('click', function () { openAt(i); });
    /* Keyboard accessibility */
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', 'View image ' + (i + 1));
    cell.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(i); }
    });
  });

  if (lbClose) lbClose.addEventListener('click', close);
  if (lbPrev)  lbPrev.addEventListener('click',  prev);
  if (lbNext)  lbNext.addEventListener('click',  next);

  /* Backdrop click */
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) close(); });

  /* Keyboard */
  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')      close();
    if (e.key === 'ArrowLeft')   prev();
    if (e.key === 'ArrowRight')  next();
  });
}());

/* --------------------------------------------------------------------------
   Video Lightbox
   - Thumbnail grid click → lightbox with autoplay
   - Shorts open in portrait (9:16) ratio
   - ESC or backdrop click to close; iframe src cleared to stop playback
   -------------------------------------------------------------------------- */
(function () {
  var thumbs    = document.querySelectorAll('.video-thumb');
  var vlb       = document.getElementById('video-lightbox');
  var vlbInner  = vlb ? vlb.querySelector('.vlb-inner')  : null;
  var vlbIframe = vlb ? document.getElementById('vlb-iframe') : null;
  var vlbClose  = vlb ? vlb.querySelector('.vlb-close')  : null;

  if (!vlb || !vlbIframe || !thumbs.length) return;

  function openVideo(id, isShort) {
    vlbInner.classList.toggle('is-short', !!isShort);
    vlbIframe.src = 'https://www.youtube.com/embed/' + id +
      '?autoplay=1&rel=0&modestbranding=1&color=white';
    vlb.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (vlbClose) vlbClose.focus();
  }

  function closeVideo() {
    vlb.classList.remove('open');
    document.body.style.overflow = '';
    vlbIframe.src = '';   /* stops playback */
  }

  /* Wire up each thumbnail */
  thumbs.forEach(function (thumb) {
    function activate() {
      openVideo(thumb.dataset.youtubeId, thumb.dataset.short === 'true');
    }
    thumb.addEventListener('click', activate);
    thumb.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  /* Close button */
  if (vlbClose) vlbClose.addEventListener('click', closeVideo);

  /* Backdrop click */
  vlb.addEventListener('click', function (e) {
    if (e.target === vlb) closeVideo();
  });

  /* ESC key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && vlb.classList.contains('open')) closeVideo();
  });
}());

