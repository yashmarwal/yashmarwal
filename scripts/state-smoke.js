// Smoke test for every state machine in js/main.js, driven through headless Chrome.
// Usage: node scripts/state-smoke.js [url]      (default http://localhost:3030/, serve the site first: npm start)
// Needs Chrome (set CHROME_PATH if it is not at the default Windows location). Exits 1 on any failure.
const { spawn } = require('child_process');
const path = require('path');

const url = process.argv[2] || 'http://localhost:3030/';
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9666;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failures++; };

(async () => {
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(__dirname, '..', 'node_modules', '.state-smoke-profile')}`, 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d.result || d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  const load = async (w, mobile, reduced = false) => {
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
    await send('Page.navigate', { url });
    await sleep(3500);
  };
  const st = (sel, name) => ev(`document.querySelector(${JSON.stringify(sel)}).getAttribute('data-${name}-state')`);

  // ---------- phone: app, menu ----------
  await load(390, true);
  check('app: ready after init', (await ev('document.documentElement.dataset.appState')) === 'ready');
  check('portfolioState() lists machines', (await ev('Object.keys(portfolioState()).sort().join()')) === 'app,brand,figures,form,lightbox,menu,section,toast');

  check('menu: starts closed', (await st('#mobile-nav', 'menu')) === 'closed');
  await ev("document.getElementById('mobile-menu-btn').click()");
  await sleep(500);
  check('menu: button opens it (state, class, aria, icon)', (await ev(`(() => { const n=document.getElementById('mobile-nav'); return n.dataset.menuState==='open' && n.classList.contains('open') && document.getElementById('mobile-menu-btn').getAttribute('aria-expanded')==='true' && document.getElementById('mobile-menu-icon').textContent==='close' })()`)));
  await ev("document.querySelector('main h2').click()");
  check('menu: tap outside closes it', (await st('#mobile-nav', 'menu')) === 'closed');
  await ev("document.getElementById('mobile-menu-btn').click()");
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  check('menu: Escape closes it', (await st('#mobile-nav', 'menu')) === 'closed');
  await ev("document.getElementById('mobile-menu-btn').click()");
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  check('menu: resizing to desktop closes it', (await st('#mobile-nav', 'menu')) === 'closed');

  // ---------- desktop: figures, lightbox, brand, section ----------
  await load(1280, false);
  await ev("document.getElementById('in-the-field').scrollIntoView()");
  await sleep(3500);
  check('figures: all four drawn', (await ev(`[...document.querySelectorAll('#in-the-field figure')].map(f=>f.dataset.figureState).join()`)) === 'drawn,drawn,drawn,drawn');
  check('figures: keyboard-reachable buttons', (await ev(`[...document.querySelectorAll('#in-the-field figure')].every(f=>f.getAttribute('role')==='button' && f.tabIndex===0)`)));

  await ev("document.querySelector('#in-the-field figure').focus()");
  await ev("document.querySelector('#in-the-field figure').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  await sleep(200);
  check('lightbox: Enter opens it, focus moves to Close', (await ev(`(() => { const m=document.getElementById('media-modal'); return m.dataset.lightboxState==='open' && m.getAttribute('aria-hidden')==='false' && document.activeElement.classList.contains('close-modal') })()`)));
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  await sleep(200);
  check('lightbox: Escape closes it, focus returns to the figure', (await ev(`(() => { const m=document.getElementById('media-modal'); return m.dataset.lightboxState==='closed' && m.classList.contains('hidden') && document.activeElement===document.querySelector('#in-the-field figure') })()`)));
  await ev("document.querySelector('#in-the-field figure').click()");
  await ev("document.getElementById('media-modal').click()");
  check('lightbox: backdrop click closes it', (await st('#media-modal', 'lightbox')) === 'closed');

  await ev("document.getElementById('ventures').scrollIntoView()");
  await sleep(800);
  check('brand: scrolled past the masthead', (await ev("document.documentElement.dataset.brandState")) === 'scrolled');
  check('section: ventures active (state + nav highlight)', (await ev(`document.documentElement.dataset.sectionState==='ventures' && document.querySelector('header nav a[data-path=ventures]').classList.contains('active') && !document.querySelector('header nav a[data-path=front-page]').classList.contains('active')`)));
  await ev('window.scrollTo(0,0)');
  await sleep(800);
  check('brand + section: back at the top', (await ev(`document.documentElement.dataset.brandState==='top' && document.documentElement.dataset.sectionState==='front-page' && document.querySelector('header nav a[data-path=front-page]').classList.contains('active')`)));

  // ---------- form + toast (network stubbed, nothing is sent) ----------
  await ev(`window.__calls = 0; window.__mode = 'ok'; const real = window.fetch;
    window.fetch = (u, o) => /web3forms/.test(u) ? (window.__calls++, new Promise((res, rej) => setTimeout(() => window.__mode === 'ok' ? res({ json: async () => ({ success: true }) }) : window.__mode === 'bad' ? res({ json: async () => ({ success: false, message: 'x' }) }) : rej(new Error('net')), 600))) : real(u, o);
    document.getElementById('inquiry-name').value='Test'; document.getElementById('inquiry-email').value='t@example.com'; document.getElementById('inquiry-message').value='Hello';`);
  await ev("document.getElementById('inquiry-form').requestSubmit(); document.getElementById('inquiry-form').requestSubmit();");
  await sleep(150);
  check('form: submit moves to sending (button disabled, aria-busy)', (await ev(`(() => { const f=document.getElementById('inquiry-form'); return f.dataset.formState==='sending' && f.getAttribute('aria-busy')==='true' && f.querySelector('button[type=submit]').disabled })()`)));
  await sleep(1000);
  check('form: double submit sent only one request', (await ev('window.__calls')) === 1);
  check('form: success ends in "sent", toast visible, announced', (await ev(`document.getElementById('inquiry-form').dataset.formState==='sent' && document.getElementById('toast-notification').dataset.toastState==='visible' && /Message sent/.test(document.getElementById('sr-status').textContent) && !document.getElementById('inquiry-form').hasAttribute('aria-busy')`)));
  await ev("document.getElementById('inquiry-message').dispatchEvent(new Event('input',{bubbles:true}))");
  check('form: editing again returns it to idle', (await st('#inquiry-form', 'form')) === 'idle');

  await ev(`window.__mode='bad'; document.getElementById('inquiry-name').value='Test'; document.getElementById('inquiry-email').value='t@example.com'; document.getElementById('inquiry-message').value='Hello'; document.getElementById('inquiry-form').requestSubmit()`);
  await sleep(1000);
  check('form: failure falls back to the email app and re-enables the button', (await ev(`document.getElementById('inquiry-form').dataset.formState==='fallback' && !document.querySelector('#inquiry-form button[type=submit]').disabled && document.querySelector('#inquiry-form button[type=submit]').textContent.includes('SEND MESSAGE')`)));

  // toast timer: a second message must restart the 5 s timer, not be cut short by the first
  await ev(`window.__mode='ok'; for (const [i,v] of [['inquiry-name','T'],['inquiry-email','t@example.com'],['inquiry-message','Hi']]) document.getElementById(i).value=v; document.getElementById('inquiry-form').requestSubmit()`);
  await sleep(4200); // toast #1 visible since ~0.6 s
  await ev(`for (const [i,v] of [['inquiry-name','T'],['inquiry-email','t@example.com'],['inquiry-message','Hi']]) document.getElementById(i).value=v; document.getElementById('inquiry-form').requestSubmit()`);
  await sleep(2400); // 6.6 s after toast #1: the first timer (5 s) would have hidden it
  check('toast: second message restarts the timer', (await st('#toast-notification', 'toast')) === 'visible');
  await sleep(5200);
  check('toast: hides after its own 5 s', (await st('#toast-notification', 'toast')) === 'hidden');

  // ---------- reduced motion ----------
  await load(1280, false, true);
  check('motion: reduced-motion leaves figures as plain images, still openable', (await ev(`document.documentElement.dataset.motion==='reduced' && document.querySelectorAll('#in-the-field figure img').length===4 && [...document.querySelectorAll('#in-the-field figure')].every(f=>f.getAttribute('role')==='button')`)));

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll state-machine checks passed');
  ws.close(); chrome.kill();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
