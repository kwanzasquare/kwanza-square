/* Kwanza Square — game engine.
 *
 * Pure state machine. No DOM, no rendering, no timers. Everything the UI and the
 * AI need to know about legality lives here so both agree on the rules.
 *
 * Rules (authoritative, per Martin):
 *   - 10 pawns per side, 24 intersections, sacred centre never playable.
 *   - Phase 1 placement: one pawn per intersection, a placement that would
 *     complete a trio is ILLEGAL — the player must choose another intersection.
 *     Nothing scores in Phase 1.
 *   - Phase 2 movement: vertical/horizontal to an ADJACENT FREE intersection.
 *     No diagonals, no skipping, no immediate back-and-forth. A player's first
 *     move of Phase 2 cannot score.
 *   - A trio (3 in a straight line, never diagonal) grants the right to remove
 *     ANY one enemy pawn, including one standing inside a trio.
 *   - Round ends when a side has no pawns left, or cannot move. Best of three.
 */
(function (KZ) {
  'use strict';

  var G = KZ.Geometry;
  var PAWNS_PER_SIDE = 10;
  var ROUNDS_TO_WIN = 2;
  var DRAW_LIMIT = 100; // moves without a capture -> round declared a draw

  function other(player) { return player === 'A' ? 'B' : 'A'; }

  function createMatch(opts) {
    opts = opts || {};
    var state = {
      mode: opts.mode || 'local',          // 'local' | 'ai'
      aiSide: opts.aiSide || 'B',
      difficulty: opts.difficulty || 'normal',
      names: opts.names || { A: 'Gold', B: 'Black' },
      // 10 a side is the traditional count and the default. Configurable only
      // so the effect of a smaller count can be tested on a real board.
      pawnsPerSide: opts.pawns || PAWNS_PER_SIDE,
      round: 1,
      scores: { A: 0, B: 0 },
      roundHistory: [],
      matchOver: false,
      matchWinner: null,
      startingPlayer: 'A'
    };
    resetRound(state);
    return state;
  }

  function resetRound(state) {
    state.phase = 'placement';
    state.board = new Array(G.NODE_COUNT).fill(null);
    state.turn = state.startingPlayer;
    var n = state.pawnsPerSide || PAWNS_PER_SIDE;
    state.toPlace = { A: n, B: n };
    state.onBoard = { A: 0, B: 0 };
    state.awaitingCapture = null;
    state.lastMove = { A: null, B: null };
    state.movesMade = { A: 0, B: 0 };
    state.movesSinceCapture = 0;
    state.activeTrios = [];
    state.roundOver = false;
    state.roundWinner = null;
    state.roundReason = '';
    state.log = [];
  }

  function clone(state) {
    return {
      mode: state.mode, aiSide: state.aiSide, difficulty: state.difficulty,
      names: state.names, pawnsPerSide: state.pawnsPerSide, round: state.round,
      scores: { A: state.scores.A, B: state.scores.B },
      roundHistory: state.roundHistory.slice(),
      matchOver: state.matchOver, matchWinner: state.matchWinner,
      startingPlayer: state.startingPlayer,
      phase: state.phase,
      board: state.board.slice(),
      turn: state.turn,
      toPlace: { A: state.toPlace.A, B: state.toPlace.B },
      onBoard: { A: state.onBoard.A, B: state.onBoard.B },
      awaitingCapture: state.awaitingCapture,
      lastMove: {
        A: state.lastMove.A ? { from: state.lastMove.A.from, to: state.lastMove.A.to } : null,
        B: state.lastMove.B ? { from: state.lastMove.B.from, to: state.lastMove.B.to } : null
      },
      movesMade: { A: state.movesMade.A, B: state.movesMade.B },
      movesSinceCapture: state.movesSinceCapture,
      activeTrios: state.activeTrios.slice(),
      roundOver: state.roundOver, roundWinner: state.roundWinner,
      roundReason: state.roundReason,
      log: state.log.slice()
    };
  }

  // --- trio detection -------------------------------------------------------

  /** Indices of trios that are completely owned by `player` and contain `node`. */
  function triosAt(board, node, player) {
    var found = [];
    var candidates = G.triosByNode[node];
    for (var i = 0; i < candidates.length; i++) {
      var t = G.trios[candidates[i]];
      if (board[t[0]] === player && board[t[1]] === player && board[t[2]] === player) {
        found.push(candidates[i]);
      }
    }
    return found;
  }

  /** Every trio currently held by `player` — used for the board glow. */
  function allTrios(board, player) {
    var found = [];
    for (var i = 0; i < G.trios.length; i++) {
      var t = G.trios[i];
      if (board[t[0]] === player && board[t[1]] === player && board[t[2]] === player) found.push(i);
    }
    return found;
  }

  /** Would dropping a pawn on `node` complete a trio? Placement forbids this. */
  function placementFormsTrio(board, node, player) {
    board[node] = player;
    var hit = triosAt(board, node, player).length > 0;
    board[node] = null;
    return hit;
  }

  // --- legality -------------------------------------------------------------

  function legalPlacements(state) {
    var player = state.turn;
    var free = [];
    var i;
    for (i = 0; i < G.NODE_COUNT; i++) if (state.board[i] === null) free.push(i);

    var legal = free.filter(function (n) {
      return !placementFormsTrio(state.board, n, player);
    });

    // Defensive only: if every remaining intersection would force a trio there is
    // no legal choice left, so the trio is allowed but still scores nothing.
    return legal.length ? legal : free;
  }

  function isBacktrack(state, player, from, to) {
    var last = state.lastMove[player];
    return !!last && last.from === to && last.to === from;
  }

  function legalMovesFrom(state, from) {
    var player = state.turn;
    if (state.board[from] !== player) return [];
    var out = [];
    var adj = G.adjacency[from];
    for (var i = 0; i < adj.length; i++) {
      var to = adj[i];
      if (state.board[to] !== null) continue;          // no moving into an occupied space
      if (isBacktrack(state, player, from, to)) continue; // no back-and-forth
      out.push(to);
    }
    return out;
  }

  function allMoves(state, player) {
    var moves = [];
    for (var from = 0; from < G.NODE_COUNT; from++) {
      if (state.board[from] !== player) continue;
      var adj = G.adjacency[from];
      for (var i = 0; i < adj.length; i++) {
        var to = adj[i];
        if (state.board[to] !== null) continue;
        if (isBacktrack(state, player, from, to)) continue;
        moves.push({ from: from, to: to });
      }
    }
    return moves;
  }

  /** Any enemy pawn may be taken — including one standing inside a trio. */
  function capturableNodes(state, player) {
    var foe = other(player);
    var out = [];
    for (var i = 0; i < G.NODE_COUNT; i++) if (state.board[i] === foe) out.push(i);
    return out;
  }

  /** Every action the side to move may legally take right now. */
  function legalActions(state) {
    if (state.roundOver || state.matchOver) return [];
    if (state.awaitingCapture) {
      return capturableNodes(state, state.awaitingCapture).map(function (n) {
        return { type: 'capture', node: n };
      });
    }
    if (state.phase === 'placement') {
      return legalPlacements(state).map(function (n) { return { type: 'place', node: n }; });
    }
    return allMoves(state, state.turn).map(function (m) {
      return { type: 'move', from: m.from, to: m.to };
    });
  }

  // --- applying actions -----------------------------------------------------

  function log(state, text) {
    state.log.push({ round: state.round, text: text });
    if (state.log.length > 200) state.log.shift();
  }

  function label(state, player) {
    return state.names[player] || player;
  }

  /**
   * Apply an action. Mutates `state`. Returns a list of UI events describing
   * what visibly happened, e.g. [{type:'trio', trios:[...]}, {type:'capture'}].
   */
  function apply(state, action) {
    var events = [];
    if (state.roundOver || state.matchOver) return events;
    var player = state.awaitingCapture || state.turn;

    if (action.type === 'place') {
      if (state.phase !== 'placement' || state.awaitingCapture) return events;
      if (state.board[action.node] !== null) return events;
      state.board[action.node] = player;
      state.toPlace[player]--;
      state.onBoard[player]++;
      log(state, label(state, player) + ' places a soldier.');
      events.push({ type: 'place', node: action.node, player: player });

      if (state.toPlace.A === 0 && state.toPlace.B === 0) {
        state.phase = 'movement';
        log(state, 'All 20 soldiers placed — the movement phase begins.');
        events.push({ type: 'phase', phase: 'movement' });
      }
      endTurn(state, events);
      return events;
    }

    if (action.type === 'move') {
      if (state.phase !== 'movement' || state.awaitingCapture) return events;
      if (state.board[action.from] !== player) return events;
      if (legalMovesFrom(state, action.from).indexOf(action.to) === -1) return events;

      state.board[action.from] = null;
      state.board[action.to] = player;
      state.lastMove[player] = { from: action.from, to: action.to };
      state.movesSinceCapture++;
      events.push({ type: 'move', from: action.from, to: action.to, player: player });

      var isFirstMove = state.movesMade[player] === 0;
      state.movesMade[player]++;

      var formed = triosAt(state.board, action.to, player);
      if (formed.length && isFirstMove) {
        log(state, label(state, player) + ' lines up a trio, but a first move cannot score.');
        events.push({ type: 'trio-void', trios: formed });
      } else if (formed.length) {
        state.awaitingCapture = player;
        log(state, label(state, player) + ' scores a trio — remove an enemy soldier.');
        events.push({ type: 'trio', trios: formed, player: player });
        refreshTrios(state);
        return events; // same player continues, to take a pawn
      }
      refreshTrios(state);
      endTurn(state, events);
      return events;
    }

    if (action.type === 'capture') {
      if (!state.awaitingCapture) return events;
      var taker = state.awaitingCapture;
      if (state.board[action.node] !== other(taker)) return events;
      state.board[action.node] = null;
      state.onBoard[other(taker)]--;
      state.awaitingCapture = null;
      state.movesSinceCapture = 0;
      log(state, label(state, taker) + ' captures a soldier of ' + label(state, other(taker)) + '.');
      events.push({ type: 'capture', node: action.node, player: taker, victim: other(taker) });
      refreshTrios(state);
      endTurn(state, events);
      return events;
    }

    return events;
  }

  function refreshTrios(state) {
    state.activeTrios = allTrios(state.board, 'A')
      .map(function (i) { return { trio: i, player: 'A' }; })
      .concat(allTrios(state.board, 'B').map(function (i) { return { trio: i, player: 'B' }; }));
  }

  function endTurn(state, events) {
    state.turn = other(state.turn);
    checkRoundEnd(state, events);
  }

  function checkRoundEnd(state, events) {
    if (state.roundOver) return;
    var mover = state.turn;
    var foe = other(mover);

    // A side with no soldiers left loses the round.
    if (state.phase === 'movement' && state.onBoard[mover] === 0) {
      return finishRound(state, foe, label(state, mover) + ' has no soldiers left.', events);
    }
    if (state.phase === 'movement' && state.onBoard[foe] === 0) {
      return finishRound(state, mover, label(state, foe) + ' has no soldiers left.', events);
    }
    // A side that cannot move loses the round.
    if (state.phase === 'movement' && allMoves(state, mover).length === 0) {
      return finishRound(state, foe, label(state, mover) + ' cannot move.', events);
    }
    if (state.phase === 'movement' && state.movesSinceCapture >= DRAW_LIMIT) {
      return finishRound(state, null, 'No capture in ' + DRAW_LIMIT + ' moves — the round is drawn.', events);
    }
  }

  function finishRound(state, winner, reason, events) {
    state.roundOver = true;
    state.roundWinner = winner;
    state.roundReason = reason;
    if (winner) state.scores[winner]++;
    state.roundHistory.push({ round: state.round, winner: winner, reason: reason });
    log(state, 'Round ' + state.round + ': ' + (winner ? label(state, winner) + ' wins. ' : 'Drawn. ') + reason);
    events.push({ type: 'round-over', winner: winner, reason: reason });

    if (winner && state.scores[winner] >= ROUNDS_TO_WIN) {
      state.matchOver = true;
      state.matchWinner = winner;
      log(state, label(state, winner) + ' takes the match ' + state.scores[winner] + '–' + state.scores[other(winner)] + '.');
      events.push({ type: 'match-over', winner: winner });
    }
  }

  /** Begin the next round. The loser of the toss alternates who opens. */
  function nextRound(state) {
    if (state.matchOver) return state;
    state.round++;
    state.startingPlayer = other(state.startingPlayer);
    resetRound(state);
    return state;
  }

  KZ.Engine = {
    PAWNS_PER_SIDE: PAWNS_PER_SIDE,
    ROUNDS_TO_WIN: ROUNDS_TO_WIN,
    DRAW_LIMIT: DRAW_LIMIT,
    other: other,
    createMatch: createMatch,
    resetRound: resetRound,
    nextRound: nextRound,
    clone: clone,
    triosAt: triosAt,
    allTrios: allTrios,
    placementFormsTrio: placementFormsTrio,
    legalPlacements: legalPlacements,
    legalMovesFrom: legalMovesFrom,
    allMoves: allMoves,
    capturableNodes: capturableNodes,
    legalActions: legalActions,
    apply: apply,
    refreshTrios: refreshTrios
  };
})(typeof module !== 'undefined' && module.exports ? (module.exports.KZ = module.exports.KZ || {}) : (window.KZ = window.KZ || {}));
