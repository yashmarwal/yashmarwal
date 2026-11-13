# State machines

Every piece of UI state that changes over time is an explicit machine in `js/main.js` (`machine()`).
Each has one source of truth, mirrored to a `data-<name>-state` attribute on its host element, and fires a
`statechange` event on `document` (`detail: { machine, from, to }`). Illegal transitions are ignored.
CSS classes (`open`, `show`, `past-masthead`, `in`) are still applied, derived from the state.

Read everything at once from the console or an agent: `portfolioState()`.

| Machine | Host element | States | Transitions | Also drives |
|---|---|---|---|---|
| `app` | `<html data-app-state>` | `loading`, `ready` | loading -> ready (end of init) | wait for `ready` instead of sleeping |
| `menu` | `#mobile-nav` | `closed`, `open` | closed <-> open | `.open`, `aria-expanded`, icon; closes on Esc, outside tap, link tap, and when the screen grows past `md` |
| `lightbox` | `#media-modal` | `closed`, `open` | closed <-> open | `hidden/flex`, `aria-hidden`; focus moves to Close and returns to the figure; Esc, backdrop, Close |
| `toast` | `#toast-notification` | `hidden`, `visible` | hidden <-> visible | `.show`; ONE timer (a new message restarts it); text also sent to `#sr-status` for screen readers |
| `form` | `#inquiry-form` | `idle`, `sending`, `sent`, `fallback` | idle -> sending / fallback; sending -> sent / fallback; sent -> idle / sending / fallback; fallback -> idle / sending | button disabled + `aria-busy` while `sending`; a second submit during `sending` is ignored; 15 s timeout falls back to the email app; editing returns to `idle` |
| `brand` | `<html data-brand-state>` | `top`, `scrolled` | top <-> scrolled | `.past-masthead` (header shows "Indian B2B" / "Yash Marwal") |
| `section` | `<html data-section-state>` | section id (`front-page`, `ventures`, `the-profile`, `in-the-field`, `about`, `inquiries`) | any -> any | nav highlight; evaluated on load and on scroll |
| `figure` (x4) | `#in-the-field figure` | `static`, `loading`, `ready`, `drawn`, `failed` | static -> loading -> ready -> drawn; loading -> failed | inlines the SVG, draws it when on screen; `failed` keeps the plain `<img>` |

Not machines, but worth knowing:
- **Reveals** (`.reveal`, `.rule-draw`): a one-way latch, pending -> `in` class, set once by an IntersectionObserver.
- **Boot flags** set in `<head>` before first paint: `html.js`, `html.brand-swap`, `data-app-state="loading"`. `html[data-motion]` is `full` or `reduced`.
- `brand-ready` class: transitions on the header brand only start after the first position check, so nothing animates on load.

## Adding or changing a machine
1. `machines.x = machine('x', hostElement, { initial, transitions, onEnter })`. Never keep the state in a class or a variable too.
2. Read it with `m.is('open')`; change it only with `m.to('open')`.
3. Add it to the table above and to `scripts/state-smoke.js`.

## Testing
`npm start` in one terminal, then `npm run test:state` (needs Chrome; set `CHROME_PATH` if it is not at the default Windows path).
It drives every machine through its transitions (network stubbed, nothing is sent).
