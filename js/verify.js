/* Kwanza Square — re-proving a submitted match.
 *
 * The client is never believed. A submitted game is a list of every action in
 * order; this replays it against the same engine, rejects anything illegal, and
 * works out the result and the grade for itself. Whatever the app claimed is
 * only ever compared against what the replay produced.
 *
 * Runs unchanged in Node (tests) and in Deno (the edge function).
 */
(function (KZ) {
  'use strict';

  var E = KZ.Engine, Gr = KZ.Grade;

  var MAX_ACTIONS = 20000;   // a real match is a few hundred; this is a DoS guard

  var OUTCOME = { win: 1.0, draw: 0.5, loss: 0.2 };

  /** Points for one match: how it ended, weighted by how well it was played. */
  function pointsFor(result, accuracy) {
    var acc = typeof accuracy === 'number' ? accuracy : 0;
    return OUTCOME[result] * (0.5 + acc / 100);
  }

  function parseKey(key) {
    if (key === 'R') return { type: 'next-round' };
    if (key[0] === 'p') return { type: 'place', node: +key.slice(1) };
    if (key[0] === 'x') return { type: 'capture', node: +key.slice(1) };
    if (key[0] === 'm') {
      var bits = key.slice(1).split('>');
      return { type: 'move', from: +bits[0], to: +bits[1] };
    }
    return null;
  }

  function sameAction(a, b) {
    if (a.type !== b.type) return false;
    if (a.type === 'move') return a.from === b.from && a.to === b.to;
    return a.node === b.node;
  }

  /**
   * @param submission {level, pawns, roundsToWin, humanSide, actionLog[]}
   * @returns {ok, reason, result, accuracy, decisions, points, rounds}
   */
  function replay(submission) {
    var s = submission || {};
    var log = s.actionLog;

    if (!Array.isArray(log)) return fail('no action log');
    if (!log.length) return fail('empty action log');
    if (log.length > MAX_ACTIONS) return fail('action log too long');
    if (['easy', 'normal', 'hard'].indexOf(s.level) === -1) return fail('unknown level');
    if (['A', 'B'].indexOf(s.humanSide) === -1) return fail('unknown side');
    if (!(s.pawns >= 5 && s.pawns <= 12)) return fail('pawn count out of range');
    if (!(s.roundsToWin >= 1 && s.roundsToWin <= 3)) return fail('round count out of range');

    var state = E.createMatch({
      mode: 'ai', aiSide: s.humanSide === 'A' ? 'B' : 'A',
      difficulty: s.level, pawns: s.pawns, roundsToWin: s.roundsToWin
    });
    var card = Gr.newCard();

    for (var i = 0; i < log.length; i++) {
      var action = parseKey(log[i]);
      if (!action) return fail('unreadable action at ' + i);

      if (action.type === 'next-round') {
        if (!state.roundOver) return fail('round advanced before it ended, at ' + i);
        if (state.matchOver) return fail('round advanced after the match ended, at ' + i);
        E.nextRound(state);
        continue;
      }

      if (state.roundOver || state.matchOver) return fail('action played after the round ended, at ' + i);

      // The action must be one the engine would have allowed at this moment.
      var legal = E.legalActions(state);
      var allowed = false;
      for (var j = 0; j < legal.length; j++) {
        if (sameAction(legal[j], action)) { allowed = true; break; }
      }
      if (!allowed) return fail('illegal action at ' + i + ': ' + log[i]);

      // Grade only the human's own decisions, exactly as the app does.
      var mover = state.awaitingCapture || state.turn;
      if (mover === s.humanSide) Gr.record(card, action, Gr.assess(state, action));

      E.apply(state, action);
    }

    if (!state.matchOver) return fail('the match never finished');

    var result = state.matchWinner === s.humanSide ? 'win'
      : (!state.matchWinner ? 'draw' : 'loss');
    var summary = Gr.summarise(card);
    // Round the accuracy FIRST, then derive points from that same rounded
    // figure. Otherwise the stored points and the stored accuracy do not
    // reconcile, and a leaderboard people can audit has to add up.
    var accuracy = Math.round((summary.accuracy === null ? 0 : summary.accuracy) * 100) / 100;

    return {
      ok: true,
      reason: null,
      result: result,
      accuracy: accuracy,
      decisions: summary.decisions,
      points: Math.round(pointsFor(result, accuracy) * 1000) / 1000,
      rounds: state.round,
      scores: { A: state.scores.A, B: state.scores.B }
    };
  }

  function fail(reason) {
    return { ok: false, reason: reason, result: null, accuracy: 0, decisions: 0, points: 0 };
  }

  KZ.Verify = { replay: replay, pointsFor: pointsFor, MAX_ACTIONS: MAX_ACTIONS };
})(typeof module !== 'undefined' && module.exports ? (module.exports.KZ = module.exports.KZ || {}) : (window.KZ = window.KZ || {}));
