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

Durations are read from the files by the browser — you don't type them in.

There's a transport bar under the waveform: previous, play/pause, next, a seek
bar and elapsed/total time. Clicking a track in the list plays it; clicking the
same one again pauses. Tracks auto-advance to the next and stop at the end of
the list. The waveform only animates while something is playing.

**Don't type the extension into the filename.** Windows adds it for you, so
`01 - First Light - Instrumental Rock.mp3` typed into the name box becomes
`…Rock.mp3.mp3` on disk. The build strips repeated extensions now, so the site
looks right either way — but the file itself stays oddly named.

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

Pages scroll sideways with arrows underneath — dots up to 8 pages, then a
`3 / 23` counter, since a dot per page stops being useful past that.

Paging works at every screen size. Only the grid's shape changes, so page
count is identical on a phone and a monitor:

| Screen | Grid |
|---|---|
| Desktop, 801px+ | 6 across × 3 down |
| Tablet and large phone, ≤800px | 4 × 5 |
| Phone, ≤480px | 2 × 9 |

**Column counts must stay even.** A landscape tile spans 2 columns, so in an
odd-column grid only one fits per row and the spare column is wasted — a page
of nine landscapes needed 9 rows at 3 columns while other pages needed 7,
which is the uneven-height problem this scheme exists to prevent.

### Order can shift by a place or two

Pages are filled by actually packing them. Counting area isn't enough: whether
18 units fit in 18 cells depends on the order the shapes arrive in. Six
landscapes fill rows 1–2 exactly, and a portrait then needs two rows with one
left.

So when the next photo won't fit the space remaining, the build takes the
earliest one that does, and the skipped photo goes to the front of the next
page. Portraits are 1×2 and want to come in pairs; an odd one leaves a 1×2
hole nothing else can fill, and this closes it.

The effect is small — currently 5 of 48 photos sit out of numbered order, none
by more than 3 places — and it's what keeps every page completely full.

Each photo's shape decides its tile:

| Photo | Tile | Costs |
|---|---|---|
| Landscape | 2 units wide × 1 tall | 2 |
| Portrait | 1 wide × 2 tall | 2 |
| Square | 2 × 2 — square photos become feature tiles | 4 |

The grid is 6 units across and 3 rows deep, so a page holds **18 units**.
That's normally nine photos — or eight when one of them is square.

Pages are filled by area rather than by count on purpose. Nine-always would
make a page containing a square photo four rows tall while the rest were
three, and the whole gallery would jump vertically as you paged through it.
Filling by area keeps every page exactly three rows, so the height never
moves. The last page is short, which is what a last page should look like.

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
