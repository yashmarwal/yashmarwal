/**
 * Yash Marwal — Broadsheet Editorial Portfolio Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initLiveDate();
  initNavigation();
  initModals();
  initInquiryForm();
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

  // Mobile menu trigger toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileNav.classList.add('hidden')));
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
      if (!img || !img.naturalWidth) return; // image still pending

      const title = trigger.getAttribute("data-title") || "";
      document.getElementById("modal-media-title").textContent = title;
      const frame = document.createElement("div");
      frame.className = "border border-primary bg-white p-1";
      const big = document.createElement("img");
      big.src = img.src;
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
