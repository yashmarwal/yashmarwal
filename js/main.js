/**
 * Yash Marwal — Broadsheet Editorial Portfolio Logic
 *
 * State lives in explicit machines (see machine() below and docs/STATE.md).
 * Each machine has ONE source of truth, mirrored to a data-*-state attribute on its host
 * element so CSS, tests and agents can read it, and fires a `statechange` event.
 * Existing CSS classes (open, show, past-masthead, in ...) are still applied, derived from the state.
 */

const machines = {};

/**
 * Tiny finite-state machine.
 *  - transitions: { from: [allowed next states] }, or '*' for "any to any"
 *  - onEnter: { state: (from) => side effects }
 * Illegal transitions are ignored and return false, so impossible states cannot happen.
 */
function machine(name, host, { initial, transitions, onEnter = {} }) {
  let state = initial;
  host.setAttribute(`data-${name}-state`, state);
  const api = {
    name,
    get: () => state,
    is: (s) => state === s,
    to(next) {
      if (next === state) return false;
      if (transitions !== '*' && !(transitions[state] || []).includes(next)) return false;
      const from = state;
      state = next;
      host.setAttribute(`data-${name}-state`, next);
      if (onEnter[next]) onEnter[next](from);
      document.dispatchEvent(new CustomEvent('statechange', { detail: { machine: name, from, to: next } }));
      return true;
    },
  };
  return api;
}

// Read-only snapshot for tests and agents: portfolioState() in the console.
window.portfolioState = () => Object.fromEntries(Object.entries(machines).map(([k, m]) => [k, Array.isArray(m) ? m.map((x) => x.get()) : m.get()]));

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  machines.app = machine('app', root, { initial: root.getAttribute('data-app-state') || 'loading', transitions: { loading: ['ready'] } });

  initLiveDate();
  initNavigation();
  initModals();
  initFigureAccess();
  initInquiryForm();
  initMotion();
  initBrandSwap();
  initFitLine();

  machines.app.to('ready');
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
 * Navigation: scroll-spy ("section" machine) and the mobile drawer ("menu" machine).
 */
function initNavigation() {
  const root = document.documentElement;
  const navLinks = document.querySelectorAll('header nav a[data-path], footer nav a[data-path]');
  const sections = document.querySelectorAll('section[id]');
  const ACTIVE = ['active', 'bg-primary-container', 'text-on-primary-container', 'font-bold', 'px-2', 'py-1'];

  // section: which part of the page is under the header. Any section can follow any other.
  const section = machines.section = machine('section', root, {
    initial: 'front-page',
    transitions: '*',
  });
  const paint = (current) => navLinks.forEach(link => {
    link.classList.remove(...ACTIVE);
    if (link.getAttribute('data-path') === current) link.classList.add(...ACTIVE);
  });
  const goto = (current) => { if (section.to(current)) paint(current); };

  const firstSection = sections[0];
  const spy = () => {
    const scrollPosition = window.scrollY + 160;
    let current = '';
    sections.forEach(s => {
      if (scrollPosition >= s.offsetTop && scrollPosition < s.offsetTop + s.offsetHeight) current = s.getAttribute('id');
    });
    // the masthead and hero sit above the first section: that is still the front page
    if (!current && firstSection && scrollPosition < firstSection.offsetTop) current = 'front-page';
    if (current) goto(current);
  };
  window.addEventListener('scroll', spy, { passive: true });
  spy(); // correct on load too (deep links, restored scroll)

  // menu: closed <-> open. One state, three mirrors (class, aria-expanded, icon).
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileMenuBtn || !mobileNav) return;
  const icon = document.getElementById('mobile-menu-icon');
  const apply = (open) => {
    mobileNav.classList.toggle('open', open);
    mobileMenuBtn.setAttribute('aria-expanded', String(open));
    if (icon) icon.textContent = open ? 'close' : 'menu';
  };
  const menu = machines.menu = machine('menu', mobileNav, {
    initial: 'closed',
    transitions: { closed: ['open'], open: ['closed'] },
    onEnter: { open: () => apply(true), closed: () => apply(false) },
  });

  mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.to('closed')));
  mobileMenuBtn.addEventListener('click', () => menu.to(menu.is('open') ? 'closed' : 'open'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.to('closed'); });
  // tapping anywhere outside the menu (and its button) closes it
  document.addEventListener('click', (e) => {
    if (menu.is('open') && !mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) menu.to('closed');
  });
  // the drawer only exists below the md breakpoint: never leave it "open" on a wider screen
  matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) menu.to('closed'); });
}

/**
 * Image lightbox ("lightbox" machine): closed <-> open.
 * Escape, the close buttons and a click on the backdrop all close it; focus returns to what opened it.
 */
