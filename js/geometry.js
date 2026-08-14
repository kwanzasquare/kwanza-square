/* Kwanzaa Square — board geometry.
 *
 * Three concentric squares, 8 playable intersections each = 24 nodes.
 * The centre is sacred and never playable.
 *
 * Ring   0 = outer (Territory), 1 = middle (Strategy), 2 = inner (Mastery)
 * Pos    0=NW 1=N 2=NE 3=E 4=SE 5=S 6=SW 7=W   (clockwise from north-west)
 * Node id = ring * 8 + pos
 */
(function (KZ) {
  'use strict';

  var CENTER = 500;                 // viewBox is 0 0 1000 1000
  var HALF = [420, 280, 140];       // half-width of each ring
  var MIDPOINTS = [1, 3, 5, 7];     // N, E, S, W — the only nodes carrying spokes

  var nodes = [];
  for (var ring = 0; ring < 3; ring++) {
    var h = HALF[ring];
    var coords = [
      [CENTER - h, CENTER - h], // NW
      [CENTER,     CENTER - h], // N
      [CENTER + h, CENTER - h], // NE
      [CENTER + h, CENTER    ], // E
      [CENTER + h, CENTER + h], // SE
      [CENTER,     CENTER + h], // S
      [CENTER - h, CENTER + h], // SW
      [CENTER - h, CENTER    ]  // W
    ];
    for (var pos = 0; pos < 8; pos++) {
      nodes.push({
        id: ring * 8 + pos,
        ring: ring,
        pos: pos,
        x: coords[pos][0],
        y: coords[pos][1],
        corner: pos % 2 === 0
      });
    }
  }

  // --- adjacency ------------------------------------------------------------
  // Within a ring the eight nodes form a closed loop (corner-midpoint-corner).
  // Radial connectors ("spokes") join the rings at the four edge midpoints,
  // which is what lets a pawn travel between Territory, Strategy and Mastery.
  var adjacency = nodes.map(function () { return []; });

  function link(a, b) {
    if (adjacency[a].indexOf(b) === -1) adjacency[a].push(b);
    if (adjacency[b].indexOf(a) === -1) adjacency[b].push(a);
  }

  for (var r = 0; r < 3; r++) {
    for (var p = 0; p < 8; p++) link(r * 8 + p, r * 8 + ((p + 1) % 8));
  }
  MIDPOINTS.forEach(function (p) {
    link(0 * 8 + p, 1 * 8 + p);
    link(1 * 8 + p, 2 * 8 + p);
  });

  // --- trios (mills) --------------------------------------------------------
  // Only straight vertical or horizontal lines of three count. Diagonals never do.
  //   * 4 edges per ring x 3 rings = 12
  //   * 4 radial lines (one per midpoint direction) = 4
  var trios = [];
  for (var r2 = 0; r2 < 3; r2++) {
    var b = r2 * 8;
    trios.push([b + 0, b + 1, b + 2]); // top edge     — horizontal
    trios.push([b + 2, b + 3, b + 4]); // right edge   — vertical
    trios.push([b + 4, b + 5, b + 6]); // bottom edge  — horizontal
    trios.push([b + 6, b + 7, b + 0]); // left edge    — vertical
  }
  MIDPOINTS.forEach(function (p) {
    trios.push([p, 8 + p, 16 + p]);    // radial — vertical (N/S) or horizontal (E/W)
  });

  // trios that touch each node, precomputed for fast detection
  var triosByNode = nodes.map(function () { return []; });
  trios.forEach(function (t, i) {
    t.forEach(function (n) { triosByNode[n].push(i); });
  });

  // straight segments used to draw the board lines
  var segments = [];
  for (var r3 = 0; r3 < 3; r3++) {
    var bb = r3 * 8;
    segments.push([bb + 0, bb + 2], [bb + 2, bb + 4], [bb + 4, bb + 6], [bb + 6, bb + 0]);
  }
  MIDPOINTS.forEach(function (p) {
    segments.push([p, 16 + p]); // one straight run crossing all three rings
  });

  KZ.Geometry = {
    CENTER: CENTER,
    HALF: HALF,
    NODE_COUNT: 24,
    nodes: nodes,
    adjacency: adjacency,
    trios: trios,
    triosByNode: triosByNode,
    segments: segments,
    node: function (id) { return nodes[id]; },
    /** Is `orientation` of a trio vertical or horizontal (never diagonal). */
    trioOrientation: function (trio) {
      return nodes[trio[0]].x === nodes[trio[1]].x ? 'vertical' : 'horizontal';
    }
  };
})(typeof module !== 'undefined' && module.exports ? (module.exports.KZ = module.exports.KZ || {}) : (window.KZ = window.KZ || {}));
