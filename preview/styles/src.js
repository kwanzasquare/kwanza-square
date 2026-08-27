var NS = 'http://www.w3.org/2000/svg';

var GOLD = { light:'#FFF0BE', mid:'#E9B833', dark:'#8A6408', deep:'#5B4104', rim:'#3E2C03' };
var JADE = { light:'#B6F7DF', mid:'#16A085', dark:'#075040', deep:'#04332A', rim:'#02241E' };

function defs(id, c) {
  return '' +
  '<defs>' +
    '<linearGradient id="' + id + '-body" x1="0.15" y1="0" x2="0.9" y2="1">' +
      '<stop offset="0" stop-color="' + c.light + '"/>' +
      '<stop offset=".42" stop-color="' + c.mid + '"/>' +
      '<stop offset="1" stop-color="' + c.dark + '"/>' +
    '</linearGradient>' +
    '<linearGradient id="' + id + '-deep" x1="0.2" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="' + c.mid + '"/>' +
      '<stop offset="1" stop-color="' + c.deep + '"/>' +
    '</linearGradient>' +
    '<radialGradient id="' + id + '-head" cx="0.34" cy="0.28" r="0.85">' +
      '<stop offset="0" stop-color="' + c.light + '"/>' +
      '<stop offset=".55" stop-color="' + c.mid + '"/>' +
      '<stop offset="1" stop-color="' + c.dark + '"/>' +
    '</radialGradient>' +
    '<linearGradient id="' + id + '-metal" x1="0" y1="0" x2="1" y2="0.3">' +
      '<stop offset="0" stop-color="' + c.dark + '"/>' +
      '<stop offset=".28" stop-color="' + c.light + '"/>' +
      '<stop offset=".46" stop-color="' + c.mid + '"/>' +
      '<stop offset=".72" stop-color="' + c.deep + '"/>' +
      '<stop offset=".88" stop-color="' + c.light + '"/>' +
      '<stop offset="1" stop-color="' + c.dark + '"/>' +
    '</linearGradient>' +
  '</defs>';
}

/* ---------------------------------------------------------------- 1. sculpted
   The reference done properly: real tapers, a waist, shoulders that slope,
   calves that narrow into the ankle. */
