#!/usr/bin/env node
/**
 * Scans images/, music/ and notes/ and writes data.js.
 *
 * Why data.js and not data.json: a <script> tag works when you open
 * index.html straight off your desktop. fetch() does not — Chrome blocks
 * it on file:// as a cross-origin request. This keeps local previews working
 * with no server.
 *
 * Naming convention, all parts optional except the title:
 *   01 - Atlantic Weather - From the camera roll.jpg
 *   ^^   ^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^
 *   sort      title              subtitle
 *
 * Notes additionally accept a leading date:
 *   2026-08-29 - A home for unfinished things.md
 *
 * Run: node build.mjs
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

// sharp resizes the photos. If it isn't installed the build still works —
// it just falls back to serving the originals, which is slow but not broken.
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }

// The grid never shows a photo wider than ~580px, so 1200 covers 2x retina.
// The lightbox goes full screen, where ~2200 is enough for a 1440p display.
const DERIVATIVES = { grid: 1200, full: 2200 };
const WEBP_QUALITY = 82;
const WEB_DIR = 'images/_web';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const AUDIO_TYPES = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.flac']);

/* ---------- filename parsing ---------- */

// "01 - Title - Subtitle.jpg" -> { sort: 1, title, subtitle }
function parseName(file) {
  const stem = basename(file, extname(file));
  const parts = stem.split(/\s+[-–—]\s+/);

  let sort = null;
  let date = null;

  // A leading "01" or "2026-08-29" is metadata, not part of the title.
  if (parts.length > 1) {
    const head = parts[0].trim();
    if (/^\d{1,4}$/.test(head)) {
      sort = Number(head);
      parts.shift();
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
      date = head;
      parts.shift();
    }
  }

  return {
    sort,
    date,
    title: (parts.shift() || stem).trim(),
    subtitle: parts.length ? parts.join(' — ').trim() : null
  };
}

/* ---------- image dimensions ----------
 * Read just enough of each file's header to get width and height. Doing this
 * here rather than in the browser means the page knows every photo's shape
 * before a single byte of image data has loaded — so the grid never reflows
 * and portraits/landscapes can be given different amounts of space.
 */
function imageSize(file) {
  let buf;
  try { buf = readFileSync(file); } catch { return null; }

  // PNG: IHDR is always the first chunk.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: logical screen descriptor, little-endian.
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP: three container flavours, each stores the size differently.
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8 ') {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (kind === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      const read24 = at => buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16);
      return { width: read24(24) + 1, height: read24(27) + 1 };
    }
  }

  // JPEG: walk the marker segments until a start-of-frame.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let at = 2;
    while (at < buf.length - 9) {
      if (buf[at] !== 0xff) { at++; continue; }
      const marker = buf[at + 1];
      // SOF0–SOF15, excluding the non-frame markers in that range.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
      }
      at += 2 + buf.readUInt16BE(at + 2);
    }
  }

  return null; // AVIF and anything unrecognised fall back to a square cell.
}

// Anything within 12% of square is treated as square — a 4:3 photo shouldn't
// claim a double-wide cell just for being fractionally wider than tall.
function orientationOf(size) {
  if (!size || !size.width || !size.height) return 'square';
  const ratio = size.width / size.height;
  if (ratio > 1.12) return 'landscape';
  if (ratio < 0.89) return 'portrait';
  return 'square';
}

function listFiles(dir, allowed, withSize = false) {
  const path = join(ROOT, dir);
  if (!existsSync(path)) return [];

  return readdirSync(path)
    .filter(file => allowed.has(extname(file).toLowerCase()))
    .filter(file => !file.startsWith('.'))
    .map(file => {
      const entry = {
        ...parseName(file),
        src: `${dir}/${file}`,
        mtime: statSync(join(path, file)).mtimeMs
      };
      if (withSize) {
        const size = imageSize(join(path, file));
        entry.stem = basename(file, extname(file));
        entry.width = size?.width ?? null;
        entry.height = size?.height ?? null;
        entry.shape = orientationOf(size);
      }
      return entry;
    })
    .sort(byOrder);
}

// Numbered files first in number order, then everything else newest-first.
function byOrder(a, b) {
  if (a.sort !== null && b.sort !== null) return a.sort - b.sort;
  if (a.sort !== null) return -1;
  if (b.sort !== null) return 1;
  return b.mtime - a.mtime;
}

/* ---------- markdown ---------- */

const escapeHtml = text => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Inline formatting, applied to already-escaped text.
const inline = text => text
  .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

