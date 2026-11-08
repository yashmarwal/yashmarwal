/**
 * Yash Marwal — Broadsheet Editorial Portfolio Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initLiveDate();
  initNavigation();
  initModals();
  initInquiryForm();
  initMotion();
  initBrandSwap();
});

/**
 * Live broadsheet details, all computed from the real clock (Delhi time):
 * masthead date, volume/issue number, Delhi clock, and page load time.
 */
const DELHI = { timeZone: 'Asia/Kolkata' };

function delhiNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { ...DELHI, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { year: +parts.year, month: +parts.month, day: +parts.day, time: `${parts.hour}:${parts.minute}` };
}

function initLiveDate() {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const { year, month, day } = delhiNow();
  // Volume = years since launch year (2026 = Vol. 01); issue = day of the year.
  const dayOfYear = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
  const volume = pad(year - 2025);
  const issue = pad(dayOfYear, 3);

  const dateText = new Date().toLocaleDateString('en-US', { ...DELHI, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  document.querySelectorAll('#masthead-live-date, .live-date-stamp, #foot-today').forEach(el => { el.textContent = el.id === 'foot-today' ? `Published in New Delhi • ${dateText}` : dateText; });

  const issueEl = document.getElementById('issue-stamp');
  if (issueEl) issueEl.textContent = `Delhi Edition • Vol. ${volume} No. ${issue}`;
  const editionEl = document.getElementById('foot-edition');
  if (editionEl) editionEl.textContent = `EDITION: WEB • VOL. ${volume} • NO. ${issue}`;

  const stamp = document.getElementById('delhi-stamp');
  const tick = () => { if (stamp) stamp.textContent = `28°36'N 77°12'E • IST ${delhiNow().time}`; };
  tick();
  setInterval(tick, 30000);

  window.addEventListener('load', () => setTimeout(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const ready = document.getElementById('foot-ready');
    if (nav && nav.loadEventEnd > 0 && ready) {
      ready.textContent = `READY IN: ${(nav.loadEventEnd / 1000).toFixed(2)} s`;
      ready.classList.remove('hidden');
    }
  }, 0));
}

/**
 * Handles smooth section scrolling and active state updating for broadsheet nav links.
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('header nav a[data-path], footer nav a[data-path]');
  const sections = document.querySelectorAll('section[id]');

  // Scroll active state updates
  window.addEventListener('scroll', () => {
    let current = '';
    const scrollPosition = window.scrollY + 160;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'font-bold', 'px-2', 'py-1');
      if (link.getAttribute('data-path') === current) {
        link.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'font-bold', 'px-2', 'py-1');
      }
    });
  });

  // Mobile menu: a newspaper page turning down from the masthead (see css/style.css)
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    const icon = document.getElementById('mobile-menu-icon');
    const setOpen = (open) => {
      mobileNav.classList.toggle('open', open);
      mobileMenuBtn.setAttribute('aria-expanded', String(open));
      if (icon) icon.textContent = open ? 'close' : 'menu';
    };
    mobileNav.querySelectorAll('a').forEach((a, i) => {
      
      a.addEventListener('click', () => setOpen(false));
    });
    mobileMenuBtn.addEventListener('click', () => setOpen(!mobileNav.classList.contains('open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    // tapping anywhere outside the menu (and its button) closes it
    document.addEventListener('click', (e) => {
      if (mobileNav.classList.contains('open') && !mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) setOpen(false);
    });
  }
}

/**
 * Image lightbox for gallery figures
 */
function initModals() {
  const mediaModal = document.getElementById("media-modal");
  const closeBtns = document.querySelectorAll(".close-modal");
  const close = () => {
    mediaModal.classList.add("hidden");
    mediaModal.classList.remove("flex");
  };

  document.querySelectorAll("[data-media]").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const img = trigger.querySelector("img");
      const src = trigger.dataset.src || (img && img.naturalWidth ? img.src : '');
      if (!src) return; // image still pending

      const title = trigger.getAttribute("data-title") || "";
      document.getElementById("modal-media-title").textContent = title;
      const frame = document.createElement("div");
      frame.className = "border border-primary bg-white p-1";
      const big = document.createElement("img");
      big.src = src;
      big.alt = title;
      big.className = "w-full h-auto object-contain block max-h-[70vh]";
      frame.appendChild(big);
      document.getElementById("modal-media-content").replaceChildren(frame);

      mediaModal.classList.remove("hidden");
      mediaModal.classList.add("flex");
    });
  });

  closeBtns.forEach(btn => btn.addEventListener("click", close));
  mediaModal.addEventListener("click", e => { if (e.target === mediaModal) close(); });
}

/**
 * Inquiry form: sends through Web3Forms when a key is set, otherwise opens the visitor's email app.
 * Get a free access key at https://web3forms.com (use mynameisyashmarwal@outlook.com) and paste it here.
 */
const WEB3FORMS_KEY = '7148f298-782a-45c4-ae86-b4583af2c31d';
const CONTACT_EMAIL = 'mynameisyashmarwal@outlook.com';

