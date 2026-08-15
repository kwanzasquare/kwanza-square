/* Kwanza Square — screens, input, AI turns, tutorial, scoreboard. */
(function (KZ) {
  'use strict';

  var G = KZ.Geometry, E = KZ.Engine, AI = KZ.AI, R = KZ.Render;

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
    win:     function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.24, 'sine', 0.06); }, i * 130); }); }
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
      if (ev.type === 'trio') sfx.trio();
      if (ev.type === 'capture') { sfx.capture(); R.burst(view, ev.node, ev.player); }
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
    $('#score-round').textContent = 'Round ' + state.round + ' · best of 3';

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

    $('#btn-undo').disabled = !history.length || thinking || state.matchOver;
    var confirmBtn = $('#btn-confirm');
    confirmBtn.hidden = !settings.confirm;
    confirmBtn.disabled = !staged;
  }

  // -------------------------------------------------------------------- modals

  function openModal(html, actions) {
    var body = $('#modal-body');
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
    if (state.matchOver) {
      sfx.win();
      renderScoreboard();
      showScreen('screen-scoreboard');
      return;
    }
    var winner = state.roundWinner;
    openModal(
      '<h2>' + (winner ? playerName(winner) + ' wins round ' + state.round : 'Round ' + state.round + ' drawn') + '</h2>' +
      '<div class="modal-body"><p>' + state.roundReason + '</p>' +
      '<p><strong>' + state.scores.A + ' – ' + state.scores.B + '</strong> in the match.</p></div>',
      [{
        label: 'Next round', cls: 'btn-primary', onClick: function () {
          closeModal();
          E.nextRound(state);
          history = [];
          selected = null; staged = null;
          render();
          scheduleAI();
        }
      }]
    );
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
    '<li>The match is best of three.</li>' +
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

  function renderScoreboard() {
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

  // ---------------------------------------------------------------- match setup

  function startMatch() {
    state = E.createMatch({
      mode: settings.mode,
      aiSide: 'B',
      difficulty: settings.difficulty,
      pawns: settings.pawns
    });
    history = [];
    selected = null;
    staged = null;
    thinking = false;
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
    $all('[data-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(!!settings[btn.dataset.toggle]));
    });
  }

  function init() {
    loadSettings();
    R.emblem($('#home-emblem'));

    // home
    $('#btn-play').addEventListener('click', function () { syncModeUI(); showScreen('screen-mode'); });
    $('#btn-tutorial').addEventListener('click', function () {
      tutorialIndex = 0; showScreen('screen-tutorial'); renderTutorial();
    });
    $('#btn-rules-home').addEventListener('click', showRules);

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
