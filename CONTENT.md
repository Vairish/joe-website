# Adding things to the site

Drop files into a folder, commit, push. A GitHub Action regenerates `data.js`
and the site updates itself.

To preview locally before committing, run `node build.mjs` (or double-click
`build.bat`) and refresh the page.

**One-time setup:** run `npm install` once, to get the image resizer.

---

## Naming

The filename is the content. Every part except the title is optional:

```
01 - Atlantic Weather - From the camera roll.webp
^^   ^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^
|    title              small grey line underneath
number controls order, never displayed
```

- **`01 - `** sets the order. Renumber to reorder; the number never appears.
- **`- Subtitle`** is the second line. Leave it off and the line disappears.
- Separator is a space-hyphen-space. Hyphens *inside* a title are safe:
  `01 - Black-and-white study.jpg` works.

Files without a number sort newest-first, below the numbered ones.

## Photographs → `images/`

`.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`

The gallery shows **nine photos per page** and scrolls sideways between pages,
with arrows and dots underneath. On phones paging switches off and the photos
stack in one column.

Each photo's shape is measured at build time and decides how much room it gets:

| Photo | Tile |
|---|---|
| Landscape (wider than 1.12:1) | 2 units wide × 1 tall |
| Portrait (taller than 1:1.12) | 1 unit wide × 2 tall |
| Square (anything between) | 2 × 2 — square photos become feature tiles |

The page is six units across, so nine landscape-and-portrait photos fill it
exactly. A page with square photos in it will be taller. Gaps are normal and
read as whitespace, not breakage.

Because shapes are known before the images load, tiles are the right size
immediately and the page never jumps as photos arrive.

### Sizes — drop full-resolution files in

Put whatever came out of the camera into `images/`. The build makes two
web-sized WebP copies of each into `images/_web/` and the site loads those:

- **`-grid.webp`** — max 1200px, for the gallery tiles
- **`-full.webp`** — max 2200px, for the lightbox

Your originals are never modified and never served. Copies are only rebuilt
when the source file changes, so repeat builds take seconds.

For scale: 25 photos totalling 115 MB of originals become 10.7 MB of web
copies, and the first gallery page loads 0.8 MB instead of 33.5 MB.

### Originals are not committed

`.gitignore` tracks `images/_web/` only. Full-resolution files stay on your
machine, so the repository holds ~15 MB of web copies rather than 164 MB of
originals, and doesn't grow by 5 MB every time you add a photo.

**This makes one step non-optional: run the build before you push.** The
GitHub Action never sees your originals, so it cannot resize them for you. If
you push a new photo without building first, its web copies won't exist and it
won't appear on the site.

```
1. Drop the photo into images/
2. Double-click build.bat        <- generates the web copies
3. Commit and push
```

You can delete or move originals out of `images/` afterwards — anything
already published stays published, because the build reads the committed web
copies as well as any new originals and merges the two.

> **Git is not backing up your photographs.** Keep your own copies.

## Music → `music/`

`.mp3` `.m4a` `.ogg` `.wav` `.flac`

Durations are read from the file by the browser — you don't enter them. One
track plays at a time and the waveform animates while it does.

## Notes → `notes/`

Markdown files. Start the filename with a date:

```
2026-08-29 - A home for unfinished things.md
```

The date shows in the left column; without one the note is marked `Draft` and
sorts to the top.

An optional first line sets the small category label:

```
Kicker: Music
```

The first ordinary paragraph is used as the summary in the list. Clicking a
note expands it in place.

Supported markdown: `##` headings, **bold**, *italic*, `code`, links, images,
`>` quotes, bullet and numbered lists, ``` fences, and `---` rules. It's
converted to HTML when `data.js` is built, so the page loads no markdown
library.

---

## Why `data.js` and not `data.json`

A browser opening `index.html` straight from your desktop refuses to `fetch()`
a JSON file next to it — Chrome treats it as a cross-origin request and blocks
it. A `<script>` tag has no such restriction, so `data.js` assigns a global and
local previews keep working with no server running.

`data.js` is generated. Don't edit it by hand; your changes will be overwritten
on the next build.