function sculpted(id, c, side) {
  var arm = side === 'A'
    ? '<path d="M -10.6 -25 C -15.6 -23 -17.6 -17 -17.2 -9 C -16.9 -2.5 -15.8 1.5 -15.2 4.5 C -14.8 7.2 -10.6 7.2 -10.2 4.5 C -9.7 1.5 -11.2 -3 -11.4 -9 C -11.6 -15 -10.4 -19.5 -8 -22 Z" fill="url(#' + id + '-body)" stroke="' + c.rim + '" stroke-width="1.1" stroke-opacity=".5"/>'
    : '<path d="M -10.2 -25 C -15.6 -22.4 -19 -14.6 -18.4 -7 C -18 -1.4 -13.8 2.8 -9 3.6 L -9 -2 C -12 -2.8 -13.8 -4.8 -13.6 -7.6 C -13.3 -12.6 -11.2 -17.8 -7 -20.8 Z" fill="url(#' + id + '-body)" stroke="' + c.rim + '" stroke-width="1.1" stroke-opacity=".5"/>';
  return '' +
  arm +
  '<path d="M 10.6 -25 C 15.6 -23 17.6 -17 17.2 -9 C 16.9 -2.5 15.8 1.5 15.2 4.5 C 14.8 7.2 10.6 7.2 10.2 4.5 C 9.7 1.5 11.2 -3 11.4 -9 C 11.6 -15 10.4 -19.5 8 -22 Z" fill="url(#' + id + '-body)" stroke="' + c.rim + '" stroke-width="1.1" stroke-opacity=".5"/>' +
  // legs, tapered, with a notch of daylight cut between them
  '<path d="M -9.8 -2 C -10.4 8 -9.6 18 -8.4 25 C -8 28.6 -3.4 28.6 -3 25 C -2.4 19 -2.2 12 -2.2 6 C -2.2 3 2.2 3 2.2 6 C 2.2 12 2.4 19 3 25 C 3.4 28.6 8 28.6 8.4 25 C 9.6 18 10.4 8 9.8 -2 Z" fill="url(#' + id + '-body)"/>' +
  '<path d="M -13.4 25.5 C -13.4 23.4 -12 22.6 -9.6 22.6 L -3.4 22.6 C -2.2 22.6 -1.8 23.6 -1.8 25 C -1.8 27.4 -3.4 28.6 -6.2 28.6 L -10.8 28.6 C -12.6 28.6 -13.4 27.4 -13.4 25.5 Z" fill="url(#' + id + '-deep)"/>' +
  '<path d="M 13.4 25.5 C 13.4 23.4 12 22.6 9.6 22.6 L 3.4 22.6 C 2.2 22.6 1.8 23.6 1.8 25 C 1.8 27.4 3.4 28.6 6.2 28.6 L 10.8 28.6 C 12.6 28.6 13.4 27.4 13.4 25.5 Z" fill="url(#' + id + '-deep)"/>' +
  // torso: sloped shoulders, waist, hips
  '<path d="M 0 -27 C 6.4 -27 10.6 -24.6 11.4 -20 C 12.2 -15 11 -10 9.6 -5.4 C 8.8 -2.6 9.6 0 9.9 -1.6 L 9.9 -1 C 6 1 -6 1 -9.9 -1 L -9.9 -1.6 C -9.6 0 -8.8 -2.6 -9.6 -5.4 C -11 -10 -12.2 -15 -11.4 -20 C -10.6 -24.6 -6.4 -27 0 -27 Z" fill="url(#' + id + '-body)"/>' +
  '<path d="M -3.4 -31 L 3.4 -31 L 3.4 -25 C 3.4 -23.4 -3.4 -23.4 -3.4 -25 Z" fill="url(#' + id + '-deep)"/>' +
  '<ellipse cx="0" cy="-38" rx="8.4" ry="9.2" fill="url(#' + id + '-head)"/>' +
  (side === 'A'
    ? '<path d="M -8 -42.6 L 8 -42.6" stroke="' + c.rim + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : '<path d="M 0 -56 C 3.6 -51.6 4 -47.6 2 -44.4 L -2 -44.4 C -4 -47.6 -3.6 -51.6 0 -56 Z" fill="url(#' + id + '-body)" stroke="' + c.rim + '" stroke-width="1.6"/>');
}

/* ------------------------------------------------------------ 2. carved wood
   Senufo/Baule-inspired: elongated, columnar, a crest on the head, carved
   bands across the body, short flexed legs on a plinth. */
