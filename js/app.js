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
let particleCount = isMobile ? 800 : 3000;

// ═════════════════════════════════════════════════════════
// THREE.JS — MULTI-LAYER PARTICLE FOREST
// ═════════════════════════════════════════════════════════
function initThreeJS() {
  const canvas = document.getElementById('bg-canvas');
  scene  = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.5,
    100
  );
  camera.position.set(0, 0, 20);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Fog — creates the "deep forest" depth
  scene.fog = new THREE.FogExp2('#050505', 0.0004);

  // ── Three depth layers ──
  const layerDefs = [
    {
      label: 'deep',
      count: Math.floor(particleCount * 0.15),
      size: 0.14,
      zRange: [-35, -50],
      speed: 0.03,
      color: '#1B3B2B',
      opacity: 0.7,
    },
    {
      label: 'mid',
      count: Math.floor(particleCount * 0.45),
      size: 0.07,
      zRange: [-12, -25],
      speed: 0.06,
      color: '#3D6B4F',
      opacity: 0.55,
    },
    {
      label: 'near',
      count: Math.floor(particleCount * 0.40),
      size: 0.035,
      zRange: [-3, -10],
      speed: 0.10,
      color: '#7BA884',
      opacity: 0.45,
    },
  ];

  layerDefs.forEach((def) => {
    const geometry  = new THREE.BufferGeometry();
    const positions = new Float32Array(def.count * 3);
    const originals = new Float32Array(def.count * 3);

    for (let i = 0; i < def.count; i++) {
      const px = (Math.random() - 0.5) * 50;
      const py = (Math.random() - 0.5) * 40;
      const pz = def.zRange[0] + Math.random() * (def.zRange[1] - def.zRange[0]);

      positions[i * 3]     = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;

      originals[i * 3]     = px;
      originals[i * 3 + 1] = py;
      originals[i * 3 + 2] = pz;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Soft radial particle texture
    const texCanvas = document.createElement('canvas');
    texCanvas.width  = 32;
    texCanvas.height = 32;
    const ctx = texCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, def.color);
    grad.addColorStop(0.25, def.color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
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
}

function animateThreeJS(time) {
  requestAnimationFrame(animateThreeJS);

  // Smooth mouse & scroll follow
  mouse.tx  += (mouse.x - mouse.tx)   * 0.04;
  mouse.ty  += (mouse.y - mouse.ty)   * 0.04;
  scroll.ty += (scroll.y - scroll.ty) * 0.07;

  // Camera drift
  camera.position.x += (mouse.tx * 3.0 - camera.position.x) * 0.03;
  camera.position.y += (-mouse.ty * 2.0 - scroll.ty * 0.18 - camera.position.y) * 0.03;
  camera.lookAt(0, -scroll.ty * 0.1, -10);

  // Animate particle layers
  particleLayers.forEach((layer) => {
    const positions = layer.geometry.attributes.position.array;
    const originals = layer.userData.originals;
    const count     = positions.length / 3;
    const speed     = layer.userData.def.speed;
    const phaseBase = layer.userData.phaseOffset;

    for (let i = 0; i < count; i++) {
      const idx   = i * 3;
      const ox    = originals[idx];
      const oy    = originals[idx + 1];
      const phase = i * 0.013 + time * 0.00015 * speed + phaseBase;

      positions[idx]     = ox + Math.sin(phase) * speed * 1.2;
      positions[idx + 1] = oy + Math.cos(phase * 0.7) * speed * 0.9;
      // z stays anchored (depth is fixed)
    }

    layer.geometry.attributes.position.needsUpdate = true;

    // Subtle opacity breathing
    const baseOp = layer.userData.def.opacity;
    layer.material.opacity = baseOp + Math.sin(time * 0.0004 + layer.userData.phaseOffset) * 0.04;
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

function initVideoButtons() {
  // VIDEO buttons on product cards
  document.querySelectorAll('.btn-video').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const section = btn.closest('.product-section');
      const productKey = section ? section.dataset.product : null;
      if (productKey) openVideo(productKey);
    });
  });

  // Modal close
  document.getElementById('video-modal').querySelector('.video-close').addEventListener('click', closeVideo);
  document.getElementById('video-modal').querySelector('.video-backdrop').addEventListener('click', closeVideo);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeVideo();
  });

  // Click on the video container itself shouldn't close it
  document.querySelector('.video-modal-box').addEventListener('click', (e) => {
    e.stopPropagation();
  });
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

function initWhatsAppButtons() {
  document.querySelectorAll('.btn-buy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = btn.dataset.waProduct || 'HK MiniJungle';
      window.open(waURL(product, 'buy'), '_blank', 'noopener');
    });
  });

  document.querySelectorAll('.btn-inquire').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = btn.dataset.waProduct || 'HK MiniJungle';
      window.open(waURL(product, 'inquire'), '_blank', 'noopener');
    });
  });
}

// ═════════════════════════════════════════════════════════
// BOOT
// ═════════════════════════════════════════════════════════
async function boot() {
  initThreeJS();
  requestAnimationFrame(animateThreeJS);

  await initLenis();
  initScrollAnimations();
  initVideoButtons();
  initWhatsAppButtons();

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
