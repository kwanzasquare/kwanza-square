/* Build the six-styles comparison page as STATIC html.
 *
 *   node build-styles.js
 *
 * The first version of this page drew every soldier in JavaScript at load.
 * That works on a web server and is blank everywhere else — opened from disk,
 * or in any viewer that does not run scripts, you get a heading and an empty
 * black page. A page whose whole purpose is "look at these and choose one"
 * must not need a JavaScript engine to show them.
 *
 * So the drawing code runs HERE, once, and the output is baked into the file.
 * The page that ships is markup and nothing else: no <script>, no fetches, no
 * dependencies. It renders from disk, from a web server, and from an email
 * attachment identically.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const source = fs.readFileSync(path.join(root, 'preview/styles/src.js'), 'utf8');

// The drawing functions are pure string builders — no DOM — so they run in
// Node unchanged. That is deliberate: it is what makes this bake possible.
const api = new Function(source + '; return { STYLES: STYLES, defs: defs, GOLD: GOLD, JADE: JADE };')();
const { STYLES, defs, GOLD, JADE } = api;

if (!STYLES || !STYLES.length) {
  console.error('No styles found in preview/styles/src.js — refusing to build an empty page.');
  process.exit(1);
}

let uid = 0;
function svg(style, colour, side, width) {
  const id = 'g' + (++uid);
  return '<svg viewBox="-26 -66 52 104" width="' + width + '" height="' + (width * 2) +
         '" xmlns="http://www.w3.org/2000/svg">' + defs(id, colour) + style.fn(id, colour, side) + '</svg>';
}

const rows = STYLES.map(st => {
  const big = svg(st, GOLD, 'A', 96) + svg(st, JADE, 'B', 96);
  const mid = svg(st, GOLD, 'A', 26) + svg(st, JADE, 'B', 26);
  const tiny = ['A', 'B', 'A', 'B', 'A']
    .map((sd, i) => svg(st, i % 2 ? JADE : GOLD, sd, 15)).join('');
  return '' +
    '<section class="style">' +
      '<p class="name">' + st.name + '</p>' +
      '<p class="desc">' + st.desc + '</p>' +
      '<div class="row">' +
        '<div class="grp">' + big + '</div>' +
        '<div class="grp">' + mid + '</div>' +
        '<div class="tiny">' + tiny + '</div>' +
      '</div>' +
      '<p class="lab">large &nbsp;·&nbsp; 46px &nbsp;·&nbsp; 26px on the board</p>' +
    '</section>';
}).join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kwanza Square — six soldier styles</title>
<style>
  body { margin:0; padding:24px 20px 60px; background:#0A0A0A; color:#F7F3E9;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:20px; margin:0 0 6px; }
  .lede { color:rgba(247,243,233,.6); font-size:13.5px; line-height:1.6; max-width:46rem; margin:0 0 20px; }
  .style { border-top:1px solid rgba(212,160,23,.22); padding-top:14px; margin:0 0 22px; }
  .name { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#D4A017; margin:0 0 3px; }
  .desc { font-size:12.5px; color:rgba(247,243,233,.58); margin:0 0 11px; line-height:1.5; max-width:44rem; }
  .row { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap;
         background:radial-gradient(circle at 50% 40%, #2B4FC7, #1E3A9E);
         border-radius:10px; padding:14px 16px; }
  .grp { display:flex; align-items:flex-end; gap:6px; }
  .tiny { background:#10306B; border-radius:6px; padding:8px 10px;
          display:flex; align-items:flex-end; gap:7px; }
  svg { display:block; overflow:visible; }
  .lab { font-size:10px; letter-spacing:.08em; text-transform:uppercase;
         color:rgba(247,243,233,.35); margin:7px 0 0; }
</style>
</head>
<body>
<h1>Six soldier styles</h1>
<p class="lede">
  Each row shows the two armies large, then at 46px, then at 26px on the board's
  own blue. The 26px strip is the one that decides it — that is the size a thumb
  actually sees. Everything here is SVG drawn from maths; there are no image
  files, and this page runs no scripts.
</p>
${rows}
</body>
</html>
`;

if (/<script/i.test(page)) {
  console.error('The built page contains a script tag — the whole point is that it does not.');
  process.exit(1);
}

fs.writeFileSync(path.join(root, 'preview/styles/index.html'), page);
console.log('preview/styles/index.html  ' + (page.length / 1024).toFixed(0) + ' KB  (static, no scripts)');
