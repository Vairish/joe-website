const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];

$('#year').textContent = new Date().getFullYear();

const header = $('.site-header');
const menu = $('#main-nav');
const menuButton = $('.menu-button');

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menu.classList.toggle('open', !open);
});

$$('a', menu).forEach(link => link.addEventListener('click', () => {
  menu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

addEventListener('scroll', () => {
  header.classList.toggle('scrolled', scrollY > 24);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && scrollY < innerHeight) {
    $('.hero-background img').style.transform = `scale(1.015) translateY(${scrollY * .045}px)`;
  }
}, { passive: true });

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
// threshold MUST stay 0. A percentage threshold is unsatisfiable for an
// element taller than the viewport — on mobile the gallery becomes one
// column ~14,000px tall, so 7% of it never fits on screen and the section
// would stay at opacity 0 forever. rootMargin still holds the reveal back
// until the element is properly on screen.
}, { threshold: 0, rootMargin: '0px 0px -30px' });
// Observation happens after the sections below are rendered, so that
// generated .reveal elements are picked up too.

const navLinks = $$('a', menu);
const sections = ['photography', 'music', 'software', 'notes'].map(id => document.getElementById(id));
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -55%' });
sections.forEach(section => sectionObserver.observe(section));

/* ---------------------------------------------------------------
   Content comes from three generated listings, each living beside the
   files it describes:
     images/photos.js       -> window.PHOTOS   (made in the photo folder)
     music/tracks.js        -> window.TRACKS   (update-lists.mjs)
     notes/notes.js         -> window.NOTES    (update-lists.mjs)
   A missing listing degrades to an empty section rather than an error.
   --------------------------------------------------------------- */

const DATA = {
  photos: window.PHOTOS || [],
  tracks: window.TRACKS || [],
  notes: window.NOTES || []
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const empty = message => {
  const node = el('p', 'empty-note', message);
  return node;
};

/* ---------- photography ---------- */

/* Pages are filled by actually packing them, not by counting area.
 *
 * The grid is 6 columns by 3 rows. A landscape tile is 2x1, a portrait 1x2,
 * a square 2x2. Counting units and stopping at 18 is NOT enough: whether 18
 * units fit in 18 cells depends on the order the shapes arrive in. Six
 * landscapes fill rows 1-2 exactly, and the next portrait then needs two
 * rows with only one left — so it spills into a fourth row and that page
 * becomes taller than the others.
 *
 * So this mirrors CSS grid's own dense first-fit placement and closes the
 * page when the next photo genuinely won't fit. Pages hold 8 or 9 photos
 * instead of always 9, and every page is exactly 3 rows. */
const GRID_COLS = 6;
const GRID_ROWS = 3;
const SPAN = { landscape: [2, 1], portrait: [1, 2], square: [2, 2] };

// How many photos load eagerly before the rest wait to be scrolled to.
const EAGER_COUNT = 9;

const free = (grid, row, col, w, h) => {
  if (col + w > GRID_COLS || row + h > GRID_ROWS) return false;
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) if (grid[r]?.[c]) return false;
  }
  return true;
};

const occupy = (grid, row, col, w, h) => {
  for (let r = row; r < row + h; r++) {
    grid[r] = grid[r] || [];
    for (let c = col; c < col + w; c++) grid[r][c] = true;
  }
};

// Same scan order CSS grid uses for `grid-auto-flow: dense`, so the browser
// reproduces exactly the placement worked out here.
const tryPlace = (grid, [w, h]) => {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (free(grid, r, c, w, h)) { occupy(grid, r, c, w, h); return true; }
    }
  }
  return false;
};

/**
 * Fills each page by repeatedly taking the EARLIEST remaining photo that
 * still fits. Order is preserved wherever possible; a photo is only skipped
 * when it genuinely cannot fit the space left, and it goes to the front of
 * the next page rather than to the back of the queue — so nothing drifts far.
 *
 * This is what lets pages fill completely. Portraits are 1x2, so they want to
 * come in pairs; an odd one leaves a 1x2 hole that nothing else can fill, and
 * the look-ahead pulls a later portrait forward to close it.
 */
