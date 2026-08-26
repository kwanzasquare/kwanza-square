/* Bundle Kwanza Square into single self-contained HTML files.
 *
 *   node build-single.js
 *
 * Produces:
 *   dist/kwanza-square.html  — standalone. Double-click it, email it, host it.
 *   dist/artifact-page.html  — same page without the doctype/html/body wrapper,
 *                              for publishing as a Claude Artifact.
 *
 * Re-run this after editing anything in js/ or css/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const css = read('css/styles.css');
const index = read('index.html');

// The script list is READ FROM index.html, never written down here.
//
// It used to be a hand-written array, and it silently fell three files behind:
// grade.js, cloud.js and celebrate.js were added to the page and never added
// here. The bundle still built, still passed every test, and still looked
// right — but KZ.Cloud was undefined inside it, so the very first click threw
// and the standalone file did nothing at all. A copy of a list is a copy that
// drifts; the page is the only honest source of what the app needs.
const sources = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!sources.length) {
  console.error('No <script src> tags found in index.html — refusing to build a bundle with no code.');
  process.exit(1);
}
const scripts = sources
  .map(f => '/* ===== ' + f + ' ===== */\n' + read(f))
  .join('\n\n');

// Take the markup from index.html: everything between <div id="app"> and its
// closing tag, inclusive. Keeps one source of truth for the DOM.
const start = index.indexOf('<div id="app">');
const end = index.lastIndexOf('</div>');
if (start === -1 || end === -1) {
  console.error('Could not locate the #app markup in index.html');
  process.exit(1);
}
const markup = index.slice(start, end + '</div>'.length);

// The head is READ FROM index.html too, for the same reason the script list is.
// It used to be hand-copied here, which is the identical drift trap: add a meta
// tag or an icon to the page and the bundle silently keeps the old head.
//
// Two things have to change on the way in, because a standalone file cannot
// fetch anything:
//   - the stylesheet <link> goes, since the CSS is inlined further down;
//   - icon hrefs become data: URIs, so the file carries its own artwork.
const dataUri = (file, mime) =>
  'data:' + mime + ';base64,' + fs.readFileSync(path.join(root, file)).toString('base64');

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const head = index
  .slice(0, index.indexOf('<div id="app">'))
  .replace(/<link\s+rel="stylesheet"[^>]*>\s*/g, '')
  .replace(/href="([^"]+\.(?:svg|png|ico))"/g, (whole, file) => {
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) return whole;
    try {
      return 'href="' + dataUri(file, mime) + '"';
    } catch (e) {
      console.error('Icon referenced by index.html is missing: ' + file);
      process.exit(1);
    }
  })
  .trim();

const body = markup + '\n\n<style>\n' + css + '\n</style>\n\n<script>\n' + scripts + '\n</script>\n';

const standalone =
  '<!doctype html>\n<html lang="en">\n<head>\n' + head + '\n</head>\n<body>\n' + body + '</body>\n</html>\n';

// The artifact host supplies <!doctype>/<html>/<head>/<body> itself, so the
// page content is written directly. The viewport meta is kept — browsers honour
// it from the body and mobile layout depends on it. Only the charset goes,
// since that is the host document's business rather than this fragment's.
const artifact = head.replace(/<meta\s+charset="[^"]*">\s*/i, '') + '\n\n' + body;

// Any src/href that is not a data: URI or a #fragment is something this file
// would have to go and fetch. The check used to look only for `https?:`, which
// let a plain relative path like href="favicon.svg" pass as self-contained when
// it is exactly the opposite — a request that resolves to nothing once the file
// is emailed or opened from disk.
//
// This runs BEFORE anything is written. A bundle that fails the check is not a
// bundle worth leaving on disk for someone to pick up and ship by mistake.
const external = [...standalone.matchAll(/(?:src|href)="([^"]*)"/g)]
  .map(m => m[1])
  .filter(v => !/^(data:|#)/.test(v));

if (external.length) {
  console.error('NOT self-contained — these would be fetched at runtime:');
  external.forEach(v => console.error('  ' + v.slice(0, 80)));
  console.error('Nothing written.');
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/kwanza-square.html'), standalone);
fs.writeFileSync(path.join(root, 'dist/artifact-page.html'), artifact);

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('dist/kwanza-square.html  ' + kb(standalone.length) + '  (standalone, self-contained)');
console.log('dist/artifact-page.html  ' + kb(artifact.length) + '  (for publishing)');
console.log('No external requests: confirmed');
