/* ═══════════════════════════════════════════════════════
   HK MINIJUNGLE — MAIN APP
   Three.js + Lenis + GSAP ScrollTrigger
   ═══════════════════════════════════════════════════════ */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ═════════════════════════════════════════════════════════
// GLOBALS
// ═════════════════════════════════════════════════════════
let lenis = null;
let scene, camera, renderer;
let particleLayers = [];
const mouse  = { x: 0, y: 0, tx: 0, ty: 0 };
const scroll = { y: 0, ty: 0 };
let isMobile = window.innerWidth < 768;
let perfTier = 'high'; // 'low' | 'mid' | 'high'

function detectPerfTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile && mem <= 2) perfTier = 'low';
  else if (isMobile || mem <= 4 || cores <= 4) perfTier = 'mid';
  else perfTier = 'high';

  // Reduce render quality on mobile
  if (isMobile && renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }
}

function getParticleCount() {
  if (perfTier === 'low') return 100;   // very low
  if (perfTier === 'mid') return 300;   // mobile
  return 2000;                          // desktop (reduced from 3000)
}

// Lazy load background images
// ════════════════ ACCESSIBILITY ════════════════
function initAccessibility() {
  // Add aria-labels to all variant images
  document.querySelectorAll('.variant-img').forEach((img) => {
    const card = img.closest('.variant-card');
    const name = card?.querySelector('.variant-name')?.textContent || 'Product image';
    img.setAttribute('role', 'img');
    img.setAttribute('aria-label', name);
  });

  // Improve focus visibility on interactive elements
  document.querySelectorAll('button, a, input, .btn-cart-add, .filter-btn').forEach((el) => {
    if (!el.hasAttribute('aria-label') && el.textContent?.trim()) {
      el.setAttribute('aria-label', el.textContent.trim());
    }
  });
}

// ════════════════ PRODUCT SEARCH ════════════════
function initSearch() {
  const input = document.getElementById('filterSearch');
  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();

    // Reset filter buttons when searching
    if (query) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    }

    document.querySelectorAll('.product-section').forEach((section) => {
      const text = section.textContent?.toLowerCase() || '';
      const variantNames = Array.from(section.querySelectorAll('.variant-name'))
        .map(el => el.textContent?.toLowerCase() || '').join(' ');

      if (!query || text.includes(query) || variantNames.includes(query)) {
        section.classList.remove('filtered-out');
      } else {
        section.classList.add('filtered-out');
      }
    });

    setTimeout(() => ScrollTrigger.refresh(), 100);
  });
}

// ════════════════ MODAL FOCUS TRAP ════════════════
function initFocusTrap() {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modal.querySelectorAll(focusableSelector);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Auto-focus first element when modal opens
  const observer = new MutationObserver(() => {
    if (!modal.classList.contains('hidden')) {
      setTimeout(() => {
        const first = modal.querySelector(focusableSelector);
        if (first) first.focus();
      }, 300);
    }
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
}

// ════════════════ LAZY VIDEO LOADING ════════════════
function initLazyLoading() {
  if ('loading' in HTMLImageElement.prototype) return; // browser supports native lazy loading

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const el = e.target;
        if (el.dataset.bg) {
          el.style.backgroundImage = `url('${el.dataset.bg}')`;
          delete el.dataset.bg;
        }
        observer.unobserve(el);
      }
    });
  }, { rootMargin: '300px' });

  document.querySelectorAll('.variant-img, .case-img, .ig-img').forEach((el) => {
    const style = el.style.backgroundImage;
    if (style && style !== 'none') {
      const url = style.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1];
      if (url) {
        el.dataset.bg = url;
        el.style.backgroundImage = 'none';
        observer.observe(el);
      }
    }
  });
}

// ═════════════════════════════════════════════════════════
// THREE.JS — ENHANCED PARTICLE FOREST (5 layers + light rays)
// ═════════════════════════════════════════════════════════
function initThreeJS() {
  detectPerfTier();
  const particleCount = getParticleCount();
  console.log('%c🌿 Performance tier: ' + perfTier + ' (' + particleCount + ' particles)',
    'color:#4ADE80;');

  const canvas = document.getElementById('bg-canvas');
  scene  = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.5,
    100
  );
  camera.position.set(0, 0, 18);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Deeper fog for more atmosphere
  scene.fog = new THREE.FogExp2('#1A2A1E', 0.00025);

  // ── 5 particle layers: deep → mid → near → core → streaks ──
  const layerDefs = [
    // 1. Deep background — large, slow, heavily fogged
    {
      label: 'deep',
      count: Math.floor(particleCount * 0.12),
      size: 0.18,
      zRange: [-40, -55],
      speed: 0.025,
      color: '#1A3A22',
      opacity: 0.6,
      mouseInfluence: 0.3,
    },
    // 2. Mid layer — medium particles
    {
      label: 'mid',
      count: Math.floor(particleCount * 0.38),
      size: 0.08,
      zRange: [-15, -28],
      speed: 0.05,
      color: '#2D6B3F',
      opacity: 0.55,
      mouseInfluence: 0.6,
    },
    // 3. Near layer — smaller, faster, brighter
    {
      label: 'near',
      count: Math.floor(particleCount * 0.30),
      size: 0.04,
      zRange: [-4, -12],
      speed: 0.09,
      color: '#3DA85C',
      opacity: 0.5,
      mouseInfluence: 1.0,
    },
    // 4. Core — bright highlight particles near the center
    {
      label: 'core',
      count: Math.floor(particleCount * 0.20),
      size: 0.025,
      zRange: [-1, -5],
      speed: 0.14,
      color: '#4ADE80',
      opacity: 0.65,
      mouseInfluence: 1.8,
      centerCluster: true,
    },
  ];

  layerDefs.forEach((def) => {
    const geometry  = new THREE.BufferGeometry();
    const positions = new Float32Array(def.count * 3);
    const originals = new Float32Array(def.count * 3);

    for (let i = 0; i < def.count; i++) {
      let px, py;
      if (def.centerCluster) {
        // Cluster near center with gaussian-like distribution
        px = (Math.random() + Math.random() + Math.random()) / 3 * 20 - 10;
        py = (Math.random() + Math.random() + Math.random()) / 3 * 16 - 8;
      } else {
        px = (Math.random() - 0.5) * 50;
        py = (Math.random() - 0.5) * 40;
      }
      const pz = def.zRange[0] + Math.random() * (def.zRange[1] - def.zRange[0]);

      positions[i * 3]     = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;

      originals[i * 3]     = px;
      originals[i * 3 + 1] = py;
      originals[i * 3 + 2] = pz;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle texture
    const texCanvas = document.createElement('canvas');
    texCanvas.width  = 48;
    texCanvas.height = 48;
    const ctx = texCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, def.color);
    grad.addColorStop(0.15, def.color);
    grad.addColorStop(0.5, def.color + '88');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 48, 48);
    const texture = new THREE.CanvasTexture(texCanvas);

    const material = new THREE.PointsMaterial({
      size: def.size,
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: def.opacity,
      transparent: true,
      color: new THREE.Color(def.color),
    });

    const points = new THREE.Points(geometry, material);
    points.userData = {
      def,
      originals,
      phaseOffset: Math.random() * Math.PI * 2,
    };
    scene.add(points);
    particleLayers.push(points);
  });

  // ── 5. Light rays — vertical elongated particles ──
  const rayCount = isMobile ? 40 : 120;
  const rayGeo = new THREE.BufferGeometry();
  const rayPositions = new Float32Array(rayCount * 3);
  const rayOriginals = new Float32Array(rayCount * 3);

  for (let i = 0; i < rayCount; i++) {
    const px = (Math.random() - 0.5) * 30;
    const py = (Math.random() - 0.5) * 20;
    const pz = -3 + Math.random() * -8;
    rayPositions[i * 3] = px;
    rayPositions[i * 3 + 1] = py;
    rayPositions[i * 3 + 2] = pz;
    rayOriginals[i * 3] = px;
    rayOriginals[i * 3 + 1] = py;
    rayOriginals[i * 3 + 2] = pz;
  }

  rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));

  // Create vertical streak texture
  const streakCanvas = document.createElement('canvas');
  streakCanvas.width  = 8;
  streakCanvas.height = 128;
  const sctx = streakCanvas.getContext('2d');
  const sgrad = sctx.createLinearGradient(0, 0, 0, 128);
  sgrad.addColorStop(0, 'transparent');
  sgrad.addColorStop(0.3, '#4ADE8044');
  sgrad.addColorStop(0.5, '#4ADE8088');
  sgrad.addColorStop(0.7, '#4ADE8044');
  sgrad.addColorStop(1, 'transparent');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 8, 128);
  const streakTex = new THREE.CanvasTexture(streakCanvas);

  const rayMat = new THREE.PointsMaterial({
    size: 0.35,
    map: streakTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.25,
    transparent: true,
  });

  const rays = new THREE.Points(rayGeo, rayMat);
  rays.userData = {
    def: { label: 'rays', speed: 0.04, mouseInfluence: 1.2, opacity: 0.25 },
    originals: rayOriginals,
    phaseOffset: 0,
  };
  scene.add(rays);
  particleLayers.push(rays);
}

