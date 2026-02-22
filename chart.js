/* ============================================================
   CHART.JS — Nonchalant Coin Chart Page
   ============================================================

   CONFIG — keep TOKEN_CA in sync with script.js
   When you have your Solana contract address, paste it in both:
     - script.js  → const TOKEN_CA = 'your-ca-here';
     - chart.js   → const TOKEN_CA = 'your-ca-here';  (this file)

   ============================================================ */

// === CONFIG — keep in sync with script.js ===
const TOKEN_CA = ''; // paste your Solana CA here

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initPage();
  setupMobileNav();
  setupScrollAnimations();
  setupCopyCA();
  initMemePopup();

  if (TOKEN_CA.trim()) {
    fetchTokenData();
    setInterval(fetchTokenData, 60000);
    const pairAddress = await getPairAddress();
    loadChart(pairAddress);
  }
});

/* ============================================================
   INIT PAGE — show/hide sections based on TOKEN_CA
   ============================================================ */
function initPage() {
  const wrapper     = document.getElementById('chart-wrapper');
  const placeholder = document.getElementById('chart-placeholder');
  const caMeta      = document.getElementById('ca-meta');
  const caTruncated = document.getElementById('ca-truncated');

  if (TOKEN_CA.trim()) {
    // Show chart experience
    wrapper.hidden     = false;
    placeholder.hidden = true;

    // Show and populate CA meta block
    if (caMeta && caTruncated) {
      const ca = TOKEN_CA.trim();
      caTruncated.textContent = ca.slice(0, 6) + '...' + ca.slice(-4);
      caTruncated.title = ca;
      caMeta.hidden = false;
    }
  } else {
    // Show placeholder
    wrapper.hidden     = true;
    placeholder.hidden = false;

    // Hide CA meta
    if (caMeta) caMeta.hidden = true;
  }
}

/* ============================================================
   COPY CA BUTTON
   ============================================================ */
function setupCopyCA() {
  const btn = document.getElementById('copy-ca-btn');
  if (!btn || !TOKEN_CA.trim()) return;

  btn.addEventListener('click', async () => {
    const ca = TOKEN_CA.trim();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(ca);
      } else {
        const ta = document.createElement('textarea');
        ta.value = ca;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      btn.textContent = 'COPIED.';
    } catch (e) {
      btn.textContent = 'FAILED.';
    }
    setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
  });
}

/* ============================================================
   GET PAIR ADDRESS FROM DEXSCREENER
   ============================================================ */
async function getPairAddress() {
  if (!TOKEN_CA) return null;
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/' + TOKEN_CA.trim()
    );
    if (!res.ok) throw new Error('API error');
    const json = await res.json();
    if (!json.pairs || !json.pairs.length) return null;
    const pair = json.pairs.sort((a, b) =>
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    return pair.pairAddress;
  } catch (e) {
    console.warn('getPairAddress failed:', e);
    return null;
  }
}

/* ============================================================
   LOAD CHART IFRAME
   ============================================================ */
function loadChart(pairAddress) {
  const loading = document.getElementById('chart-loading');
  const error   = document.getElementById('chart-error');
  const iframe  = document.getElementById('chart-iframe');
  const retryBtn = document.getElementById('chart-retry-btn');

  if (!pairAddress) {
    // Show error state
    if (loading) loading.style.display = 'none';
    if (error)   error.hidden = false;
    if (iframe)  iframe.hidden = true;

    // Retry button
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        error.hidden = true;
        if (loading) loading.style.display = '';
        const newPair = await getPairAddress();
        loadChart(newPair);
      });
    }
    return;
  }

  // Set iframe src
  const src = 'https://dexscreener.com/solana/' + pairAddress +
    '?embed=1&theme=dark&trades=1&info=0';

  if (iframe) {
    iframe.src = src;
    iframe.hidden = false;
    if (loading) loading.style.display = 'none';
    if (error)   error.hidden = true;
  }
}

/* ============================================================
   FETCH TOKEN DATA — LIVE PRICE
   ============================================================ */
async function fetchTokenData() {
  if (!TOKEN_CA.trim()) return;
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/' + TOKEN_CA.trim()
    );
    if (!res.ok) throw new Error('API error');
    const json = await res.json();
    const pairs = json.pairs;
    if (!pairs || !pairs.length) return;
    const pair = pairs.sort((a, b) =>
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    applyTokenData(pair);
  } catch (e) {
    console.warn('Price fetch failed:', e);
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
  const price   = formatUSD(pair?.priceUsd);
  const vol     = formatUSD(pair?.volume?.h24);
  const cap     = formatUSD(pair?.fdv);
  const rawChg  = parseFloat(pair?.priceChange?.h24 || 0);
  const change  = (rawChg >= 0 ? '+' : '') + rawChg.toFixed(2) + '%';
  const isPos   = rawChg >= 0;

  document.querySelectorAll('[data-live="price"]').forEach(el => el.textContent = price);
  document.querySelectorAll('[data-live="vol"]').forEach(el => el.textContent = vol);
  document.querySelectorAll('[data-live="cap"]').forEach(el => el.textContent = cap);
  document.querySelectorAll('[data-live="change"]').forEach(el => {
    el.textContent = change;
    el.style.color = isPos ? 'var(--accent)' : '#ff6b6b';
  });
}

/* ============================================================
   MOBILE NAV
   ============================================================ */
function setupMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const navOverlay = document.querySelector('.nav-overlay');
  const closeBtn = document.querySelector('.nav-overlay-close');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
    });
  }

  document.querySelectorAll('.nav-overlay a').forEach(link => {
    link.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
    });
  });

  if (navOverlay) {
    navOverlay.addEventListener('click', (e) => {
      if (e.target === navOverlay) {
        document.body.classList.remove('nav-open');
      }
    });
  }
}

/* ============================================================
   SCROLL ANIMATIONS
   ============================================================ */
function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        entry.target.style.transitionDelay = delay + 'ms';
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.sr').forEach(el => observer.observe(el));
}

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