/**
 * Deliberately small: headings, paragraphs, lists, quotes, code fences, rules.
 * Enough for writing prose, and it runs at build time so the page ships no
 * markdown library at all.
 */
function markdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  let fence = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(escapeHtml(paragraph.join(' ')))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  };
  const flush = () => { flushParagraph(); flushList(); };

  for (const line of lines) {
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      if (fence === null) { flush(); fence = []; }
      else { html.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`); fence = null; }
      continue;
    }
    if (fence !== null) { fence.push(line); continue; }

    if (!line.trim()) { flush(); continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length + 1; // h1 is the note title itself
      html.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { flush(); html.push('<hr>'); continue; }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flush();
      html.push(`<blockquote>${inline(escapeHtml(quote[1]))}</blockquote>`);
      continue;
    }

    const item = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.*)$/);
    if (item) {
      const wanted = item[1] ? 'ul' : 'ol';
      flushParagraph();
      if (list !== wanted) { flushList(); html.push(`<${wanted}>`); list = wanted; }
      html.push(`<li>${inline(escapeHtml(item[3]))}</li>`);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (fence !== null) html.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  flush();
  return html.join('\n');
}

function listNotes() {
  const path = join(ROOT, 'notes');
  if (!existsSync(path)) return [];

  return readdirSync(path)
    .filter(file => extname(file).toLowerCase() === '.md')
    .filter(file => !file.startsWith('.'))
    .map(file => {
      const meta = parseName(file);
      const raw = readFileSync(join(path, file), 'utf8');

      // An optional "Kicker: Music" first line sets the category label.
      const kicker = raw.match(/^kicker:\s*(.+)$/im);
      const body = kicker ? raw.replace(kicker[0], '') : raw;

      // First paragraph doubles as the summary in the list.
      const summary = body
        .split('\n').filter(l => l.trim() && !/^[#>\-*`]/.test(l.trim()))[0] || '';

      return {
        ...meta,
        kicker: kicker ? kicker[1].trim() : (meta.subtitle || 'Notes'),
        summary: summary.trim().replace(/[*`_]/g, ''),
        html: markdown(body.trim()),
        mtime: statSync(join(path, file)).mtimeMs
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.mtime - a.mtime);
}

/* ---------- resized copies ----------
 * Originals stay in images/ as your masters and are never modified. The page
 * loads from images/_web/ instead. Anything already generated and newer than
 * its source is skipped, so repeat builds are quick.
 */
async function makeDerivatives(photos) {
  if (!sharp) {
    console.log('  ! sharp not installed — serving full-size originals.');
    console.log('    Run: npm install');
    return { made: 0, skipped: 0, bytes: 0 };
  }

  mkdirSync(join(ROOT, WEB_DIR), { recursive: true });
  let made = 0, skipped = 0, bytes = 0;

  for (const photo of photos) {
    const source = join(ROOT, photo.src);
    const sourceTime = statSync(source).mtimeMs;
    const stem = basename(photo.src, extname(photo.src));

    // sharp knows more formats than the header reader, so let it correct
    // the dimensions where it can.
    try {
      const meta = await sharp(source).metadata();
      if (meta.width && meta.height) {
        photo.width = meta.width;
        photo.height = meta.height;
        photo.shape = orientationOf(meta);
      }
    } catch { /* keep what the header reader found */ }

    for (const [name, edge] of Object.entries(DERIVATIVES)) {
      const relative = `${WEB_DIR}/${stem}-${name}.webp`;
      const target = join(ROOT, relative);
      photo[name] = relative;

      if (existsSync(target) && statSync(target).mtimeMs >= sourceTime) {
        skipped++;
        bytes += statSync(target).size;
        continue;
      }

      try {
        await sharp(source)
          .rotate()                                    // honour EXIF orientation
          .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toFile(target);
        made++;
        bytes += statSync(target).size;
      } catch (error) {
        console.log(`  ! could not resize ${photo.src}: ${error.message}`);
        photo[name] = photo.src;                       // fall back to the original
      }
    }
  }

  return { made, skipped, bytes };
}

/* ---------- photos without originals ----------
 * Full-resolution originals are deliberately not committed (see .gitignore),
 * so a CI checkout sees images/_web/ and nothing else. Rebuild the photo list
 * from the derivatives in that case, otherwise the build would find an empty
 * images/ folder and quietly publish an empty gallery.
 */
function listFromDerivatives() {
  const path = join(ROOT, WEB_DIR);
  if (!existsSync(path)) return [];

  const entries = readdirSync(path).filter(file => file.endsWith('-grid.webp'));

  return entries.map(file => {
    const stem = basename(file, '-grid.webp');
    const large = `${WEB_DIR}/${stem}-full.webp`;
    const size = imageSize(join(path, file));

    return {
      ...parseName(stem),
      stem,
      src: `${WEB_DIR}/${file}`,
      grid: `${WEB_DIR}/${file}`,
      full: existsSync(join(ROOT, large)) ? large : `${WEB_DIR}/${file}`,
      width: size?.width ?? null,
      height: size?.height ?? null,
      shape: orientationOf(size),
      mtime: statSync(join(path, file)).mtimeMs
    };
  }).sort(byOrder);
}

/* ---------- write ---------- */

/* Originals and web copies are merged rather than one replacing the other.
 * Once originals stop being committed, the usual state of this folder is
 * "all the web copies, plus the handful of new originals you just dropped in".
 * Treating those as separate sets would publish only the new arrivals. */
const originals = listFiles('images', IMAGE_TYPES, true);
const resize = originals.length
  ? await makeDerivatives(originals)
  : { made: 0, skipped: 0, bytes: 0 };

const merged = new Map();
for (const photo of listFromDerivatives()) merged.set(photo.stem, photo);
for (const photo of originals) merged.set(photo.stem, photo); // originals win

const photos = [...merged.values()].sort(byOrder);
const carried = photos.length - originals.length;

if (carried > 0 && originals.length) {
  console.log(`  ${originals.length} original(s) + ${carried} already-published photo(s)`);
} else if (carried > 0) {
  console.log(`  no originals present — using the ${carried} web copies already committed.`);
}

// Last line of defence: never replace a populated gallery with an empty one.
if (!photos.length && existsSync(join(ROOT, 'data.js'))) {
  const previous = readFileSync(join(ROOT, 'data.js'), 'utf8');
  const had = (previous.match(/"src":/g) || []).length;
  if (had) {
    console.error(
      `\nRefusing to write an empty data.js over one describing ${had} item(s).\n` +
      `No images were found in images/ or ${WEB_DIR}/. If that's genuinely what\n` +
      `you want, delete data.js by hand and run the build again.`
    );
    process.exit(1);
  }
}