function initModals() {
  const mediaModal = document.getElementById('media-modal');
  if (!mediaModal) return;
  const closeBtns = mediaModal.querySelectorAll('.close-modal');
  let opener = null;

  const lightbox = machines.lightbox = machine('lightbox', mediaModal, {
    initial: 'closed',
    transitions: { closed: ['open'], open: ['closed'] },
    onEnter: {
      open: () => {
        mediaModal.classList.remove('hidden');
        mediaModal.classList.add('flex');
        mediaModal.setAttribute('aria-hidden', 'false');
        if (closeBtns[0]) closeBtns[0].focus({ preventScroll: true });
      },
      closed: () => {
        mediaModal.classList.add('hidden');
        mediaModal.classList.remove('flex');
        mediaModal.setAttribute('aria-hidden', 'true');
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        opener = null;
      },
    },
  });

  const open = (trigger) => {
    const img = trigger.querySelector('img');
    const src = trigger.dataset.src || (img && img.naturalWidth ? img.src : '');
    if (!src) return; // image still pending

    const title = trigger.getAttribute('data-title') || '';
    document.getElementById('modal-media-title').textContent = title;
    const frame = document.createElement('div');
    frame.className = 'border border-primary bg-white p-1';
    const big = document.createElement('img');
    big.src = src;
    big.alt = title;
    big.className = 'w-full h-auto object-contain block max-h-[70vh]';
    frame.appendChild(big);
    document.getElementById('modal-media-content').replaceChildren(frame);

    opener = trigger;
    lightbox.to('open');
  };

  document.querySelectorAll('[data-media]').forEach((trigger) => {
    trigger.addEventListener('click', () => open(trigger));
    trigger.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && trigger.getAttribute('role') === 'button') { e.preventDefault(); open(trigger); }
    });
  });

  closeBtns.forEach((btn) => btn.addEventListener('click', () => lightbox.to('closed')));
  mediaModal.addEventListener('click', (e) => { if (e.target === mediaModal) lightbox.to('closed'); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.is('open')) return;
    if (e.key === 'Escape') lightbox.to('closed');
    // the dialog has a single control, so keep keyboard focus on it
    if (e.key === 'Tab') { e.preventDefault(); if (closeBtns[0]) closeBtns[0].focus({ preventScroll: true }); }
  });
}

// A gallery figure opens the lightbox once its image exists: make it a real, keyboard-reachable button.
function initFigureAccess() {
  document.querySelectorAll('[data-media]').forEach((figure) => {
    const img = figure.querySelector('img');
    if (!img) return;
    if (img.complete && img.naturalWidth) makeOpenable(figure);
    else img.addEventListener('load', () => makeOpenable(figure), { once: true });
  });
}

/**
 * Inquiry form ("form" machine) and its toast ("toast" machine).
 *   form:  idle -> sending -> sent | fallback;  sent/fallback -> idle when edited, or -> sending on resubmit
 *   toast: hidden <-> visible, one timer (a second message restarts it instead of being cut short)
 * Sends through Web3Forms when a key is set, otherwise opens the visitor's email app.
 * Get a free access key at https://web3forms.com (use mynameisyashmarwal@outlook.com) and paste it here.
 */
const WEB3FORMS_KEY = '7148f298-782a-45c4-ae86-b4583af2c31d';
const CONTACT_EMAIL = 'mynameisyashmarwal@outlook.com';