function initInquiryForm() {
  const form = document.getElementById('inquiry-form');
  const toast = document.getElementById('toast-notification');
  if (!form) return;

  const showToast = (title, body) => {
    if (!toast) return;
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = body;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);
  };

  const openMailClient = (name, email, message) => {
    const subject = encodeURIComponent(`Portfolio inquiry — ${name}`);
    const body = encodeURIComponent(`${message}\n\nReply to: ${email}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    showToast('Opening your email app', 'Your message is ready to send.');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('inquiry-name').value.trim();
    const email = document.getElementById('inquiry-email').value.trim();
    const message = document.getElementById('inquiry-message').value.trim();
    if (!name || !email || !message) return;

    if (!WEB3FORMS_KEY) {
      openMailClient(name, email, message);
      form.reset();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'SENDING…';
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Portfolio inquiry — ${name}`,
          from_name: name,
          name,
          email,
          message,
          botcheck: form.querySelector('[name="botcheck"]').checked
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      form.reset();
      showToast('Message sent', 'Thank you. Yash will reply to your email.');
    } catch (err) {
      openMailClient(name, email, message); // fall back so the message is never lost
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

/**
 * Scroll motion: sections fade up, heading rules draw, figures draw themselves.
 * Skipped entirely for visitors who prefer reduced motion.
 */
function initMotion() {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    root.classList.remove('js');
    return;
  }

  const stagger = (nodes, cls = 'reveal', step = 0.09) =>
    nodes.forEach((el, i) => { el.classList.add(cls); el.style.setProperty('--d', `${i * step}s`); });

  document.querySelectorAll('main > div > section:not(:first-of-type)').forEach((section) => {
    const head = section.querySelector(':scope > div');
    if (head) {
      stagger([...head.querySelectorAll('h2, h2 + span, :scope > div:first-child > span')], 'reveal', 0.08);
      stagger([...head.querySelectorAll('.h-1, .h-px')], 'rule-draw', 0.12);
    }
  });

  stagger([...document.querySelectorAll('#ventures article')]);
  stagger([...document.querySelectorAll('#the-profile .grid > div')], 'reveal', 0.14);
  stagger([...document.querySelectorAll('#in-the-field figure')], 'reveal', 0.1);
  initDrawnFigures();
  stagger([...document.querySelectorAll('#about p')], 'reveal', 0.12);
  stagger([...document.querySelectorAll('#inquiries .grid > div, #inquiries form')], 'reveal', 0.1);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        // the drawing starts when its figure scrolls into view
        entry.target.querySelectorAll('.draw-svg').forEach((s) => s.classList.add('in'));
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal, .rule-draw').forEach((el) => io.observe(el));
}

/**
 * "In The Field" diagrams draw themselves: outlines trace in, rules sweep across,
 * labels fade in reading order. Each SVG is fetched and inlined so CSS can animate
 * its parts; if that fails the plain <img> stays in place.
 */
function initDrawnFigures() {
  document.querySelectorAll('#in-the-field figure[data-media]').forEach(async (figure) => {
    const img = figure.querySelector('img');
    if (!img) return;
    const src = img.getAttribute('src');
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
      const svg = document.importNode(doc.documentElement, true);
      if (svg.nodeName !== 'svg') throw new Error('not svg');

      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('class', 'draw-svg absolute inset-0 w-full h-full block');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', img.alt);

      const frame = img.parentElement;
      frame.querySelectorAll('span').forEach((s) => s.remove()); // "IMAGE PENDING" label
      img.replaceWith(svg);
      figure.dataset.src = src;
      figure.classList.add('cursor-pointer');
      if (figure.classList.contains('in')) svg.classList.add('in'); // figure was already on screen

      let i = 0;
      svg.querySelectorAll('rect, path, circle, text').forEach((el) => {
        const delay = Math.min(i * 0.022, 1.7).toFixed(2) + 's';
        const stroked = el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none';
        const filled = el.getAttribute('fill') !== 'none';
        el.style.setProperty('--d', delay);
        if (el.tagName === 'text' || el.hasAttribute('stroke-dasharray')) {
          el.classList.add('d-text');
        } else if (stroked) {
          el.style.setProperty('--len', el.getTotalLength());
          el.classList.add('d-stroke');
          if (filled) el.classList.add('d-fill');
        } else if (el.tagName === 'rect' && +el.getAttribute('height') <= 6) {
          el.classList.add('d-rule');
        } else if (+el.getAttribute('width') < 1280) { // skip the full-bleed paper background
          el.classList.add('d-fill');
        }
        i++;
      });
    } catch (err) {
      /* keep the static <img> */
    }
  });
}

/**
 * The header shows "The Front Page" while the big masthead name is on screen,
 * then switches to "Yash Marwal" once the masthead has scrolled under the header.
 */
function initBrandSwap() {
  const masthead = document.querySelector('#front-page h1');
  if (!masthead || !('IntersectionObserver' in window)) return;
  const root = document.documentElement;
  root.classList.add('brand-swap');
  new IntersectionObserver(([entry]) => {
    root.classList.toggle('past-masthead', !entry.isIntersecting);
  }, { rootMargin: '-80px 0px 0px 0px' }).observe(masthead);
}
