/* Six modern soldier designs — drawing code only, no DOM.
 *
 * The first six were dated, and the reason was structural rather than a
 * matter of taste. Every one of them was a symmetrical grey figure standing
 * to attention with no face, lit by a single soft gradient. That is how a
 * museum label looks. Children do not choose museum labels.
 *
 * What actually reads as "cool" in the games kids play now is specific and
 * copyable:
 *
 *   HEAVY OUTLINE.      A thick dark keyline around the whole character.
 *                       It is what makes a piece pop off a busy board, and
 *                       it is the single biggest difference between these
 *                       and the last set.
 *   BOLD PROPORTION.    Big head, small body, huge boots — or enormous
 *                       shoulders over a tiny waist. Never 1:1 human.
 *                       A big head also survives being 26px tall, so the
 *                       thing that reads as modern is the same thing that
 *                       fixes the legibility problem.
 *   A FACE.             Even just a glowing visor slit. Something that
 *                       looks back at the player.
 *   LIGHT THAT EMITS.   A glow that spills past its own edge. Flat fills
 *                       read as printed; emitted light reads as powered.
 *   ASYMMETRY.          A planted stance, a lean, one shoulder higher.
 *                       Standing to attention is what made the old set
 *                       look like a chess set from 1974.
 *
 * The culture stays — Adinkra glyphs, the Kente stripe, the mask — but
 * rendered as something powered rather than something carved.
 */

var GOLD = {
  light: '#FFE9A0', base: '#F5C542', mid: '#D89B18', deep: '#7A4E06',
  accent: '#FF8A1E', ink: '#241603', glowc: '#FFC13D'
};
var JADE = {
  light: '#A9F7DC', base: '#19C79A', mid: '#0E9A79', deep: '#04473A',
  accent: '#22E3FF', ink: '#02201A', glowc: '#3DF0C4'
};

function defs(id, c) {
  return '<defs>' +
    '<linearGradient id="' + id + '-b" x1="0.2" y1="0" x2="0.8" y2="1">' +
      '<stop offset="0" stop-color="' + c.light + '"/>' +
      '<stop offset=".38" stop-color="' + c.base + '"/>' +
      '<stop offset="1" stop-color="' + c.mid + '"/>' +
    '</linearGradient>' +
    '<linearGradient id="' + id + '-d" x1="0.2" y1="0" x2="0.8" y2="1">' +
      '<stop offset="0" stop-color="' + c.mid + '"/>' +
      '<stop offset="1" stop-color="' + c.deep + '"/>' +
    '</linearGradient>' +
    '<linearGradient id="' + id + '-a" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + c.accent + '"/>' +
      '<stop offset="1" stop-color="' + c.glowc + '"/>' +
    '</linearGradient>' +
    '<radialGradient id="' + id + '-h" cx="0.36" cy="0.26" r="0.9">' +
      '<stop offset="0" stop-color="' + c.light + '"/>' +
      '<stop offset=".5" stop-color="' + c.base + '"/>' +
      '<stop offset="1" stop-color="' + c.mid + '"/>' +
    '</radialGradient>' +
    '<filter id="' + id + '-glow" x="-80%" y="-80%" width="260%" height="260%">' +
      '<feGaussianBlur stdDeviation="1.9" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
    '</filter>' +
    '<filter id="' + id + '-soft" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="3.4"/>' +
    '</filter>' +
  '</defs>';
}

// Thick keyline. Everything modern here is drawn twice: once as a fat dark
// stroke underneath, then filled on top.
function ink(d, c, w) {
  return '<path d="' + d + '" fill="none" stroke="' + c.ink + '" stroke-width="' + (w || 7) +
         '" stroke-linejoin="round" stroke-linecap="round"/>';
}
function shape(d, c, fill, w) {
  return ink(d, c, w) + '<path d="' + d + '" fill="' + fill + '"/>';
}

