/* ============================================================
   GALLERY.JS — Nonchalant Coin
   ============================================================

   SETUP INSTRUCTIONS (read before deploying):

   1. Go to https://firebase.google.com and sign in with your Google account.

   2. Click "Add project" — give it any name, disable Google Analytics if not needed.

   3. In the left sidebar, click "Firestore Database" → "Create database"
      - Choose "Start in test mode" (allows all reads/writes for 30 days)
      - Pick any server location close to you
      - Click Enable

   4. In the left sidebar, click "Storage" → "Get started"
      - Choose "Start in test mode"
      - Click Done

   5. In the left sidebar, click the gear icon (⚙) → "Project settings"
      - Scroll down to "Your apps" → click the </> web icon
      - Register app with any nickname
      - Copy the firebaseConfig object values into the firebaseConfig below

   6. Change ADMIN_KEY below to any secret string you want (no spaces).
      Example: 'correct-horse-battery-staple' or 'xK9mQ2nZ'

   7. Access admin mode at: yourdomain.com/gallery.html?admin=YOURSECRETKEY

   8. BEFORE GOING PUBLIC — update Firestore rules:
      In Firebase console → Firestore → Rules, paste:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /gallery/{docId} {
              allow read: if true;
              allow write: if false;  // writes only via admin secret URL
            }
          }
        }

      NOTE: Since there's no auth, the admin writes happen while Firestore is
      in "test mode" (30 day window). For long-term use, re-enable test mode
      periodically or implement Firebase Auth.

   9. Update Storage rules in Firebase console → Storage → Rules:

        rules_version = '2';
        service firebase.storage {
          match /b/{bucket}/o {
            match /gallery/{allPaths=**} {
              allow read: if true;
              allow write: if true;  // secured by secret URL obscurity
            }
          }
        }

  10. To add first images: navigate to gallery.html?admin=YOURSECRETKEY
      Click "UPLOAD IMAGES" and select files from your device.

   ============================================================ */

/* ============================================================
   CONFIGURATION — FILL THESE IN
   ============================================================ */
const ADMIN_KEY = 'samidon645@';
const PAGE_SIZE = 20;

// Cloudinary config (free image hosting — no card needed)
const CLOUDINARY_CLOUD_NAME = 'di6o5hrn3';
const CLOUDINARY_UPLOAD_PRESET = 'nonchalant_gallery';

const firebaseConfig = {
  apiKey: "AIzaSyDQhDR8GOcbW1VbeKgMfeKjmzgrfaRCF98",
  authDomain: "nonchalant-b7e39.firebaseapp.com",
  projectId: "nonchalant-b7e39",
  storageBucket: "nonchalant-b7e39.firebasestorage.app",
  messagingSenderId: "52028846503",
  appId: "1:52028846503:web:19f8151f266f713d638682",
  measurementId: "G-SM8NZZ7G7X"
};

/* ============================================================
   STATE
   ============================================================ */
let db = null;
let loadedCount = 0;
let isLoading = false;
let isAdminMode = false;
let deleteModeActive = false;
let lastVisible = null;
let allDone = false;
let lightboxImages = [];   // { url, docId, cloudinaryId }
let lightboxIndex = 0;
let scrollObserver = null;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  checkAdminMode();
  setupMobileNav();
  setupLightbox();
  initMemePopup();
  await loadTotalCount();
  await loadNextBatch();
  setupInfiniteScroll();
});

/* ============================================================
   FIREBASE INIT
   ============================================================ */
function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    console.error('Firebase init failed. Have you filled in firebaseConfig?', e);
  }
}

/* ============================================================
   ADMIN MODE CHECK
   ============================================================ */
function checkAdminMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === ADMIN_KEY && ADMIN_KEY !== 'your-secret-key-here') {
    isAdminMode = true;
    injectAdminUI();
  }
}

/* ============================================================
   LOAD TOTAL COUNT
   ============================================================ */
async function loadTotalCount() {
  if (!db) return;
  try {
    const snap = await db.collection('gallery').get();
    document.getElementById('total-count').textContent = snap.size;
  } catch (e) {
    console.warn('Could not load total count:', e);
  }
}

/* ============================================================
   LOAD NEXT BATCH
   ============================================================ */
