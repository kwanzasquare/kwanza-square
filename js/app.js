/* Kwanza Square — screens, input, AI turns, tutorial, scoreboard. */
(function (KZ) {
  'use strict';

  var G = KZ.Geometry, E = KZ.Engine, AI = KZ.AI, R = KZ.Render, Gr = KZ.Grade;

  var cards = null;        // grading cards, one per side, for the current match

  var state = null;        // current match
  var view = null;         // built board
  var history = [];        // snapshots for Undo
  var selected = null;     // chosen soldier (movement phase)
  var staged = null;       // {type:'move',from,to} | {type:'capture',node} when confirm is on
  var thinking = false;    // AI is choosing
  var flashTimer = null;

  var settings = {
    sound: true,
    confirm: false,
    difficulty: 'normal',
    mode: 'ai',
    opponent: 'jade',    // colourway for the second side; gold is fixed
    pawns: 9,            // Martin's revised ruling
    roundsToWin: 2,      // 2 = best of three · 1 = single-round Quick Match
    v: 2                 // settings version, for one-time migrations
  };

  var PAWNS_HINT = {
    10: '10 leaves only 4 free intersections, so rounds are nearly always decided by trapping rather than by capturing. This was the original count.',
    9: '9 is the standard game. Six free intersections give the board room to breathe, and trios decide rounds instead of just decorating them.',
    8: '8 leaves 8 free intersections — the most open game, with the most room to manoeuvre.'
  };

  // ------------------------------------------------------------------ helpers

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function loadSettings() {
    try {
      var raw = localStorage.getItem('kwanza-settings');
      if (raw) {
        var saved = JSON.parse(raw);
        Object.assign(settings, saved);
        // The soldier count changed from 10 to 9. Anyone carrying the old
        // default should get the new one; a deliberate 8 is left alone.
        if (saved.v !== 2) {
          if (!saved.pawns || saved.pawns === 10) settings.pawns = 9;
          settings.v = 2;
        }
      }
      // saved settings from before the colour picker existed have no opponent
      if (!R.SOLDIERS[settings.opponent]) settings.opponent = 'jade';
    } catch (e) { /* private mode — defaults are fine */ }
  }
  function saveSettings() {
    try { localStorage.setItem('kwanza-settings', JSON.stringify(settings)); } catch (e) {}
  }

  // tiny generated sounds — no audio files
  var audioCtx = null;
  function tone(freq, dur, type, gain) {
    if (!settings.sound) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  var sfx = {
    place:   function () { tone(320, 0.12, 'triangle'); },
    select:  function () { tone(520, 0.07, 'sine', 0.04); },
    move:    function () { tone(400, 0.1, 'triangle'); },
    trio:    function () { tone(660, 0.16, 'sine', 0.07); setTimeout(function () { tone(880, 0.2, 'sine', 0.06); }, 110); },
    capture: function () { tone(180, 0.24, 'sawtooth', 0.05); },
    deny:    function () { tone(120, 0.16, 'square', 0.04); },
    win:     function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { setTimeout(function () { tone(f, 0.30, 'sine', 0.06); }, i * 120); }); },
    roundWin: function () { [659, 880].forEach(function (f, i) { setTimeout(function () { tone(f, 0.20, 'sine', 0.06); }, i * 110); }); },
    defeat:  function () { [330, 262, 196].forEach(function (f, i) { setTimeout(function () { tone(f, 0.34, 'triangle', 0.045); }, i * 150); }); }
  };

  function showScreen(id) {
    $all('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
  }

  function humanSide() { return state.mode === 'ai' ? (state.aiSide === 'A' ? 'B' : 'A') : state.turn; }
  function isHumanTurn() {
    if (state.mode !== 'ai') return true;
    var mover = state.awaitingCapture || state.turn;
    return mover !== state.aiSide;
  }

  function flash(text, ms) {
    var p = $('#prompt-text');
    p.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(render, ms || 1400);
  }

  // --------------------------------------------------------------- view model

  function buildViewModel() {
    var vm = {
      board: state.board,
      legal: new Set(),
      forbidden: new Set(),
      capturable: new Set(),
      selected: selected,
      staged: staged ? (staged.type === 'move' ? staged.to : staged.node) : null,
      trios: state.activeTrios,      // standing — drawn quietly
      scored: state.scoredTrios,     // just formed — glows, a capture is due
      lastMove: state.lastMove[E.other(state.turn)] || null
    };

    if (state.roundOver || state.matchOver || !isHumanTurn()) return vm;

    if (state.awaitingCapture) {
      E.capturableNodes(state, state.awaitingCapture).forEach(function (n) { vm.capturable.add(n); });
    } else if (state.phase === 'placement') {
      // Every free intersection is playable, so highlighting them all is noise.
      // Mark only the ones the no-trio rule closes off.
      var open = new Set(E.legalPlacements(state));
      for (var n = 0; n < G.NODE_COUNT; n++) {
        if (state.board[n] === null && !open.has(n)) vm.forbidden.add(n);
      }
    } else if (selected !== null) {
      E.legalMovesFrom(state, selected).forEach(function (n) { vm.legal.add(n); });
    } else {
      // nothing selected: highlight the soldiers that actually have somewhere to go
      E.allMoves(state, state.turn).forEach(function (m) { vm.legal.add(m.from); });
    }
    return vm;
  }

  // ------------------------------------------------------------------ actions

  function pushHistory() {
    history.push(E.clone(state));
    if (history.length > 240) history.shift();
  }

  function applyAction(action) {
    pushHistory();
    // judge the decision against every alternative BEFORE it is played
    var mover = state.awaitingCapture || state.turn;
    if (cards && cards[mover]) Gr.record(cards[mover], action, Gr.assess(state, action));
    var events = E.apply(state, action);
    handleEvents(events);
    selected = null;
    staged = null;
    render();
    scheduleAI();
    return events;
  }

  function handleEvents(events) {
    events.forEach(function (ev) {
      if (ev.type === 'place') sfx.place();
      if (ev.type === 'move') sfx.move();
      if (ev.type === 'trio') { sfx.trio(); if (cards && cards[ev.player]) cards[ev.player].trios++; }
      if (ev.type === 'capture') {
        sfx.capture(); R.burst(view, ev.node, ev.player);
        if (cards && cards[ev.player]) cards[ev.player].captures++;
        if (cards && cards[ev.victim]) cards[ev.victim].lost++;
      }
      if (ev.type === 'round-over') setTimeout(showRoundResult, 620);
    });
  }

  function onPick(nodeId) {
    if (!state || state.roundOver || state.matchOver || thinking || !isHumanTurn()) return;

    // capture step
    if (state.awaitingCapture) {
      if (state.board[nodeId] !== E.other(state.awaitingCapture)) {
        if (state.board[nodeId]) flash('Take one of your opponent’s soldiers.');
        return;
      }
      if (settings.confirm) {
        staged = { type: 'capture', node: nodeId };
        sfx.select();
        render();
      } else {
        applyAction({ type: 'capture', node: nodeId });
      }
      return;
    }

    // placement phase
    if (state.phase === 'placement') {
      if (state.board[nodeId] !== null) { flash('That intersection is taken.'); sfx.deny(); return; }
      if (E.placementFormsTrio(state.board, nodeId, state.turn) &&
          E.legalPlacements(state).indexOf(nodeId) === -1) {
        flash('No trios during placement — choose another intersection.');
        sfx.deny();
        return;
      }
      applyAction({ type: 'place', node: nodeId });
      return;
    }

    // movement phase
    if (state.board[nodeId] === state.turn) {
      if (selected === nodeId) { selected = null; staged = null; }
      else {
        if (E.legalMovesFrom(state, nodeId).length === 0) {
          flash('That soldier has nowhere to go.');
          sfx.deny();
          return;
        }
        selected = nodeId;
        staged = null;
        sfx.select();
      }
      render();
      return;
    }

    if (selected !== null && state.board[nodeId] === null) {
      if (E.legalMovesFrom(state, selected).indexOf(nodeId) === -1) {
        var adjacent = G.adjacency[selected].indexOf(nodeId) !== -1;
        flash(adjacent ? 'No back-and-forth — that undoes your last move.'
                       : 'Only one step, straight along a line.');
        sfx.deny();
        return;
      }
      if (settings.confirm) {
        staged = { type: 'move', from: selected, to: nodeId };
        sfx.select();
        render();
      } else {
        applyAction({ type: 'move', from: selected, to: nodeId });
      }
      return;
    }

    if (state.board[nodeId] !== null) flash('That is not your soldier.');
  }

  function confirmStaged() {
    if (!staged) return;
    applyAction(staged.type === 'move'
      ? { type: 'move', from: staged.from, to: staged.to }
      : { type: 'capture', node: staged.node });
  }

  function undo() {
    if (!history.length || thinking) return;
    if (state.mode === 'ai') {
      // step back past the AI's reply to the player's own turn
      var guard = 0;
      while (history.length && guard++ < 40) {
        state = history.pop();
        var mover = state.awaitingCapture || state.turn;
        if (mover !== state.aiSide && !state.roundOver && !state.matchOver) break;
      }
    } else {
      state = history.pop();
    }
    selected = null;
    staged = null;
    closeModal();
    render();
  }

  // --------------------------------------------------------------------- AI

  function scheduleAI() {
    if (!state || state.mode !== 'ai') return;
    if (state.roundOver || state.matchOver) return;
    var mover = state.awaitingCapture || state.turn;
    if (mover !== state.aiSide) return;

    thinking = true;
    render();
    // The search itself is near-instant, which made the AI feel like it was
    // slapping pieces down. Pace it so a move reads as considered.
    var base = state.phase === 'placement' ? 620 : 900;
    if (state.difficulty === 'hard') base += 260;      // the Master "thinks" longer
    if (state.awaitingCapture) base += 320;            // a capture deserves a beat
    var delay = base + Math.random() * 420;
    setTimeout(function () {
      if (!state || state.roundOver || state.matchOver) { thinking = false; render(); return; }
      var action = AI.chooseAction(state);
      thinking = false;
      if (!action) { render(); return; }
      pushHistory();
      var aiMover = state.awaitingCapture || state.turn;
      if (cards && cards[aiMover]) Gr.record(cards[aiMover], action, Gr.assess(state, action));
      handleEvents(E.apply(state, action));
      render();
      scheduleAI();
    }, delay);
  }

  // ----------------------------------------------------------------- rendering

  function playerName(side) {
    if (state.mode === 'ai' && side === state.aiSide) return 'Kwanza AI';
    return side === 'A' ? 'Gold' : R.SOLDIERS[settings.opponent].label;
  }

  function render() {
    if (!state) return;
    R.update(view, buildViewModel());

    $('#name-a').textContent = playerName('A');
    $('#name-b').textContent = playerName('B');
    $('#chip-a').style.background = R.chipStyle('gold');
    $('#chip-b').style.background = R.chipStyle(settings.opponent);
    $('#score-value').textContent = state.scores.A + ' – ' + state.scores.B;
    $('#score-round').textContent = state.roundsToWin === 1
      ? 'Quick match · one round'
      : 'Round ' + state.round + ' · best of 3';

    var pawnsA = state.phase === 'placement'
      ? state.toPlace.A + ' to place'
      : state.onBoard.A + ' on board';
    var pawnsB = state.phase === 'placement'
      ? state.toPlace.B + ' to place'
      : state.onBoard.B + ' on board';
    $('#pawns-a').textContent = pawnsA;
    $('#pawns-b').textContent = pawnsB;

    var mover = state.awaitingCapture || state.turn;
    $('#side-a').classList.toggle('active-turn', mover === 'A' && !state.roundOver);
    $('#side-b').classList.toggle('active-turn', mover === 'B' && !state.roundOver);

    // prompt
    var prompt = $('#prompt');
    var tag = $('#prompt-tag');
    var text = $('#prompt-text');
    prompt.classList.remove('capture', 'thinking');

    if (state.matchOver) {
      tag.textContent = 'Match';
      text.textContent = playerName(state.matchWinner) + ' wins the match.';
    } else if (state.roundOver) {
      tag.textContent = 'Round';
      text.textContent = state.roundWinner
        ? playerName(state.roundWinner) + ' takes round ' + state.round + '.'
        : 'Round ' + state.round + ' is drawn.';
    } else if (thinking && state.awaitingCapture) {
      // say plainly what is happening, rather than a bare "Thinking…"
      prompt.classList.add('capture');
      tag.textContent = 'Capture';
      text.textContent = 'Kwanza AI scored a trio — taking one of your soldiers.';
    } else if (thinking) {
      prompt.classList.add('thinking');
      tag.textContent = 'Kwanza AI';
      text.textContent = 'Thinking…';
    } else if (state.awaitingCapture) {
      prompt.classList.add('capture');
      tag.textContent = 'Capture';
      text.textContent = playerName(state.awaitingCapture) + ' scored — remove any enemy soldier.';
    } else if (state.phase === 'placement') {
      tag.textContent = 'Place';
      text.textContent = playerName(state.turn) + ': place a soldier (' + state.toPlace[state.turn] + ' left).';
    } else {
      tag.textContent = 'Move';
      text.textContent = selected === null
        ? playerName(state.turn) + ': choose a soldier.'
        : 'Step to a glowing intersection.';
    }

    pushToTv();

    $('#btn-undo').disabled = !history.length || thinking || state.matchOver;
    var confirmBtn = $('#btn-confirm');
    confirmBtn.hidden = !settings.confirm;
    confirmBtn.disabled = !staged;
  }

  // -------------------------------------------------------------------- modals

  function openModal(html, actions, mood) {
    var body = $('#modal-body');
    var card = $('#modal-backdrop').querySelector('.modal');
    card.classList.remove('won', 'lost');
    if (mood) card.classList.add(mood);
    body.innerHTML = html;
    var bar = $('#modal-actions');
    bar.innerHTML = '';
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'btn-ghost');
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      bar.appendChild(b);
    });
    $('#modal-backdrop').classList.add('open');
  }
  function closeModal() { $('#modal-backdrop').classList.remove('open'); }

  function showRoundResult() {
    // Whose victory is it, from the player's point of view? Against the AI that
    // is the human side; with two people on one phone somebody in the room won
    // either way, so it is always a celebration.
    var me = state.mode === 'ai' ? (state.aiSide === 'A' ? 'B' : 'A') : null;
    var winner = state.matchOver ? state.matchWinner : state.roundWinner;
    var playerWon = !me || winner === me;
    var mood = !winner ? null : (playerWon ? 'won' : 'lost');

    if (state.matchOver) {
      if (cards && cards[me || 'A']) {
        var card = Gr.summarise(cards[me || 'A']);
        Gr.commitMatch({ won: winner === (me || 'A'), drawn: !winner, accuracy: card.accuracy });
      }
      if (playerWon && winner) { sfx.win(); KZ.Celebrate.win(true); }
      else if (winner) { sfx.defeat(); KZ.Celebrate.defeat(); }
      renderScoreboard(mood);
      showScreen('screen-scoreboard');
      return;
    }

    if (winner && playerWon) { sfx.roundWin(); KZ.Celebrate.win(false); }
    else if (winner) { sfx.defeat(); KZ.Celebrate.defeat(); }

    var title = winner
      ? (playerWon && me ? 'You take round ' + state.round : playerName(winner) + ' takes round ' + state.round)
      : 'Round ' + state.round + ' is drawn';

    var grade = '';
    var side = me;
    if (side && cards[side] && cards[side].decisions >= 4) {
      var g = Gr.summarise(cards[side]);
      grade = '<div class="result-grade">Your play so far: <b>' + g.accuracyText +
        '</b> accuracy · grade <b>' + g.grade + '</b></div>';
    }

    openModal(
      '<div class="result-head">' +
        '<svg class="result-crest" id="round-crest" aria-hidden="true"></svg>' +
        '<div class="result-title">' + title + '</div>' +
        '<p class="result-reason">' + state.roundReason + '</p>' +
        '<div class="result-tally">' + state.scores.A + ' – ' + state.scores.B + '</div>' +
        grade +
      '</div>',
      [{
        label: 'Next round', cls: playerWon ? 'btn-gold' : 'btn-primary', onClick: function () {
          closeModal();
          KZ.Celebrate.stop();
          E.nextRound(state);
          history = [];
          selected = null; staged = null;
          render();
          scheduleAI();
        }
      }],
      mood
    );
    R.crest($('#round-crest'));
  }

  function rulesHtml() {
    var n = settings.pawns;
    return '<div class="modal-body">' +
    '<h3>The board</h3><ul>' +
    '<li>Three concentric squares — Territory, Strategy, Mastery.</li>' +
    '<li>24 playable intersections, eight on each square.</li>' +
    '<li>Four radial connectors join the squares at north, east, south and west.</li>' +
    '<li>The centre is sacred and can never be played.</li>' +
    '</ul>' +
    '<h3>Phase 1 — placement</h3><ul>' +
    '<li>Each side has ' + n + ' soldiers, placed one at a time.</li>' +
    '<li>One soldier per intersection.</li>' +
    '<li>A placement that would complete a trio is not allowed — choose another intersection.</li>' +
    '<li>Nothing scores in this phase.</li>' +
    '</ul>' +
    '<h3>Phase 2 — movement</h3><ul>' +
    '<li>Move one step along a line to an adjacent free intersection.</li>' +
    '<li>Vertical and horizontal only. Never diagonal, never skipping.</li>' +
    '<li>You may not immediately move back where you came from.</li>' +
    '</ul>' +
    '<h3>Scoring and capture</h3><ul>' +
    '<li>Three of your soldiers in a straight line is a trio. Diagonals never count.</li>' +
    '<li>A trio lets you remove any one enemy soldier — including one standing inside a trio.</li>' +
    '</ul>' +
    '<h3>Winning</h3><ul>' +
    '<li>A round ends when a side has no soldiers left, or cannot move.</li>' +
    '<li>' + (settings.roundsToWin === 1
      ? 'This is a quick match — one round decides it.'
      : 'The match is best of three.') + '</li>' +
    '</ul></div>';
  }

  function showRules() {
    openModal('<h2>Rules of Kwanza Square</h2>' + rulesHtml(),
      [{ label: 'Close', cls: 'btn-gold', onClick: closeModal }]);
  }

  function confirmQuit() {
    openModal('<h2>Leave the match?</h2><div class="modal-body"><p>The current match will be lost.</p></div>', [
      { label: 'Stay', onClick: closeModal },
      { label: 'Leave', cls: 'btn-danger', onClick: function () { closeModal(); showScreen('screen-home'); } }
    ]);
  }

  // ---------------------------------------------------------------- scoreboard

  function gradeCardHtml(side, label) {
    var card = cards && cards[side];
    if (!card) return '';
    var s = Gr.summarise(card);
    if (!s.decisions) return '';
    return '' +
      '<div class="grade-block">' +
        '<div class="grade-head">' +
          '<div>' +
            '<div class="eyebrow">' + label + '</div>' +
            '<div class="grade-accuracy">' + s.accuracyText + '<span> accuracy</span></div>' +
          '</div>' +
          '<div class="grade-letter">' + s.grade + '</div>' +
        '</div>' +
        '<p class="grade-note">' + s.note + '</p>' +
        '<div class="grade-stats">' +
          '<span><b>' + s.bestRate + '%</b>strongest move</span>' +
          '<span><b>' + s.decisions + '</b>real decisions</span>' +
          '<span><b>' + s.blunders + '</b>blunders</span>' +
          '<span><b>' + s.trios + '</b>trios scored</span>' +
          '<span><b>' + s.captures + '</b>prisoners taken</span>' +
          '<span><b>' + s.lost + '</b>soldiers lost</span>' +
        '</div>' +
      '</div>';
  }

  function recordHtml() {
    var rec = Gr.loadRecord();
    if (!rec.played) return '';
    var avg = Gr.averageAccuracy(rec);
    return '' +
      '<div class="grade-stats record-stats">' +
        '<span><b>' + rec.played + '</b>matches</span>' +
        '<span><b>' + rec.won + '</b>won</span>' +
        '<span><b>' + rec.lost + '</b>lost</span>' +
        '<span><b>' + (avg === null ? '—' : Math.round(avg) + '%') + '</b>average</span>' +
        '<span><b>' + (rec.bestAccuracy === null ? '—' : Math.round(rec.bestAccuracy) + '%') + '</b>best ever</span>' +
        '<span><b>' + rec.bestStreak + '</b>best streak</span>' +
      '</div>';
  }

  function renderScoreboard(mood) {
    var panel = $('#screen-scoreboard').querySelector('.panel');
    panel.classList.remove('won', 'lost');
    if (mood) panel.classList.add(mood);
    $('#final-line').textContent = state.matchWinner
      ? playerName(state.matchWinner) + ' wins the match'
      : 'Match complete';
    $('#final-score').textContent = state.scores.A + ' – ' + state.scores.B;
    var pills = $('#round-pills');
    pills.innerHTML = '';
    state.roundHistory.forEach(function (r) {
      var span = document.createElement('span');
      span.className = 'pill ' + (r.winner === 'A' ? 'win-a' : r.winner === 'B' ? 'win-b' : 'draw');
      span.textContent = 'R' + r.round + ' · ' + (r.winner ? playerName(r.winner) : 'Draw');
      span.title = r.reason;
      pills.appendChild(span);
    });
    var log = $('#final-reasons');
    log.innerHTML = state.roundHistory.map(function (r) {
      return '<li>Round ' + r.round + ': ' + r.reason + '</li>';
    }).join('');
    R.emblem($('#final-emblem'));

    // How well you played, win or lose.
    var grades = '';
    if (state.mode === 'ai') {
      grades = gradeCardHtml(state.aiSide === 'A' ? 'B' : 'A', 'How you played');
    } else {
      grades = gradeCardHtml('A', playerName('A') + ' — how they played') +
               gradeCardHtml('B', playerName('B') + ' — how they played');
    }
    $('#grade-panel').innerHTML = grades;
    $('#grade-panel').hidden = !grades;

    var rec = recordHtml();
    $('#record-panel').innerHTML = rec ? '<h2>Your record</h2>' + rec : '';
    $('#record-panel').hidden = !rec;
  }

  // ------------------------------------------------------------------ tutorial

  var tutorialSteps = [
    {
      title: 'The three squares',
      text: 'Kwanza Square is played on three concentric squares — Territory, Strategy and Mastery — with eight intersections each. That is 24 playable points. The medallion at the heart of the board is sacred: no soldier ever stands there.',
      vm: function () { return { board: new Array(24).fill(null) }; }
    },
    {
      title: 'The four connectors',
      text: 'Four radial connectors join the squares at north, east, south and west. They are the only way to travel between rings, which makes those four midpoints the most valuable ground on the board.',
      vm: function () {
        var b = new Array(24).fill(null);
        b[9] = 'A';
        return { board: b, selected: 9, legal: new Set([1, 17, 8, 10]) };
      }
    },
    {
      title: 'Phase 1 — placement',
      text: 'Each side places {n} soldiers, one at a time, one per intersection. A placement that would complete a trio is refused — you must choose somewhere else. Nothing scores during placement.',
      vm: function () {
        var b = new Array(24).fill(null);
        b[0] = 'A'; b[1] = 'A'; b[8] = 'B'; b[3] = 'B'; b[16] = 'B'; b[5] = 'A';
        return { board: b, capturable: new Set([2]) };
      }
    },
    {
      title: 'Phase 2 — movement',
      text: 'Once all {n2} soldiers are down, you move one step along a line to an adjacent free point. Vertical and horizontal only — never diagonal, never skipping — and you may not immediately step back where you came from.',
      vm: function () {
        var b = new Array(24).fill(null);
        b[3] = 'A'; b[8] = 'B'; b[5] = 'B'; b[16] = 'A';
        return { board: b, selected: 3, legal: new Set([2, 4, 11]) };
      }
    },
    {
      title: 'Trios score',
      text: 'Three of your soldiers in a straight line is a trio. It may run along an edge of any square, or straight down a radial connector. A diagonal is never a trio.',
      vm: function () {
        var b = new Array(24).fill(null);
        b[8] = 'A'; b[9] = 'A'; b[10] = 'A'; b[17] = 'B'; b[20] = 'B';
        return { board: b, trios: [{ trio: G.trios.findIndex(function (t) { return t[0] === 8 && t[1] === 9 && t[2] === 10; }), player: 'A' }] };
      }
    },
    {
      title: 'Capture, and the match',
      text: 'Every trio you complete lets you remove one enemy soldier — any one you like, including a soldier standing inside a trio of its own. A round ends when a side has no soldiers left or cannot move. First to two rounds takes the match.',
      vm: function () {
        var b = new Array(24).fill(null);
        b[8] = 'A'; b[9] = 'A'; b[10] = 'A'; b[17] = 'B'; b[20] = 'B'; b[1] = 'B';
        return { board: b, capturable: new Set([17, 20, 1]) };
      }
    }
  ];

  var tutorialIndex = 0;
  var tutorialView = null;

  function renderTutorial() {
    var step = tutorialSteps[tutorialIndex];
    if (!tutorialView) tutorialView = R.build($('#tutorial-board'), null);
    if (tutorialView.soldier.B !== settings.opponent) {
      R.setSoldiers(tutorialView, { A: 'gold', B: settings.opponent });
    }
    var vm = step.vm();
    vm.board = vm.board || new Array(24).fill(null);
    R.update(tutorialView, vm);
    $('#tutorial-title').textContent = step.title;
    $('#tutorial-text').textContent = step.text
      .replace(/\{n\}/g, settings.pawns)
      .replace(/\{n2\}/g, settings.pawns * 2);
    $('#tutorial-prev').disabled = tutorialIndex === 0;
    $('#tutorial-next').textContent = tutorialIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next';
    var dots = $('#tutorial-dots');
    dots.innerHTML = '';
    tutorialSteps.forEach(function (_, i) {
      var d = document.createElement('span');
      d.className = 'dot' + (i === tutorialIndex ? ' on' : '');
      dots.appendChild(d);
    });
  }

  // ------------------------------------------------------ the big screen (TV)
  //
  // A web page cannot mirror a phone's screen by itself — that is an operating
  // system capability and no site is allowed to trigger it. What a page CAN do
  // is ask a nearby Cast device to open a copy of itself and then drive it.
  //
  // So the television runs the same page with ?tv=1, which turns it into a
  // display: no menus, no taps, just the board. Every move made on the phone is
  // pushed across. Where Presentation isn't supported (Safari, iOS) we explain
  // AirPlay or Smart View instead of pretending.

  var tvConnection = null;
  var tvView = null;

  function isTvReceiver() {
    return /[?&]tv=1/.test(location.search) ||
      !!(navigator.presentation && navigator.presentation.receiver);
  }

  function initTvReceiver() {
    showScreen('screen-tv');
    tvView = R.build($('#tv-board'), null);
    R.update(tvView, { board: new Array(24).fill(null) });
    // A seam so the display can be exercised without a Cast device in the room.
    KZ.TvDisplay = { paint: paintTv };

    if (navigator.presentation && navigator.presentation.receiver) {
      navigator.presentation.receiver.connectionList.then(function (list) {
        list.connections.forEach(listen);
        list.addEventListener('connectionavailable', function (ev) { listen(ev.connection); });
      });
    }
    function listen(conn) {
      conn.addEventListener('message', function (ev) {
        try { paintTv(JSON.parse(ev.data)); } catch (e) {}
      });
    }
  }

  function paintTv(m) {
    if (!tvView) return;
    if (tvView.soldier.B !== m.colour) R.setSoldiers(tvView, { A: 'gold', B: m.colour });
    R.update(tvView, {
      board: m.board, trios: m.trios, scored: m.scored, lastMove: m.lastMove
    });
    $('#tv-name-a').textContent = m.nameA;
    $('#tv-name-b').textContent = m.nameB;
    $('#tv-score').textContent = m.score;
    $('#tv-prompt').textContent = m.prompt;
    $('#tv-chip-a').style.background = R.chipStyle('gold');
    $('#tv-chip-b').style.background = R.chipStyle(m.colour);
  }

  /** Push the current position to the television, if one is connected. */
  function pushToTv() {
    if (!tvConnection || !state) return;
    try {
      tvConnection.send(JSON.stringify({
        board: state.board,
        trios: state.activeTrios,
        scored: state.scoredTrios,
        lastMove: state.lastMove[E.other(state.turn)] || null,
        colour: settings.opponent,
        nameA: playerName('A'),
        nameB: playerName('B'),
        score: state.scores.A + ' – ' + state.scores.B,
        prompt: $('#prompt-text').textContent
      }));
    } catch (e) { /* the set was switched off, or the connection dropped */ }
  }

  function connectTv() {
    if (!window.PresentationRequest) return castHelp();
    var url = location.pathname + (location.search ? location.search + '&' : '?') + 'tv=1';
    var request;
    try { request = new PresentationRequest([url]); } catch (e) { return castHelp(); }

    request.start().then(function (conn) {
      tvConnection = conn;
      conn.addEventListener('close', function () { tvConnection = null; });
      conn.addEventListener('terminate', function () { tvConnection = null; });
      conn.addEventListener('connect', pushToTv);
      setTimeout(pushToTv, 1200);
      openModal('<h2>Connected to the television</h2><div class="modal-body">' +
        '<p>The board is on the big screen. Keep playing on this phone — every move appears there.</p></div>',
        [{ label: 'Good', cls: 'btn-gold', onClick: closeModal }]);
    }).catch(function () {
      castHelp();
    });
  }

  function castHelp() {
    openModal('<h2>Putting the game on your television</h2><div class="modal-body">' +
      '<p>This phone can\'t hand the game to a TV by itself — only the phone\'s own screen-sharing can do that. It takes one step:</p>' +
      '<h3>Android</h3><p>Swipe down and tap <strong>Smart View</strong> or <strong>Cast</strong>, then choose your television.</p>' +
      '<h3>iPhone / iPad</h3><p>Swipe down and tap <strong>Screen Mirroring</strong>, then choose your Apple TV.</p>' +
      '<h3>A smart TV with a web browser</h3><p>Open <strong>kwanzasquare.com</strong> on the television itself and play from the sofa.</p>' +
      '<p>Once mirroring is on, the board fills the screen on its own.</p></div>',
      [{ label: 'Close', cls: 'btn-gold', onClick: closeModal }]);
  }

  // ---------------------------------------------------------------- match setup

  function startMatch() {
    state = E.createMatch({
      mode: settings.mode,
      aiSide: 'B',
      difficulty: settings.difficulty,
      pawns: settings.pawns,
      roundsToWin: settings.roundsToWin
    });
    history = [];
    selected = null;
    staged = null;
    thinking = false;
    // Grade the human side(s) only — judging the AI against itself costs time
    // and tells nobody anything.
    cards = {};
    if (settings.mode === 'ai') cards[state.aiSide === 'A' ? 'B' : 'A'] = Gr.newCard();
    else { cards.A = Gr.newCard(); cards.B = Gr.newCard(); }
    if (!view) view = R.build($('#board'), onPick);
    if (view.soldier.B !== settings.opponent) R.setSoldiers(view, { A: 'gold', B: settings.opponent });
    // Do NOT reset view.owners here: it is the record of what is actually drawn.
    // Clearing it would make the empty new board diff as "no change" and leave
    // the previous match's soldiers on screen. render() diffs it correctly.
    showScreen('screen-game');
    render();
    scheduleAI();
  }

  // ---------------------------------------------------------------------- wire

  var DIFFICULTY_HINT = {
    easy: 'Beginner never plays to trap you. It chases its own trios, blocks yours only half-heartedly, and makes ordinary mistakes.',
    normal: 'Skilled looks two moves ahead and will take a good block when it sees one — but it does not hunt for the strangle.',
    hard: 'Master looks four moves ahead and will deliberately close off your last free step to win on “cannot move”. Genuinely hard.'
  };

  function syncModeUI() {
    $all('[data-mode]').forEach(function (btn) {
      btn.setAttribute('aria-checked', String(btn.dataset.mode === settings.mode));
    });
    $('#difficulty-block').hidden = settings.mode !== 'ai';
    $all('[data-difficulty]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.difficulty === settings.difficulty));
    });
    $('#difficulty-hint').textContent = DIFFICULTY_HINT[settings.difficulty] || '';

    $all('[data-opponent]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.opponent === settings.opponent));
      btn.querySelector('.dot').style.background = R.chipStyle(btn.dataset.opponent);
    });
    $('#prev-gold').style.background = R.chipStyle('gold');
    $('#prev-opp').style.background = R.chipStyle(settings.opponent);

    $all('[data-pawns]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.pawns) === settings.pawns));
    });
    $('#pawns-hint').textContent = PAWNS_HINT[settings.pawns] || '';

    $all('[data-rounds]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.rounds) === settings.roundsToWin));
    });
    $('#rounds-hint').textContent = settings.roundsToWin === 1
      ? 'One round decides the match — about 3 to 5 minutes. Best for a first game, or a short break.'
      : 'First to win two rounds, about 8 to 12 minutes. The full game.';
    $all('[data-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(!!settings[btn.dataset.toggle]));
    });
  }

  function init() {
    loadSettings();

    // On the television this page is a display, not a game. Nothing else runs.
    if (isTvReceiver()) { initTvReceiver(); return; }

    R.emblem($('#home-emblem'));

    // home
    $('#btn-play').addEventListener('click', function () { syncModeUI(); showScreen('screen-mode'); });
    $('#btn-tutorial').addEventListener('click', function () {
      tutorialIndex = 0; showScreen('screen-tutorial'); renderTutorial();
    });
    $('#btn-rules-home').addEventListener('click', showRules);
    $('#btn-tv').addEventListener('click', connectTv);

    // mode select
    $all('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.mode = btn.dataset.mode; saveSettings(); syncModeUI();
      });
    });
    $all('[data-difficulty]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.difficulty = btn.dataset.difficulty; saveSettings(); syncModeUI();
      });
    });
    $all('[data-pawns]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.pawns = Number(btn.dataset.pawns);
        saveSettings(); syncModeUI();
      });
    });
    $all('[data-rounds]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.roundsToWin = Number(btn.dataset.rounds);
        saveSettings(); syncModeUI();
      });
    });
    $all('[data-opponent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.opponent = btn.dataset.opponent;
        saveSettings(); syncModeUI();
        // repaint a match already in progress so a colour can be judged live
        if (view && view.soldier.B !== settings.opponent) {
          R.setSoldiers(view, { A: 'gold', B: settings.opponent });
          if (state) render();
        }
      });
    });
    $all('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings[btn.dataset.toggle] = !settings[btn.dataset.toggle];
        saveSettings(); syncModeUI();
        if (state) render();
      });
    });
    $('#btn-start').addEventListener('click', startMatch);
    $('#btn-mode-back').addEventListener('click', function () { showScreen('screen-home'); });

    // tutorial
    $('#tutorial-prev').addEventListener('click', function () {
      if (tutorialIndex > 0) { tutorialIndex--; renderTutorial(); }
    });
    $('#tutorial-next').addEventListener('click', function () {
      if (tutorialIndex < tutorialSteps.length - 1) { tutorialIndex++; renderTutorial(); }
      else showScreen('screen-home');
    });
    $('#tutorial-exit').addEventListener('click', function () { showScreen('screen-home'); });

    // game
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-confirm').addEventListener('click', confirmStaged);
    $('#btn-rules').addEventListener('click', showRules);
    $('#btn-quit').addEventListener('click', confirmQuit);

    // scoreboard
    $('#btn-rematch').addEventListener('click', startMatch);
    $('#btn-scoreboard-home').addEventListener('click', function () { showScreen('screen-home'); });

    $('#modal-backdrop').addEventListener('click', function (ev) {
      if (ev.target === ev.currentTarget) closeModal();
    });

    syncModeUI();
    showScreen('screen-home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.KZ = window.KZ || {});
