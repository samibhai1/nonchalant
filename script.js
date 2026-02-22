/* ============================================================
   NONCHALANT COIN — script.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ============================================================
     TOKEN CONFIG — paste your Solana CA here
     ============================================================ */
  const TOKEN_CA = ''; // e.g. 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

  /* ============================================================
     LIVE PRICE DATA — DEXSCREENER
     ============================================================ */
  async function fetchTokenData() {
    if (!TOKEN_CA || TOKEN_CA.trim() === '') {
      applyTokenData(null);
      return;
    }
    try {
      const res = await fetch(
        'https://api.dexscreener.com/latest/dex/tokens/' + TOKEN_CA.trim()
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      const pairs = json.pairs;
      if (!pairs || pairs.length === 0) { applyTokenData(null); return; }
      const pair = pairs.sort((a, b) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];
      applyTokenData(pair);
    } catch (e) {
      console.warn('Token data fetch failed:', e);
      applyTokenData(null);
    }
  }

  function formatUSD(val) {
    if (!val || isNaN(val)) return '$0.00';
    const n = parseFloat(val);
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(n < 0.01 ? 6 : 4);
  }

  function applyTokenData(pair) {
    const price    = pair ? formatUSD(pair.priceUsd) : '$0.00';
    const vol      = pair ? formatUSD(pair.volume?.h24) : '$0.00';
    const cap      = pair ? formatUSD(pair.fdv) : '$0.00';
    const rawChange = pair ? parseFloat(pair.priceChange?.h24 || 0) : 0;
    const change   = rawChange.toFixed(2) + '%';
    const isPositive = rawChange >= 0;

    document.querySelectorAll('[data-live="price"]').forEach(el => el.textContent = price);
    document.querySelectorAll('[data-live="vol"]').forEach(el => el.textContent = vol);
    document.querySelectorAll('[data-live="cap"]').forEach(el => el.textContent = cap);
    document.querySelectorAll('[data-live="change"]').forEach(el => {
      el.textContent = (isPositive ? '+' : '') + change;
      el.style.color = isPositive ? 'var(--accent)' : '#ff6b6b';
    });
  }

  fetchTokenData();
  setInterval(fetchTokenData, 60000);

  /* ============================================================
     PARTICLES
     ============================================================ */
  function createParticles(containerId, count) {
    var container = document.getElementById(containerId);
    if (!container) return;

    for (var i = 0; i < count; i++) {
      var particle = document.createElement('span');
      particle.classList.add('particle');

      var size = 1 + Math.random() * 1;
      var left = Math.random() * 100;
      var delay = Math.random() * 60;
      var duration = 45 + Math.random() * 35;
      var drift = (Math.random() - 0.5) * 120;

      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.left = left + '%';
      particle.style.bottom = '0';
      particle.style.setProperty('--drift', drift + 'px');
      particle.style.animationDuration = duration + 's';
      particle.style.animationDelay = '-' + delay + 's';
      particle.style.opacity = (0.05 + Math.random() * 0.1).toFixed(2);

      container.appendChild(particle);
    }
  }

  createParticles('heroParticles', 18);
  createParticles('aboutParticles', 18);
  createParticles('communityParticles', 18);
  createParticles('vaultParticles', 18);

  /* ============================================================
     COPY ADDRESS
     ============================================================ */
  async function copyAddress() {
    var addr = document.getElementById('contractAddress');
    var btn = document.getElementById('copyButton');
    if (!addr || !btn) return;

    var text = addr.textContent.trim();

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      btn.textContent = 'copied.';
    } catch (e) {
      btn.textContent = 'failed.';
    }

    setTimeout(function () {
      btn.textContent = 'copy address';
    }, 1500);
  }

  var copyBtn = document.getElementById('copyButton');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyAddress);
  }

  /* ============================================================
     VAULT TIMESTAMP
     ============================================================ */
  function updateTimestamp() {
    var el = document.getElementById('vault-timestamp');
    if (!el) return;
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    el.textContent =
      now.getUTCFullYear() + '-' +
      pad(now.getUTCMonth() + 1) + '-' +
      pad(now.getUTCDate()) + ' ' +
      pad(now.getUTCHours()) + ':' +
      pad(now.getUTCMinutes()) + ':' +
      pad(now.getUTCSeconds()) + ' UTC';
  }

  updateTimestamp();
  setInterval(updateTimestamp, 1000);

  /* ============================================================
     MOBILE NAV
     ============================================================ */
  const hamburger = document.querySelector('.hamburger');
  const navOverlay = document.querySelector('.nav-overlay');
  const navOverlayClose = document.querySelector('.nav-overlay-close');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }

  if (navOverlayClose) {
    navOverlayClose.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
    });
  }

  // Close on any link click inside overlay
  document.querySelectorAll('.nav-overlay a').forEach(link => {
    link.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
    });
  });

  // Close on outside click (tapping the overlay background)
  if (navOverlay) {
    navOverlay.addEventListener('click', (e) => {
      if (e.target === navOverlay) {
        document.body.classList.remove('nav-open');
      }
    });
  }

  /* ============================================================
     SMOOTH SCROLL
     ============================================================ */
  var allLinks = document.querySelectorAll('a[href^="#"]');
  allLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* ============================================================
     INTERSECTION OBSERVER — SCROLL REVEAL
     ============================================================ */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var delay = entry.target.dataset.delay || 0;
        entry.target.style.transitionDelay = delay + 'ms';
        entry.target.classList.add('in');

        // Dial specific visibility
        if (entry.target.classList.contains('dial-svg')) {
          entry.target.classList.add('dial-visible');
        }

        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  // Set initial dial opacity low before reveal
  var dialSvg = document.querySelector('.dial-svg');
  if (dialSvg) {
    dialSvg.style.opacity = '0.2';
  }

  var srElements = document.querySelectorAll('.sr');
  srElements.forEach(function (el) {
    observer.observe(el);
  });

  /* ============================================================
     MEME POPUP
     ============================================================ */
  function initMemePopup() {
    const popup = document.getElementById('meme-popup');
    if (!popup) return;
    const backdrop = popup.querySelector('.meme-popup-backdrop');
    const closeBtn = popup.querySelector('.meme-popup-close');

    function openPopup() {
      popup.classList.add('open');
      popup.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closePopup() {
      popup.classList.remove('open');
      popup.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('.meme-trigger').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); openPopup(); });
    });
    backdrop.addEventListener('click', closePopup);
    closeBtn.addEventListener('click', closePopup);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popup.classList.contains('open')) closePopup();
    });
  }

  initMemePopup();

});