function animateThreeJS(time) {
  requestAnimationFrame(animateThreeJS);

  // Smooth mouse & scroll follow
  mouse.tx  += (mouse.x - mouse.tx)   * 0.035;
  mouse.ty  += (mouse.y - mouse.ty)   * 0.035;
  scroll.ty += (scroll.y - scroll.ty) * 0.06;

  // Camera drift — stronger mouse response
  camera.position.x += (mouse.tx * 4.5 - camera.position.x) * 0.025;
  camera.position.y += (-mouse.ty * 3.0 - scroll.ty * 0.18 - camera.position.y) * 0.025;
  camera.lookAt(0, -scroll.ty * 0.12, -8);

  // Animate particle layers
  particleLayers.forEach((layer) => {
    const positions = layer.geometry.attributes.position.array;
    const originals = layer.userData.originals;
    const def       = layer.userData.def;
    const count     = positions.length / 3;
    const speed     = def.speed;
    const mouseInf  = def.mouseInfluence || 0.3;
    const phaseBase = layer.userData.phaseOffset;

    for (let i = 0; i < count; i++) {
      const idx   = i * 3;
      const ox    = originals[idx];
      const oy    = originals[idx + 1];
      const phase = i * 0.013 + time * 0.00015 * speed + phaseBase;

      // Natural drift + mouse parallax
      const mx = mouse.tx * mouseInf * 1.5;
      const my = mouse.ty * mouseInf * 1.5;

      positions[idx]     = ox + Math.sin(phase) * speed * 1.3 + mx;
      positions[idx + 1] = oy + Math.cos(phase * 0.7) * speed * 1.0 + my;
    }

    layer.geometry.attributes.position.needsUpdate = true;

    // Opacity breathing
    const baseOp = def.opacity;
    layer.material.opacity = baseOp + Math.sin(time * 0.0004 + phaseBase) * 0.05;
  });

  renderer.render(scene, camera);
}

function onResize() {
  isMobile = window.innerWidth < 768;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
}

