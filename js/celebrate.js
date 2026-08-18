/* Kwanza Square — winning should feel like winning.
 *
 * A canvas overlay for the moments that matter: confetti in the board's own
 * colours when you take a round or a match, and something quieter and more
 * dignified when you lose — dust settling rather than a mockery.
 *
 * Canvas rather than SVG or DOM nodes: a few hundred moving pieces at 60fps on
 * a cheap phone is exactly what canvas is for.
 */
(function (KZ) {
  'use strict';

  var canvas = null, ctx = null, bits = [], raf = 0, W = 0, H = 0;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // the painted board's palette, so a celebration still looks like this game
  var GOLD   = ['#FFE9A8', '#E9B833', '#D4A017', '#8A6408'];
  var BOARD  = ['#E4711E', '#F79438', '#1B4BA8', '#FFFFFF'];
  var ASH    = ['#6E7A88', '#49525C', '#2A3038', '#8A94A0'];

  function surface() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function spray(n, origin, opts) {
    for (var i = 0; i < n; i++) {
      var angle = opts.angle + (Math.random() - 0.5) * opts.spread;
      var speed = opts.speed * (0.55 + Math.random() * 0.75);
      bits.push({
        x: origin.x, y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        g: opts.gravity,
        drag: opts.drag,
        size: opts.size * (0.6 + Math.random() * 0.8),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.34,
        colour: pick(opts.palette),
        ribbon: Math.random() < 0.68,
        life: opts.life * (0.75 + Math.random() * 0.5),
        age: 0
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    var alive = 0;

    for (var i = 0; i < bits.length; i++) {
      var b = bits[i];
      b.age += 1 / 60;
      if (b.age > b.life) continue;
      alive++;

      b.vy += b.g;
      b.vx *= b.drag;
      b.vy *= b.drag;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vr;

      var fade = 1 - Math.pow(b.age / b.life, 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.colour;
      if (b.ribbon) {
        // a flat ribbon that flutters: the width breathes as it spins
        var w = b.size * (0.35 + 0.65 * Math.abs(Math.cos(b.rot * 1.7)));
        ctx.fillRect(-w / 2, -b.size / 2, w, b.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, b.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (alive > 0) {
      raf = requestAnimationFrame(tick);
    } else {
      bits.length = 0;
      ctx.clearRect(0, 0, W, H);
      raf = 0;
    }
  }

  function run() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  /**
   * A win. `big` for taking the whole match rather than a single round —
   * two cannons and a second wave instead of one modest burst.
   */
  function win(big) {
    if (reducedMotion()) { buzz(big ? [18, 50, 18] : [14]); return; }
    surface();
    var palette = GOLD.concat(BOARD);

    // Gravity is deliberately light and the launch fast: the pieces have to
    // actually cross the screen. Anything slower just piles up in the corners.
    var base = {
      angle: -Math.PI / 2, spread: 1.15, gravity: 0.22, drag: 0.994,
      size: big ? 15 : 12, life: big ? 3.1 : 2.4, palette: palette
    };

    // cannons from the bottom corners, aimed inward and up
    spray(big ? 74 : 46, { x: -10, y: H + 10 }, Object.assign({}, base, { angle: -Math.PI / 3.1, speed: big ? 31 : 25 }));
    spray(big ? 74 : 46, { x: W + 10, y: H + 10 }, Object.assign({}, base, { angle: -Math.PI + Math.PI / 3.1, speed: big ? 31 : 25 }));

    // A fall from above rather than a burst over the middle — an explosion at
    // centre screen lands squarely on the result text and hides it.
    function rain(n) {
      for (var i = 0; i < n; i++) {
        bits.push({
          x: Math.random() * W,
          y: -20 - Math.random() * 140,
          vx: (Math.random() - 0.5) * 1.6,
          vy: 1.6 + Math.random() * 2.6,
          g: 0.05, drag: 0.999,
          size: base.size * (0.6 + Math.random() * 0.7),
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          colour: pick(palette),
          ribbon: Math.random() < 0.7,
          life: 3.6, age: 0
        });
      }
    }
    rain(big ? 46 : 24);

    if (big) {
      setTimeout(function () {
        spray(48, { x: W * 0.22, y: H + 10 }, Object.assign({}, base, { angle: -Math.PI / 2.5, speed: 29 }));
        spray(48, { x: W * 0.78, y: H + 10 }, Object.assign({}, base, { angle: -Math.PI + Math.PI / 2.5, speed: 29 }));
        rain(30);
        run();
      }, 480);
    }

    buzz(big ? [20, 60, 20, 60, 40] : [16]);
    run();
  }

  /**
   * A loss. Not a punishment — ash drifting down and settling. The player is
   * told how well they played; the screen shouldn't jeer at them.
   */
  function defeat() {
    if (reducedMotion()) { buzz([26]); return; }
    surface();
    for (var i = 0; i < 34; i++) {
      bits.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.7 + Math.random() * 0.9,
        g: 0.004, drag: 0.999,
        size: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.05,
        colour: pick(ASH),
        ribbon: Math.random() < 0.4,
        life: 3.4 + Math.random() * 1.4,
        age: 0
      });
    }
    buzz([28]);
    run();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    bits.length = 0;
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  KZ.Celebrate = { win: win, defeat: defeat, stop: stop };
})(window.KZ = window.KZ || {});