function carved(id, c, side) {
  return '' +
  '<path d="M -12 30 L 12 30 L 10 35 L -10 35 Z" fill="url(#' + id + '-deep)"/>' +
  '<path d="M -9.6 -4 C -10.6 6 -10 16 -8.6 24 C -8.2 28 -3.6 28 -3.2 24 C -2.6 18 -2.4 11 -2.4 5 L 2.4 5 C 2.4 11 2.6 18 3.2 24 C 3.6 28 8.2 28 8.6 24 C 10 16 10.6 6 9.6 -4 Z" fill="url(#' + id + '-body)"/>' +
  '<path d="M -10.6 -26 C -11.6 -16 -11.4 -6 -10 -1 C -5 1.6 5 1.6 10 -1 C 11.4 -6 11.6 -16 10.6 -26 C 6 -29 -6 -29 -10.6 -26 Z" fill="url(#' + id + '-body)"/>' +
  '<g stroke="' + c.rim + '" stroke-width="1.5" fill="none" opacity=".55">' +
    '<path d="M -10.8 -19 C -4 -17.4 4 -17.4 10.8 -19"/>' +
    '<path d="M -11 -13 C -4 -11.4 4 -11.4 11 -13"/>' +
    '<path d="M -10.8 -7 C -4 -5.4 4 -5.4 10.8 -7"/>' +
  '</g>' +
  '<path d="M -10.8 -26 C -14.4 -24 -15.6 -18 -15 -10 C -14.6 -5 -13.6 -1 -13 2 C -12.6 4.4 -9 4.4 -8.6 2 C -8.2 -1 -9.4 -5.4 -9.6 -10.6" fill="url(#' + id + '-deep)"/>' +
  '<path d="M 10.8 -26 C 14.4 -24 15.6 -18 15 -10 C 14.6 -5 13.6 -1 13 2 C 12.6 4.4 9 4.4 8.6 2 C 8.2 -1 9.4 -5.4 9.6 -10.6" fill="url(#' + id + '-deep)"/>' +
  '<path d="M -3 -30 L 3 -30 L 3 -25.4 L -3 -25.4 Z" fill="url(#' + id + '-deep)"/>' +
  '<path d="M 0 -50 C 7 -50 9.6 -44 9.6 -38 C 9.6 -32.6 6 -29 0 -29 C -6 -29 -9.6 -32.6 -9.6 -38 C -9.6 -44 -7 -50 0 -50 Z" fill="url(#' + id + '-head)"/>' +
  (side === 'A'
    ? '<path d="M 0 -60 C 3 -56 3.4 -52 2.4 -49.4 C 1 -50.4 -1 -50.4 -2.4 -49.4 C -3.4 -52 -3 -56 0 -60 Z" fill="url(#' + id + '-body)"/>'
    : '<path d="M -8 -49 C -5 -55 5 -55 8 -49 C 4 -51.4 -4 -51.4 -8 -49 Z" fill="url(#' + id + '-body)"/>' +
      '<path d="M -9.4 -44 L 9.4 -44" stroke="' + c.rim + '" stroke-width="2.4" stroke-linecap="round"/>');
}

/* ----------------------------------------------------------- 3. cast bronze
   Benin-inspired: banded collar, headdress, ornamented chest, spear. Heavier
   and more ceremonial; the metal gradient does the work. */