// ═════════════════════════════════════════════════════════
// LENIS — SMOOTH SCROLL
// ═════════════════════════════════════════════════════════
async function initLenis() {
  try {
    const mod = await import(
      'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.mjs'
    );
    const LenisClass = mod.default || mod.Lenis;

    lenis = new LenisClass({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    lenis.on('scroll', ({ scroll: s }) => {
      scroll.y = s / window.innerHeight;
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  } catch (e) {
    console.warn('Lenis unavailable — falling back to native scroll');
    window.addEventListener(
      'scroll',
      () => { scroll.y = window.scrollY / window.innerHeight; },
      { passive: true }
    );
  }
}

// ═════════════════════════════════════════════════════════
// GSAP SCROLLTRIGGER — SCENE ANIMATIONS
// ═════════════════════════════════════════════════════════
function initScrollAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  // ── HERO ──
  document.querySelectorAll('#hero [data-anim="fade-up"]').forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 60 },
      {
        opacity: 1, y: 0, duration: 1.2, delay: i * 0.25,
        scrollTrigger: { trigger: '#hero', start: 'top 80%' },
        ease: 'power3.out',
      }
    );
  });

  document.querySelectorAll('#hero [data-anim="type-text"]').forEach((el) => {
    gsap.fromTo(el,
      { clipPath: 'inset(0 100% 0 0)' },
      {
        clipPath: 'inset(0 0% 0 0)', duration: 1.8, delay: 0.3,
        scrollTrigger: { trigger: '#hero', start: 'top 80%' },
        ease: 'power3.inOut',
      }
    );
  });

  // ── MANIFESTO ──
  document.querySelectorAll('.manifesto-line').forEach((line, i) => {
    gsap.fromTo(line,
      { opacity: 0, x: -40 },
      {
        opacity: 1, x: 0, duration: 0.9, delay: i * 0.3,
        scrollTrigger: { trigger: '#manifesto', start: 'top 70%' },
        ease: 'power3.out',
      }
    );
  });

  // ── PRODUCT SECTIONS ──
  document.querySelectorAll('.product-section').forEach((section) => {
    // Overlay elements fade up sequentially
    const animEls = section.querySelectorAll('[data-anim]');
    animEls.forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 50 },
        {
          opacity: 1, y: 0, duration: 0.9, delay: i * 0.1,
          scrollTrigger: {
            trigger: section,
            start: 'top 62%',
            toggleActions: 'play none none none',
          },
          ease: 'power3.out',
        }
      );
    });

    // Background image — dynamic scroll-driven zoom + parallax
    const bg = section.querySelector('.product-bg-image');
    if (bg) {
      // Initial reveal
      gsap.fromTo(bg,
        { scale: 1.1, opacity: 0 },
        {
          scale: 1, opacity: 1, duration: 1.8,
          scrollTrigger: {
            trigger: section,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
          ease: 'power2.out',
        }
      );

      // Continuous scroll-driven zoom (Ken Burns effect)
      gsap.to(bg, {
        scale: 1.12,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
      });
    }
  });

  // ── PATH — pipeline nodes light up ──
  const pathNodes = document.querySelectorAll('.path-node');
  ScrollTrigger.create({
    trigger: '#path',
    start: 'top 55%',
    onEnter: () => {
      pathNodes.forEach((n, j) => {
        gsap.to(n, { opacity: 1, duration: 0.5, delay: j * 0.3 });
      });
    },
    onLeaveBack: () => {
      pathNodes.forEach((n) => {
        gsap.to(n, { opacity: 0.3, duration: 0.3 });
      });
    },
  });

  // ── TERMINAL — lines appear ──
  document.querySelectorAll('.terminal-line').forEach((line, i) => {
    gsap.fromTo(line,
      { opacity: 0 },
      {
        opacity: 1, duration: 0.5, delay: i * 0.5 + 0.4,
        scrollTrigger: { trigger: '#contact', start: 'top 68%' },
        ease: 'none',
      }
    );
  });
}

// ═════════════════════════════════════════════════════════
// VIDEO SYSTEM
// Supports BOTH local MP4 and YouTube fallback
// ═════════════════════════════════════════════════════════

// Product → video mapping
// To use YOUR local MP4 files, replace the 'local' paths below:
//   e.g. 'video/wall.mp4', 'video/desk.mp4', etc.
const VIDEO_MAP = {
  'signature-space': { local: 'video/signature-space.mp4', youtube: '0I_zhhMin4E' },
  'wall':            { local: 'video/wall.mp4',            youtube: '0I_zhhMin4E' },
  'desk':            { local: 'video/desk.mp4',            youtube: '0I_zhhMin4E' },
  'gift':            { local: 'video/gift.mp4',            youtube: '0I_zhhMin4E' },
  'doctor':          { local: 'video/doctor-forest.mp4',   youtube: '0I_zhhMin4E' },
};

function openVideo(productKey) {
  const modal      = document.getElementById('video-modal');
  const frame      = document.getElementById('video-frame');
  const videoEl    = document.getElementById('video-local');
  const iframeWrap = document.getElementById('video-iframe-wrap');
  const videoWrap  = document.getElementById('video-local-wrap');

  const videoInfo  = VIDEO_MAP[productKey];

  if (!videoInfo) return;

  // Hide both first
  iframeWrap.classList.add('hidden');
  videoWrap.classList.add('hidden');

  // Stop any previous playback
  videoEl.pause();
  videoEl.src = '';
  frame.src = '';

  // Helper: show YouTube
  function playYouTube() {
    iframeWrap.classList.remove('hidden');
    frame.src = `https://www.youtube.com/embed/${videoInfo.youtube}?autoplay=1&rel=0`;
  }

  // Try local MP4 first — if error, fall back to YouTube
  if (videoInfo.local) {
    let handled = false;

    const fallback = () => {
      if (handled) return;
      handled = true;
      videoEl.removeEventListener('loadeddata', success);
      videoEl.removeEventListener('error', fallback);
      videoEl.pause();
      videoEl.src = '';
      videoWrap.classList.add('hidden');
      playYouTube();
    };

    const success = () => {
      if (handled) return;
      handled = true;
      videoEl.removeEventListener('error', fallback);
    };

    videoEl.addEventListener('loadeddata', success, { once: true });
    videoEl.addEventListener('error', fallback, { once: true });

    // Start loading — if it doesn't load in 2s, fallback
    videoEl.src = videoInfo.local;
    videoEl.load();
    videoWrap.classList.remove('hidden');

    setTimeout(fallback, 2500);
  } else if (videoInfo.youtube) {
    playYouTube();
  }

  modal.classList.remove('hidden');
}

function closeVideo() {
  const modal      = document.getElementById('video-modal');
  const frame      = document.getElementById('video-frame');
  const videoEl    = document.getElementById('video-local');

  frame.src = '';
  videoEl.pause();
  videoEl.src = '';
  modal.classList.add('hidden');
}

function initInlineVideos() {
  // Background videos play inline — mute all, ensure autoplay
  document.querySelectorAll('.product-video-bg, .brand-video-full').forEach((video) => {
    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    // Play when section enters viewport, pause when not
    const section = video.closest('.product-section, .brand-video-section');
    if (!section) return;

    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.3 }).observe(section);
  });

  // ── Brand video play/pause button + text fade ──
  const brandVideo  = document.getElementById('brandVideo');
  const brandBtn    = document.getElementById('brandVideoBtn');
  const brandOverlay = document.querySelector('.brand-video-overlay');
  if (brandVideo && brandBtn) {

    // Text hides when playing, shows when paused
    function hideOverlay() {
      if (brandOverlay) gsap.to(brandOverlay, { opacity: 0, duration: 0.5, ease: 'power2.out' });
      brandBtn.classList.remove('paused');
    }
    function showOverlay() {
      if (brandOverlay) gsap.to(brandOverlay, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      brandBtn.classList.add('paused');
    }

    brandBtn.addEventListener('click', () => {
      if (brandVideo.paused) {
        const playPromise = brandVideo.play();
        if (playPromise) {
          playPromise.then(() => hideOverlay()).catch(() => {
            brandVideo.load();
            brandVideo.play().then(() => hideOverlay()).catch(() => {});
          });
        }
      } else {
        brandVideo.pause();
        showOverlay();
      }
    });

    brandVideo.addEventListener('play',  () => hideOverlay());
    brandVideo.addEventListener('pause', () => showOverlay());
    brandVideo.addEventListener('ended', () => showOverlay());

    // Init state
    if (!brandVideo.paused) {
      hideOverlay();
    } else {
      showOverlay();
    }
  }
}

