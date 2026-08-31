/* Cullery page. Standalone — the main site's script.js expects the homepage's
   sections and listings, none of which exist here. */

const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];

$('#year').textContent = new Date().getFullYear();

/* ---------- mobile menu ---------- */

const menu = $('#main-nav');
const menuButton = $('.menu-button');

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menu.classList.toggle('open', !open);
});

/* ---------- reveals ----------
   threshold 0, same reasoning as the homepage: a percentage threshold is
   unsatisfiable for anything taller than the viewport. */

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0, rootMargin: '0px 0px -30px' });

$$('.reveal').forEach(item => revealObserver.observe(item));

// Safety net: an unrevealed .reveal is invisible, not just un-animated.
addEventListener('load', () => {
  $$('.reveal:not(.visible)').forEach(item => {
    const box = item.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) item.classList.add('visible');
  });
});

/* ---------- keycaps ----------
   The page demonstrates the app's entire interface, so pressing the real keys
   lights up the real keys. Deliberately does not preventDefault — arrow keys
   should still scroll the page. */

const keycaps = new Map($$('#keycaps .keycap').map(cap => [cap.dataset.key, cap]));

const flash = (code, on) => {
  const cap = keycaps.get(code);
  if (cap) cap.classList.toggle('pressed', on);
};

addEventListener('keydown', event => {
  if (event.repeat) return;
  flash(event.code, true);
});

addEventListener('keyup', event => flash(event.code, false));

// Releasing a key while the window is unfocused never fires keyup.
addEventListener('blur', () => keycaps.forEach(cap => cap.classList.remove('pressed')));

// Pointer/touch users get the same feedback, since they have no keyboard.
keycaps.forEach(cap => {
  cap.addEventListener('pointerdown', () => cap.classList.add('pressed'));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(event =>
    cap.addEventListener(event, () => cap.classList.remove('pressed')));
});
