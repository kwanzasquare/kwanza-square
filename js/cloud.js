/* Kwanza Square — talking to the leaderboard.
 *
 * The key below is the PUBLISHABLE key. It is meant to be readable by anyone
 * holding the game, and it grants nothing: the tables refuse it entirely (row
 * level security with no policies), and the only things it may call are three
 * read-only functions and the submit endpoint, which re-proves every game
 * before storing it. There is no secret in this file and there must never be.
 *
 * No SDK — plain fetch, so the game keeps its "no dependencies" promise.
 */
(function (KZ) {
  'use strict';

  var CONFIG = {
    url: 'https://ftnrcogoynentmvoolsi.supabase.co',
    key: 'sb_publishable_7Bt97jGxR838TH5Iivo9xQ_AcmsSdNB'
  };

  var STORE = 'kwanza-cloud';
  var TIMEOUT = 12000;

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }
  function save(patch) {
    var s = Object.assign(load(), patch);
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  /** A random id for this device. Not personal — it only guards handle claims. */
  function deviceId() {
    var s = load();
    if (s.deviceId) return s.deviceId;
    var id;
    try {
      id = crypto.randomUUID();
    } catch (e) {
      id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    save({ deviceId: id });
    return id;
  }

  function handle() { return load().handle || null; }
  function setHandle(h) { save({ handle: h }); }
  function forget() {
    try { localStorage.removeItem(STORE); } catch (e) {}
  }

  function request(path, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT);
    return fetch(CONFIG.url + path, Object.assign({
      signal: controller.signal,
      headers: {
        apikey: CONFIG.key,
        Authorization: 'Bearer ' + CONFIG.key,
        'Content-Type': 'application/json'
      }
    }, options)).then(function (res) {
      clearTimeout(timer);
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) {
          var err = new Error((body && (body.error || body.message)) || ('request failed (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return body;
      });
    }, function (e) {
      clearTimeout(timer);
      throw new Error(e.name === 'AbortError' ? 'The leaderboard did not answer. Check your connection.' : 'Could not reach the leaderboard.');
    });
  }

  function rpc(fn, args) {
    return request('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args || {}) });
  }

  // ------------------------------------------------------------------ public

  function isHandleFree(name) {
    return rpc('handle_available', { p_handle: name });
  }

  function leaderboard(level, period, limit) {
    return rpc('leaderboard', { p_level: level, p_period: period || 'all', p_limit: limit || 100 });
  }

  /**
   * Which periods the database actually understands.
   *
   * This matters more than it looks. period_start() falls back to all-time for
   * any period it does not recognise, so offering a tab the server has never
   * heard of would show all-time results under the wrong heading — wrong, and
   * wrong in a way nobody would notice. So the app asks first, and simply omits
   * any tab the server cannot honour. Older deployments lose a tab; none of
   * them lie. Asked once per session and cached.
   */
  var periodsPromise = null;
  function periods() {
    if (!periodsPromise) {
      periodsPromise = rpc('supported_periods').then(function (list) {
        return (list && list.length) ? list : FALLBACK_PERIODS;
      }, function () {
        // An old database has no such function. Fall back to what it has always
        // known, rather than to nothing.
        return FALLBACK_PERIODS;
      });
    }
    return periodsPromise;
  }
  var FALLBACK_PERIODS = ['week', 'month', 'year', 'all'];

  /**
   * The handle rule, as the database actually enforces it.
   *
   * The app used to carry its own copy of this pattern, which meant the two
   * could disagree — and the way they disagree matters: a name accepted here
   * but refused by the server is only discovered at submit, after the player
   * has finished three matches. So the rule is read from the one place that
   * enforces it. An older database has no such function and falls back to the
   * original ASCII pattern, which is exactly what it still enforces.
   */
  var FALLBACK_HANDLE = '^[A-Za-z0-9_]{3,16}$';
  var handlePatternPromise = null;
  function handlePattern() {
    if (!handlePatternPromise) {
      handlePatternPromise = rpc('handle_pattern').then(function (p) {
        return (typeof p === 'string' && p) ? p : FALLBACK_HANDLE;
      }, function () {
        return FALLBACK_HANDLE;
      });
    }
    return handlePatternPromise;
  }

  function standing(name, level, period) {
    return rpc('my_standing', { p_handle: name, p_level: level, p_period: period || 'all' })
      .then(function (rows) { return (rows && rows[0]) || null; });
  }

  /**
   * Send a finished match. `state` is the engine's own state — the full action
   * log travels with it, and the server decides what actually happened.
   */
  function submit(state, humanSide, name) {
    return request('/functions/v1/submit', {
      method: 'POST',
      body: JSON.stringify({
        handle: name,
        deviceId: deviceId(),
        level: state.difficulty,
        pawns: state.pawnsPerSide,
        roundsToWin: state.roundsToWin,
        humanSide: humanSide,
        actionLog: state.actionLog
      })
    });
  }

  KZ.Cloud = {
    CONFIG: CONFIG,
    deviceId: deviceId,
    handle: handle,
    setHandle: setHandle,
    forget: forget,
    isHandleFree: isHandleFree,
    leaderboard: leaderboard,
    periods: periods,
    handlePattern: handlePattern,
    standing: standing,
    submit: submit
  };
})(window.KZ = window.KZ || {});
