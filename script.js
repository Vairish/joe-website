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

/* Pages are filled by area, not by count.
 *
 * The grid is 6 units across and 3 rows deep — 18 units. A landscape or
 * portrait photo costs 2 units, a square one costs 4. So a page normally
 * holds 9 photos, and 8 when one of them is square. Chunking by count
 * instead would make pages with a square taller than the rest, and the
 * whole gallery would jump as you paged through it. */
const PAGE_UNITS = 18;
const UNIT_COST = { landscape: 2, portrait: 2, square: 4 };

// How many photos load eagerly before the rest wait to be scrolled to.
const EAGER_COUNT = 9;

function paginate(photos) {
  const pages = [];
  let page = [];
  let units = 0;

  for (const photo of photos) {
    const cost = UNIT_COST[photo.shape] || 2;
    if (units + cost > PAGE_UNITS && page.length) {
      pages.push(page);
      page = [];
      units = 0;
    }
    page.push(photo);
    units += cost;
  }
  if (page.length) pages.push(page);
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

    if (pageCount > 1) buildGalleryNav(photoGrid, track, pageCount);
  }
}

function currentPageOf(track) {
  const width = track.firstElementChild?.getBoundingClientRect().width || 0;
  return width ? Math.round(track.scrollLeft / width) : 0;
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

  // Guarded: width is 0 before first layout, and 0/0 would give NaN.
  const pageWidth = () => track.firstElementChild.getBoundingClientRect().width || 0;
  const currentPage = () => currentPageOf(track);

  function goToPage(page) {
    const target = Math.max(0, Math.min(pageCount - 1, page));
    track.scrollTo({ left: target * pageWidth(), behavior: 'smooth' });
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