/* ============================================================ 1. GUARDIAN
   Afrofuturist: sealed helmet with a glowing visor band, big angular
   pauldrons, an Adinkra glyph burning on the chest. Wakanda, not a museum. */
function guardian(id, c, side) {
  var B = 'url(#' + id + '-b)', D = 'url(#' + id + '-d)', A = 'url(#' + id + '-a)';
  var lean = side === 'B' ? -1 : 1;
  return '' +
  // boots
  shape('M -13 12 L -4.5 12 L -3 30 L -15 30 Z', c, D) +
  shape('M 13 12 L 4.5 12 L 3 30 L 15 30 Z', c, D) +
  // legs
  shape('M -11 -4 L -3.5 -4 L -3.5 15 L -12.5 15 Z', c, B) +
  shape('M 11 -4 L 3.5 -4 L 3.5 15 L 12.5 15 Z', c, B) +
  // torso — wide chest, hard taper to the waist
  shape('M 0 -30 L 15 -24 L 12 -6 L 0 -2 L -12 -6 L -15 -24 Z', c, B) +
  // pauldrons
  shape('M -15 -27 L -25 -21 L -22 -9 L -13 -13 Z', c, D) +
  shape('M 15 -27 L 25 -21 L 22 -9 L 13 -13 Z', c, D) +
  // chest glyph, lit
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M 0 -22 L 5 -16 L 0 -10 L -5 -16 Z" fill="' + A + '"/>' +
    '<path d="M 0 -18.5 L 0 -13" stroke="' + c.ink + '" stroke-width="1.6"/>' +
  '</g>' +
  // helmet
  shape('M 0 -50 C 9 -50 13 -45 13 -38 C 13 -32 9 -29 0 -29 C -9 -29 -13 -32 -13 -38 C -13 -45 -9 -50 0 -50 Z', c, B) +
  // visor
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M -9.5 -40 L 9.5 -40 L 7.5 -34.5 L -7.5 -34.5 Z" fill="' + A + '"/>' +
  '</g>' +
  // crest
  shape('M ' + (lean * 2) + ' -60 L ' + (lean * 7) + ' -48 L ' + (lean * -3) + ' -48 Z', c, A, 5);
}

/* ============================================================== 2. CHAMPION
   Brawl Stars proportions: enormous head, tiny body, giant boots, and a
   keyline you could see from orbit. The most readable thing on this page at
   26px, because the head IS the character. */
function champion(id, c, side) {
  var B = 'url(#' + id + '-b)', D = 'url(#' + id + '-d)', A = 'url(#' + id + '-a)';
  return '' +
  // boots — deliberately oversized
  shape('M -15 14 L -2 14 L -2 28 L -17 28 Z', c, D, 8) +
  shape('M 15 14 L 2 14 L 2 28 L 17 28 Z', c, D, 8) +
  // little body
  shape('M 0 -6 L 11 -2 L 9 16 L -9 16 L -11 -2 Z', c, B, 8) +
  // arms, stubby
  shape('M -11 -3 L -18 2 L -15 10 L -9 6 Z', c, D, 7) +
  shape('M 11 -3 L 18 2 L 15 10 L 9 6 Z', c, D, 7) +
  // BIG head
  shape('M 0 -50 C 15 -50 21 -41 21 -29 C 21 -18 13 -12 0 -12 C -13 -12 -21 -18 -21 -29 C -21 -41 -15 -50 0 -50 Z', c, B, 8) +
  // mask band across the eyes
  shape('M -19 -36 L 19 -36 L 17 -25 L -17 -25 Z', c, D, 0) +
  // glowing eyes
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M -13 -33 L -5 -34.5 L -5 -28 L -13 -27 Z" fill="' + A + '"/>' +
    '<path d="M 13 -33 L 5 -34.5 L 5 -28 L 13 -27 Z" fill="' + A + '"/>' +
  '</g>' +
  // head crest / tuft — the army tell
  (side === 'A'
    ? shape('M -8 -49 L 0 -62 L 8 -49 Z', c, A, 6)
    : shape('M -14 -46 C -6 -58 6 -58 14 -46 C 6 -52 -6 -52 -14 -46 Z', c, A, 6));
}

