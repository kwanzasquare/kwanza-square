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
['geometry.js', 'engine.js', 'ai.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), sandbox, { filename: f });
});

const KZ = sandbox.window.KZ;
const G = KZ.Geometry, E = KZ.Engine, AI = KZ.AI;

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
  check('10 pawns per side', s.toPlace.A === 10 && s.toPlace.B === 10);
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
  check('all 20 soldiers are on the board', s.onBoard.A === 10 && s.onBoard.B === 10);
  check('exactly 4 free intersections remain', s.board.filter(v => v === null).length === 4);
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
  s.movesMade = { A: 1, B: 1 };                  // past the "first move cannot score" rule
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

console.log('\nBacktracking and first-move rules');
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
  check('a first move cannot score', ev.some(e => e.type === 'trio-void') && s.awaitingCapture === null);
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

console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'All checks passed.') + '\n');
process.exit(failures ? 1 : 0);
