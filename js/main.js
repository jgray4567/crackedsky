/* ==========================================================================
   CRACKED SKY — main.js
   YouTube background (play-once, freeze on last frame),
   sticky nav, scroll reveals, gallery lightbox, video modal.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   YouTube Background Player
   - Autoplays muted on load
   - Plays exactly once — on ENDED: seek to last frame and pause (freeze)
   - On API error: silently degrades to dark bg
   -------------------------------------------------------------------------- */

var ytBgPlayer    = null;
var bgVideoEnded  = false;

/**
 * Called automatically by YouTube IFrame API when ready.
 * The <script> tag loading the API is in index.html.
 */
window.onYouTubeIframeAPIReady = function () {
  ytBgPlayer = new YT.Player('yt-player', {
    videoId: 'yxlXEKoRQok',
    playerVars: {
      autoplay:       1,
      controls:       0,
      disablekb:      1,
      enablejsapi:    1,
      fs:             0,
      iv_load_policy: 3,
      loop:           0,
      modestbranding: 1,
      mute:           1,
      playsinline:    1,
      rel:            0,
      showinfo:       0,
      color:          'white',
    },
    events: {
      onReady: function (e) {
        e.target.mute();       // belt-and-suspenders mute
        e.target.playVideo();
        // Stagger hero content fade-in slightly after video starts
        window.setTimeout(revealHero, 700);
      },
      onStateChange: function (e) {
        // YT.PlayerState.ENDED === 0
        if (e.data === 0 && !bgVideoEnded) {
          bgVideoEnded = true;
          // Seek to within 0.1s of end then pause — holds last video frame
          var dur = ytBgPlayer.getDuration();
          ytBgPlayer.seekTo(Math.max(0, dur - 0.1), true);
          window.setTimeout(function () {
            ytBgPlayer.pauseVideo();
          }, 180);
        }
      },
      onError: function () {
        // Video unavailable — fade out the container so bg colour shows
        var bg = document.getElementById('video-background');
        if (bg) bg.style.opacity = '0';
        revealHero();
      }
    }
  });
};

/* --------------------------------------------------------------------------
   Hero reveal — fired after video starts (or on fallback timeout)
   -------------------------------------------------------------------------- */
function revealHero () {
  var el = document.querySelector('.hero-content');
  if (el && !el.classList.contains('visible')) {
    el.classList.add('visible');
  }
}

// Safety net: if YouTube API never fires, reveal hero after 2.5s
window.addEventListener('load', function () {
  window.setTimeout(revealHero, 2500);
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