/* =========================================================== 3. SPIRIT
   The body is light. A solid mask over a column of layered energy, wisps
   coming off it, embers rising. Nothing else on this page moves like it. */
function spirit(id, c, side) {
  var A = 'url(#' + id + '-a)';
  return '' +
  // outer haze
  '<g filter="url(#' + id + '-soft)" opacity=".55">' +
    '<path d="M 0 -30 C 12 -18 14 4 8 24 L -8 24 C -14 4 -12 -18 0 -30 Z" fill="' + c.glowc + '"/>' +
  '</g>' +
  // energy column
  '<path d="M 0 -28 C 10 -16 12 4 7 22 L -7 22 C -12 4 -10 -16 0 -28 Z" fill="' + A + '" opacity=".9"/>' +
  '<path d="M 0 -22 C 6 -12 7 4 4 18 L -4 18 C -7 4 -6 -12 0 -22 Z" fill="' + c.light + '" opacity=".75"/>' +
  // wisps
  '<g filter="url(#' + id + '-glow)" fill="' + c.glowc + '">' +
    (side === 'A'
      ? '<path d="M -11 -6 C -18 2 -18 12 -13 18 C -15 8 -14 0 -9 -4 Z"/>' +
        '<path d="M 11 2 C 17 8 17 16 13 21 C 15 13 14 7 10 4 Z"/>'
      : '<path d="M 11 -6 C 18 2 18 12 13 18 C 15 8 14 0 9 -4 Z"/>' +
        '<path d="M -11 2 C -17 8 -17 16 -13 21 C -15 13 -14 7 -10 4 Z"/>') +
    // embers
    '<circle cx="' + (side === 'A' ? -14 : 14) + '" cy="-20" r="2.2"/>' +
    '<circle cx="' + (side === 'A' ? 12 : -12) + '" cy="-30" r="1.6"/>' +
    '<circle cx="' + (side === 'A' ? -8 : 8) + '" cy="-38" r="1.2"/>' +
  '</g>' +
  // the mask — the only solid thing
  shape('M 0 -52 C 10 -52 14 -45 14 -36 C 14 -27 8 -22 0 -22 C -8 -22 -14 -27 -14 -36 C -14 -45 -10 -52 0 -52 Z', c, 'url(#' + id + '-h)', 6) +
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M -8.5 -41 L -2.5 -39 L -3.5 -33 L -9 -35 Z" fill="' + A + '"/>' +
    '<path d="M 8.5 -41 L 2.5 -39 L 3.5 -33 L 9 -35 Z" fill="' + A + '"/>' +
  '</g>' +
  '<path d="M 0 -30 L 0 -25" stroke="' + c.ink + '" stroke-width="2" stroke-linecap="round"/>';
}

/* ========================================================== 4. VANGUARD
   Plated and mechanical: hard angular armour with light bleeding out of
   every seam. Reads as powered armour, which is close to universally cool
   at eight years old. */