function bronze(id, c, side) {
  var weapon = side === 'A'
    ? '<rect x="16.6" y="-46" width="3.6" height="76" rx="1.8" fill="url(#' + id + '-metal)"/>' +
      '<path d="M 18.4 -55 C 22 -50.6 22 -45.6 18.4 -41.4 C 14.8 -45.6 14.8 -50.6 18.4 -55 Z" fill="url(#' + id + '-metal)"/>'
    : '<rect x="16.6" y="-40" width="3.6" height="70" rx="1.8" fill="url(#' + id + '-metal)"/>' +
      '<path d="M 18.4 -50 C 23 -47 23.6 -41 20 -38 L 16.8 -38 C 13.2 -41 13.8 -47 18.4 -50 Z" fill="url(#' + id + '-metal)"/>';
  return '' +
  weapon +
  '<path d="M -10.4 -1 C -11.4 9 -10.8 19 -9.4 26 C -9 29.6 -4 29.6 -3.6 26 C -3 20 -2.8 12 -2.8 6 L 2.8 6 C 2.8 12 3 20 3.6 26 C 4 29.6 9 29.6 9.4 26 C 10.8 19 11.4 9 10.4 -1 Z" fill="url(#' + id + '-metal)"/>' +
  '<path d="M -14 27 L -2.6 27 L -2.6 31.4 L -14 31.4 Z" fill="url(#' + id + '-deep)"/>' +
  '<path d="M 14 27 L 2.6 27 L 2.6 31.4 L 14 31.4 Z" fill="url(#' + id + '-deep)"/>' +
  '<path d="M -12.6 -24 C -13.6 -14 -13 -6 -11 -1 C -5 2 5 2 11 -1 C 13 -6 13.6 -14 12.6 -24 C 7 -28 -7 -28 -12.6 -24 Z" fill="url(#' + id + '-metal)"/>' +
  '<g fill="none" stroke="' + c.rim + '" stroke-width="1.6" opacity=".6">' +
    '<path d="M -12.6 -17 C -5 -15 5 -15 12.6 -17"/>' +
    '<path d="M -12 -10 C -5 -8 5 -8 12 -10"/>' +
    '<circle cx="0" cy="-20" r="3.2"/>' +
  '</g>' +
  '<path d="M -12.6 -24 C -16.4 -21.6 -17.6 -15 -17 -8 C -16.6 -3 -15.6 0 -15 3 C -14.6 5.6 -10.6 5.6 -10.2 3 C -9.8 0 -11.2 -4.4 -11.4 -9.6" fill="url(#' + id + '-metal)"/>' +
  '<path d="M 12.6 -24 C 16.4 -21.6 17.6 -15 17 -8 C 16.6 -3 15.6 0 15 3 C 14.6 5.6 10.6 5.6 10.2 3 C 9.8 0 11.2 -4.4 11.4 -9.6" fill="url(#' + id + '-metal)"/>' +
  '<path d="M -6 -30 L 6 -30 L 5 -25 L -5 -25 Z" fill="url(#' + id + '-deep)"/>' +
  '<g stroke="' + c.rim + '" stroke-width="1.3" opacity=".7"><path d="M -5.6 -28.4 L 5.6 -28.4"/><path d="M -5.2 -26.4 L 5.2 -26.4"/></g>' +
  '<ellipse cx="0" cy="-38" rx="8.6" ry="9" fill="url(#' + id + '-head)"/>' +
  '<path d="M -9 -42 C -9 -48.6 -5 -52 0 -52 C 5 -52 9 -48.6 9 -42 C 5 -44.4 -5 -44.4 -9 -42 Z" fill="url(#' + id + '-metal)"/>';
}

/* -------------------------------------------------------------- 4. silhouette
   No interior detail at all. One flat shape, one rim. The most legible thing
   on this page at 26px, and the least warm. */
function silhouette(id, c, side) {
  var body = side === 'A'
    ? 'M 0 -47 C 5.4 -47 9 -43.4 9 -38 C 9 -34.6 7.6 -31.8 5.4 -30.2 L 5.4 -27 L 11 -25 C 13.6 -24 14.6 -21.4 14.6 -18 L 14.6 -3 L 11 -3 L 11 -20 L 9.6 -20.6 L 9.6 1 L 8 26 L 8.4 31 L -0.6 31 L 0.4 26 L 0.4 8 L -0.4 8 L -0.4 26 L 0.6 31 L -8.4 31 L -8 26 L -9.6 1 L -9.6 -20.6 L -11 -20 L -11 -3 L -14.6 -3 L -14.6 -18 C -14.6 -21.4 -13.6 -24 -11 -25 L -5.4 -27 L -5.4 -30.2 C -7.6 -31.8 -9 -34.6 -9 -38 C -9 -43.4 -5.4 -47 0 -47 Z'
    : 'M 0 -47 C 5.4 -47 9 -43.4 9 -38 C 9 -34.6 7.6 -31.8 5.4 -30.2 L 5.4 -27 L 11 -25 C 13.6 -24 14.6 -21.4 14.6 -18 L 14.6 -3 L 11 -3 L 11 -20 L 9.6 -20.6 L 9.6 1 L 8 26 L 8.4 31 L -0.6 31 L 0.4 26 L 0.4 8 L -0.4 8 L -0.4 26 L 0.6 31 L -8.4 31 L -8 26 L -9.6 1 L -9.6 -20.6 C -13.6 -19.4 -16.4 -15 -16 -9 C -15.7 -4 -13 -0.6 -9.4 0.6 L -9.4 5 C -15.4 3.6 -19.6 -1.4 -20 -8.6 C -20.4 -17 -16.4 -23.6 -10.4 -25.6 L -5.4 -27 L -5.4 -30.2 C -7.6 -31.8 -9 -34.6 -9 -38 C -9 -43.4 -5.4 -47 0 -47 Z';
  var spear = side === 'A'
    ? '<rect x="17.4" y="-44" width="3.4" height="74" rx="1.7" fill="' + c.mid + '"/>' +
      '<path d="M 19.1 -52 C 22.4 -48 22.4 -43.4 19.1 -39.4 C 15.8 -43.4 15.8 -48 19.1 -52 Z" fill="' + c.mid + '"/>'
    : '';
  return spear +
    '<path d="' + body + '" fill="' + c.mid + '" stroke="' + c.rim + '" stroke-width="2.4" stroke-linejoin="round"/>';
}