/** Takes photos off the queue until nothing more fits on a page. */
function fillPage(queue) {
  const grid = [];
  const page = [];

  for (;;) {
    let placed = false;
    for (let i = 0; i < queue.length; i++) {
      const span = SPAN[queue[i].shape] || SPAN.landscape;
      if (tryPlace(grid, span)) {
        page.push(queue.splice(i, 1)[0]);
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  return page;
}

function paginate(photos) {
  const queue = [...photos];
  const pages = [];

  while (queue.length) {
    const page = fillPage(queue);
    // Any shape fits an empty grid, so this can't happen — but an empty page
    // here would loop forever, so bail rather than hang the browser.
    if (!page.length) break;
    pages.push(page);
  }
  return pages;
}

const photoTile = (photo, index) => {
  const button = el('button', 'photo');
  button.type = 'button';
  // Tiles load the small copy; the lightbox gets the large one. Both fall
  // back to the original if the build couldn't produce a derivative.
  button.dataset.image = photo.full || photo.src;
  button.dataset.caption = photo.title;
  // Shape drives how many grid cells the tile claims.
  button.dataset.shape = photo.shape || 'square';

  const image = el('img');
  image.src = photo.grid || photo.src;
  image.alt = photo.subtitle ? `${photo.title} — ${photo.subtitle}` : photo.title;
  // Known up front from the build, so the browser reserves the right box
  // before the file arrives and nothing jumps as images load.
  if (photo.width) { image.width = photo.width; image.height = photo.height; }
  // Only the first page loads eagerly; later pages wait until scrolled to.
  image.setAttribute('loading', index < EAGER_COUNT ? 'eager' : 'lazy');
  image.setAttribute('decoding', 'async');

  const label = el('span');
  label.append(el('b', null, photo.title));
  if (photo.subtitle) label.append(el('small', null, photo.subtitle));

  button.append(image, label);
  return button;
};

const photoGrid = $('#photo-grid');
if (photoGrid) {
  if (!DATA.photos.length) {
    photoGrid.append(empty('Run make-web in your photo folder, then copy the images folder in.'));
  } else {
    const pages = paginate(DATA.photos);
    const pageCount = pages.length;

    // reveal lives on the track, not the pages — a page scrolled out of
    // view horizontally never intersects, and would stay invisible.
    const track = el('div', 'gallery-track reveal');
    track.id = 'gallery-track';
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', `Photographs, ${pageCount} page${pageCount > 1 ? 's' : ''}`);

    let seen = 0;
    pages.forEach((group, page) => {
      const panel = el('div', 'gallery-page');
      panel.setAttribute('aria-label', `Page ${page + 1} of ${pageCount}`);
      group.forEach(photo => panel.append(photoTile(photo, seen++)));
      track.append(panel);
    });
    photoGrid.append(track);

    watchCentreBand(track);
    if (pageCount > 1) buildGalleryNav(photoGrid, track, pageCount);
  }
}

/**
 * Touch devices get no hover, so the row crossing the middle of the screen
 * comes into colour instead — scroll position doing the cursor's job.
 *
 * rootMargin clips the observer's view to a thin band across the centre, so
 * only tiles actually passing through it qualify. Tiles on horizontally
 * scrolled-out pages never intersect, so they cost nothing.
 */
function watchCentreBand(track) {
  if (!matchMedia('(hover: none)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const band = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('in-band', entry.isIntersecting));
  }, { rootMargin: '-42% 0px -42%', threshold: 0 });

  $$('.photo', track).forEach(tile => band.observe(tile));
}

/* Page positions are measured, never calculated from index x width.
 * Multiplying gives a fractional target that the browser rounds to whole
 * device pixels, which is what left a sliver of the previous page showing.
 * It also silently breaks the moment the track gains a gap. */
function offsetOfPage(track, page) {
  return page.getBoundingClientRect().left
       - track.getBoundingClientRect().left
       + track.scrollLeft;
}

function currentPageOf(track) {
  const pages = [...track.children];
  if (!pages.length) return 0;

  let closest = 0;
  let smallest = Infinity;
  pages.forEach((page, index) => {
    const distance = Math.abs(offsetOfPage(track, page) - track.scrollLeft);
    if (distance < smallest) { smallest = distance; closest = index; }
  });
  return closest;
}

function buildGalleryNav(root, track, pageCount) {
  const nav = el('div', 'gallery-nav');

  const arrow = (direction, label, glyph) => {
    const button = el('button', `gallery-arrow gallery-${direction}`);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.append(el('span', null, glyph));
    button.addEventListener('click', () => goToPage(currentPage() + (direction === 'next' ? 1 : -1)));
    return button;
  };

  // A dot per page stops being useful past about eight — at 200 photos that
  // would be 23 of them. Beyond that, show a plain count instead.
  const DOT_LIMIT = 8;
  const useDots = pageCount <= DOT_LIMIT;

  const dots = el('div', 'gallery-dots');
  if (useDots) {
    for (let page = 0; page < pageCount; page++) {
      const dot = el('button', 'gallery-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to page ${page + 1}`);
      dot.addEventListener('click', () => goToPage(page));
      dots.append(dot);
    }
  } else {
    dots.classList.add('gallery-count');
  }

  const previous = arrow('prev', 'Previous page', '←');
  const next = arrow('next', 'Next page', '→');
  nav.append(previous, dots, next);
  root.append(nav);

  const currentPage = () => currentPageOf(track);

  function goToPage(page) {
    const target = Math.max(0, Math.min(pageCount - 1, page));
    const destination = track.children[target];
    if (!destination) return;
    track.scrollTo({ left: offsetOfPage(track, destination), behavior: 'smooth' });
  }

  const syncNav = () => {
    const page = currentPage();
    if (useDots) {
      [...dots.children].forEach((dot, index) => {
        dot.classList.toggle('active', index === page);
        dot.setAttribute('aria-current', index === page ? 'true' : 'false');
      });
    } else {
      dots.textContent = `${page + 1} / ${pageCount}`;
    }
    previous.disabled = page === 0;
    next.disabled = page === pageCount - 1;
    track.setAttribute('aria-label', `Photographs, page ${page + 1} of ${pageCount}`);
  };

  let frame = null;
  track.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = null; syncNav(); });
  }, { passive: true });

  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goToPage(currentPage() + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goToPage(currentPage() - 1); }
  });

  addEventListener('resize', syncNav);
  syncNav();
}