async function loadNextBatch() {
  if (isLoading || allDone || !db) return;
  isLoading = true;

  const loader = document.getElementById('gallery-loader');
  if (loader) loader.hidden = false;

  try {
    let query = db.collection('gallery').orderBy('timestamp', 'desc');
    if (lastVisible) {
      query = query.startAfter(lastVisible);
    }
    query = query.limit(PAGE_SIZE);

    const snapshot = await query.get();

    if (snapshot.empty && loadedCount === 0) {
      if (loader) loader.hidden = true;
      showEmptyState();
      isLoading = false;
      return;
    }

    if (snapshot.empty) {
      if (loader) loader.hidden = true;
      showEndState();
      isLoading = false;
      allDone = true;
      return;
    }

    lastVisible = snapshot.docs[snapshot.docs.length - 1];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      appendImageToMasonry(data.url, doc.id, data.cloudinaryId);
      lightboxImages.push({ url: data.url, docId: doc.id, cloudinaryId: data.cloudinaryId });
      loadedCount++;
    });

    document.getElementById('loaded-count').textContent = loadedCount;

    if (snapshot.docs.length < PAGE_SIZE) {
      showEndState();
      allDone = true;
      if (scrollObserver) {
        const sentinel = document.getElementById('scroll-sentinel');
        if (sentinel) scrollObserver.unobserve(sentinel);
      }
    }

    if (loader) loader.hidden = true;
    updateAdminCount();

  } catch (e) {
    console.error('Failed to load images:', e);
    if (loader) loader.hidden = true;
  }

  isLoading = false;
}

/* ============================================================
   APPEND IMAGE TO MASONRY
   ============================================================ */
function appendImageToMasonry(url, docId, cloudinaryId, prepend = false) {
  const masonry = document.getElementById('gallery-masonry');
  const sentinel = document.getElementById('scroll-sentinel');

  const item = document.createElement('div');
  item.classList.add('gallery-item', 'loading');
  item.dataset.docId = docId;
  item.dataset.cloudinaryId = cloudinaryId || '';

  const img = document.createElement('img');
  img.alt = '';
  img.src = url;

  img.addEventListener('load', () => {
    item.classList.remove('loading');
  });

  img.addEventListener('error', () => {
    item.classList.remove('loading');
    item.style.minHeight = '160px';
    item.style.background = 'var(--surface2)';
  });

  item.appendChild(img);

  // Lightbox click (only when not in delete mode and not clicking delete btn)
  item.addEventListener('click', (e) => {
    if (deleteModeActive) return;
    if (e.target.classList.contains('delete-btn')) return;
    const idx = lightboxImages.findIndex(im => im.docId === docId);
    if (idx !== -1) openLightbox(idx);
  });

  // Admin delete button
  if (isAdminMode) {
    const delBtn = document.createElement('button');
    delBtn.classList.add('delete-btn');
    delBtn.textContent = 'REMOVE';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirmDialog(async () => {
        try {
          // Delete from Firestore
          await db.collection('gallery').doc(docId).delete();
          // Delete from Cloudinary via their destroy API
          // Note: Cloudinary client-side deletion requires a signed request.
          // For simplicity, the image is removed from Firestore and the DOM.
          // To fully delete from Cloudinary storage, use their dashboard or
          // set up a small server-side function. The image will stop appearing
          // on your site immediately.
          item.remove();
          loadedCount--;
          lightboxImages = lightboxImages.filter(im => im.docId !== docId);
          document.getElementById('loaded-count').textContent = loadedCount;
          const totalEl = document.getElementById('total-count');
          totalEl.textContent = Math.max(0, parseInt(totalEl.textContent) - 1);
          updateAdminCount();
        } catch (err) {
          console.error('Delete failed:', err);
        }
      });
    });
    item.appendChild(delBtn);
  }

  if (prepend) {
    masonry.insertBefore(item, masonry.firstChild);
  } else {
    masonry.insertBefore(item, sentinel);
  }
}

/* ============================================================
   STATES — EMPTY / END
   ============================================================ */
function showEmptyState() {
  const masonry = document.getElementById('gallery-masonry');
  const empty = document.createElement('div');
  empty.classList.add('gallery-empty');
  empty.innerHTML = `
    <p>NO IMAGES YET.</p>
    <p class="gallery-empty-sub">Check back soon.</p>
  `;
  masonry.parentNode.insertBefore(empty, masonry.nextSibling);
}

