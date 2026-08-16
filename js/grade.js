/* Kwanza Square — grading a player's thinking.
 *
 * The point, in Martin's words: most people will lose to the AI, so losing
 * badly and losing well must not look the same. This measures whether the moves
 * showed strategy or were close to random, and it works just as well in a
 * defeat as in a win.
 *
 * Method, per decision:
 *   1. Score every move the player COULD have made (deterministically).
 *   2. See where the move they actually chose ranked between the best and the
 *      worst available.
 *   3. quality = (played - worst) / (best - worst)  ->  0 for the worst move
 *      available, 1 for the best.
 *
 * Decisions where every option is equal, or where only one move is legal, carry
 * no information about skill and are excluded rather than counted as perfect.
 *
 * Accuracy is the mean quality across graded decisions. It is a judgement
 * against this engine's opinion, not against absolute truth — a strong human
 * may play a good move the engine dislikes.
 *
 * Every decision is also recorded as a move list, so a future server could
 * replay a game and confirm both the result and the grade independently.
 */
(function (KZ) {
  'use strict';

  var AI = KZ.AI;

  var GRADE_DEPTH = 2;      // deep enough to be meaningful, fast enough on a phone
  var FLAT_SPREAD = 10;     // below this, the options are effectively equivalent
  var BLUNDER_SPREAD = 60;  // a decision that genuinely mattered
  var BLUNDER_QUALITY = 0.25;

  var BANDS = [
    { min: 92, grade: 'A+', note: 'Masterful. Nearly every move was the strongest available.' },
    { min: 85, grade: 'A',  note: 'Excellent judgement. You saw the board clearly.' },
    { min: 76, grade: 'B',  note: 'Strong play with a few missed chances.' },
    { min: 66, grade: 'C',  note: 'Sound instincts, but several moves gave ground away.' },
    { min: 55, grade: 'D',  note: 'The shape of a plan is there. Watch your opponent\'s trios.' },
    { min: 0,  grade: 'E',  note: 'Mostly reacting rather than planning. Try the tutorial.' }
  ];

  function newCard() {
    return {
      decisions: 0,      // graded decisions
      skipped: 0,        // forced or equivalent-option decisions
      sum: 0,            // summed quality
      best: 0,           // times the strongest move was chosen
      blunders: 0,
      trios: 0,
      captures: 0,
      lost: 0,           // own soldiers taken
      moves: []          // the move list, for later verification
    };
  }

  /**
   * Judge one decision before it is played.
   * `state` must be the position BEFORE the action.
   */
  function assess(state, action) {
    var scored = AI.scoreActions(state, GRADE_DEPTH);
    if (scored.length < 2) return { forced: true };

    var best = scored[0].value;
    var worst = scored[scored.length - 1].value;
    var spread = best - worst;
    if (spread < FLAT_SPREAD) return { forced: true };

    var key = actionKey(action);
    var played = null;
    for (var i = 0; i < scored.length; i++) {
      if (actionKey(scored[i].action) === key) { played = scored[i].value; break; }
    }
    if (played === null) return { forced: true }; // not a legal action; nothing to judge

    var quality = (played - worst) / spread;
    return {
      forced: false,
      quality: quality,
      wasBest: played >= best - 1e-9,
      blunder: quality < BLUNDER_QUALITY && spread >= BLUNDER_SPREAD,
      spread: spread
    };
  }

  function actionKey(a) {
    return a.type === 'move' ? 'm' + a.from + '>' + a.to
      : a.type === 'place' ? 'p' + a.node
      : 'x' + a.node;
  }

  /** Fold one judged decision into a card. */
  function record(card, action, verdict) {
    card.moves.push(actionKey(action));
    if (!verdict || verdict.forced) { card.skipped++; return; }
    card.decisions++;
    card.sum += verdict.quality;
    if (verdict.wasBest) card.best++;
    if (verdict.blunder) card.blunders++;
  }

  /** Final numbers for a card. */
  function summarise(card) {
    var accuracy = card.decisions ? (card.sum / card.decisions) * 100 : null;
    var band = null;
    if (accuracy !== null) {
      for (var i = 0; i < BANDS.length; i++) {
        if (accuracy >= BANDS[i].min) { band = BANDS[i]; break; }
      }
    }
    return {
      accuracy: accuracy,
      accuracyText: accuracy === null ? '—' : Math.round(accuracy) + '%',
      grade: band ? band.grade : '—',
      note: band ? band.note : 'Not enough real decisions to grade this round.',
      bestRate: card.decisions ? Math.round((card.best / card.decisions) * 100) : 0,
      decisions: card.decisions,
      blunders: card.blunders,
      trios: card.trios,
      captures: card.captures,
      lost: card.lost,
      moves: card.moves
    };
  }

  // --------------------------------------------------------------- persistence

  var STORE = 'kwanza-record';

  function loadRecord() {
    try {
      var raw = localStorage.getItem(STORE);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, won: 0, lost: 0, drawn: 0, bestAccuracy: null, sumAccuracy: 0, graded: 0, streak: 0, bestStreak: 0 };
  }

  function saveRecord(rec) {
    try { localStorage.setItem(STORE, JSON.stringify(rec)); } catch (e) {}
  }

  /** Fold a finished match into the player's lifetime record. */
  function commitMatch(result) {
    var rec = loadRecord();
    rec.played++;
    if (result.won) { rec.won++; rec.streak++; if (rec.streak > rec.bestStreak) rec.bestStreak = rec.streak; }
    else if (result.drawn) { rec.drawn++; }
    else { rec.lost++; rec.streak = 0; }

    if (typeof result.accuracy === 'number') {
      rec.sumAccuracy += result.accuracy;
      rec.graded++;
      if (rec.bestAccuracy === null || result.accuracy > rec.bestAccuracy) rec.bestAccuracy = result.accuracy;
    }
    saveRecord(rec);
    return rec;
  }

  function averageAccuracy(rec) {
    return rec.graded ? rec.sumAccuracy / rec.graded : null;
  }

  KZ.Grade = {
    GRADE_DEPTH: GRADE_DEPTH,
    BANDS: BANDS,
    newCard: newCard,
    assess: assess,
    record: record,
    summarise: summarise,
    actionKey: actionKey,
    loadRecord: loadRecord,
    saveRecord: saveRecord,
    commitMatch: commitMatch,
    averageAccuracy: averageAccuracy
  };
})(typeof module !== 'undefined' && module.exports ? (module.exports.KZ = module.exports.KZ || {}) : (window.KZ = window.KZ || {}));