/* ------------------------------------------------------------- 5. low-poly
   Built from flat facets, each a slightly different shade. Reads as carved
   stone or modern game art depending on the colour. */
function lowpoly(id, c, side) {
  function f(d, fill) { return '<path d="' + d + '" fill="' + fill + '"/>'; }
  var L = c.light, M = c.mid, D = c.dark, P = c.deep;
  var arm = side === 'A'
    ? f('M -10 -25 L -15.6 -19 L -14.6 -2 L -10.4 3 L -8.6 -2 L -10.4 -18 Z', P)
    : f('M -10 -25 L -17.4 -14 L -15.6 -3 L -8.6 3 L -8.6 -2.4 L -12.6 -6.4 L -12 -15 Z', P);
  return '' +
  arm +
  f('M 10 -25 L 15.6 -19 L 14.6 -2 L 10.4 3 L 8.6 -2 L 10.4 -18 Z', D) +
  // legs
  f('M -10 -2 L -9.2 25.6 L -3.2 25.6 L -2.4 5 L 0 2 L 0 -2 Z', M) +
  f('M 10 -2 L 9.2 25.6 L 3.2 25.6 L 2.4 5 L 0 2 L 0 -2 Z', D) +
  f('M -10 -2 L -6 -2 L -5.6 25.6 L -9.2 25.6 Z', L) +
  f('M 10 -2 L 6 -2 L 5.6 25.6 L 9.2 25.6 Z', M) +
  f('M -13.6 26 L -2.6 25 L -2.6 30.4 L -13.6 30.4 Z', P) +
  f('M 13.6 26 L 2.6 25 L 2.6 30.4 L 13.6 30.4 Z', P) +
  // torso facets
  f('M 0 -28 L -11.6 -22 L -9.6 -2 L 0 2 Z', M) +
  f('M 0 -28 L 11.6 -22 L 9.6 -2 L 0 2 Z', D) +
  f('M 0 -28 L -11.6 -22 L 0 -18 Z', L) +
  // neck + head facets
  f('M -3.4 -31 L 3.4 -31 L 3 -25.4 L -3 -25.4 Z', P) +
  f('M 0 -48 L -8.6 -41 L -6 -30.6 L 0 -29 Z', M) +
  f('M 0 -48 L 8.6 -41 L 6 -30.6 L 0 -29 Z', D) +
  f('M 0 -48 L -8.6 -41 L 0 -38 Z', L) +
  (side === 'A'
    ? f('M -8.4 -43.6 L 8.4 -43.6 L 7.6 -40 L -7.6 -40 Z', L)
    : f('M 0 -58 L 3.6 -50 L 0 -47.4 L -3.6 -50 Z', L));
}

/* ------------------------------------------------- 6. turned base + figure
   A compromise: unmistakably a game piece from the waist down — a turned,
   weighted base that sits on a board — and a person from the waist up. */
