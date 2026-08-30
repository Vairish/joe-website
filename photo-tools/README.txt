PHOTO FOLDER TOOLS
==================

Copy make-web.mjs and make-web.bat into the folder holding your
full-resolution photographs (the one on G:). They don't do anything
sitting here in the repo.


TO PUBLISH PHOTOS
-----------------
1. Add or rename photos in your photo folder.
2. Double-click make-web.bat.
3. Copy the "images" folder it creates into the website repo,
   replacing the images folder already there.
4. Commit and push.

That's it. The website reads everything it needs from images\ —
there is no build step in the repo.


NAMING
------
    01 - Atlantic Weather - From the camera roll.jpg
    ^^   ^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^
    |    title              small grey line under the title
    order, never displayed

- The number sets the order. Renumber to reorder. Gaps are fine.
- The subtitle is optional; leave it off and the line disappears.
- Separator is space-hyphen-space. Hyphens inside a title are safe.
- Photos with no number sort to the end, newest first.


WHAT IT MAKES
-------------
images\<name>-grid.webp   max 1200px, for the gallery tiles
images\<name>-full.webp   max 2200px, for the lightbox
images\photos.js          the listing the website reads

Your originals are never modified, moved or deleted.

Only changed photos are reprocessed, so running it again is quick.
Delete or rename a photo and the leftovers are cleaned up next run.

Output filenames are tidied for the web — "&" becomes "and", curly
quotes become straight ones, trailing spaces go. The titles shown on
the site still come from your original filenames, so nothing you see
changes. This avoids files that are fine on Windows but awkward in a
URL.


A NOTE ON THE FOLDER NAME
-------------------------
The output folder is called "images", not "_web". GitHub Pages runs
Jekyll, which silently ignores any folder starting with an underscore.
That produces a site that works perfectly on your machine and shows no
photographs at all online. There's also a .nojekyll file in the repo
root as a second line of defence — leave it there.


FIRST RUN
---------
It installs the image resizer by itself (about 30 seconds, needs an
internet connection). You need Node.js installed:
https://nodejs.org  — take the LTS version, default options.