const data = {
  photos,
  tracks: listFiles('music', AUDIO_TYPES),
  notes: listNotes()
};

// Strip build-only fields — sort keys the page has no use for.
const strip = ({ mtime, stem, ...rest }) => rest;
const payload = {
  photos: data.photos.map(strip),
  tracks: data.tracks.map(strip),
  notes: data.notes.map(strip)
};

for (const dir of ['images', 'music', 'notes']) {
  if (!existsSync(join(ROOT, dir))) mkdirSync(join(ROOT, dir), { recursive: true });
}

writeFileSync(
  join(ROOT, 'data.js'),
  `/* Generated by build.mjs — do not edit by hand. */\n` +
  `window.SITE_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  'utf8'
);

const shapes = payload.photos.reduce((tally, photo) => {
  tally[photo.shape] = (tally[photo.shape] || 0) + 1;
  return tally;
}, {});
const unread = payload.photos.filter(photo => !photo.width).map(photo => photo.src);

console.log(
  `data.js written — ${payload.photos.length} photo(s), ` +
  `${payload.tracks.length} track(s), ${payload.notes.length} note(s)`
);
if (payload.photos.length) {
  console.log(`  shapes: ${Object.entries(shapes).map(([k, v]) => `${v} ${k}`).join(', ')}` +
    ` — ${Math.ceil(payload.photos.length / 9)} page(s)`);
}
unread.forEach(src => console.log(`  ! couldn't read dimensions, defaulting to square: ${src}`));

const mb = n => (n / 1048576).toFixed(2);
const firstPage = payload.photos.slice(0, 9)
  .reduce((sum, p) => sum + (existsSync(join(ROOT, p.grid)) ? statSync(join(ROOT, p.grid)).size : 0), 0);

if (sharp && originals.length) {
  const sourceBytes = originals.reduce((sum, p) => sum + statSync(join(ROOT, p.src)).size, 0);
  console.log(`  resized: ${resize.made} new, ${resize.skipped} unchanged`);
  console.log(`  ${mb(sourceBytes)} MB of originals -> ${mb(resize.bytes)} MB of web copies`);
}
if (payload.photos.length) console.log(`  first page loads ${mb(firstPage)} MB`);
