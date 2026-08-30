#!/usr/bin/env node
/**
 * make-web.mjs — put this in the folder holding your full-resolution photos.
 *
 *   node make-web.mjs      (or double-click make-web.bat)
 *
 * It creates an "images" folder next to your photos containing, for each one:
 *
 *   <name>-grid.webp   max 1200px, for the gallery tiles
 *   <name>-full.webp   max 2200px, for the lightbox
 *   photos.js          the listing the website reads
 *
 * Then copy that whole images folder into the website repo, replacing the one
 * already there. That's the entire process — the site needs nothing else.
 *
 * (It's called "images" and not "_web" on purpose. GitHub Pages runs Jekyll,
 * which silently drops any directory whose name starts with an underscore —
 * which gives you a site that works locally and shows nothing online.)
 *
 * Your originals are never modified, moved or deleted.
 *
 * Naming, all parts optional except the title:
 *   01 - Atlantic Weather - From the camera roll.jpg
 *   ^^   ^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^
 *   order (hidden)          small grey line under the title
 */

import { readdirSync, existsSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'images');

const TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tif', '.tiff']);
const SIZES = { grid: 1200, full: 2200 };
const QUALITY = 82;

/* ---------- sharp, installed on demand ---------- */

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    console.log('First run — installing the image resizer (about 30 seconds)...\n');
    try {
      execSync('npm install sharp --no-save --silent', { cwd: HERE, stdio: 'inherit' });
      return (await import('sharp')).default;
    } catch {
      console.error(
        '\nCould not install sharp automatically.\n' +
        'Make sure Node.js is installed, then run this by hand in this folder:\n\n' +
        '    npm install sharp\n'
      );
      process.exit(1);
    }
  }
}

/* ---------- filename -> title ---------- */

function parseName(file) {
  const stem = basename(file, extname(file));
  const parts = stem.split(/\s+[-–—]\s+/);
  let sort = null;

  if (parts.length > 1 && /^\d{1,4}$/.test(parts[0].trim())) {
    sort = Number(parts[0].trim());
    parts.shift();
  }

  return {
    stem,
    sort,
    title: (parts.shift() || stem).trim(),
    subtitle: parts.length ? parts.join(' — ').trim() : null
  };
}

const byOrder = (a, b) => {
  if (a.sort !== null && b.sort !== null) return a.sort - b.sort;
  if (a.sort !== null) return -1;
  if (b.sort !== null) return 1;
  return b.mtime - a.mtime;
};

// Anything within 12% of square counts as square, so a 4:3 photo doesn't
// claim a double-wide tile just for being slightly wider than tall.
function shapeOf(width, height) {
  if (!width || !height) return 'square';
  const ratio = width / height;
  if (ratio > 1.12) return 'landscape';
  if (ratio < 0.89) return 'portrait';
  return 'square';
}

/**
 * Web servers are fussier than Windows is. A file called
 * "Mama & Son .webp" is legal on disk but its URL needs encoding, and a
 * stray trailing space before the extension is very easy to miss. Rather
 * than hope, the output files get tidied names — the displayed title still
 * comes from the original filename, so nothing you see changes.
 */
function safeName(stem) {
  return stem
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, 'and')
    .replace(/[#?%+:"<>|*\\/]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\.\s*$/, '');
}

/* ---------- run ---------- */

const sharp = await loadSharp();

const sources = readdirSync(HERE)
  .filter(file => TYPES.has(extname(file).toLowerCase()))
  .filter(file => !file.startsWith('.'))
  .map(file => ({ ...parseName(file), file, mtime: statSync(join(HERE, file)).mtimeMs }))
  .sort(byOrder);

if (!sources.length) {
  console.error(`No images found in:\n  ${HERE}\n\nPut this script in the folder with your photos.`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
console.log(`${sources.length} photo(s) found\n`);

const photos = [];
const usedNames = new Set();
let made = 0, skipped = 0, webBytes = 0, sourceBytes = 0, renamed = 0;

for (const item of sources) {
  const source = join(HERE, item.file);
  const sourceTime = statSync(source).mtimeMs;
  sourceBytes += statSync(source).size;

  let width = null, height = null;
  try {
    const meta = await sharp(source).metadata();
    // EXIF-rotated photos report pre-rotation dimensions; swap when needed.
    const turned = meta.orientation >= 5 && meta.orientation <= 8;
    width = turned ? meta.height : meta.width;
    height = turned ? meta.width : meta.height;
  } catch (error) {
    console.log(`  ! skipping ${item.file} — ${error.message}`);
    continue;
  }

  // Keep output names unique even if tidying makes two of them collide.
  let clean = safeName(item.stem);
  if (clean !== item.stem) renamed++;
  let suffix = 2;
  while (usedNames.has(clean.toLowerCase())) clean = `${safeName(item.stem)} ${suffix++}`;
  usedNames.add(clean.toLowerCase());

  const entry = {
    title: item.title,
    subtitle: item.subtitle,
    width,
    height,
    shape: shapeOf(width, height)
  };

  let failed = false;
  for (const [name, edge] of Object.entries(SIZES)) {
    const outName = `${clean}-${name}.webp`;
    const target = join(OUT, outName);
    entry[name] = `images/${outName}`;

    if (existsSync(target) && statSync(target).mtimeMs >= sourceTime) {
      skipped++;
      webBytes += statSync(target).size;
      continue;
    }

    try {
      await sharp(source)
        .rotate()                                   // apply EXIF orientation
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 4 })
        .toFile(target);
      made++;
      webBytes += statSync(target).size;
    } catch (error) {
      console.log(`  ! could not resize ${item.file} — ${error.message}`);
      failed = true;
    }
  }

  if (!failed) {
    photos.push(entry);
    process.stdout.write(`\r  processed ${photos.length}/${sources.length}   `);
  }
}

console.log('\n');

/* ---------- clean up copies whose original is gone ---------- */

const expected = new Set(photos.flatMap(p => [basename(p.grid), basename(p.full)]));
let removed = 0;
for (const file of readdirSync(OUT)) {
  if (file === 'photos.js') continue;
  if (!expected.has(file)) { rmSync(join(OUT, file)); removed++; }
}

/* ---------- the listing the site reads ---------- */

writeFileSync(
  join(OUT, 'photos.js'),
  '/* Generated by make-web.mjs — do not edit by hand. */\n' +
  `window.PHOTOS = ${JSON.stringify(photos, null, 2)};\n`,
  'utf8'
);

const mb = n => (n / 1048576).toFixed(1);
console.log(`  resized: ${made} new, ${skipped} unchanged${removed ? `, ${removed} stale file(s) removed` : ''}`);
if (renamed) console.log(`  ${renamed} filename(s) tidied for the web (titles unchanged)`);
console.log(`  ${mb(sourceBytes)} MB of originals -> ${mb(webBytes)} MB in images`);
console.log(`  wrote images/photos.js listing ${photos.length} photo(s)\n`);
console.log('Now copy the images folder into the website repo, replacing the one there.');
