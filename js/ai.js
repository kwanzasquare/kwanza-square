/* Kwanza Square — the Kwanza AI.
 *
 * The three levels differ in TEMPERAMENT, not just search depth. That matters
 * because of how this board behaves: with 20 soldiers on 24 points, the fastest
 * win is not to capture anything, it is to take away the opponent's last free
 * step and win on "cannot move". A strong engine finds that immediately and the
 * game is over before it starts.
 *
 * So `squeeze` scales how much the AI values strangling your mobility:
 *
 *   Beginner — squeeze 0. Never plays to suffocate you. Chases its own trios,
 *              blocks yours only half-heartedly, and plays with a wide random
 *              spread so it makes ordinary human mistakes. One ply.
 *   Skilled  — squeeze 0.35. Will take a good blocking move when it sees one,
 *              but does not hunt for the strangle. Two ply, mild randomness.
 *   Master   — squeeze 1. Full strength, plays the suffocation line on purpose,
 *              no randomness. Four ply in movement. This one is hard to beat.
 */
(function (KZ) {
  'use strict';

  var G = KZ.Geometry;
  var E = KZ.Engine;

  var LEVELS = {
    easy:   { label: 'Beginner', place: 1, move: 1, noise: 34, squeeze: 0,    block: 0.55, build: 1 },
    normal: { label: 'Skilled',  place: 2, move: 2, noise: 11, squeeze: 0.35, block: 0.85, build: 1 },
    hard:   { label: 'Master',   place: 3, move: 4, noise: 0,  squeeze: 1,    block: 1.15, build: 1 }
  };

  // Midpoints carry the radial connectors, so they are worth more than corners.
  var DEGREE = G.adjacency.map(function (a) { return a.length; });

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

  function evaluate(state, me, cfg) {
    var foe = E.other(me);

    if (state.roundOver) {
      if (state.roundWinner === me) return 100000;
      if (state.roundWinner === foe) return -100000;
      return 0;
    }

    var score = 0;

    // Material — every capture is a step towards emptying the enemy side.
    score += (state.onBoard[me] - state.onBoard[foe]) * 120;

    // Trios held, and trios one step away. `build` drives its own attack,
    // `block` drives how urgently it answers yours.
    for (var i = 0; i < G.trios.length; i++) {
      var c = trioCounts(state.board, G.trios[i]);
      var mine = c[me], theirs = c[foe];
      if (mine === 3) score += 45 * cfg.build;
      else if (mine === 2 && c.empty === 1) score += 14 * cfg.build;
      else if (mine === 1 && c.empty === 2) score += 3 * cfg.build;
      if (theirs === 3) score -= 45 * cfg.block;
      else if (theirs === 2 && c.empty === 1) score -= 17 * cfg.block;
      else if (theirs === 1 && c.empty === 2) score -= 3 * cfg.block;
    }

    // Mobility and the strangle. All of it scales with `squeeze`, except the
    // AI's own survival — it always avoids trapping itself.
    var myMob = mobility(state, me), foeMob = mobility(state, foe);
    score += (myMob - foeMob) * 6 * cfg.squeeze;
    if (state.phase === 'movement') {
      if (myMob === 0) score -= 5000;                     // never self-trap
      if (myMob <= 2) score -= (3 - myMob) * 40;
      if (foeMob === 0) score += 5000 * cfg.squeeze;      // only hunt the kill if allowed
      if (foeMob <= 2) score += (3 - foeMob) * 40 * cfg.squeeze;
    }

    // Hold the connectors — the only way between the three rings.
    for (var n = 0; n < G.NODE_COUNT; n++) {
      if (state.board[n] === me) score += DEGREE[n] * 2;
      else if (state.board[n] === foe) score -= DEGREE[n] * 2;
    }

    return score;
  }

  function search(state, depth, alpha, beta, me, cfg, budget) {
    if (budget.nodes++ > budget.limit) return evaluate(state, me, cfg);
    if (depth <= 0 || state.roundOver || state.matchOver) return evaluate(state, me, cfg);

    var actions = E.legalActions(state);
    if (!actions.length) return evaluate(state, me, cfg);

    var mover = state.awaitingCapture || state.turn;
    var maximizing = mover === me;
    var best = maximizing ? -Infinity : Infinity;

    for (var i = 0; i < actions.length; i++) {
      var next = E.clone(state);
      E.apply(next, actions[i]);
      var value = search(next, depth - 1, alpha, beta, me, cfg, budget);
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

  /** Choose an action for the side to move (or to capture). */
  function chooseAction(state) {
    var mover = state.awaitingCapture || state.turn;
    var actions = E.legalActions(state);
    if (!actions.length) return null;
    if (actions.length === 1) return actions[0];

    var cfg = LEVELS[state.difficulty] || LEVELS.normal;
    var depth = state.phase === 'placement' ? cfg.place : cfg.move;
    var budget = { nodes: 0, limit: 60000 };

    var scored = actions.map(function (action) {
      var next = E.clone(state);
      E.apply(next, action);
      var value = search(next, depth - 1, -Infinity, Infinity, mover, cfg, budget);
      if (cfg.noise) value += (Math.random() * 2 - 1) * cfg.noise;
      return { action: action, value: value };
    });

    scored.sort(function (x, y) { return y.value - x.value; });
    return scored[0].action;
  }

  /**
   * Score every legal action from the mover's point of view, strongest first.
   * Deterministic — no randomness — because this is what the grader judges a
   * human move against, and a grade must never change between two identical games.
   */
  function scoreActions(state, depth) {
    var mover = state.awaitingCapture || state.turn;
    var actions = E.legalActions(state);
    if (!actions.length) return [];
    var cfg = LEVELS.hard;
    var budget = { nodes: 0, limit: 40000 };
    var d = depth || 2;

    return actions.map(function (action) {
      var next = E.clone(state);
      E.apply(next, action);
      return { action: action, value: search(next, d - 1, -Infinity, Infinity, mover, cfg, budget) };
    }).sort(function (x, y) { return y.value - x.value; });
  }

  KZ.AI = {
    LEVELS: LEVELS,
    chooseAction: chooseAction,
    scoreActions: scoreActions,
    evaluate: evaluate
  };
})(typeof module !== 'undefined' && module.exports ? (module.exports.KZ = module.exports.KZ || {}) : (window.KZ = window.KZ || {}));