function turned(id, c, side) {
  var arm = side === 'A'
    ? '<path d="M -9.4 -26 C -13.6 -24 -15.4 -18.6 -15 -11 C -14.8 -7 -14 -4 -13.4 -1.6 C -13 0.8 -9.4 0.8 -9 -1.6 C -8.6 -4 -9.8 -8 -10 -12.6 Z" fill="url(#' + id + '-deep)"/>'
    : '<path d="M -9.4 -26 C -14.4 -23.4 -17.4 -15.6 -16.8 -8.6 C -16.4 -3.6 -12.8 -0.4 -8.6 0.4 L -8.6 -4.6 C -11.4 -5.4 -12.8 -7 -12.6 -9.6 C -12.3 -14 -10.6 -19 -6.6 -21.6 Z" fill="url(#' + id + '-deep)"/>';
  return '' +
  arm +
  '<path d="M 9.4 -26 C 13.6 -24 15.4 -18.6 15 -11 C 14.8 -7 14 -4 13.4 -1.6 C 13 0.8 9.4 0.8 9 -1.6 C 8.6 -4 9.8 -8 10 -12.6 Z" fill="url(#' + id + '-deep)"/>' +
  // turned base: skirt, collar, disc
  '<path d="M -7.6 -2 C -9.6 8 -12.6 16 -15.4 22 L 15.4 22 C 12.6 16 9.6 8 7.6 -2 Z" fill="url(#' + id + '-body)"/>' +
  '<ellipse cx="0" cy="22" rx="16.6" ry="4.4" fill="url(#' + id + '-body)"/>' +
  '<ellipse cx="0" cy="26" rx="16.6" ry="4.4" fill="url(#' + id + '-deep)"/>' +
  '<ellipse cx="0" cy="-2" rx="8.6" ry="2.6" fill="url(#' + id + '-deep)"/>' +
  // torso
  '<path d="M 0 -28 C 6 -28 10 -25.6 10.6 -21 C 11.2 -16 10 -10 8.6 -5 C 4 -2 -4 -2 -8.6 -5 C -10 -10 -11.2 -16 -10.6 -21 C -10 -25.6 -6 -28 0 -28 Z" fill="url(#' + id + '-body)"/>' +
  '<path d="M -3.2 -31.6 L 3.2 -31.6 L 3.2 -26 L -3.2 -26 Z" fill="url(#' + id + '-deep)"/>' +
  '<ellipse cx="0" cy="-38.6" rx="8.4" ry="9" fill="url(#' + id + '-head)"/>' +
  (side === 'A'
    ? '<path d="M -8 -43.4 L 8 -43.4" stroke="' + c.rim + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>'
    : '<path d="M 0 -56.6 C 3.6 -52.2 4 -48.2 2 -45 L -2 -45 C -4 -48.2 -3.6 -52.2 0 -56.6 Z" fill="url(#' + id + '-body)" stroke="' + c.rim + '" stroke-width="1.5"/>');
}

var STYLES = [
  { key:'sculpted',   name:'1 — Sculpted figure',  fn:sculpted,
    desc:'Martin’s reference done properly: sloped shoulders, a waist, limbs that taper into wrist and ankle. Soft and human. The closest to the photograph.' },
  { key:'carved',     name:'2 — Carved wood',      fn:carved,
    desc:'Senufo and Baule statuary: elongated, columnar, a crest on the head, carved bands across the body, standing on a plinth. The most culturally rooted of the six.' },
  { key:'bronze',     name:'3 — Cast bronze',      fn:bronze,
    desc:'Benin-inspired: banded collar, headdress, ornamented chest, spear held at the side. Ceremonial and heavy — the metal gradient does most of the work.' },
  { key:'silhouette', name:'4 — Bold silhouette',  fn:silhouette,
    desc:'No interior detail at all — one flat shape and a rim. Easily the most readable of the six on a small phone, and the coldest.' },
  { key:'lowpoly',    name:'5 — Low-poly facets',  fn:lowpoly,
    desc:'Built from flat triangular facets, each a slightly different shade, the way a modern game renders carved stone. Sharp rather than soft.' },
  { key:'turned',     name:'6 — Turned base',      fn:turned,
    desc:'A person from the waist up, a weighted turned base below — like a chess piece. Unmistakably a game piece that sits on a board, and still a figure.' }
];