function showEndState() {
  const loader = document.getElementById('gallery-loader');
  if (loader) loader.hidden = true;

  // Remove any existing end state
  const existing = document.querySelector('.gallery-end');
  if (existing) existing.remove();

  const end = document.createElement('div');
  end.classList.add('gallery-end');
  end.innerHTML = `
    <span class="loader-line"></span>
    <span>END OF GALLERY</span>
    <span class="loader-line"></span>
  `;
  const masonry = document.getElementById('gallery-masonry');
  masonry.parentNode.insertBefore(end, masonry.nextSibling);

  // Also hide the sentinel so infinite scroll stops triggering
  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) sentinel.style.display = 'none';
}

/* ============================================================
   INFINITE SCROLL
   ============================================================ */
function setupInfiniteScroll() {
  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && !allDone) {
      loadNextBatch();
    }
  }, { rootMargin: '200px' });

  scrollObserver.observe(sentinel);
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
function setupLightbox() {
  const lightbox = document.getElementById('lightbox');
  const backdrop = lightbox.querySelector('.lightbox-backdrop');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');

  backdrop.addEventListener('click', closeLightbox);
  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => showLightboxImage(lightboxIndex - 1));
  nextBtn.addEventListener('click', () => showLightboxImage(lightboxIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
    if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
  });
}

function openLightbox(index) {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  showLightboxImage(index);
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.getElementById('lightbox-img').src = '';
}

function showLightboxImage(index) {
  if (lightboxImages.length === 0) return;
  // Wrap around
  if (index < 0) index = lightboxImages.length - 1;
  if (index >= lightboxImages.length) index = 0;
  lightboxIndex = index;
  document.getElementById('lightbox-img').src = lightboxImages[index].url;
  document.getElementById('lightbox-counter').textContent =
    (index + 1) + ' / ' + lightboxImages.length;
}

/* ============================================================
   ADMIN UI — INJECTED BY JS ONLY
   ============================================================ */