function initInquiryForm() {
  const form = document.getElementById('inquiry-form');
  const toastEl = document.getElementById('toast-notification');
  if (!form) return;

  let timer = 0;
  const toast = toastEl ? (machines.toast = machine('toast', toastEl, {
    initial: 'hidden',
    transitions: { hidden: ['visible'], visible: ['hidden'] },
    onEnter: {
      visible: () => toastEl.classList.add('show'),
      hidden: () => toastEl.classList.remove('show'),
    },
  })) : null;

  const srStatus = document.getElementById('sr-status');
  const showToast = (title, body) => {
    if (srStatus) srStatus.textContent = `${title}. ${body}`; // announced to screen readers
    if (!toast) return;
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = body;
    toast.to('visible'); // no-op if already visible: the text is simply replaced
    clearTimeout(timer);
    timer = setTimeout(() => toast.to('hidden'), 5000);
  };

  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  const settle = (from) => {
    if (from !== 'sending') return;
    button.disabled = false;
    button.textContent = label;
    form.removeAttribute('aria-busy');
  };
  const state = machines.form = machine('form', form, {
    initial: 'idle',
    transitions: {
      idle: ['sending', 'fallback'],
      sending: ['sent', 'fallback'],
      sent: ['idle', 'sending', 'fallback'],
      fallback: ['idle', 'sending'],
    },
    onEnter: {
      sending: () => { button.disabled = true; button.textContent = 'SENDING…'; form.setAttribute('aria-busy', 'true'); },
      sent: settle,
      fallback: settle,
      idle: settle,
    },
  });

  const openMailClient = (name, email, message) => {
    const subject = encodeURIComponent(`Portfolio inquiry — ${name}`);
    const body = encodeURIComponent(`${message}\n\nReply to: ${email}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    showToast('Opening your email app', 'Your message is ready to send.');
  };

  // editing again after a result returns the form to idle
  form.addEventListener('input', () => state.to('idle'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.is('sending')) return; // a send is already in flight
    const name = document.getElementById('inquiry-name').value.trim();
    const email = document.getElementById('inquiry-email').value.trim();
    const message = document.getElementById('inquiry-message').value.trim();
    if (!name || !email || !message) return;

    if (!WEB3FORMS_KEY) {
      openMailClient(name, email, message);
      form.reset();
      state.to('fallback');
      return;
    }

    state.to('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
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
      state.to('sent');
      showToast('Message sent', 'Thank you. Yash will reply to your email.');
    } catch (err) {
      state.to('fallback');
      openMailClient(name, email, message); // fall back so the message is never lost
    }
  });
}

/**
 * Scroll motion: sections fade up, heading rules draw, figures draw themselves.
 * Reveals are a one-way latch (pending -> `in` class); see docs/STATE.md.
 * Skipped entirely for visitors who prefer reduced motion.
 */
function initMotion() {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    root.setAttribute('data-motion', 'reduced');
    root.classList.remove('js');
    return;
  }
  root.setAttribute('data-motion', 'full');

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
        if (entry.target.matches('figure')) seeFigure(entry.target); // the drawing starts when its figure is on screen
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal, .rule-draw').forEach((el) => io.observe(el));
}

/**
 * "In The Field" diagrams draw themselves ("figure" machine, one per figure):
 *   static -> loading -> ready -> drawn      (or loading -> failed, which keeps the plain <img>)
 * Each SVG is fetched and inlined so CSS can animate its parts. `drawn` needs both `ready` and
 * the figure being on screen, in either order.
 */
const seen = new WeakSet();
const figureMachines = new WeakMap();

function seeFigure(figure) {
  seen.add(figure);
  tryDraw(figure);
}

function tryDraw(figure) {
  const m = figureMachines.get(figure);
  if (m && m.is('ready') && seen.has(figure)) m.to('drawn');
}

// keyboard access for a figure that can open the lightbox
function makeOpenable(figure) {
  figure.classList.add('cursor-pointer');
  figure.setAttribute('role', 'button');
  figure.setAttribute('tabindex', '0');
  figure.setAttribute('aria-label', `Open larger view: ${figure.getAttribute('data-title') || 'figure'}`);
}

function initDrawnFigures() {
  machines.figures = [];
  document.querySelectorAll('#in-the-field figure[data-media]').forEach(async (figure) => {
    const img = figure.querySelector('img');
    if (!img) return;
    const src = img.getAttribute('src');
    let svg = null;

    const m = machine('figure', figure, {
      initial: 'static',
      transitions: { static: ['loading'], loading: ['ready', 'failed'], ready: ['drawn'] },
      onEnter: {
        drawn: () => svg && svg.classList.add('in'),
      },
    });
    figureMachines.set(figure, m);
    machines.figures.push(m);
    m.to('loading');

    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
      svg = document.importNode(doc.documentElement, true);
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
      makeOpenable(figure);

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
      m.to('ready');
      tryDraw(figure); // the figure may already be on screen
    } catch (err) {
      m.to('failed'); // keep the static <img>
    }
  });
}

/**
 * The header shows "Indian B2B" while the big masthead name is on screen ("brand" machine: top),
 * then switches to "Yash Marwal" once the masthead has scrolled under the header (scrolled).
 */
function initBrandSwap() {
  const masthead = document.querySelector('#front-page h1');
  if (!masthead || !('IntersectionObserver' in window)) return;
  const root = document.documentElement;
  const brand = machines.brand = machine('brand', root, {
    initial: 'top',
    transitions: { top: ['scrolled'], scrolled: ['top'] },
    onEnter: {
      scrolled: () => root.classList.add('past-masthead'),
      top: () => root.classList.remove('past-masthead'),
    },
  });
  // 'brand-swap' is set by the inline script in <head> so the first paint is already correct
  new IntersectionObserver(([entry]) => {
    brand.to(entry.isIntersecting ? 'top' : 'scrolled');
    requestAnimationFrame(() => root.classList.add('brand-ready')); // transitions start only after the first check
  }, { rootMargin: '-80px 0px 0px 0px' }).observe(masthead);
}

/**
 * Keeps a value on a single line next to its label by shrinking the font only as much
 * as needed (used for the Ventures row in At a Glance).
 */
function initFitLine() {
  const els = document.querySelectorAll("[data-fit]");
  const fit = () => els.forEach((el) => {
    el.style.fontSize = "";
    const row = el.parentElement;
    const label = el.previousElementSibling;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const room = row.clientWidth - label.offsetWidth - gap;
    if (el.scrollWidth > room) {
      el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * room / el.scrollWidth) + "px";
    }
  });
  fit();
  window.addEventListener("resize", fit);
  if (document.fonts) document.fonts.ready.then(fit);
}
