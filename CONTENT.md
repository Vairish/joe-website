# Adding things to the site

Three folders, three listing files. Each folder carries its own listing, so
the site reads what's there and nothing needs building at the repo level.

| Section | Content lives in | Listing | Made by |
|---|---|---|---|
| Photography | `images/` | `images/photos.js` | `make-web.bat`, in your photo folder |
| Music | `music/` | `music/tracks.js` | `update-lists.bat`, here |
| Notes | `notes/` | `notes/notes.js` | `update-lists.bat`, here |

---

## Photographs

Your full-resolution originals live in your own photo folder, outside this
repo. `make-web.mjs` and `make-web.bat` sit in there with them.

```
1. Add or rename photos in your photo folder
2. Double-click make-web.bat
3. Copy the images folder it makes into the repo, replacing the one there
4. Commit and push
```

The `images` folder contains everything the site needs: the resized images *and*
the `photos.js` listing. Copying it across is the whole publish step.

Originals are never modified. Only changed photos are reprocessed, so repeat
runs are quick. Delete a photo and its leftover copies are cleaned up on the
next run.

## Music

Drop `.mp3` (or `.m4a`, `.ogg`, `.wav`, `.flac`) into `music/`, then
double-click `update-lists.bat`.

Durations are read from the files by the browser — you don't type them in. One
track plays at a time, and the waveform animates while it does.

## Notes

Write a markdown file into `notes/`, then double-click `update-lists.bat`.

```
2026-08-29 - A home for unfinished things.md
```

The date shows in the left column; without one the note is marked `Draft` and
sorts to the top. An optional first line sets the small category label:

```
Kicker: Music
```

The first ordinary paragraph becomes the summary in the list. Clicking a note
expands it in place.

Supported: `##` headings, **bold**, *italic*, `code`, links, images, `>`
quotes, bullet and numbered lists, ``` fences, `---` rules. Converted to HTML
when the listing is made, so the page loads no markdown library.

---

## Naming

Same convention everywhere. Only the title is required:

```
01 - Atlantic Weather - From the camera roll.jpg
^^   ^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^
|    title              small grey line underneath
number sets the order, never displayed
```

- Renumber to reorder. Gaps in the numbering are fine.
- Leave the subtitle off and that line disappears.
- Separator is space-hyphen-space, so hyphens inside a title are safe.
- Unnumbered files sort last, newest first.

## Gallery layout

Nine photos per page, scrolling sideways with arrows and dots. On phones,
paging switches off and photos stack in a single column.

Each photo's shape decides its tile:

| Photo | Tile |
|---|---|
| Landscape | 2 units wide × 1 tall |
| Portrait | 1 wide × 2 tall |
| Square | 2 × 2 — square photos become feature tiles |

The page is six units across, so nine landscape-and-portrait photos fill it
exactly. Pages with square photos are taller. Gaps read as whitespace.

---

## Why listings exist at all

A website opened from a folder can't ask what's in that folder — there's no
server to answer, GitHub Pages serves no directory index, and `fetch()` is
blocked outright on `file://`. So each folder ships a small `.js` file naming
its contents, loaded with a plain `<script>` tag, which works everywhere
including straight off your desktop.

These files are generated. Don't edit them by hand.

## Never start a folder name with an underscore

GitHub Pages runs Jekyll, and Jekyll silently drops any directory whose name
begins with `_`. The images folder was briefly called `_web`, which produced a
site that worked perfectly on this machine and showed no photographs at all
online — no error, just nothing.

`.nojekyll` in the repo root now disables Jekyll entirely and is the real fix.
Leave it there. But avoid underscore-prefixed folders anyway.

## Git

`images/` is committed — it's what the site serves. Full-resolution
originals are not in this repo at all; they live in your photo folder, and
git is not backing them up. Keep your own copies.
