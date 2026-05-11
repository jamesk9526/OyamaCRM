/**
 * OyamaCRM Demo Site — Interactive JS
 * Handles: hero slideshow, gallery filter + lightbox (with prev/next),
 *          mobile nav toggle, smooth scroll, scroll-reveal animations.
 */

(function () {
  'use strict';

  /* ─── HERO SLIDESHOW ────────────────────────────────────────── */
  const heroImg   = document.getElementById('heroScreenshot');
  const slideBtns = document.querySelectorAll('.slide-btn');
  let slideTimer  = null;
  let currentSlide = 0;

  function goToSlide(index) {
    if (!heroImg) return;
    const btn = slideBtns[index];
    if (!btn) return;

    /* Fade out, swap src, fade in */
    heroImg.classList.add('fading');
    setTimeout(() => {
      heroImg.src = btn.dataset.src;
      heroImg.alt = btn.dataset.label || 'OyamaCRM Screenshot';
      heroImg.classList.remove('fading');
    }, 250);

    /* Update active dot */
    slideBtns.forEach((b, i) => b.classList.toggle('active', i === index));
    currentSlide = index;
  }

  function advanceSlide() {
    goToSlide((currentSlide + 1) % slideBtns.length);
  }

  function resetTimer() {
    clearInterval(slideTimer);
    if (slideBtns.length > 1) {
      slideTimer = setInterval(advanceSlide, 5000);
    }
  }

  slideBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => { goToSlide(i); resetTimer(); });
  });

  resetTimer();

  /* ─── MOBILE NAV ─────────────────────────────────────────────── */
  const toggle   = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    /* Close nav when a link is clicked */
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ─── SMOOTH SCROLL ──────────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ─── GALLERY FILTER ─────────────────────────────────────────── */
  const chips  = document.querySelectorAll('.chip');
  const shots  = document.querySelectorAll('.shot');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const filter = chip.dataset.filter;
      shots.forEach(shot => {
        const match = filter === 'all' || shot.dataset.category === filter;
        shot.classList.toggle('hidden', !match);
      });
    });
  });

  /* ─── LIGHTBOX ───────────────────────────────────────────────── */
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightboxImg');
  const lbCaption   = document.getElementById('lightboxCaption');
  const lbClose     = document.getElementById('lightboxClose');
  const lbPrev      = document.getElementById('lightboxPrev');
  const lbNext      = document.getElementById('lightboxNext');
  let visibleShots  = [];
  let lbIndex       = 0;

  function openLightbox(index) {
    /* Re-compute visible shots (respects current filter) */
    visibleShots = Array.from(shots).filter(s => !s.classList.contains('hidden'));
    lbIndex = Math.max(0, Math.min(index, visibleShots.length - 1));
    showLbSlide();
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function showLbSlide() {
    const shot = visibleShots[lbIndex];
    if (!shot) return;
    const img  = shot.querySelector('img');
    const cap  = shot.querySelector('figcaption');
    lbImg.src           = img ? img.src : '';
    lbImg.alt           = img ? img.alt : '';
    lbCaption.textContent = cap ? cap.textContent : '';
  }

  function closeLightbox() {
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  shots.forEach((shot, i) => {
    shot.addEventListener('click', () => {
      /* index within currently-visible shots */
      const visible = Array.from(shots).filter(s => !s.classList.contains('hidden'));
      const vi = visible.indexOf(shot);
      openLightbox(vi >= 0 ? vi : 0);
    });
  });

  lbClose && lbClose.addEventListener('click', closeLightbox);
  lightbox && lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  lbPrev && lbPrev.addEventListener('click', e => {
    e.stopPropagation();
    lbIndex = (lbIndex - 1 + visibleShots.length) % visibleShots.length;
    showLbSlide();
  });

  lbNext && lbNext.addEventListener('click', e => {
    e.stopPropagation();
    lbIndex = (lbIndex + 1) % visibleShots.length;
    showLbSlide();
  });

  document.addEventListener('keydown', e => {
    if (lightbox.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape')       closeLightbox();
    if (e.key === 'ArrowLeft')  { lbIndex = (lbIndex - 1 + visibleShots.length) % visibleShots.length; showLbSlide(); }
    if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % visibleShots.length; showLbSlide(); }
  });

  /* ─── SCROLL REVEAL ──────────────────────────────────────────── */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } else {
    /* Fallback: show all immediately if no IntersectionObserver */
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }

  /* ─── STICKY HEADER SHADOW ───────────────────────────────────── */
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 10
        ? '0 1px 24px rgba(0,0,0,0.4)'
        : 'none';
    }, { passive: true });
  }

})();