/* ---------- music ---------- */

const trackList = $('#track-list');
const audio = new Audio();
// 'metadata' not 'auto': cueing the first track on load should cost a header,
// not a whole MP3 nobody has asked to hear yet.
audio.preload = 'metadata';

const rows = [];
let index = -1;                 // which track is cued; -1 = none

// Assigned by the transport below. Declared here because the track rows are
// built first and their click handlers call it. A no-op until then, so a
// missing transport can't throw.
let select = () => {};

const clock = seconds => Number.isFinite(seconds) && seconds >= 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  : '—:—';

/* ---------- track rows ---------- */

if (trackList) {
  if (!DATA.tracks.length) {
    trackList.append(empty('Drop MP3s into the music folder and run update-lists.'));
  } else {
    DATA.tracks.forEach((track, position) => {
      const row = el('div', 'track');
      row.dataset.src = track.src;

      const button = el('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Play ${track.title}`);
      button.append(el('span', 'glyph', '▶'));

      const label = el('span');
      label.append(el('b', null, track.title));
      if (track.subtitle) label.append(el('small', null, track.subtitle));

      const time = el('time', null, '—:—');

      // Ask the browser for just the header, so a duration can be shown
      // without downloading the whole file.
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.addEventListener('loadedmetadata', () => { time.textContent = clock(probe.duration); });
      probe.src = track.src;

      button.addEventListener('click', () => select(position, { toggle: true }));
      row.append(button, label, time);
      trackList.append(row);
      rows.push(row);
    });
  }
}

/* ---------- transport ---------- */

const playerBar = $('#player');

if (playerBar && DATA.tracks.length) {
  playerBar.hidden = false;

  const toggleButton = $('.player-toggle', playerBar);
  const prevButton = $('[data-action="prev"]', playerBar);
  const nextButton = $('[data-action="next"]', playerBar);
  const range = $('#player-range');
  const elapsedOut = $('#player-elapsed');
  const durationOut = $('#player-duration');
  const titleOut = $('#player-title');
  const subOut = $('#player-sub');

  // While the seek bar is being dragged, timeupdate must not fight the thumb.
  let seeking = false;

  const isPlaying = () => !audio.paused && !audio.ended && audio.currentSrc;

  /** Point the player at a track. Plays unless told otherwise. */
  select = function (position, { toggle = false, play = true } = {}) {
    if (position < 0 || position >= DATA.tracks.length) return;

    if (position === index && toggle) {
      isPlaying() ? audio.pause() : audio.play().catch(paintTransport);
      return;
    }

    index = position;
    const track = DATA.tracks[index];

    audio.src = track.src;
    titleOut.textContent = track.title;
    subOut.textContent = track.subtitle || '';
    range.value = 0;
    paintRange();
    elapsedOut.textContent = '0:00';
    durationOut.textContent = '—:—';
    announce(track);

    if (play) audio.play().catch(paintTransport);
    paintTransport();
  };

  /* Lock-screen and media-key support, where the browser offers it. */
  function announce(track) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: 'Joe Kiernan',
      album: track.subtitle || 'Mostly Harmless'
    });
  }

  function paintTransport() {
    const playing = isPlaying();

    $('span', toggleButton).textContent = playing ? '❚❚' : '▶';
    toggleButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    prevButton.disabled = index <= 0;
    nextButton.disabled = index >= DATA.tracks.length - 1;

    rows.forEach((row, position) => {
      const active = position === index;
      row.classList.toggle('cued', active);
      row.classList.toggle('playing', active && playing);
      const glyph = $('.glyph', row);
      if (glyph) glyph.textContent = active && playing ? '❚❚' : '▶';
    });

    $$('.waveform').forEach(wave => wave.classList.toggle('active', playing));
  }

  /* --- controls --- */

  toggleButton.addEventListener('click', () => {
    if (index === -1) return select(0);
    isPlaying() ? audio.pause() : audio.play().catch(paintTransport);
  });
  prevButton.addEventListener('click', () => select(index - 1));
  nextButton.addEventListener('click', () => select(index + 1));

  /* --- seeking --- */

  // Chrome/Safari can't fill a range track natively, so the played portion
  // is a gradient stop the CSS reads from --played.
  const paintRange = () => range.style.setProperty('--played', `${range.value / 10}%`);

  const scrub = () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = (range.value / 1000) * audio.duration;
  };

  range.addEventListener('pointerdown', () => { seeking = true; });
  range.addEventListener('keydown', () => { seeking = true; });
  range.addEventListener('input', () => {
    paintRange();
    if (!Number.isFinite(audio.duration)) return;
    elapsedOut.textContent = clock((range.value / 1000) * audio.duration);
  });
  range.addEventListener('change', () => { scrub(); seeking = false; });
  ['pointerup', 'pointercancel'].forEach(event =>
    range.addEventListener(event, () => { scrub(); seeking = false; }));

  /* --- audio events --- */

  audio.addEventListener('loadedmetadata', () => {
    durationOut.textContent = clock(audio.duration);
    range.max = 1000;
  });

  audio.addEventListener('timeupdate', () => {
    if (seeking || !Number.isFinite(audio.duration) || !audio.duration) return;
    range.value = Math.round((audio.currentTime / audio.duration) * 1000);
    paintRange();
    elapsedOut.textContent = clock(audio.currentTime);
  });

  ['play', 'pause'].forEach(event => audio.addEventListener(event, paintTransport));

  // Roll on to the next track, and stop cleanly at the end of the list.
  audio.addEventListener('ended', () => {
    if (index < DATA.tracks.length - 1) select(index + 1);
    else { range.value = 0; paintRange(); elapsedOut.textContent = '0:00'; paintTransport(); }
  });

  audio.addEventListener('error', () => {
    if (!audio.currentSrc) return;
    subOut.textContent = 'Could not load this track';
    paintTransport();
  });

  // Cue the first track without playing it, so the bar isn't blank on load.
  select(0, { play: false });
}