// ═════════════════════════════════════════════════════════
// WHATSAPP — purchase & inquiry links
// ═════════════════════════════════════════════════════════
const WA_NUMBER = '85212345678'; // ← Replace with real number

function waURL(product, action) {
  const text = encodeURIComponent(
    `Hi HK MiniJungle — I'm interested in ${product}. ${action === 'buy' ? 'I would like to purchase.' : 'Can you tell me more?'}`
  );
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

// ═════════════════════════════════════════════════════════
// SHOPPING CART
// ═════════════════════════════════════════════════════════
function getCart() {
  try { return JSON.parse(localStorage.getItem('mj_cart') || '[]'); }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem('mj_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0);

  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const itemsEl = document.getElementById('cart-items');
  const sumTotal = document.getElementById('cart-sum-total');

  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = 'HK$' + total.toLocaleString();
  if (sumTotal) sumTotal.textContent = 'HK$' + total.toLocaleString();

  if (itemsEl) {
    if (cart.length === 0) {
      itemsEl.innerHTML = '<p class="cart-empty">Empty — add some green.</p>';
    } else {
      itemsEl.innerHTML = cart.map((item, idx) => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">HK$${item.price} &times; ${item.qty}</div>
          </div>
          <button class="cart-item-remove" data-cart-idx="${idx}" aria-label="Remove">&times;</button>
        </div>
      `).join('');

      // Bind remove buttons
      itemsEl.querySelectorAll('.cart-item-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.cartIdx);
          const cart = getCart();
          cart.splice(idx, 1);
          saveCart(cart);
          updateCartUI();
        });
      });
    }
  }
}

// ═════════════════════════════════════════════════════════
// PRODUCT DETAIL MODAL
// ═════════════════════════════════════════════════════════
const productData = {
  'signature-space': {
    index: 'PRODUCT / 01',
    name: 'Signature Space',
    desc: 'A one-of-one living installation for headquarters, flagship stores, and hotel lobbies. Designed as brand language — not decoration. Each piece is custom-sized, custom-planted, and custom-lit for the space it inhabits.',
    specs: ['Bespoke · Custom Dimensions · Brand Statement', 'Xponge Soilless · Closed-loop Water · LED Spectrum'],
  },
  'wall': {
    index: 'PRODUCT / 02',
    name: 'MiniJungle Living Ecosystem™',
    desc: 'A living painting. Slimmer than a frame, more alive than a garden. Wall-mounted, self-irrigating, zero-mess installation. The 55×240cm module clicks together like tiles — scale from a single statement piece to an entire living wall.',
    specs: ['55×240cm Standard · Ultra-thin 6cm Profile · Modular', 'Xponge Soilless · Closed-loop · Full-spectrum LED'],
  },
  'desk': {
    index: 'PRODUCT / 03',
    name: 'MiniJungle Desk',
    desc: 'A miniature forest on your desk. Not a houseplant — a designed object with presence, personality, and roots. Self-contained planter with integrated lighting. Perfect for personal desks, co-working spaces, and hotel rooms.',
    specs: ['Desktop Scale · Plug & Grow · Self-contained', 'Integrated LED · Water-level Indicator · Silent'],
  },
  'gift': {
    index: 'PRODUCT / 04',
    name: 'Gift Box',
    desc: 'Collected like art toys. Gifted like treasures. Grown like plants. Each box is a self-contained green universe — a curated selection of plant, vessel, and care card. Limited seasonal drops. Not a flower-shop gift box.',
    specs: ['Curated Box · Collectible · Shareable', 'Plant + Vessel + Care Card · Seasonal Drops'],
  },
  'doctor': {
    index: 'PRODUCT / 05',
    name: 'Doctor Forest',
    desc: 'A five-step green workplace strategy: Audit, Design, Install, Subscribe, and Storytell. For companies that want biophilic design as a service, not a one-time project. Includes ESG storytelling kit for your sustainability report.',
    specs: ['Audit · Design · Install · Maintain · Storytell', 'ESG Kit · Wellness Narrative · Team Workshop'],
  },
};

const variantCards = {
  'signature-space': [
    { variant: 'Flagship', price: 'XX,XXX', img: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&q=80' },
    { variant: 'Boutique', price: 'XX,XXX', img: 'https://images.unsplash.com/photo-1491147334573-44cbb4602074?w=800&q=80' },
    { variant: 'Pop-up', price: 'XX,XXX', img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80' },
  ],
  'wall': [
    { variant: 'Wall Classic', price: 'X,XXX', img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80' },
    { variant: 'Wall Panorama', price: 'X,XXX', img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80' },
    { variant: 'Wall Compact', price: 'X,XXX', img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80' },
  ],
  'desk': [
    { variant: 'Desk Solo', price: 'XXX', img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80' },
    { variant: 'Desk Duo', price: 'XXX', img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80' },
    { variant: 'Desk Mini', price: 'XXX', img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80' },
  ],
  'gift': [
    { variant: 'Seasonal Box', price: 'XXX', img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80' },
    { variant: 'Collector Box', price: 'XXX', img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80' },
    { variant: 'Mini Box', price: 'XXX', img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80' },
  ],
  'doctor': [
    { variant: 'Audit', price: 'XX,XXX', img: 'https://images.unsplash.com/photo-1491147334573-44cbb4602074?w=800&q=80' },
    { variant: 'Strategy', price: 'XX,XXX', img: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&q=80' },
    { variant: 'Full Service', price: 'XX,XXX', img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&q=80' },
  ],
};

let modalQty = 1;
let modalCurrentProduct = null;
let modalCurrentVariant = null;

function openProductModal(productKey, variantIdx) {
  const data = productData[productKey];
  const vc = variantCards[productKey]?.[variantIdx];
  if (!data || !vc) return;

  modalCurrentProduct = productKey;
  modalCurrentVariant = vc;
  modalQty = 1;

  document.getElementById('modalIndex').textContent = data.index;
  document.getElementById('modalName').textContent = data.name;
  document.getElementById('modalVariant').textContent = vc.variant;
  document.getElementById('modalDesc').textContent = data.desc;
  document.getElementById('modalSpecs').innerHTML = data.specs.map(s => `<span>${s}</span>`).join('');
  document.getElementById('modalPrice').textContent = 'HK$' + vc.price;
  document.getElementById('modalImage').style.backgroundImage = `url('${vc.img}')`;
  document.getElementById('qtyVal').textContent = '1';

  document.getElementById('product-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Play video if available
  const video = document.getElementById('modalVideo');
  if (video) { video.currentTime = 0; video.play().catch(() => {}); }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
  document.body.style.overflow = '';
  const video = document.getElementById('modalVideo');
  if (video) video.pause();
}

function initProductModal() {
  // Click on variant card → open modal
  document.querySelectorAll('.variant-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Don't open if clicking the ADD TO CART button
      if (e.target.closest('.btn-cart-add')) return;

      const section = card.closest('.product-section');
      const productKey = section?.dataset.product;
      const cards = Array.from(section?.querySelectorAll('.variant-card') || []);
      const idx = cards.indexOf(card);
      if (productKey && idx >= 0) openProductModal(productKey, idx);
    });

    // Make card look clickable
    card.style.cursor = 'pointer';
  });

  // Close button
  document.querySelector('.product-modal-close').addEventListener('click', closeProductModal);
  document.querySelector('.product-modal-backdrop').addEventListener('click', closeProductModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProductModal(); });

  // Quantity
  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (modalQty > 1) { modalQty--; document.getElementById('qtyVal').textContent = modalQty; }
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    modalQty++; document.getElementById('qtyVal').textContent = modalQty;
  });

  // Add to cart from modal
  document.getElementById('modalAddCart').addEventListener('click', () => {
    if (!modalCurrentVariant) return;
    const name = `${productData[modalCurrentProduct]?.name} — ${modalCurrentVariant.variant}`;
    const price = modalCurrentVariant.price;
    const cart = getCart();
    const existing = cart.find(i => i.name === name);
    if (existing) { existing.qty += modalQty; }
    else { cart.push({ name, price, qty: modalQty }); }
    saveCart(cart);
    updateCartUI();

    // Flash cart bar
    const mini = document.getElementById('mini-cart');
    if (mini) { mini.classList.add('open'); setTimeout(() => mini.classList.remove('open'), 2000); }
    document.getElementById('modalAddCart').textContent = 'ADDED ✓';
    setTimeout(() => { document.getElementById('modalAddCart').textContent = 'ADD TO CART'; }, 1200);
  });

  // Buy now from modal
  document.getElementById('modalBuyNow').addEventListener('click', () => {
    if (!modalCurrentVariant) return;
    const name = `${productData[modalCurrentProduct]?.name} — ${modalCurrentVariant.variant}`;
    const price = modalCurrentVariant.price;
    const params = new URLSearchParams();
    params.set('items', JSON.stringify([{ name, price, qty: modalQty }]));
    window.location.href = '/checkout.html?' + params.toString();
  });
}

function initCart() {
  const toggle = document.getElementById('cart-toggle');
  const mini = document.getElementById('mini-cart');
  const close = document.getElementById('cart-close');
  const checkout = document.getElementById('cart-checkout');

  if (toggle && mini) {
    toggle.addEventListener('click', () => mini.classList.toggle('open'));
    if (close) close.addEventListener('click', () => mini.classList.remove('open'));
  }

  // Checkout → goes to checkout page with cart data
  if (checkout) {
    checkout.addEventListener('click', () => {
      const cart = getCart();
      if (cart.length === 0) return;
      const params = new URLSearchParams();
      params.set('items', JSON.stringify(cart));
      window.location.href = '/checkout.html?' + params.toString();
    });
  }

  // Add to cart buttons
  document.querySelectorAll('.btn-cart-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.cartName || 'Product';
      const price = btn.dataset.cartPrice || '---';

      const cart = getCart();
      const existing = cart.find(i => i.name === name);
      if (existing) {
        existing.qty++;
      } else {
        cart.push({ name, price, qty: 1 });
      }
      saveCart(cart);
      updateCartUI();

      // Flash feedback
      btn.textContent = 'ADDED ✓';
      btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = 'ADD TO CART';
        btn.classList.remove('added');
      }, 1200);

      // Open mini cart briefly
      if (mini) {
        mini.classList.add('open');
        setTimeout(() => mini.classList.remove('open'), 2500);
      }
    });
  });

  // Doctor Forest INQUIRE buttons → WhatsApp
  document.querySelectorAll('#product-doctor .btn-cart-add').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const name = btn.dataset.cartName || 'Doctor Forest';
      const text = encodeURIComponent(`Hi HK MiniJungle — I'm interested in ${name}. Can you tell me more?`);
      window.open(`https://wa.me/${WA_NUMBER}?text=${text}`, '_blank', 'noopener');
    });
  });

  updateCartUI();
}

// ═════════════════════════════════════════════════════════
// CUSTOM CURSOR
// ═════════════════════════════════════════════════════════
const cursor = { dot: null, ring: null, hover: false };

function initCursor() {
  if (isMobile) return;

  // Create cursor elements
  cursor.dot = document.createElement('div');
  cursor.dot.id = 'cursor-dot';
  cursor.ring = document.createElement('div');
  cursor.ring.id = 'cursor-ring';

  document.body.appendChild(cursor.dot);
  document.body.appendChild(cursor.ring);

  // Track mouse for cursor
  document.addEventListener('mousemove', (e) => {
    gsap.to(cursor.dot, { x: e.clientX, y: e.clientY, duration: 0.08, ease: 'power2.out' });
    gsap.to(cursor.ring, { x: e.clientX, y: e.clientY, duration: 0.25, ease: 'power2.out' });
  });

  // Hover effect on interactive elements
  const hoverTargets = document.querySelectorAll('a, button, .btn-buy, .btn-video, .btn-inquire, .contact-link, .path-node');
  hoverTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      cursor.hover = true;
      gsap.to(cursor.ring, { scale: 2.5, borderColor: 'rgba(143,191,154,0.6)', duration: 0.3 });
      gsap.to(cursor.dot, { scale: 0.5, duration: 0.3 });
    });
    el.addEventListener('mouseleave', () => {
      cursor.hover = false;
      gsap.to(cursor.ring, { scale: 1, borderColor: 'rgba(143,191,154,0.25)', duration: 0.3 });
      gsap.to(cursor.dot, { scale: 1, duration: 0.3 });
    });
  });

  // Hide on leaving window
  document.addEventListener('mouseleave', () => {
    gsap.to([cursor.dot, cursor.ring], { opacity: 0, duration: 0.2 });
  });
  document.addEventListener('mouseenter', () => {
    gsap.to([cursor.dot, cursor.ring], { opacity: 1, duration: 0.2 });
  });
}

