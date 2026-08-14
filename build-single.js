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
const scripts = ['js/geometry.js', 'js/engine.js', 'js/ai.js', 'js/render.js', 'js/app.js']
  .map(f => '/* ===== ' + f + ' ===== */\n' + read(f))
  .join('\n\n');

// Take the markup from index.html: everything between <div id="app"> and its
// closing tag, inclusive. Keeps one source of truth for the DOM.
const index = read('index.html');
const start = index.indexOf('<div id="app">');
const end = index.lastIndexOf('</div>');
if (start === -1 || end === -1) {
  console.error('Could not locate the #app markup in index.html');
  process.exit(1);
}
const markup = index.slice(start, end + '</div>'.length);

const TITLE = 'Kwanza Square';
const DESCRIPTION = 'A mystical African traditional game of wit and strategic thinking.';

const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">',
  '<meta name="theme-color" content="#0A0A0A">',
  '<meta name="description" content="' + DESCRIPTION + '">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<title>' + TITLE + '</title>'
].join('\n');

const body = markup + '\n\n<style>\n' + css + '\n</style>\n\n<script>\n' + scripts + '\n</script>\n';

const standalone =
  '<!doctype html>\n<html lang="en">\n<head>\n' + head + '\n</head>\n<body>\n' + body + '</body>\n</html>\n';

// The artifact host supplies <!doctype>/<html>/<head>/<body> itself, so the
// page content is written directly. The viewport meta is kept — browsers honour
// it from the body and mobile layout depends on it.
const artifact =
  '<title>' + TITLE + '</title>\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">\n' +
  '<meta name="theme-color" content="#0A0A0A">\n\n' + body;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/kwanza-square.html'), standalone);
fs.writeFileSync(path.join(root, 'dist/artifact-page.html'), artifact);

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('dist/kwanza-square.html  ' + kb(standalone.length) + '  (standalone, self-contained)');
console.log('dist/artifact-page.html  ' + kb(artifact.length) + '  (for publishing)');
console.log('No external requests: ' + (/(src|href)=["']https?:/.test(standalone) ? 'NO — found a remote URL' : 'confirmed'));