/* ---------- notes ---------- */

const noteList = $('#note-list');
if (noteList) {
  if (!DATA.notes.length) {
    noteList.append(empty('Write a markdown file into the notes folder and run update-lists.'));
  } else {
    DATA.notes.forEach((note, index) => {
      const article = el('article', 'note reveal');

      const time = el('time', null, note.date ? formatDate(note.date) : 'Draft');
      if (note.date) time.dateTime = note.date;

      const middle = el('div');
      middle.append(el('small', null, note.kicker));
      middle.append(el('h3', null, note.title));
      if (note.summary) middle.append(el('p', null, note.summary));

      const toggle = el('button', 'note-toggle');
      toggle.type = 'button';
      toggle.innerHTML = '<span aria-hidden="true">↗</span>';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', `note-body-${index}`);
      toggle.append(el('span', 'sr-only', `Read ${note.title}`));

      const body = el('div', 'note-body');
      body.id = `note-body-${index}`;
      const inner = el('div', 'note-body-inner');
      inner.innerHTML = note.html;
      body.append(inner);

      toggle.addEventListener('click', () => {
        const open = article.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });

      article.append(time, middle, toggle, body);
      noteList.append(article);
    });
  }
}

function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year.slice(2)}`;
}

// Everything above is now in the DOM — start watching for reveals.
$$('.reveal').forEach(item => revealObserver.observe(item));

// Safety net. A .reveal element that never receives .visible is invisible,
// not merely un-animated — a silent, total failure. Once everything has
// loaded, reveal anything already on screen regardless of the observer.
addEventListener('load', () => {
  $$('.reveal:not(.visible)').forEach(item => {
    const box = item.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) item.classList.add('visible');
  });
});

const stack = $('#polaroid-stack');
if (stack) {
  const cards = $$('.card', stack);
  let order = [...cards];

  const restack = () => order.forEach((card, index) => {
    card.classList.remove('slot-1', 'slot-2', 'slot-3');
    card.classList.add(`slot-${index + 1}`);
    $('.card-hit', card).setAttribute('aria-disabled', String(index === 0));
  });

  cards.forEach(card => $('.card-hit', card).addEventListener('click', () => {
    if (order[0] === card) return;
    order = [card, ...order.filter(other => other !== card)];
    restack();
  }));

  restack();
}

const lightbox = $('#lightbox');
$$('.photo').forEach(button => button.addEventListener('click', () => {
  const image = $('img', lightbox);
  image.src = button.dataset.image;
  image.alt = $('img', button).alt;
  $('p', lightbox).textContent = button.dataset.caption;
  lightbox.showModal();
}));

$('button', lightbox).addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => {
  if (event.target === lightbox) lightbox.close();
});