// ═════════════════════════════════════════════════════════
// SIDE NAVIGATION DOTS
// ═════════════════════════════════════════════════════════
function initNavDots() {
  const sections = document.querySelectorAll('.scene, .product-section');
  if (sections.length === 0) return;

  // Create nav container
  const nav = document.createElement('nav');
  nav.id = 'side-nav';

  sections.forEach((section, i) => {
    const dot = document.createElement('button');
    dot.className = 'nav-dot';
    dot.setAttribute('aria-label', section.id || `section-${i}`);
    dot.addEventListener('click', () => {
      if (lenis) {
        lenis.scrollTo(section);
      } else {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    });
    nav.appendChild(dot);
  });

  document.body.appendChild(nav);

  // Track active section
  const dots = nav.querySelectorAll('.nav-dot');
  sections.forEach((section, i) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 40%',
      end: 'bottom 40%',
      onEnter:  () => { dots.forEach(d => d.classList.remove('active')); dots[i]?.classList.add('active'); },
      onEnterBack: () => { dots.forEach(d => d.classList.remove('active')); dots[i]?.classList.add('active'); },
    });
  });
}

// ═════════════════════════════════════════════════════════
// FULL-SCREEN NAVIGATION
// ═════════════════════════════════════════════════════════
function initNav() {
  const hamburger = document.getElementById('hamburger');
  const fullnav   = document.getElementById('fullnav');
  if (!hamburger || !fullnav) return;

  let open = false;

  function toggle() {
    open = !open;
    hamburger.classList.toggle('open', open);
    fullnav.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  hamburger.addEventListener('click', toggle);

  // Close on nav link click
  fullnav.querySelectorAll('[data-nav-close]').forEach((link) => {
    link.addEventListener('click', () => {
      if (open) toggle();
      // Smooth scroll handled by Lenis
    });
  });

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) toggle();
  });
}

