/* Kwanza Square — the Kwanza AI.
 *
 * Heuristics asked for: block opponent trios, build towards your own, avoid
 * traps (don't wander into positions with no room to move).
 *
 * Easy   — greedy with noise, misses some blocks on purpose
 * Normal — 2-ply alpha-beta
 * Hard   — 4-ply alpha-beta in movement, 3-ply in placement
 */
(function (KZ) {
  'use strict';

  var G = KZ.Geometry;
  var E = KZ.Engine;

  var DEPTH = {
    easy:   { place: 1, move: 1, noise: 26 },
    normal: { place: 2, move: 2, noise: 6 },
    hard:   { place: 3, move: 4, noise: 0 }
  };

  // Midpoints carry the radial connectors, so they are worth more than corners.
  var DEGREE = G.adjacency.map(function (a) { return a.length; });

  /** How many of this trio's three points the player holds, and is it blockable. */
  function trioCounts(board, trio) {
    var a = 0, b = 0, empty = 0;
    for (var i = 0; i < 3; i++) {
      var v = board[trio[i]];
      if (v === 'A') a++; else if (v === 'B') b++; else empty++;
    }
    return { A: a, B: b, empty: empty };
  }

  function mobility(state, player) {
    var n = 0;
    for (var from = 0; from < G.NODE_COUNT; from++) {
      if (state.board[from] !== player) continue;
      var adj = G.adjacency[from];
      for (var i = 0; i < adj.length; i++) if (state.board[adj[i]] === null) n++;
    }
    return n;
  }

  function evaluate(state, me) {
    var foe = E.other(me);

    if (state.roundOver) {
      if (state.roundWinner === me) return 100000;
      if (state.roundWinner === foe) return -100000;
      return 0;
    }

    var score = 0;

    // Material is king — every capture is a step towards emptying the enemy side.
    score += (state.onBoard[me] - state.onBoard[foe]) * 120;

    // Trios held, and trios one step away. Blocking is weighted slightly higher
    // than building, which is what makes the AI feel defensively alert.
    for (var i = 0; i < G.trios.length; i++) {
      var c = trioCounts(state.board, G.trios[i]);
      var mine = c[me], theirs = c[foe];
      if (mine === 3) score += 45;
      else if (mine === 2 && c.empty === 1) score += 14;
      else if (mine === 1 && c.empty === 2) score += 3;
      if (theirs === 3) score -= 45;
      else if (theirs === 2 && c.empty === 1) score -= 17;
      else if (theirs === 1 && c.empty === 2) score -= 3;
    }

    // Mobility, and the trap penalty: a soldier with nowhere to go is a liability,
    // and a side with no moves at all loses the round outright.
    var myMob = mobility(state, me), foeMob = mobility(state, foe);
    score += (myMob - foeMob) * 6;
    if (state.phase === 'movement') {
      if (myMob === 0) score -= 5000;
      if (foeMob === 0) score += 5000;
      if (myMob <= 2) score -= (3 - myMob) * 40;
    }

    // Hold the connectors — they are the only way between the three rings.
    for (var n = 0; n < G.NODE_COUNT; n++) {
      if (state.board[n] === me) score += DEGREE[n] * 2;
      else if (state.board[n] === foe) score -= DEGREE[n] * 2;
    }

    return score;
  }

  function search(state, depth, alpha, beta, me, budget) {
    if (budget.nodes++ > budget.limit) return evaluate(state, me);
    if (depth <= 0 || state.roundOver || state.matchOver) return evaluate(state, me);

    var actions = E.legalActions(state);
    if (!actions.length) return evaluate(state, me);

    var mover = state.awaitingCapture || state.turn;
    var maximizing = mover === me;
    var best = maximizing ? -Infinity : Infinity;

    for (var i = 0; i < actions.length; i++) {
      var next = E.clone(state);
      E.apply(next, actions[i]);
      var value = search(next, depth - 1, alpha, beta, me, budget);
      if (maximizing) {
        if (value > best) best = value;
        if (best > alpha) alpha = best;
      } else {
        if (value < best) best = value;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) break; // prune
    }
    return best;
  }

  /**
   * Choose an action for the side to move (or to capture). Returns null when
   * there is nothing to do.
   */
  function chooseAction(state) {
    var mover = state.awaitingCapture || state.turn;
    var actions = E.legalActions(state);
    if (!actions.length) return null;
    if (actions.length === 1) return actions[0];

    var cfg = DEPTH[state.difficulty] || DEPTH.normal;
    var depth = state.phase === 'placement' ? cfg.place : cfg.move;
    var budget = { nodes: 0, limit: 60000 };

    var scored = actions.map(function (action) {
      var next = E.clone(state);
      E.apply(next, action);
      var value = search(next, depth - 1, -Infinity, Infinity, mover, budget);
      if (cfg.noise) value += (Math.random() * 2 - 1) * cfg.noise;
      return { action: action, value: value };
    });

    scored.sort(function (x, y) { return y.value - x.value; });
    return scored[0].action;
  }

  KZ.AI = {
    chooseAction: chooseAction,
    evaluate: evaluate
  };
})(typeof module !== 'undefined' && module.exports ? (module.exports.KZ = module.exports.KZ || {}) : (window.KZ = window.KZ || {}));
