/* Build the one page that shows every soldier direction side by side.
 *
 *   node build-soldiers.js
 *
 * Three generations, in the order they happened, so the argument is visible
 * rather than asserted:
 *
 *   1. Six traditional SVG styles      — where I started. Steph: "dated".
 *   2. Six modern SVG designs          — heavy keylines, glowing visors,
 *                                        chunky proportions.
 *   3. Akan goldweight, 3D rendered    — after the research said figurative
 *                                        pieces at this size are a raster
 *                                        problem and that this game's own
 *                                        culture already solved it.
 *
 * Static markup only. The earlier version of a comparison page like this drew
 * itself in JavaScript and arrived as a blank black rectangle when opened from
 * disk. A page whose whole job is "look at these and choose" must never need a
 * script engine to show them, so the SVG is baked and the renders are inlined
 * as data URIs.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const SHOTS = process.env.SHOTS || path.join(
  '/private/tmp/claude-501/-Users-stephdavid-Kwanza-Square-game--Martin-',
  '6ef66d75-1d16-40ee-8cac-d118a51e3c5a/scratchpad/goldweight/out'
);

function svgSet(srcPath) {
  const src = fs.readFileSync(path.join(root, srcPath), 'utf8');
  const api = new Function(src + '; return { STYLES: STYLES, defs: defs, GOLD: GOLD, JADE: JADE };')();
  if (!api.STYLES || !api.STYLES.length) {
    console.error('No styles found in ' + srcPath);
    process.exit(1);
  }
  return api;
}

let uid = 0;
function svg(api, style, colour, side, width) {
  const id = 'q' + (++uid);
  return '<svg viewBox="-26 -66 52 104" width="' + width + '" height="' + (width * 2) +
         '" xmlns="http://www.w3.org/2000/svg">' +
         api.defs(id, colour) + style.fn(id, colour, side) + '</svg>';
}

function dataUri(file) {
  const buf = fs.readFileSync(path.join(SHOTS, 'web', file));
  return 'data:image/png;base64,' + buf.toString('base64');
}

function row(api, st) {
  return '' +
    '<section class="card">' +
      '<p class="name">' + st.name + '</p>' +
      '<p class="desc">' + st.desc + '</p>' +
      '<div class="stage">' +
        '<div class="grp">' + svg(api, st, api.GOLD, 'A', 92) + svg(api, st, api.JADE, 'B', 92) + '</div>' +
        '<div class="grp small">' + svg(api, st, api.GOLD, 'A', 26) + svg(api, st, api.JADE, 'B', 26) + '</div>' +
        '<div class="tiny">' +
          ['A','B','A','B','A'].map((sd, i) =>
            svg(api, st, i % 2 ? api.JADE : api.GOLD, sd, 15)).join('') +
        '</div>' +
      '</div>' +
      '<p class="lab">large · 46px · 26px on the board</p>' +
    '</section>';
}

const trad = svgSet('preview/styles/src.js');
const modern = svgSet('preview/styles2/src.js');

const gw = ['brass-A', 'brass-B', 'patina-A', 'patina-B', 'jade-A', 'jade-B']
  .map(n => ({ name: n, uri: dataUri(n + '.png') }));

// One rule per render, reused by class. Sized with CSS, so a piece can appear
// at 150px and at 26px without the bytes appearing twice.
const gwCss = gw.map(g =>
  '.gw-' + g.name + '{background-image:url(' + g.uri + ')}').join('\n');

const piece = (name, h) =>
  '<i class="gw gw-' + name + '" style="height:' + h + 'px;width:' + Math.round(h * 0.773) + 'px"></i>';

const gwBig = gw.slice(0, 4).map(g => piece(g.name, 150)).join('');
const gwMid = gw.slice(0, 4).map(g => piece(g.name, 46)).join('');
const gwTiny = ['brass-A','patina-B','brass-B','patina-A','brass-A','patina-B','brass-B']
  .map(n => piece(n, 26)).join('');
const gwJade = gw.slice(4).map(g => piece(g.name, 110)).join('');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kwanza Square — every soldier direction</title>
<style>
  body { margin:0; padding:26px 20px 70px; background:#0A0A0A; color:#F7F3E9;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:22px; margin:0 0 6px; }
  h2 { font-size:13px; letter-spacing:.18em; text-transform:uppercase; color:#D4A017;
       margin:38px 0 4px; border-top:1px solid rgba(212,160,23,.3); padding-top:16px; }
  .gen { color:rgba(247,243,233,.6); font-size:13.5px; line-height:1.6; max-width:48rem; margin:0 0 18px; }
  .lede { color:rgba(247,243,233,.6); font-size:13.5px; line-height:1.6; max-width:48rem; margin:0 0 8px; }
  .card { border-top:1px solid rgba(247,243,233,.09); padding-top:13px; margin:0 0 20px; }
  .name { font-size:12px; letter-spacing:.13em; text-transform:uppercase; color:#F7F3E9; margin:0 0 3px; }
  .desc { font-size:12.5px; color:rgba(247,243,233,.55); margin:0 0 11px; line-height:1.5; max-width:46rem; }
  .stage { display:flex; align-items:flex-end; gap:18px; flex-wrap:wrap;
           background:radial-gradient(circle at 50% 40%, #2B4FC7, #1E3A9E);
           border-radius:10px; padding:14px 16px; }
  .grp { display:flex; align-items:flex-end; gap:6px; }
  .tiny { background:#10306B; border-radius:6px; padding:8px 10px;
          display:flex; align-items:flex-end; gap:7px; }
  svg, img { display:block; overflow:visible; }
  .gw { display:block; background-repeat:no-repeat; background-position:center bottom;
        background-size:contain; flex:0 0 auto; }
${gwCss}
  .lab { font-size:10px; letter-spacing:.08em; text-transform:uppercase;
         color:rgba(247,243,233,.33); margin:7px 0 0; }
  .verdict { background:rgba(212,160,23,.07); border:1px solid rgba(212,160,23,.28);
             border-radius:12px; padding:14px 16px; margin:14px 0 0;
             font-size:13px; line-height:1.6; color:rgba(247,243,233,.8); max-width:48rem; }
  .verdict b { color:#F0BB35; }
</style>
</head>
<body>

<h1>Every soldier direction</h1>
<p class="lede">
  Three generations, in the order they happened. Each row shows the two armies
  large, then at 46px, then at 26px on the board's own blue. <b>The 26px strip
  is the one that decides it</b> — that is the size a thumb actually sees.
  This page runs no scripts.
</p>

<h2>Generation 1 · Traditional vector</h2>
<p class="gen">
  Where I started. Flat SVG, drawn by hand, six different traditions. Your
  verdict was that they were dated, and the reason turned out to be structural
  rather than a matter of taste: every one is a symmetrical figure standing to
  attention, no face, lit by a single soft gradient.
</p>
${trad.STYLES.map(st => row(trad, st)).join('\n')}

<h2>Generation 2 · Modern game art</h2>
<p class="gen">
  Rebuilt for the audience rather than the museum. Heavy dark keylines so a
  piece pops off a busy board, proportions that are never 1:1 human, a face
  that looks back at you, and light that spills past its own edge instead of
  being painted on. The Adinkra glyphs and masks stay — rendered as something
  powered rather than something carved.
</p>
${modern.STYLES.map(st => row(modern, st)).join('\n')}

<h2>Generation 3 · Akan goldweight, rendered in 3D</h2>
<p class="gen">
  Three research agents converged on the same answer: figurative pieces at
  26–120px are a raster problem, every professional studio pre-renders from 3D,
  and this game's own culture already solved it. <b>Akan goldweights are
  miniature cast-brass figures</b> — 1 to 5cm, built silhouette-first because
  they had to be read in the palm. One documented subject is a mancala board.
  <br><br>
  These are genuinely 3D: real normals, ambient occlusion, soft shadows, one
  fixed orthographic camera and light rig for every piece. Brass and patina are
  <b>the same figure at two ages</b>, which is what a real box of weights looks
  like — so the two armies stop being arbitrary colours.
</p>

<section class="card">
  <p class="name">Brass and patina — the two armies</p>
  <p class="desc">Carrying the akrafena (the Akan state sword) and the akoben (war horn), wearing the batakari smock, under a ram's-horn war cap and a pangolin cap. Not a spear and not a knobkerrie — that is Zulu, and would be the pan-continental blur this is trying to avoid.</p>
  <div class="stage">
    <div class="grp">${gwBig}</div>
    <div class="grp small">${gwMid}</div>
    <div class="tiny">${gwTiny}</div>
  </div>
  <p class="lab">large · 46px · 26px on the board</p>
</section>

<section class="card">
  <p class="name">The same figure in the jade colourway</p>
  <p class="desc">The renderer takes any of the game's existing colourways, so this is not locked to brass.</p>
  <div class="stage"><div class="grp">${gwJade}</div></div>
</section>

<div class="verdict">
  <b>Where I actually stand.</b> Generation 3 is the right direction and the
  sculpt is the weakest part of it — the cap is blocky, the sword reads as a
  nub, the horns barely register. That is a modelling problem, not a rendering
  one, and it is fixable. Generation 2's <b>Champion</b> is the one a child
  picks up fastest and is the most readable of everything here at 26px.
  Generation 1 I would not ship.
  <br><br>
  The real question underneath is not which picture you like. It is whether we
  drop "pure SVG, no image files" — a rule I set so the game could be one
  self-contained file. Base64-embedded WebP keeps it self-contained anyway, and
  twenty sprites cost roughly 30–60&nbsp;KB, which is smaller than a single web
  font. That constraint was the thing capping realism, and it was mine, not the
  game's.
</div>

</body>
</html>
`;

if (/<script/i.test(page)) {
  console.error('The built page contains a script tag — the whole point is that it does not.');
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'preview/soldiers'), { recursive: true });
fs.writeFileSync(path.join(root, 'preview/soldiers/index.html'), page);
console.log('preview/soldiers/index.html  ' + (page.length / 1024).toFixed(0) + ' KB  (static, no scripts)');
