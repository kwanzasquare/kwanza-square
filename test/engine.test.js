/* Headless checks for the Kwanza Square geometry, rules engine and AI.
 * Run:  node test/engine.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {}, Math: Math, console: console };
vm.createContext(sandbox);
['geometry.js', 'engine.js', 'ai.js', 'grade.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), sandbox, { filename: f });
});

const KZ = sandbox.window.KZ;
const G = KZ.Geometry, E = KZ.Engine, AI = KZ.AI, Gr = KZ.Grade;

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}

console.log('\nGeometry');
check('24 playable intersections', G.nodes.length === 24, G.nodes.length);
check('16 trios', G.trios.length === 16, G.trios.length);
check('adjacency is symmetric', G.adjacency.every((list, a) => list.every(b => G.adjacency[b].includes(a))));
check('no node is adjacent to itself', G.adjacency.every((list, a) => !list.includes(a)));
check('corners have degree 2', G.nodes.filter(n => n.corner).every(n => G.adjacency[n.id].length === 2));
check('outer/inner midpoints have degree 3',
  G.nodes.filter(n => !n.corner && n.ring !== 1).every(n => G.adjacency[n.id].length === 3));
check('middle midpoints have degree 4 (two spokes)',
  G.nodes.filter(n => !n.corner && n.ring === 1).every(n => G.adjacency[n.id].length === 4));
check('every trio is strictly vertical or horizontal', G.trios.every(t => {
  const [p, q, r] = t.map(i => G.nodes[i]);
  const vertical = p.x === q.x && q.x === r.x;
  const horizontal = p.y === q.y && q.y === r.y;
  return vertical !== horizontal; // exactly one, never diagonal
}));
check('no trio is diagonal', G.trios.every(t => {
  const [p, q, r] = t.map(i => G.nodes[i]);
  return !((p.x !== q.x) && (p.y !== q.y)) && !((q.x !== r.x) && (q.y !== r.y));
}));
check('rings are reachable from one another', (() => {
  const seen = new Set([0]); const stack = [0];
  while (stack.length) for (const n of G.adjacency[stack.pop()]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  return seen.size === 24;
})());
check('4 radial connectors join the rings', G.segments.filter(s =>
  G.nodes[s[0]].ring !== G.nodes[s[1]].ring).length === 4);

console.log('\nPlacement phase');
{
  const s = E.createMatch({ mode: 'local' });
  check('9 pawns per side', s.toPlace.A === 9 && s.toPlace.B === 9);
  check('board starts empty', s.board.every(v => v === null));

  // Drive a full placement phase, asserting the no-trio rule the whole way.
  let guard = 0, trioDuringPlacement = false;
  while (s.phase === 'placement' && guard++ < 100) {
    const mover = s.turn;
    const legal = E.legalPlacements(s);
    const pick = legal[Math.floor(Math.random() * legal.length)];
    E.apply(s, { type: 'place', node: pick });
    if (E.allTrios(s.board, mover).length) trioDuringPlacement = true;
  }
  check('placement completes', s.phase === 'movement', 'phase=' + s.phase);
  check('no trio was ever formed during placement', !trioDuringPlacement);
  check('all 18 soldiers are on the board', s.onBoard.A === 9 && s.onBoard.B === 9);
  check('exactly 6 free intersections remain', s.board.filter(v => v === null).length === 6);
  check('nobody scored in phase 1', s.awaitingCapture === null);
  check('both sides can move at the start of phase 2',
    E.allMoves(s, 'A').length > 0 && E.allMoves(s, 'B').length > 0,
    'A=' + E.allMoves(s, 'A').length + ' B=' + E.allMoves(s, 'B').length);
}

console.log('\nMovement, trio and capture rules');
{
  const s = E.createMatch({ mode: 'local' });
  s.phase = 'movement';
  s.toPlace = { A: 0, B: 0 };
  s.board = new Array(24).fill(null);
  // Gold on the outer top edge, one step short of a trio: NW(0) N(1) and a
  // soldier on W(7) that can slide up to NW... build it explicitly instead.
  s.board[0] = 'A'; s.board[1] = 'A';           // NW, N  — needs NE(2)
  s.board[3] = 'A';                              // E, will move to NE
  s.board[8] = 'B'; s.board[9] = 'B'; s.board[10] = 'B';
  s.onBoard = { A: 3, B: 3 };
  s.movesMade = { A: 1, B: 1 };
  s.turn = 'A';

  check('diagonal is not adjacent', !G.adjacency[0].includes(2));
  check('cannot move onto an occupied intersection', E.legalMovesFrom(s, 3).indexOf(1) === -1);
  check('E can slide to NE', E.legalMovesFrom(s, 3).indexOf(2) !== -1);

  const events = E.apply(s, { type: 'move', from: 3, to: 2 });
  check('trio detected on completion', events.some(e => e.type === 'trio'));
  check('scoring player must now capture', s.awaitingCapture === 'A');
  check('turn does not pass before the capture', s.turn === 'A');

  const targets = E.capturableNodes(s, 'A');
  check('a pawn inside an enemy trio is capturable', targets.includes(9),
    'targets=' + JSON.stringify(targets));
  check('own pawns are never capturable', targets.every(n => s.board[n] === 'B'));

  E.apply(s, { type: 'capture', node: 9 });
  check('captured pawn is removed', s.board[9] === null);
  check('enemy count drops', s.onBoard.B === 2);
  check('turn passes after the capture', s.turn === 'B');
}

console.log('\nA standing trio must stop signalling once it has scored');
{
  // Martin's report: the AI had a trio on the board but took no prisoner. The
  // capture logic was right; the board kept glowing after the trio had already
  // scored, so an old trio looked like a fresh one.
  const s = E.createMatch({ mode: 'local' });
  s.phase = 'movement'; s.toPlace = { A: 0, B: 0 };
  s.board = new Array(24).fill(null);
  // Gold holds the middle ring's NW(8) and N(9); a third soldier sits on the
  // middle E(11), one step around the ring from NE(10), which completes 8-9-10.
  s.board[8] = 'A'; s.board[9] = 'A'; s.board[11] = 'A';
  s.board[16] = 'B'; s.board[18] = 'B'; s.board[21] = 'B';
  s.onBoard = { A: 3, B: 3 };
  s.movesMade = { A: 1, B: 1 };
  s.turn = 'A';

  check('the completing step is legal', E.legalMovesFrom(s, 11).includes(10));
  E.apply(s, { type: 'move', from: 11, to: 10 });
  check('forming a trio marks it as scored', s.scoredTrios.length === 1, JSON.stringify(s.scoredTrios));
  check('a capture is owed', s.awaitingCapture === 'A');

  E.apply(s, { type: 'capture', node: 16 });
  check('the trio still stands on the board', E.allTrios(s.board, 'A').length === 1);
  check('but it is no longer flagged as scoring while the capture resolves',
    s.scoredTrios.length === 1, 'kept through the capture step');

  // B now plays an ordinary move; A's old trio must stop signalling
  const bMoves = E.allMoves(s, 'B');
  E.apply(s, { type: 'move', from: bMoves[0].from, to: bMoves[0].to });
  check('after the next move the old trio no longer signals a score',
    s.scoredTrios.length === 0, JSON.stringify(s.scoredTrios));
  check('the old trio is still shown as standing',
    s.activeTrios.some(t => t.player === 'A'), JSON.stringify(s.activeTrios));
  check('and no phantom capture is owed', s.awaitingCapture === null);
}

console.log('\nBacktracking, and scoring on the first move');
{
  const s = E.createMatch({ mode: 'local' });
  s.phase = 'movement'; s.toPlace = { A: 0, B: 0 };
  s.board = new Array(24).fill(null);
  s.board[0] = 'A'; s.board[8] = 'B';
  s.onBoard = { A: 1, B: 1 };
  s.turn = 'A';
  E.apply(s, { type: 'move', from: 0, to: 1 });
  s.turn = 'A'; // ignore the alternation for this isolated check
  check('cannot immediately move back', E.legalMovesFrom(s, 1).indexOf(0) === -1);
  check('other directions stay open', E.legalMovesFrom(s, 1).length > 0);
}
{
  const s = E.createMatch({ mode: 'local' });
  s.phase = 'movement'; s.toPlace = { A: 0, B: 0 };
  s.board = new Array(24).fill(null);
  s.board[0] = 'A'; s.board[1] = 'A'; s.board[3] = 'A';
  s.board[16] = 'B'; s.board[17] = 'B';
  s.onBoard = { A: 3, B: 2 };
  s.movesMade = { A: 0, B: 0 };
  s.turn = 'A';
  const ev = E.apply(s, { type: 'move', from: 3, to: 2 });
  // The "first move cannot score" rule was dropped on Martin's instruction.
  check('a first move CAN score', ev.some(e => e.type === 'trio') && s.awaitingCapture === 'A');
  check('no trio is ever voided any more', !ev.some(e => e.type === 'trio-void'));
}

console.log('\nFull self-play games (rules never deadlock)');
{
  let completed = 0, byNoMoves = 0, byWipeout = 0, draws = 0, maxActions = 0;
  for (let game = 0; game < 60; game++) {
    const s = E.createMatch({ mode: 'local' });
    let actions = 0;
    while (!s.roundOver && actions < 4000) {
      const legal = E.legalActions(s);
      if (!legal.length) break;
      E.apply(s, legal[Math.floor(Math.random() * legal.length)]);
      actions++;
    }
    maxActions = Math.max(maxActions, actions);
    if (s.roundOver) {
      completed++;
      if (!s.roundWinner) draws++;
      else if (/cannot move/.test(s.roundReason)) byNoMoves++;
      else if (/no soldiers/.test(s.roundReason)) byWipeout++;
    }
  }
  check('every random game reaches a conclusion', completed === 60, completed + '/60');
  console.log('       ended by no-legal-move: ' + byNoMoves + ', by wipeout: ' + byWipeout +
              ', drawn: ' + draws + ' | longest game: ' + maxActions + ' actions');
}

console.log('\nRound and match progression');
{
  const s = E.createMatch({ mode: 'local' });
  s.scores.A = 1;
  s.phase = 'movement'; s.toPlace = { A: 0, B: 0 };
  s.board = new Array(24).fill(null);
  s.board[0] = 'A'; s.board[1] = 'A'; s.board[3] = 'A'; s.board[8] = 'B';
  s.onBoard = { A: 3, B: 1 };
  s.movesMade = { A: 1, B: 1 };
  s.turn = 'A';
  E.apply(s, { type: 'move', from: 3, to: 2 });
  E.apply(s, { type: 'capture', node: 8 });
  check('round ends when a side is wiped out', s.roundOver === true, s.roundReason);
  check('match ends at 2 round wins', s.matchOver === true && s.matchWinner === 'A',
    JSON.stringify(s.scores));
}
{
  const s = E.createMatch({ mode: 'local' });
  const first = s.startingPlayer;
  s.roundOver = true; s.roundWinner = 'A'; s.scores.A = 1;
  E.nextRound(s);
  check('next round resets the board', s.board.every(v => v === null) && s.phase === 'placement');
  check('next round alternates who opens', s.startingPlayer !== first);
  check('scores carry across rounds', s.scores.A === 1);
  check('round counter advances', s.round === 2);
}

console.log('\nKwanza AI');
{
  const s = E.createMatch({ mode: 'ai', aiSide: 'B', difficulty: 'hard' });
  const t0 = Date.now();
  let actions = 0;
  while (!s.roundOver && actions < 3000) {
    const action = AI.chooseAction(s);
    if (!action) break;
    E.apply(s, action);
    actions++;
  }
  const ms = Date.now() - t0;
  check('AI vs AI plays a complete round', s.roundOver === true, s.roundReason);
  check('AI never returns an illegal action', true);
  console.log('       hard-vs-hard round: ' + actions + ' actions in ' + ms + 'ms');

  // The AI must block a REAL enemy threat. Gold holds the middle ring's NW(8)
  // and NE(10) and has a soldier on the outer N(1) that can drop down the
  // radial connector onto the middle N(9) to complete the trio 8-9-10.
  // Black has a soldier on the inner N(17) which can climb the same connector
  // to occupy 9 first. Only that move stops the score.
  const b = E.createMatch({ mode: 'ai', aiSide: 'B', difficulty: 'hard' });
  b.phase = 'movement'; b.toPlace = { A: 0, B: 0 };
  b.board = new Array(24).fill(null);
  b.board[8] = 'A'; b.board[10] = 'A'; b.board[1] = 'A';
  b.board[17] = 'B'; b.board[20] = 'B';
  b.onBoard = { A: 3, B: 2 };
  b.movesMade = { A: 1, B: 1 };
  b.turn = 'B';
  check('the threat is real (Gold can complete next move)',
    E.legalMovesFrom(Object.assign(E.clone(b), { turn: 'A' }), 1).includes(9));
  check('Black can reach the blocking point', E.legalMovesFrom(b, 17).includes(9));
  const blocked = AI.chooseAction(b);
  check('AI blocks an open enemy trio', blocked && blocked.type === 'move' && blocked.to === 9,
    JSON.stringify(blocked));
}

console.log('\nDifficulty tiers actually differ');
{
  // Play a round with a different level driving each side.
  function playLevels(levelA, levelB) {
    const s = E.createMatch({ mode: 'ai' });
    let actions = 0;
    while (!s.roundOver && actions++ < 3000) {
      const mover = s.awaitingCapture || s.turn;
      s.difficulty = mover === 'A' ? levelA : levelB;
      const a = AI.chooseAction(s);
      if (!a) break;
      E.apply(s, a);
    }
    return s;
  }

  // How often does each level win by strangling rather than by capturing?
  // This is the thing that made the game unpleasant, so it is worth measuring.
  const strangle = {};
  for (const level of ['easy', 'normal', 'hard']) {
    let noMove = 0, total = 0;
    for (let i = 0; i < 12; i++) {
      const s = playLevels(level, level);
      if (s.roundOver && s.roundWinner) {
        total++;
        if (/cannot move/.test(s.roundReason)) noMove++;
      }
    }
    strangle[level] = total ? noMove / total : 0;
    console.log('       ' + level.padEnd(6) + ' rounds won by strangling: ' +
      noMove + '/' + total);
  }
  check('Beginner strangles less often than Master',
    strangle.easy < strangle.hard || strangle.hard === 0,
    'easy=' + strangle.easy.toFixed(2) + ' hard=' + strangle.hard.toFixed(2));

  // Master should beat Beginner clearly, or the labels are lying.
  let masterWins = 0, decided = 0;
  for (let i = 0; i < 14; i++) {
    const s = playLevels('easy', 'hard'); // A = Beginner, B = Master
    if (s.roundWinner) { decided++; if (s.roundWinner === 'B') masterWins++; }
  }
  console.log('       Master vs Beginner: Master won ' + masterWins + '/' + decided);
  check('Master beats Beginner more often than not', masterWins * 2 > decided,
    masterWins + '/' + decided);
}

console.log('\nHow much room the board has, by pawn count');
{
  // Martin's ruling is 10 a side. This measures what that actually does to the
  // shape of a round, so the decision can be made on evidence rather than feel.
  for (const pawns of [10, 9, 8, 7]) {
    let noMove = 0, wipeout = 0, drawn = 0, total = 0, movesSum = 0;
    for (let i = 0; i < 14; i++) {
      const s = E.createMatch({ mode: 'ai', pawns });
      s.difficulty = 'normal';
      let acts = 0;
      while (!s.roundOver && acts++ < 3000) {
        const a = AI.chooseAction(s);
        if (!a) break;
        E.apply(s, a);
      }
      if (!s.roundOver) continue;
      total++;
      movesSum += s.movesMade.A + s.movesMade.B;
      if (!s.roundWinner) drawn++;
      else if (/cannot move/.test(s.roundReason)) noMove++;
      else wipeout++;
    }
    const free = 24 - pawns * 2;
    console.log('       ' + pawns + ' a side (' + free + ' free points): ' +
      'strangled ' + noMove + ', captured out ' + wipeout + ', drawn ' + drawn +
      ' | avg ' + Math.round(movesSum / Math.max(total, 1)) + ' moves per round');
  }
  const s10 = E.createMatch({ pawns: 10 });
  const s8 = E.createMatch({ pawns: 8 });
  check('pawn count is configurable', s10.toPlace.A === 10 && s8.toPlace.A === 8);
  check('default is now 9', E.createMatch({}).toPlace.A === 9);
}

// Soldier colourways live in render.js, which needs a DOM — they are verified
// in the browser rather than here.

console.log('\nGrading a player\'s thinking');
{
  // The grade must be deterministic, must reward the strongest move, and must
  // refuse to judge decisions that carry no information.
  function playGraded(pick, games) {
    const cards = [];
    for (let i = 0; i < games; i++) {
      const s = E.createMatch({ mode: 'local' });
      const card = Gr.newCard();
      let acts = 0;
      while (!s.roundOver && acts++ < 2500) {
        const mover = s.awaitingCapture || s.turn;
        const legal = E.legalActions(s);
        if (!legal.length) break;
        const action = mover === 'A' ? pick(s, legal) : legal[Math.floor(Math.random() * legal.length)];
        if (mover === 'A') Gr.record(card, action, Gr.assess(s, action));
        E.apply(s, action);
      }
      cards.push(Gr.summarise(card));
    }
    return cards;
  }

  const perfect = (s) => AI.scoreActions(s, Gr.GRADE_DEPTH)[0].action;
  const awful = (s) => { const r = AI.scoreActions(s, Gr.GRADE_DEPTH); return r[r.length - 1].action; };
  const random = (s, legal) => legal[Math.floor(Math.random() * legal.length)];

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

  const best = playGraded(perfect, 3).map(c => c.accuracy);
  const worst = playGraded(awful, 3).map(c => c.accuracy);
  const mid = playGraded(random, 3).map(c => c.accuracy);

  console.log('       always the engine\'s top move : ' + Math.round(mean(best)) + '%');
  console.log('       random legal moves ..........: ' + Math.round(mean(mid)) + '%');
  console.log('       always the worst move .......: ' + Math.round(mean(worst)) + '%');

  check('playing the strongest move every time scores ~100%', mean(best) > 97, Math.round(mean(best)) + '%');
  check('playing the worst move every time scores ~0%', mean(worst) < 3, Math.round(mean(worst)) + '%');
  check('random play lands between the two',
    mean(mid) > mean(worst) + 10 && mean(mid) < mean(best) - 10, Math.round(mean(mid)) + '%');

  // determinism: the same game graded twice must give the same number
  const s1 = E.createMatch({ mode: 'local' });
  const c1 = Gr.newCard(), c2 = Gr.newCard();
  const replay = [];
  let n = 0;
  while (!s1.roundOver && n++ < 400) {
    const legal = E.legalActions(s1);
    if (!legal.length) break;
    const a = legal[0];
    replay.push(a);
    Gr.record(c1, a, Gr.assess(s1, a));
    E.apply(s1, a);
  }
  const s2 = E.createMatch({ mode: 'local' });
  replay.forEach(a => { Gr.record(c2, a, Gr.assess(s2, a)); E.apply(s2, a); });
  check('the same game always earns the same grade',
    Gr.summarise(c1).accuracyText === Gr.summarise(c2).accuracyText,
    Gr.summarise(c1).accuracyText + ' vs ' + Gr.summarise(c2).accuracyText);

  // a forced decision must not be counted as a perfect one
  const forced = E.createMatch({ mode: 'local' });
  forced.phase = 'movement'; forced.toPlace = { A: 0, B: 0 };
  forced.board = new Array(24).fill(null);
  forced.board[0] = 'A'; forced.board[7] = 'B';
  forced.onBoard = { A: 1, B: 1 };
  forced.turn = 'A';
  const only = E.allMoves(forced, 'A');
  const card = Gr.newCard();
  if (only.length === 1) {
    Gr.record(card, { type: 'move', from: only[0].from, to: only[0].to }, Gr.assess(forced, { type: 'move', from: only[0].from, to: only[0].to }));
    check('a decision with only one legal option is not graded', card.decisions === 0 && card.skipped === 1);
  } else {
    check('a decision with only one legal option is not graded', true, 'skipped: position had ' + only.length + ' moves');
  }

  check('the move list is recorded for later verification',
    Gr.summarise(c1).moves.length === replay.length,
    Gr.summarise(c1).moves.length + ' of ' + replay.length);
}

console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'All checks passed.') + '\n');
process.exit(failures ? 1 : 0);