function injectAdminUI() {
  // Inject admin CSS as a style tag
  const style = document.createElement('style');
  style.textContent = `
    .admin-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 3000;
      background: var(--surface2);
      border-top: 1px solid var(--accent);
      padding: 12px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      font-family: 'IBM Plex Mono', monospace;
    }
    .admin-label {
      font-size: 10px;
      color: var(--accent);
      letter-spacing: 0.15em;
    }
    .admin-actions {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .admin-bar button {
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.1em;
      background: transparent;
      border: 1px solid var(--border-strong);
      color: var(--text-dim);
      padding: 8px 16px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .admin-bar button:hover {
      color: var(--text);
      border-color: var(--border-strong);
    }
    .admin-bar button.active {
      border-color: var(--accent);
      color: var(--accent);
    }
    .admin-count {
      font-size: 10px;
      color: var(--text-muted);
      letter-spacing: 0.1em;
    }
    .admin-error {
      font-size: 10px;
      color: #ff6b6b;
      letter-spacing: 0.1em;
    }
    .delete-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
      background: rgba(10,10,10,0.9);
      border: 1px solid #ff6b6b !important;
      color: #ff6b6b !important;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 600;
      font-size: 10px;
      letter-spacing: 0.1em;
      padding: 6px 10px;
      cursor: pointer;
      display: none;
    }
    body.delete-mode .gallery-item .delete-btn {
      display: block;
    }
    body.delete-mode .gallery-item {
      cursor: default;
    }
    body.delete-mode .gallery-item img {
      pointer-events: none;
    }
    .confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 4000;
      background: rgba(10,10,10,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .confirm-dialog {
      background: var(--surface2);
      border: 1px solid var(--border-strong);
      padding: 40px 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-width: 280px;
    }
    .confirm-dialog p {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      color: var(--text);
      letter-spacing: 0.1em;
    }
    .confirm-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .confirm-actions button {
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.1em;
      background: transparent;
      border: 1px solid var(--border-strong);
      color: var(--text-dim);
      padding: 10px 20px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .confirm-actions button:hover {
      color: var(--text);
    }
    .confirm-actions .confirm-yes {
      border-color: #ff6b6b;
      color: #ff6b6b;
    }
    .confirm-actions .confirm-yes:hover {
      color: #ff6b6b;
    }
    /* Extra padding on body so content isn't hidden behind admin bar */
    body { padding-bottom: 60px; }
  `;
  document.head.appendChild(style);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', handleUpload);
  document.body.appendChild(fileInput);

  // Admin bar
  const bar = document.createElement('div');
  bar.classList.add('admin-bar');

  const label = document.createElement('span');
  label.classList.add('admin-label');
  label.textContent = 'ADMIN MODE';

  const actions = document.createElement('div');
  actions.classList.add('admin-actions');

  const uploadBtn = document.createElement('button');
  uploadBtn.id = 'admin-upload';
  uploadBtn.textContent = 'UPLOAD IMAGES';
  uploadBtn.addEventListener('click', () => fileInput.click());

  const deleteBtn = document.createElement('button');
  deleteBtn.id = 'admin-delete-mode';
  deleteBtn.textContent = 'DELETE MODE: OFF';
  deleteBtn.addEventListener('click', () => {
    deleteModeActive = !deleteModeActive;
    document.body.classList.toggle('delete-mode', deleteModeActive);
    deleteBtn.textContent = 'DELETE MODE: ' + (deleteModeActive ? 'ON' : 'OFF');
    deleteBtn.classList.toggle('active', deleteModeActive);
  });

  const countEl = document.createElement('span');
  countEl.classList.add('admin-count');
  countEl.textContent = '0 IMAGES IN GALLERY';

  const errorEl = document.createElement('span');
  errorEl.classList.add('admin-error');
  errorEl.style.display = 'none';

  actions.appendChild(uploadBtn);
  actions.appendChild(deleteBtn);
  actions.appendChild(countEl);
  actions.appendChild(errorEl);

  bar.appendChild(label);
  bar.appendChild(actions);
  document.body.appendChild(bar);

  // Update count once images are loaded (poll after short delay)
  setTimeout(updateAdminCount, 2000);

  /* ---- UPLOAD HANDLER ---- */
  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const btn = document.getElementById('admin-upload');
    errorEl.style.display = 'none';
    let done = 0;
    btn.textContent = 'UPLOADING 0/' + files.length;
    btn.disabled = true;

    for (const file of files) {
      try {
        // Upload to Cloudinary via unsigned upload preset
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'nonchalant_gallery');

        const res = await fetch(
          'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload',
          { method: 'POST', body: formData }
        );

        if (!res.ok) throw new Error('Cloudinary upload failed');
        const data = await res.json();

        const url = data.secure_url;
        const cloudinaryId = data.public_id;

        // Save URL + metadata to Firestore
        const docRef = await db.collection('gallery').add({
          url,
          filename: file.name,
          cloudinaryId,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add to DOM and lightbox array immediately
        appendImageToMasonry(url, docRef.id, cloudinaryId, true);
        lightboxImages.unshift({ url, docId: docRef.id, cloudinaryId });

        loadedCount++;
        done++;

        document.getElementById('loaded-count').textContent = loadedCount;
        const totalEl = document.getElementById('total-count');
        totalEl.textContent = parseInt(totalEl.textContent) + 1;

        btn.textContent = 'UPLOADING ' + done + '/' + files.length;

      } catch (err) {
        console.error('Upload failed for file:', file.name, err);
        errorEl.textContent = 'UPLOAD FAILED';
        errorEl.style.display = 'inline';
        setTimeout(() => { errorEl.style.display = 'none'; }, 2000);
      }
    }

    btn.textContent = 'UPLOAD IMAGES';
    btn.disabled = false;
    fileInput.value = '';
    updateAdminCount();
  }
}

/* ============================================================
   ADMIN HELPERS
   ============================================================ */
function updateAdminCount() {
  const el = document.querySelector('.admin-count');
  if (el) el.textContent = loadedCount + ' IMAGES IN GALLERY';
}

function showConfirmDialog(onConfirm) {
  const overlay = document.createElement('div');
  overlay.classList.add('confirm-overlay');

  const dialog = document.createElement('div');
  dialog.classList.add('confirm-dialog');

  const msg = document.createElement('p');
  msg.textContent = 'REMOVE THIS IMAGE?';

  const actions = document.createElement('div');
  actions.classList.add('confirm-actions');

  const confirmBtn = document.createElement('button');
  confirmBtn.classList.add('confirm-yes');
  confirmBtn.textContent = 'CONFIRM';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'CANCEL';

  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  // Click outside dialog to cancel
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  dialog.appendChild(msg);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
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