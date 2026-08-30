#!/usr/bin/env node
/**
 * update-lists.mjs — regenerates the listings for music and notes.
 *
 *   node update-lists.mjs      (or double-click update-lists.bat)
 *
 * Writes:
 *   music/tracks.js   from the audio files in music/
 *   notes/notes.js    from the markdown files in notes/
 *
 * Photos are NOT handled here. They come from images/photos.js, which is
 * produced by make-web.mjs over in your full-resolution photo folder and
 * copied in wholesale.
 *
 * No dependencies — plain Node, nothing to install.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const AUDIO_TYPES = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.flac']);

/* ---------- filename -> title ---------- */

// "01 - Title - Subtitle.mp3" / "2026-08-29 - Title.md"
function parseName(file) {
  const stem = basename(file, extname(file));
  const parts = stem.split(/\s+[-–—]\s+/);
  let sort = null;
  let date = null;

  if (parts.length > 1) {
    const head = parts[0].trim();
    if (/^\d{1,4}$/.test(head)) { sort = Number(head); parts.shift(); }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(head)) { date = head; parts.shift(); }
  }

  return {
    sort,
    date,
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

/* ---------- markdown ---------- */

const escapeHtml = text => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inline = text => text
  .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

/**
 * Deliberately small: headings, paragraphs, lists, quotes, code fences, rules.
 * Converting here means the page ships no markdown library at all.
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

/* ---------- music ---------- */

function listTracks() {
  const path = join(ROOT, 'music');
  if (!existsSync(path)) return [];

  return readdirSync(path)
    .filter(file => AUDIO_TYPES.has(extname(file).toLowerCase()))
    .filter(file => !file.startsWith('.'))
    .map(file => ({
      ...parseName(file),
      src: `music/${file}`,
      mtime: statSync(join(path, file)).mtimeMs
    }))
    .sort(byOrder)
    .map(({ mtime, ...rest }) => rest);
}

/* ---------- notes ---------- */

function listNotes() {
  const path = join(ROOT, 'notes');
  if (!existsSync(path)) return [];

  return readdirSync(path)
    .filter(file => extname(file).toLowerCase() === '.md')
    .filter(file => !file.startsWith('.'))
    .map(file => {
      const meta = parseName(file);
      const raw = readFileSync(join(path, file), 'utf8');

      // Optional "Kicker: Music" first line sets the small category label.
      const kicker = raw.match(/^kicker:\s*(.+)$/im);
      const body = kicker ? raw.replace(kicker[0], '') : raw;

      // First ordinary paragraph doubles as the summary in the list.
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
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.mtime - a.mtime)
    .map(({ mtime, ...rest }) => rest);
}

/* ---------- write ---------- */

const write = (file, global, value) => writeFileSync(
  join(ROOT, file),
  `/* Generated by update-lists.mjs — do not edit by hand. */\n` +
  `window.${global} = ${JSON.stringify(value, null, 2)};\n`,
  'utf8'
);

const tracks = listTracks();
const notes = listNotes();

if (existsSync(join(ROOT, 'music'))) write('music/tracks.js', 'TRACKS', tracks);
if (existsSync(join(ROOT, 'notes'))) write('notes/notes.js', 'NOTES', notes);

console.log(`music/tracks.js — ${tracks.length} track(s)`);
console.log(`notes/notes.js  — ${notes.length} note(s)`);

const photos = join(ROOT, 'images/photos.js');
if (existsSync(photos)) {
  const count = (readFileSync(photos, 'utf8').match(/"title":/g) || []).length;
  console.log(`images/photos.js — ${count} photo(s) (built in your photo folder)`);
} else {
  console.log('images/photos.js — MISSING. Run make-web.bat in your photo folder');
  console.log('  and copy the images folder into the repo.');
}