// ═════════════════════════════════════════════════════════
// PAGE TRANSITIONS
// ═════════════════════════════════════════════════════════
function initCardVideos() {
  // Use video/1.mp4 as demo hover video for all product cards
  const demoVideo = 'video/1.mp4';

  document.querySelectorAll('.product-section').forEach((section) => {
    const images = section.querySelectorAll('.variant-img');
    images.forEach((img) => {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.innerHTML = `<source src="${demoVideo}" type="video/mp4">`;
      img.appendChild(video);

      const card = img.closest('.variant-card');
      if (card) {
        card.addEventListener('mouseenter', () => { video.play().catch(() => {}); });
        card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
      }
    });
  });
}

function initCardBreathing() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.variant-card').forEach((card) => {
    observer.observe(card);
  });
}

// ═════════════════════════════════════════════════════════
// LANGUAGE TOGGLE
// ═════════════════════════════════════════════════════════
const translations = {
  en: {
    brand: 'A LIVING SYSTEM. NOT A PLANT.',
    products: 'Products',
    navigate: 'Navigate',
    contact: 'Contact',
  },
  zh: {
    brand: '不是植物。是生命系统。',
    products: '产品系列',
    navigate: '导航',
    contact: '联系我们',
  },
};

function initLanguageToggle() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;

  function applyLang(lang) {
    btn.textContent = lang === 'zh' ? 'EN' : '中文';
    document.documentElement.lang = lang;

    // Swap all [data-en][data-zh] elements
    document.querySelectorAll('[data-en][data-zh]').forEach((el) => {
      const val = el.dataset[lang];
      if (val.includes('<') && val.includes('>')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // Swap placeholders
    document.querySelectorAll('[data-placeholder-en][data-placeholder-zh]').forEach((el) => {
      el.placeholder = el.dataset['placeholder' + (lang === 'zh' ? 'Zh' : 'En')];
    });

    // Save
    localStorage.setItem('mj_lang', lang);
  }

  const savedLang = localStorage.getItem('mj_lang') || 'en';
  applyLang(savedLang);

  btn.addEventListener('click', () => {
    const current = document.documentElement.lang;
    applyLang(current === 'en' ? 'zh' : 'en');
  });
}

// ═════════════════════════════════════════════════════════
// MOBILE BOTTOM NAV
// ═════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════
// PRODUCT FILTER
// ═════════════════════════════════════════════════════════
function initFilter() {
  const bar = document.getElementById('filterBar');
  if (!bar) return;

  bar.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      document.querySelectorAll('.product-section').forEach((section) => {
        if (filter === 'all' || section.dataset.filter?.includes(filter)) {
          section.classList.remove('filtered-out');
        } else {
          section.classList.add('filtered-out');
        }
      });

      // Refresh ScrollTrigger after filter change
      setTimeout(() => ScrollTrigger.refresh(), 100);
    });
  });
}

// ═════════════════════════════════════════════════════════
// WISHLIST
// ═════════════════════════════════════════════════════════
function getWishlist() {
  try { return JSON.parse(localStorage.getItem('mj_wishlist') || '[]'); }
  catch { return []; }
}
function saveWishlist(w) { localStorage.setItem('mj_wishlist', JSON.stringify(w)); }
function isWished(name) { return getWishlist().includes(name); }

function toggleWishlist(name) {
  const w = getWishlist();
  const idx = w.indexOf(name);
  if (idx >= 0) w.splice(idx, 1);
  else w.push(name);
  saveWishlist(w);
  return idx < 0; // true = now wished
}

function updateWishlistBtn(btn, name) {
  if (isWished(name)) {
    btn.classList.add('wished');
    btn.textContent = '♥';
  } else {
    btn.classList.remove('wished');
    btn.textContent = '♡';
  }
}

// ═════════════════════════════════════════════════════════
// SMART RECOMMENDATIONS
// ═════════════════════════════════════════════════════════
const PRODUCT_RELATIONS = {
  'signature-space': ['wall', 'desk'],
  'wall': ['desk', 'signature-space', 'gift'],
  'desk': ['wall', 'gift'],
  'gift': ['desk', 'wall'],
  'doctor': ['signature-space', 'wall'],
};

function trackView(productKey, variantIdx) {
  let views = [];
  try { views = JSON.parse(localStorage.getItem('mj_views') || '[]'); } catch {}
  views.push({ key: productKey, idx: variantIdx, time: Date.now() });
  // Keep last 20 views
  if (views.length > 20) views = views.slice(-20);
  localStorage.setItem('mj_views', JSON.stringify(views));
}