function vanguard(id, c, side) {
  var B = 'url(#' + id + '-b)', D = 'url(#' + id + '-d)', A = 'url(#' + id + '-a)';
  var seam = '<g filter="url(#' + id + '-glow)" stroke="' + c.accent + '" stroke-width="1.8" stroke-linecap="round" fill="none">';
  return '' +
  shape('M -14 10 L -3 10 L -2 29 L -16 29 Z', c, D) +
  shape('M 14 10 L 3 10 L 2 29 L 16 29 Z', c, D) +
  shape('M -12 -6 L -3 -6 L -3 13 L -13 13 Z', c, B) +
  shape('M 12 -6 L 3 -6 L 3 13 L 13 13 Z', c, B) +
  // chest block
  shape('M 0 -32 L 16 -25 L 14 -12 L 0 -4 L -14 -12 L -16 -25 Z', c, B) +
  // plates
  shape('M -16 -28 L -27 -20 L -24 -8 L -14 -14 Z', c, D) +
  shape('M 16 -28 L 27 -20 L 24 -8 L 14 -14 Z', c, D) +
  seam +
    '<path d="M -13 -23 L -3 -20"/>' +
    '<path d="M 13 -23 L 3 -20"/>' +
    '<path d="M 0 -14 L 0 -6"/>' +
    '<path d="M -22 -19 L -18 -12"/>' +
    '<path d="M 22 -19 L 18 -12"/>' +
  '</g>' +
  // head unit
  shape('M 0 -50 L 12 -44 L 12 -34 L 0 -28 L -12 -34 L -12 -44 Z', c, B) +
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M -9 -41 L 9 -41 L 9 -36 L -9 -36 Z" fill="' + A + '"/>' +
  '</g>' +
  (side === 'A'
    ? shape('M -11 -46 L 0 -58 L 11 -46 Z', c, D, 5)
    : shape('M -13 -44 L -6 -56 L -2 -46 Z', c, D, 5) + shape('M 13 -44 L 6 -56 L 2 -46 Z', c, D, 5));
}

/* ============================================================ 5. DANCER
   Caught mid-movement rather than standing still: a lean, one leg driving,
   cloth trailing behind. Motion is the thing none of the old six had. */
function dancer(id, c, side) {
  var B = 'url(#' + id + '-b)', D = 'url(#' + id + '-d)', A = 'url(#' + id + '-a)';
  var f = side === 'B' ? -1 : 1;
  function mx(d) { return f === 1 ? d : d.replace(/-?\d+(\.\d+)?/g, function (n, _, i) { return n; }); }
  var g = '<g transform="scale(' + f + ',1)">';
  return g +
  // trailing cloth, behind everything
  '<g filter="url(#' + id + '-soft)" opacity=".5">' +
    '<path d="M -6 -18 C -22 -10 -30 6 -26 22 C -20 8 -12 0 -4 -4 Z" fill="' + c.glowc + '"/>' +
  '</g>' +
  shape('M -6 -18 C -20 -10 -27 6 -23 20 C -18 7 -11 0 -3 -3 Z', c, A, 5) +
  // driving back leg
  shape('M -2 -2 L 6 -2 L 16 20 L 8 25 Z', c, D) +
  shape('M 14 19 L 22 24 L 19 30 L 10 26 Z', c, D) +
  // planted front leg
  shape('M -8 -2 L 0 -2 L -3 22 L -12 22 Z', c, B) +
  shape('M -14 20 L -1 20 L -1 28 L -16 28 Z', c, B) +
  // leaning torso
  shape('M -3 -30 L 12 -26 L 11 -8 L -5 -2 L -13 -10 L -12 -24 Z', c, B) +
  // raised arm
  shape('M 10 -25 L 22 -34 L 26 -28 L 15 -18 Z', c, D) +
  // trailing arm
  shape('M -12 -20 L -22 -12 L -18 -6 L -9 -13 Z', c, D) +
  // head, tilted
  shape('M -1 -48 C 8 -49 13 -44 13 -37 C 13 -30 8 -26 0 -26 C -8 -26 -12 -31 -12 -38 C -12 -44 -8 -47 -1 -48 Z', c, B) +
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M -8 -40 L 9 -41.5 L 8 -35 L -8 -34 Z" fill="' + A + '"/>' +
  '</g>' +
  // motion arc
  '<g filter="url(#' + id + '-glow)" fill="none" stroke="' + c.accent + '" stroke-width="2" stroke-linecap="round" opacity=".85">' +
    '<path d="M 20 -40 C 28 -30 28 -16 22 -6"/>' +
  '</g>' +
  '</g>';
}

