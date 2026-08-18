/* Kwanza Square — board rendering.
 *
 * Everything you see is generated here as SVG: the three squares, the radial
 * connectors, 24 unique motif tiles, the sacred centre medallion, the soldiers
 * and all the animations. No image files, no external assets.
 *
 * The board keeps Martin's original colours — royal blue, orange, black, white.
 *
 * Note on ids: every board gets its own id prefix. Two SVGs sharing an id like
 * "kz-bg" would collide, and a paint server that lives inside a display:none
 * screen does not resolve for other SVGs — which silently blanks the board.
 */
(function (KZ) {
  'use strict';

  var G = KZ.Geometry;
  var NS = 'http://www.w3.org/2000/svg';

  var BOARD = {
    blue: '#1B4BA8',
    blueDeep: '#10306B',
    orange: '#E4711E',
    orangeLift: '#F79438',
    black: '#101010',
    white: '#FFFFFF'
  };

  /* Soldier colourways.
   *
   * Gold is fixed for the first player. The opponent is switchable so the
   * colour can be chosen by eye on the real board — the original near-black
   * ("Onyx") reads too dark against the black motif tiles.
   *
   * Each entry is a three-stop sphere gradient plus a rim, a centre pip and a
   * glow used for the trio highlight.
   */
  var SOLDIERS = {
    gold: {
      label: 'Gold', light: '#FFE9A8', mid: '#E9B833', dark: '#8A6408',
      rim: '#6B4D06', rimWidth: 3, pip: '#6B4D06', inner: 'rgba(255,255,255,.42)', glow: '#FFD36B'
    },
    silver: {
      label: 'Silver', light: '#FFFFFF', mid: '#C3CDD9', dark: '#66727F',
      rim: '#3E4854', rimWidth: 3, pip: '#3E4854', inner: 'rgba(255,255,255,.55)', glow: '#E6EEF8'
    },
    jade: {
      label: 'Jade', light: '#9FF3D4', mid: '#16A085', dark: '#075040',
      rim: '#04322A', rimWidth: 3, pip: '#D6FFF2', inner: 'rgba(255,255,255,.4)', glow: '#5FE3C0'
    },
    crimson: {
      label: 'Crimson', light: '#FFA898', mid: '#C0392B', dark: '#5F110A',
      rim: '#3D0A06', rimWidth: 3, pip: '#FFD9D2', inner: 'rgba(255,255,255,.34)', glow: '#FF8570'
    },
    ivory: {
      label: 'Ivory', light: '#FFFFFF', mid: '#F2E8D4', dark: '#B3A17A',
      rim: '#6F6244', rimWidth: 3, pip: '#6F6244', inner: 'rgba(255,255,255,.6)', glow: '#FFF6E2'
    },
    onyx: {
      label: 'Onyx', light: '#6A6A6A', mid: '#1C1C1C', dark: '#000000',
      rim: '#FFFFFF', rimWidth: 2.5, pip: 'rgba(255,255,255,.6)', inner: 'rgba(255,255,255,.3)', glow: '#FFFFFF'
    }
  };

  var TILE = 72;      // painted motif tile
  var SEAT = 19;      // where a soldier sits
  var PAWN = 30;
  var HIT = 56;       // generous invisible tap target for phones

  var uid = 0;

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // ------------------------------------------------------------------ motifs
  // Twelve geometric figures, each drawn in a 72x72 tile, in two colourways —
  // 24 distinct intersections, mirroring the 24 hand-painted squares on the
  // original board. These are abstract stand-ins for Martin's own artwork.

  function motif(index, ink, accent) {
    var g = '';
    var h = TILE / 2 - 8;
    function poly(pts, fill, stroke, w) {
      return '<polygon points="' + pts + '" fill="' + (fill || 'none') + '"' +
        (stroke ? ' stroke="' + stroke + '" stroke-width="' + (w || 3) + '"' : '') +
        ' stroke-linejoin="round"/>';
    }
    function line(x1, y1, x2, y2, stroke, w) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
        '" stroke="' + stroke + '" stroke-width="' + (w || 3) + '" stroke-linecap="round"/>';
    }
    function circ(cx, cy, r, fill, stroke, w) {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (fill || 'none') + '"' +
        (stroke ? ' stroke="' + stroke + '" stroke-width="' + (w || 3) + '"' : '') + '/>';
    }
    function diamond(r) { return [-0 + ',' + -r, r + ',' + 0, 0 + ',' + r, -r + ',' + 0].join(' '); }

    switch (index) {
      case 0:
        g += poly(diamond(h), 'none', ink, 3.4);
        g += poly(diamond(h * 0.64), 'none', accent, 3);
        g += poly(diamond(h * 0.3), ink);
        break;
      case 1:
        for (var c = 0; c < 3; c++) {
          var y = -h + 6 + c * (h * 0.72);
          g += '<polyline points="' + (-h) + ',' + (y + 12) + ' 0,' + y + ' ' + h + ',' + (y + 12) +
            '" fill="none" stroke="' + (c % 2 ? accent : ink) + '" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        break;
      case 2:
        g += '<ellipse cx="0" cy="0" rx="' + (h * 0.56) + '" ry="' + h + '" fill="' + ink + '"/>';
        g += line(0, -h * 0.62, 0, h * 0.62, accent, 3.2);
        for (var d = -2; d <= 2; d++) g += line(-4, d * 9, 4, d * 9, accent, 2);
        break;
      case 3:
        g += line(-h, h * 0.55, h, h * 0.55, ink, 4);
        for (var t = 0; t < 5; t++) {
          var x = -h + 4 + t * ((2 * h - 8) / 4);
          g += line(x, h * 0.55, x, -h * 0.7, t % 2 ? accent : ink, 3.4);
        }
        break;
      case 4:
        g += line(0, -h, 0, h, ink, 5);
        g += line(-h, 0, h, 0, ink, 5);
        g += circ(h * 0.6, -h * 0.6, 4.6, accent);
        g += circ(-h * 0.6, -h * 0.6, 4.6, accent);
        g += circ(h * 0.6, h * 0.6, 4.6, accent);
        g += circ(-h * 0.6, h * 0.6, 4.6, accent);
        break;
      case 5:
        for (var row = 0; row < 2; row++) {
          var pts = [], yy = -h * 0.5 + row * h * 0.95;
          for (var i = 0; i <= 4; i++) pts.push((-h + i * (h / 2)) + ',' + (yy + (i % 2 ? 11 : -11)));
          g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (row ? accent : ink) +
            '" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        break;
      case 6:
        g += '<rect x="' + (-h) + '" y="' + (-h) + '" width="' + (2 * h) + '" height="' + (2 * h) + '" fill="none" stroke="' + ink + '" stroke-width="3.4"/>';
        g += '<rect x="' + (-h * 0.6) + '" y="' + (-h * 0.6) + '" width="' + (1.2 * h) + '" height="' + (1.2 * h) + '" fill="none" stroke="' + accent + '" stroke-width="3"/>';
        g += '<rect x="' + (-h * 0.22) + '" y="' + (-h * 0.22) + '" width="' + (0.44 * h) + '" height="' + (0.44 * h) + '" fill="' + ink + '"/>';
        break;
      case 7:
        for (var k = 0; k < 4; k++) {
          var x0 = -h + k * (h / 2), up = k % 2 === 0;
          g += poly(up
            ? (x0 + ',' + h * 0.7 + ' ' + (x0 + h / 2) + ',' + (-h * 0.7) + ' ' + (x0 + h) + ',' + h * 0.7)
            : (x0 + ',' + (-h * 0.7) + ' ' + (x0 + h / 2) + ',' + h * 0.7 + ' ' + (x0 + h) + ',' + (-h * 0.7)),
            up ? ink : accent);
        }
        break;
      case 8:
        g += circ(0, 0, h * 0.42, ink);
        for (var s = 0; s < 8; s++) {
          var a = (Math.PI / 4) * s;
          g += line(Math.cos(a) * h * 0.58, Math.sin(a) * h * 0.58,
                    Math.cos(a) * h, Math.sin(a) * h, accent, 3.2);
        }
        break;
      case 9:
        for (var w = -1; w <= 1; w++) {
          g += line(-h, w * h * 0.6, h, w * h * 0.6, ink, 3.2);
          g += line(w * h * 0.6, -h, w * h * 0.6, h, accent, 3.2);
        }
        break;
      case 10:
        g += '<path d="M ' + (-h) + ' ' + h + ' L ' + (-h) + ' ' + (-h) + ' L ' + h + ' ' + (-h) +
          ' L ' + h + ' ' + (h * 0.45) + ' L ' + (-h * 0.45) + ' ' + (h * 0.45) +
          ' L ' + (-h * 0.45) + ' ' + (-h * 0.4) + ' L ' + (h * 0.4) + ' ' + (-h * 0.4) +
          '" fill="none" stroke="' + ink + '" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>';
        g += circ(0, h * 0.78, 4.4, accent);
        break;
      default:
        g += '<path d="M ' + (-h * 0.2) + ' ' + (-h) + ' A ' + h + ' ' + h + ' 0 0 0 ' + (-h * 0.2) + ' ' + h +
          ' A ' + (h * 0.66) + ' ' + h + ' 0 0 1 ' + (-h * 0.2) + ' ' + (-h) + ' Z" fill="' + ink + '"/>';
        g += '<path d="M ' + (h * 0.34) + ' ' + (-h * 0.72) + ' A ' + (h * 0.72) + ' ' + (h * 0.72) + ' 0 0 0 ' + (h * 0.34) + ' ' + (h * 0.72) +
          ' A ' + (h * 0.46) + ' ' + (h * 0.72) + ' 0 0 1 ' + (h * 0.34) + ' ' + (-h * 0.72) + ' Z" fill="' + accent + '"/>';
    }
    return g;
  }

  function motifFor(id) {
    var scheme = Math.floor(id / 12);
    return motif(id % 12,
      scheme ? BOARD.white : BOARD.orange,
      scheme ? BOARD.orangeLift : BOARD.white);
  }

  // ------------------------------------------------------------------- board

  function defs(svg, p) {
    var d = el('defs', null, svg);

    var bg = el('radialGradient', { id: p + '-bg', cx: '50%', cy: '42%', r: '78%' }, d);
    el('stop', { offset: '0%', 'stop-color': BOARD.blue }, bg);
    el('stop', { offset: '100%', 'stop-color': BOARD.blueDeep }, bg);

    // one sphere gradient per available soldier colourway
    Object.keys(SOLDIERS).forEach(function (key) {
      var s = SOLDIERS[key];
      var g = el('radialGradient', { id: p + '-s-' + key, cx: '34%', cy: '30%', r: '76%' }, d);
      el('stop', { offset: '0%', 'stop-color': s.light }, g);
      el('stop', { offset: '46%', 'stop-color': s.mid }, g);
      el('stop', { offset: '100%', 'stop-color': s.dark }, g);
    });

    // the sacred centre's glow — a soft falloff, not a flat disc
    var aura = el('radialGradient', { id: p + '-aura', cx: '50%', cy: '50%', r: '50%' }, d);
    el('stop', { offset: '55%', 'stop-color': BOARD.orangeLift, 'stop-opacity': 0.55 }, aura);
    el('stop', { offset: '78%', 'stop-color': BOARD.orange, 'stop-opacity': 0.28 }, aura);
    el('stop', { offset: '100%', 'stop-color': BOARD.orange, 'stop-opacity': 0 }, aura);

    var pat = el('pattern', { id: p + '-weave', width: 44, height: 44, patternUnits: 'userSpaceOnUse' }, d);
    el('path', {
      d: 'M0 22 L22 0 L44 22 L22 44 Z',
      fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 1.4
    }, pat);

    var glow = el('filter', { id: p + '-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' }, d);
    el('feGaussianBlur', { stdDeviation: 7, result: 'b' }, glow);
    var merge = el('feMerge', null, glow);
    el('feMergeNode', { in: 'b' }, merge);
    el('feMergeNode', { in: 'SourceGraphic' }, merge);
  }

  function drawLines(layer) {
    G.segments.forEach(function (seg) {
      var a = G.node(seg[0]), b = G.node(seg[1]);
      var common = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-linecap': 'round' };
      el('line', Object.assign({}, common, { stroke: 'rgba(0,0,0,.4)', 'stroke-width': 15 }), layer);
      el('line', Object.assign({}, common, { stroke: BOARD.orange, 'stroke-width': 8 }), layer);
    });
  }

  function drawLettering(layer) {
    // "KWANZA" sits between the outer and middle squares, mirrored top and
    // bottom exactly as on the painted board.
    var bottom = el('text', {
      x: G.CENTER, y: 858, 'text-anchor': 'middle', class: 'board-legend',
      'font-size': 44, 'font-weight': 600
    }, layer);
    bottom.textContent = 'KWANZA';

    var top = el('text', {
      x: G.CENTER, y: 158, 'text-anchor': 'middle', class: 'board-legend',
      'font-size': 44, 'font-weight': 600,
      transform: 'rotate(180 ' + G.CENTER + ' 143)'
    }, layer);
    top.textContent = 'KWANZA';

    // The two mottos run up the left and right bands, as on the painted board.
    // translate() runs first, then rotate() about the centre: a baseline at
    // (500, 152) maps to x=152 under rotate(-90) and x=848 under rotate(90).
    var left = el('text', {
      x: G.CENTER, y: 0, 'text-anchor': 'middle', class: 'board-motto', 'font-size': 23,
      transform: 'rotate(-90 ' + G.CENTER + ' ' + G.CENTER + ') translate(0 152)'
    }, layer);
    left.textContent = 'Jeu Africain traditionnel et mystique de ruse et de stratégie';

    var right = el('text', {
      x: G.CENTER, y: 0, 'text-anchor': 'middle', class: 'board-motto', 'font-size': 23,
      transform: 'rotate(90 ' + G.CENTER + ' ' + G.CENTER + ') translate(0 152)'
    }, layer);
    right.textContent = 'A mystical African traditional game of wit and strategic thinking';
  }

  /** The sacred centre. Decorative, breathing, and never playable. */
  function drawCenter(layer, prefix) {
    var g = el('g', { transform: 'translate(' + G.CENTER + ',' + G.CENTER + ')', 'pointer-events': 'none' }, layer);
    el('circle', { r: 132, fill: 'url(#' + prefix + '-aura)', class: 'center-aura' }, g);

    function ring(r, fill, stroke, w) {
      var pts = [];
      for (var i = 0; i < 12; i++) {
        var a = (Math.PI * 2 / 12) * i - Math.PI / 2;
        pts.push((Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r).toFixed(1));
      }
      el('polygon', { points: pts.join(' '), fill: fill, stroke: stroke || 'none', 'stroke-width': w || 0 }, g);
    }
    ring(96, BOARD.black, BOARD.white, 3);
    ring(82, BOARD.orange);
    ring(66, BOARD.blue, BOARD.white, 2);

    var spin = el('g', { class: 'center-spin' }, g);
    for (var i = 0; i < 8; i++) {
      var a = (Math.PI * 2 / 8) * i;
      var x = Math.cos(a) * 40, y = Math.sin(a) * 40;
      el('ellipse', {
        cx: x.toFixed(1), cy: y.toFixed(1), rx: 6, ry: 15,
        fill: BOARD.white, opacity: 0.9,
        transform: 'rotate(' + ((a * 180 / Math.PI) + 90).toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'
      }, spin);
    }
    el('circle', { r: 13, fill: BOARD.orange, stroke: BOARD.white, 'stroke-width': 2.5 }, g);
  }

  function drawNode(layer, node, prefix, onPick) {
    var g = el('g', {
      class: 'node',
      'data-node': node.id,
      transform: 'translate(' + node.x + ',' + node.y + ')'
    }, layer);

    var tile = el('g', { class: 'tile' }, g);
    el('rect', {
      x: -TILE / 2, y: -TILE / 2, width: TILE, height: TILE, rx: 6,
      fill: BOARD.black, stroke: BOARD.white, 'stroke-width': 2.5
    }, tile);
    el('g', null, tile).innerHTML = motifFor(node.id);

    el('circle', {
      class: 'node-halo', r: 40, fill: 'none',
      stroke: BOARD.orangeLift, 'stroke-width': 6, filter: 'url(#' + prefix + '-glow)'
    }, g);
    el('circle', {
      class: 'node-seat', r: SEAT, fill: 'rgba(0,0,0,.35)',
      stroke: 'rgba(255,255,255,.4)', 'stroke-width': 2
    }, g);

    // shown only on intersections where a placement would complete a trio
    var forbid = el('g', { class: 'forbid-mark' }, g);
    el('circle', { r: 26, fill: 'rgba(0,0,0,.55)' }, forbid);
    el('line', { x1: -13, y1: -13, x2: 13, y2: 13, stroke: '#FF6B6B', 'stroke-width': 5, 'stroke-linecap': 'round' }, forbid);
    el('line', { x1: 13, y1: -13, x2: -13, y2: 13, stroke: '#FF6B6B', 'stroke-width': 5, 'stroke-linecap': 'round' }, forbid);

    el('g', { class: 'pawn-slot' }, g);
    // drawn after the pawn so a scored trio reads clearly on top of the soldier
    el('circle', { class: 'trio-ring', r: 37, fill: 'none', 'stroke-width': 5, filter: 'url(#' + prefix + '-glow)' }, g);
    el('circle', { class: 'select-ring', r: 42, fill: 'none', stroke: '#FFE9A8', 'stroke-width': 5, filter: 'url(#' + prefix + '-glow)' }, g);
    el('circle', { class: 'capture-ring', r: 42, fill: 'none', stroke: '#FF5A5A', 'stroke-width': 5, filter: 'url(#' + prefix + '-glow)' }, g);

    var hit = el('circle', { class: 'node-hit', r: HIT }, g);
    if (onPick) {
      hit.addEventListener('click', function (ev) {
        ev.preventDefault();
        onPick(node.id);
      });
    }
    return g;
  }

  function pawnShape(colourKey, prefix) {
    var s = SOLDIERS[colourKey] || SOLDIERS.onyx;
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'pawn');
    el('circle', {
      class: 'pawn-body', r: PAWN,
      fill: 'url(#' + prefix + '-s-' + colourKey + ')',
      stroke: s.rim, 'stroke-width': s.rimWidth
    }, g);
    el('circle', { r: PAWN - 10, fill: 'none', stroke: s.inner, 'stroke-width': 2 }, g);
    el('circle', { r: 4, fill: s.pip }, g);
    return g;
  }

  // ------------------------------------------------------------------ public

  /**
   * Build a board into an <svg> element.
   * onPick(nodeId) is called on tap; omit it for a static illustration.
   */
  function build(svg, onPick) {
    var prefix = 'kz' + (++uid);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    defs(svg, prefix);
    el('rect', { x: 0, y: 0, width: 1000, height: 1000, fill: 'url(#' + prefix + '-bg)' }, svg);
    el('rect', { x: 0, y: 0, width: 1000, height: 1000, fill: 'url(#' + prefix + '-weave)' }, svg);
    el('rect', { x: 14, y: 14, width: 972, height: 972, rx: 10, fill: 'none', stroke: BOARD.black, 'stroke-width': 10 }, svg);
    el('rect', { x: 14, y: 14, width: 972, height: 972, rx: 10, fill: 'none', stroke: 'rgba(255,255,255,.18)', 'stroke-width': 2 }, svg);

    drawLines(el('g', { class: 'line-layer' }, svg));
    drawLettering(el('g', { class: 'text-layer', 'pointer-events': 'none' }, svg));

    var trioLayer = el('g', { class: 'trio-layer', 'pointer-events': 'none' }, svg);
    drawCenter(svg, prefix);

    var nodeLayer = el('g', { class: 'node-layer' }, svg);
    var nodeEls = G.nodes.map(function (n) { return drawNode(nodeLayer, n, prefix, onPick); });

    var fxLayer = el('g', { class: 'fx-layer', 'pointer-events': 'none' }, svg);

    return {
      svg: svg, prefix: prefix, nodes: nodeEls,
      trioLayer: trioLayer, fxLayer: fxLayer,
      owners: new Array(24).fill(null),
      soldier: { A: 'gold', B: 'jade' }
    };
  }

  /**
   * Change which colourways the two sides use, repainting any soldiers already
   * on the board. Clearing `owners` alone would make the next diff a no-op, so
   * the drawn pawns are removed here explicitly.
   */
  function setSoldiers(view, map) {
    view.soldier = { A: map.A || view.soldier.A, B: map.B || view.soldier.B };
    view.nodes.forEach(function (g, i) {
      var slot = g.querySelector('.pawn-slot');
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      view.owners[i] = null;
    });
  }

  /**
   * Sync a built board to a view model:
   *   { board, legal:Set, forbidden:Set, capturable:Set,
   *     selected, staged, trios:[{trio,player}], lastMove }
   */
  function update(view, vm) {
    var legal = vm.legal || new Set();
    var forbidden = vm.forbidden || new Set();
    var capturable = vm.capturable || new Set();

    // Rings go only on a trio that has JUST scored — a standing trio that already
    // took its prisoner must not keep signalling that a capture is due.
    var inTrio = {};
    (vm.scored || []).forEach(function (entry) {
      G.trios[entry.trio].forEach(function (n) { inTrio[n] = entry.player; });
    });

    for (var i = 0; i < 24; i++) {
      var g = view.nodes[i];
      var owner = vm.board[i];

      if (view.owners[i] !== owner) {
        var slot = g.querySelector('.pawn-slot');
        while (slot.firstChild) slot.removeChild(slot.firstChild);
        if (owner) {
          var pawn = pawnShape(view.soldier[owner], view.prefix);
          slot.appendChild(pawn);
          if (view.owners[i] === null) {
            pawn.classList.add('place-pop');
            pawn.addEventListener('animationend', function (ev) {
              ev.currentTarget.classList.remove('place-pop');
            }, { once: true });
          }
        }
        view.owners[i] = owner;
      }

      g.classList.toggle('legal', legal.has(i));
      g.classList.toggle('forbidden', forbidden.has(i));
      g.classList.toggle('selected', vm.selected === i || vm.staged === i);
      g.classList.toggle('capturable', capturable.has(i));
      g.classList.toggle('last-move', !!vm.lastMove && vm.lastMove.to === i);
      g.classList.toggle('in-trio-a', inTrio[i] === 'A');
      g.classList.toggle('in-trio-b', inTrio[i] === 'B');
      if (inTrio[i]) {
        g.querySelector('.trio-ring').setAttribute('stroke', SOLDIERS[view.soldier[inTrio[i]]].glow);
      }
    }

    var layer = view.trioLayer;
    while (layer.firstChild) layer.removeChild(layer.firstChild);

    var scoredKeys = {};
    (vm.scored || []).forEach(function (e) { scoredKeys[e.trio] = true; });

    // standing trios: a thin quiet line, so the formation is still readable
    (vm.trios || []).forEach(function (entry) {
      if (scoredKeys[entry.trio]) return;
      var t = G.trios[entry.trio];
      var a = G.node(t[0]), c = G.node(t[2]);
      el('line', {
        class: 'trio-standing',
        x1: a.x, y1: a.y, x2: c.x, y2: c.y,
        stroke: SOLDIERS[view.soldier[entry.player]].glow,
        'stroke-width': 5, 'stroke-linecap': 'round'
      }, layer);
    });

    // the trio just scored: bright and breathing, a capture is owed
    (vm.scored || []).forEach(function (entry) {
      var t = G.trios[entry.trio];
      var a = G.node(t[0]), c = G.node(t[2]);
      el('line', {
        class: 'trio-glow',
        x1: a.x, y1: a.y, x2: c.x, y2: c.y,
        stroke: SOLDIERS[view.soldier[entry.player]].glow,
        'stroke-width': 14, 'stroke-linecap': 'round',
        filter: 'url(#' + view.prefix + '-glow)'
      }, layer);
    });
  }

  /** Expanding ring where a soldier was taken. */
  function burst(view, nodeId, player) {
    var n = G.node(nodeId);
    var c = el('circle', {
      class: 'capture-burst',
      cx: n.x, cy: n.y, r: 34, fill: 'none',
      stroke: SOLDIERS[view.soldier[player]].glow,
      'stroke-width': 8, filter: 'url(#' + view.prefix + '-glow)'
    }, view.fxLayer);
    c.addEventListener('animationend', function () {
      if (c.parentNode) c.parentNode.removeChild(c);
    }, { once: true });
  }

  /** Small emblem used on the home screen and the result card. */
  function emblem(svg) {
    var prefix = 'kz' + (++uid);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 1000 1000');
    defs(svg, prefix);
    el('rect', { x: 0, y: 0, width: 1000, height: 1000, rx: 90, fill: 'url(#' + prefix + '-bg)' }, svg);
    el('rect', { x: 22, y: 22, width: 956, height: 956, rx: 78, fill: 'none', stroke: BOARD.black, 'stroke-width': 14 }, svg);
    var lines = el('g', null, svg);
    G.segments.forEach(function (seg) {
      var a = G.node(seg[0]), b = G.node(seg[1]);
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: BOARD.orange, 'stroke-width': 14, 'stroke-linecap': 'round' }, lines);
    });
    G.nodes.forEach(function (n) {
      el('circle', { cx: n.x, cy: n.y, r: 26, fill: BOARD.black, stroke: BOARD.white, 'stroke-width': 5 }, svg);
    });
    drawCenter(svg, prefix);
  }

  /** CSS gradient for the little soldier chip in the score bar. */
  function chipStyle(colourKey) {
    var s = SOLDIERS[colourKey] || SOLDIERS.onyx;
    return 'radial-gradient(circle at 35% 30%, ' + s.light + ', ' + s.mid + ' 62%, ' + s.dark + ')';
  }

  /** Just the sacred medallion, framed as a badge for the result card. */
  function crest(svg) {
    var prefix = 'kz' + (++uid);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '358 358 284 284');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    defs(svg, prefix);
    drawCenter(svg, prefix);
  }

  KZ.Render = {
    BOARD: BOARD,
    SOLDIERS: SOLDIERS,
    crest: crest,
    build: build,
    update: update,
    setSoldiers: setSoldiers,
    burst: burst,
    emblem: emblem,
    chipStyle: chipStyle,
    motifFor: motifFor
  };
})(window.KZ = window.KZ || {});