function getRecommendations() {
  let views = [];
  try { views = JSON.parse(localStorage.getItem('mj_views') || '[]'); } catch {}
  if (views.length < 2) return [];

  // Get unique viewed product keys (last 5)
  const viewed = [...new Set(views.map(v => v.key).reverse())].slice(0, 5);

  // Collect related products, exclude already viewed
  const recs = new Set();
  viewed.forEach(key => {
    const related = PRODUCT_RELATIONS[key] || [];
    related.forEach(r => { if (!viewed.includes(r)) recs.add(r); });
  });

  return [...recs].slice(0, 3);
}

function showRecommendations() {
  const recs = getRecommendations();
  const bar = document.getElementById('rec-bar');
  const items = document.getElementById('recItems');
  if (!bar || !items || recs.length === 0) {
    if (bar) bar.classList.add('hidden');
    return;
  }

  items.innerHTML = recs.map(key => {
    const data = productData[key];
    const vc = variantCards[key]?.[0];
    if (!data || !vc) return '';
    return `
      <div class="rec-item" data-rec="${key}" data-rec-idx="0">
        <div class="rec-item-img" style="background-image:url('${vc.img}')"></div>
        <span class="rec-item-name">${data.name}</span>
        <span class="rec-item-price">HK$${vc.price}</span>
      </div>
    `;
  }).join('');

  // Bind clicks
  items.querySelectorAll('.rec-item').forEach(el => {
    el.addEventListener('click', () => {
      openProductModal(el.dataset.rec, parseInt(el.dataset.recIdx));
    });
  });

  bar.classList.remove('hidden');
}

function initRecommendations() {
  // Close button
  const close = document.getElementById('recClose');
  if (close) close.addEventListener('click', () => {
    document.getElementById('rec-bar').classList.add('hidden');
  });

  // Track views when modal opens (hooks into openProductModal)
  const origOpen = openProductModal;
  window.openProductModal = function(key, idx) {
    origOpen(key, idx);
    trackView(key, idx);
    setTimeout(showRecommendations, 600);
  };
}

function initWishlist() {
  // Modal wishlist button
  const modalBtn = document.getElementById('modalWishlist');
  if (modalBtn) {
    modalBtn.addEventListener('click', () => {
      const name = `${document.getElementById('modalName')?.textContent} — ${document.getElementById('modalVariant')?.textContent}`;
      const added = toggleWishlist(name);
      updateWishlistBtn(modalBtn, name);
      modalBtn.style.transform = 'scale(1.4)';
      setTimeout(() => modalBtn.style.transform = '', 300);
    });

    // Update when modal opens
    const origOpen = openProductModal;
    window.openProductModal = function(...args) {
      origOpen(...args);
      setTimeout(() => {
        const name = `${document.getElementById('modalName')?.textContent} — ${document.getElementById('modalVariant')?.textContent}`;
        updateWishlistBtn(modalBtn, name);
      }, 50);
    };
  }
}

// ═════════════════════════════════════════════════════════
// EMAIL SYSTEM — Resend-ready infrastructure
// ═════════════════════════════════════════════════════════
async function sendEmail(to, subject, html) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Hook into checkout: send order confirmation
function initEmailHooks() {
  const origFetch = window.fetch;
  // Intercept checkout API calls to also trigger email
  window.addEventListener('message', async (e) => {
    if (e.data?.type === 'order-placed' && e.data?.email) {
      const items = e.data.items || [];
      const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0);
      await sendEmail(e.data.email, 'Order Confirmed — HK MiniJungle',
        `<h2>Thank you for your order!</h2>
         <p>Items: ${items.map(i => i.name + ' x' + i.qty).join(', ')}</p>
         <p>Total: HK$${total.toLocaleString()}</p>
         <p>We'll be in touch via WhatsApp for delivery.</p>`
      );
    }
  });
}

function initMobileNav() {
  if (!isMobile) return;
  const nav = document.createElement('nav');
  nav.id = 'mobile-nav';
  nav.innerHTML = `
    <a href="#hero">Home</a>
    <a href="#product-space">Shop</a>
    <a href="#instagram">Social</a>
    <a href="#contact">Contact</a>
  `;
  document.body.appendChild(nav);

  // Highlight active link
  const links = nav.querySelectorAll('a');
  document.querySelectorAll('.scene, .product-section').forEach((section, i) => {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          if (links[i]) links[i].classList.add('active');
        }
      });
    }, { threshold: 0.4 }).observe(section);
  });
}

function initPageTransitions() {
  const overlay = document.getElementById('page-transition');
  if (!overlay) return;

  // Intercept internal link clicks for smooth transitions
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;

    e.preventDefault();

    // Fade in overlay
    overlay.classList.add('active');
    setTimeout(() => {
      window.location.href = href;
    }, 350);
  });
}

// ═════════════════════════════════════════════════════════
// PRODUCT HOVER EFFECTS
// ═════════════════════════════════════════════════════════
function initProductHover() {
  document.querySelectorAll('.product-section').forEach((section) => {
    const bg = section.querySelector('.product-bg-image');
    const video = section.querySelector('.product-video-bg');
    const overlay = section.querySelector('.product-overlay');
    if (!overlay) return;

    section.addEventListener('mouseenter', () => {
      if (bg) gsap.to(bg, { scale: 1.05, opacity: 0.4, duration: 0.8, ease: 'power2.out' });
      if (video) gsap.to(video, { scale: 1.05, opacity: 0.55, duration: 0.8, ease: 'power2.out' });
      gsap.to(overlay, { x: 10, duration: 0.6, ease: 'power2.out' });
    });

    section.addEventListener('mouseleave', () => {
      if (bg) gsap.to(bg, { scale: 1, opacity: 0.3, duration: 0.8, ease: 'power2.out' });
      if (video) gsap.to(video, { scale: 1, opacity: 0.45, duration: 0.8, ease: 'power2.out' });
      gsap.to(overlay, { x: 0, duration: 0.6, ease: 'power2.out' });
    });
  });
}

// ═════════════════════════════════════════════════════════
// INTRO SOUNDSCAPE — replaced by ambient background music (see toggleAmbient above BOOT)
// ═════════════════════════════════════════════════════════
let _unused_audioCtx = null;