/* ============================================================== 6. TOTEM
   Not a person at all: a lit emblem. A bold Adinkra-derived glyph with a
   face in it, the way a modern game draws a faction badge. Scales to any
   size without losing a thing, because there is no anatomy to lose. */
function totem(id, c, side) {
  var B = 'url(#' + id + '-b)', D = 'url(#' + id + '-d)', A = 'url(#' + id + '-a)';
  return '' +
  // base slab
  shape('M -16 20 L 16 20 L 12 30 L -12 30 Z', c, D) +
  // shield body
  shape('M 0 -46 L 20 -34 L 20 -2 C 20 10 11 19 0 22 C -11 19 -20 10 -20 -2 L -20 -34 Z', c, B) +
  // inner field
  '<path d="M 0 -38 L 14 -30 L 14 -3 C 14 6 8 13 0 15 C -8 13 -14 6 -14 -3 L -14 -30 Z" fill="' + c.deep + '" opacity=".55"/>' +
  // the glyph — lit
  '<g filter="url(#' + id + '-glow)">' +
    (side === 'A'
      ? '<path d="M 0 -30 L 9 -20 L 4 -20 L 4 -6 L 9 -6 L 0 6 L -9 -6 L -4 -6 L -4 -20 L -9 -20 Z" fill="' + A + '"/>'
      : '<path d="M -10 -24 L 10 -24 L 10 -17 L 3 -17 L 3 6 L -3 6 L -3 -17 L -10 -17 Z" fill="' + A + '"/>' +
        '<circle cx="0" cy="-31" r="4.5" fill="' + A + '"/>') +
  '</g>' +
  // eyes cut into the top of the shield
  '<g filter="url(#' + id + '-glow)">' +
    '<path d="M -12 -33 L -5 -30 L -5 -25 L -12 -28 Z" fill="' + c.light + '"/>' +
    '<path d="M 12 -33 L 5 -30 L 5 -25 L 12 -28 Z" fill="' + c.light + '"/>' +
  '</g>' +
  // crown notches
  shape('M -20 -34 L -13 -44 L -6 -34 Z', c, D, 5) +
  shape('M 20 -34 L 13 -44 L 6 -34 Z', c, D, 5) +
  shape('M 0 -46 L 6 -56 L -6 -56 Z', c, A, 5);
}

var STYLES = [
  { key:'guardian', name:'1 — Guardian', fn:guardian,
    desc:'Afrofuturist powered armour. Sealed helmet with a glowing visor band, heavy angular pauldrons, an Adinkra glyph burning on the chest. Wakanda rather than a museum case.' },
  { key:'champion', name:'2 — Champion', fn:champion,
    desc:'Brawl Stars proportions — enormous head, tiny body, giant boots, and a keyline you can see from across the room. Because the head IS the character, this is also the most readable of the six at 26px.' },
  { key:'spirit',   name:'3 — Spirit',   fn:spirit,
    desc:'The body is made of light: a solid mask over a column of energy, wisps peeling off it, embers rising. The only one of the six that looks like it is doing something while it stands still.' },
  { key:'vanguard', name:'4 — Vanguard', fn:vanguard,
    desc:'Hard plated armour with light bleeding out of every seam. Mechanical, heavy, and close to universally cool at eight years old.' },
  { key:'dancer',   name:'5 — Dancer',   fn:dancer,
    desc:'Caught mid-movement instead of standing to attention — a lean, one leg driving, cloth trailing behind, a motion arc off the shoulder. The two armies mirror each other, so a rank of them leans into the fight.' },
  { key:'totem',    name:'6 — Totem',    fn:totem,
    desc:'Not a person: a lit faction badge. A bold Adinkra-derived glyph with eyes cut into a crowned shield. No anatomy to lose, so it holds together at any size — the safest at 26px and the boldest on a title screen.' }
];