function _unused_playIntroSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.3);
    master.gain.setValueAtTime(0.5, now + 3.5);
    master.gain.linearRampToValueAtTime(0, now + 5.5);
    master.connect(ctx.destination);

    // Helper: play a soft bell/chime
    function chime(freq, start, vol = 0.15, dur = 1.5) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 1.02, start + dur);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + dur);
    }

    // Helper: soft rising tone
    function rise(startFreq, endFreq, start, dur = 3, vol = 0.08) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, start);
      osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.4);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + dur);
    }

    // Helper: water droplet
    function droplet(baseFreq, start, vol = 0.12) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, start + 0.25);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.3);
    }

    // Helper: soft noise texture (like rustling leaves)
    function leafTexture(start, dur = 4, vol = 0.04) {
      const bufferSize = ctx.sampleRate * dur;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.3);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
      source.stop(start + dur);
    }

    // ── Compose the soundscape ──

    // Ambient rising pad (like a plant stretching toward light)
    rise(180, 520, now, 5.0, 0.07);
    rise(220, 660, now + 0.3, 4.5, 0.05);
    rise(150, 440, now + 0.6, 4.8, 0.06);

    // Leaf rustle texture
    leafTexture(now, 5.0, 0.035);

    // Gentle chimes — like water drops on leaves
    chime(523, now + 1.0, 0.12, 1.5);
    chime(659, now + 1.6, 0.10, 1.3);
    chime(784, now + 2.2, 0.11, 1.4);
    chime(880, now + 2.8, 0.09, 1.2);
    chime(1047, now + 3.4, 0.10, 1.5);
    chime(1175, now + 3.8, 0.08, 1.3);

    // Water droplets
    droplet(1200, now + 0.8, 0.10);
    droplet(1400, now + 1.5, 0.08);
    droplet(1100, now + 2.3, 0.09);
    droplet(1600, now + 3.1, 0.07);
    droplet(1300, now + 3.7, 0.08);
    droplet(1800, now + 4.2, 0.06);

    // Sub-bass warmth
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, now);
    sub.frequency.linearRampToValueAtTime(60, now + 5);
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.06, now + 0.5);
    subGain.gain.linearRampToValueAtTime(0, now + 5);
    sub.connect(subGain);
    subGain.connect(master);
    sub.start(now);
    sub.stop(now + 5.5);

    console.log('%c🔊 Soundscape playing %c— 5s plant-growth audio',
      'color:#4ADE80;', 'color:#A09A90;');

  } catch (e) {
    console.warn('Audio not supported:', e.message);
  }
}

// ════════════════ AMBIENT BACKGROUND MUSIC ════════════════
let audioCtx = null;
let ambientPlaying = false;
let ambientNodes = [];

function createAmbientMusic() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const ctx = audioCtx;
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  ambientNodes = [master];
  // Sub drone
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 40;
  const sg = ctx.createGain(); sg.gain.value = 0.06; sub.connect(sg); sg.connect(master); sub.start();
  // Mid drone
  const mid = ctx.createOscillator(); mid.type = 'sine'; mid.frequency.value = 120;
  const mg = ctx.createGain(); mg.gain.value = 0.03; mid.connect(mg); mg.connect(master); mid.start();
  (function evolve() { if (!ambientPlaying) return; mid.frequency.linearRampToValueAtTime(100 + Math.random() * 60, ctx.currentTime + 8); setTimeout(evolve, 8000); })();
  // High shimmer
  const hi = ctx.createOscillator(); hi.type = 'sine'; hi.frequency.value = 600;
  const hg = ctx.createGain(); hg.gain.value = 0.015; hi.connect(hg); hg.connect(master); hi.start();
  (function evolve() { if (!ambientPlaying) return; hi.frequency.linearRampToValueAtTime(500 + Math.random() * 300, ctx.currentTime + 6); setTimeout(evolve, 6000); })();
  // Leaf rustle
  const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2000; nf.Q.value = 0.3;
  const ng = ctx.createGain(); ng.gain.value = 0.02; noise.connect(nf); nf.connect(ng); ng.connect(master); noise.start();
  // Occasional chimes
  function chime(f, del) { if (!ambientPlaying) return; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, ctx.currentTime + del); g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + del + 0.08); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + del + 2); o.connect(g); g.connect(master); o.start(ctx.currentTime + del); o.stop(ctx.currentTime + del + 2); }
  (function sched() { if (!ambientPlaying) return; const del = 3 + Math.random() * 10; const fs = [262, 330, 392, 523, 659, 784]; chime(fs[Math.floor(Math.random() * fs.length)], 0); chime(fs[Math.floor(Math.random() * fs.length)], 0.15); setTimeout(sched, del * 1000); })();
  master.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 2);
}

function stopAmbient() { ambientPlaying = false; if (ambientNodes[0]) { ambientNodes[0].gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5); setTimeout(() => { ambientNodes.forEach(n => { try { if (n.stop) n.stop(); } catch {} }); ambientNodes = []; }, 2000); } }

function toggleAmbient() {
  const btn = document.getElementById('sound-indicator');
  if (ambientPlaying) { stopAmbient(); if (btn) { btn.textContent = '🔇'; btn.classList.remove('playing'); } }
  else { ambientPlaying = true; createAmbientMusic(); if (btn) { btn.textContent = '🔊'; btn.classList.add('playing'); } }
}

// ═════════════════════════════════════════════════════════
// BOOT
// ═════════════════════════════════════════════════════════
async function boot() {
  initThreeJS();
  requestAnimationFrame(animateThreeJS);

  await initLenis();
  initScrollAnimations();
  initInlineVideos();
  initProductModal();
  initCart();
  initCursor();
  initNavDots();
  initProductHover();
  initCardBreathing();
  initCardVideos();
  initNav();
  initPageTransitions();
  initLanguageToggle();
  initFilter();
  initRecommendations();
  initWishlist();
  initMobileNav();
  initEmailHooks();
  initLazyLoading();
  initAccessibility();
  initSearch();
  initFocusTrap();

  // Ambient background music — toggle on click
  const soundBtn = document.getElementById('sound-indicator');
  let soundInit = false;
  function initSound() {
    if (soundInit) return;
    soundInit = true;
    toggleAmbient();
    document.removeEventListener('click', initSound);
    document.removeEventListener('touchstart', initSound);
  }
  document.addEventListener('click', initSound);
  document.addEventListener('touchstart', initSound);
  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAmbient();
    });
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);

  // Touch: clamp mouse to center on mobile
  window.addEventListener('touchmove', () => {
    mouse.x = 0; mouse.y = 0;
  }, { passive: true });

  console.log('%c🌿 HK MiniJungle %c— System online.',
    'color:#7BA884;font-size:1.2em;', 'color:#E8E4DD;');
}

boot();
