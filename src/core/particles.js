/* A single flat particle pool. Everything that sparkles, drifts, or bursts in
 * the game goes through here. Pre-allocated so play never hitches on GC.
 */
AL.Particles = (function () {
  var MAX = 900;
  var pool = new Array(MAX);
  var head = 0;

  function P() {
    this.alive = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.max = 1; this.size = 1;
    this.grav = 0; this.drag = 1; this.kind = 'dot';
    this.color = '#fff'; this.spin = 0; this.rot = 0;
    this.r0 = 0; this.r1 = 0; this.a0 = 1;
  }
  for (var i = 0; i < MAX; i++) pool[i] = new P();

  function spawn(o) {
    // Round-robin: oldest particles get recycled under load.
    var p = pool[head];
    head = (head + 1) % MAX;
    p.alive = true;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.max = p.life = o.life || 0.6;
    p.size = o.size || 1.5;
    p.grav = o.grav || 0;
    p.drag = o.drag != null ? o.drag : 1;
    p.kind = o.kind || 'dot';
    p.color = o.color || AL.C.ash;
    p.spin = o.spin || 0; p.rot = o.rot || 0;
    p.r0 = o.r0 || 2; p.r1 = o.r1 || 20;
    p.a0 = o.a0 != null ? o.a0 : 1;
    return p;
  }

  function update(dt) {
    for (var i = 0; i < MAX; i++) {
      var p = pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += p.grav * dt;
      if (p.drag !== 1) {
        var d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  function draw(g, camX, camY) {
    for (var i = 0; i < MAX; i++) {
      var p = pool[i];
      if (!p.alive) continue;
      var t = p.life / p.max;          // 1 -> 0
      var x = Math.round(p.x - camX);
      var y = Math.round(p.y - camY);

      if (p.kind === 'dot') {
        g.globalAlpha = p.a0 * t;
        g.fillStyle = p.color;
        var s = Math.max(1, Math.round(p.size * (0.4 + 0.6 * t)));
        g.fillRect(x - (s >> 1), y - (s >> 1), s, s);

      } else if (p.kind === 'ash') {
        g.globalAlpha = p.a0 * Math.min(1, t * 2.2) * 0.8;
        g.fillStyle = p.color;
        g.fillRect(x, y, 1, 1);

      } else if (p.kind === 'spark') {
        g.globalAlpha = p.a0 * t;
        g.fillStyle = p.color;
        var len = 1 + p.size * t * 2;
        var nx = p.vx, ny = p.vy;
        var m = Math.sqrt(nx * nx + ny * ny) || 1;
        g.fillRect(x, y, Math.max(1, Math.round(Math.abs(nx / m) * len)),
                         Math.max(1, Math.round(Math.abs(ny / m) * len)));

      } else if (p.kind === 'ring') {
        var rr = AL.U.lerp(p.r0, p.r1, AL.U.easeOut(1 - t));
        g.globalAlpha = p.a0 * t * t;
        g.strokeStyle = p.color;
        g.lineWidth = Math.max(1, p.size * t);
        g.beginPath();
        g.arc(x + .5, y + .5, rr, 0, Math.PI * 2);
        g.stroke();

      } else if (p.kind === 'glow') {
        var rg = AL.U.lerp(p.r0, p.r1, 1 - t);
        g.globalAlpha = p.a0 * t;
        var grad = g.createRadialGradient(x, y, 0, x, y, Math.max(1, rg));
        grad.addColorStop(0, AL.U.rgba(p.color, 0.8));
        grad.addColorStop(1, AL.U.rgba(p.color, 0));
        g.fillStyle = grad;
        g.fillRect(x - rg, y - rg, rg * 2, rg * 2);

      } else if (p.kind === 'shard') {
        g.globalAlpha = p.a0 * t;
        g.save();
        g.translate(x + .5, y + .5);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        var s2 = Math.max(1, p.size * (0.5 + 0.5 * t));
        g.fillRect(-s2 / 2, -s2 / 2, s2, s2);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  function clear() { for (var i = 0; i < MAX; i++) pool[i].alive = false; }

  /* ------------------------------------------------------ named emitters */

  function burst(x, y, color, n, speed, opts) {
    opts = opts || {};
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = speed * (0.35 + Math.random() * 0.65);
      spawn({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.lift || 0),
        life: (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
        size: opts.size || 2, color: color,
        grav: opts.grav != null ? opts.grav : 180,
        drag: opts.drag != null ? opts.drag : 0.93,
        kind: opts.kind || 'dot'
      });
    }
  }

  function ring(x, y, color, r1, life, width) {
    spawn({ x: x, y: y, kind: 'ring', color: color, r0: 2, r1: r1 || 26,
            life: life || 0.45, size: width || 2 });
  }

  function glow(x, y, color, r1, life, a) {
    spawn({ x: x, y: y, kind: 'glow', color: color, r0: 1, r1: r1 || 30,
            life: life || 0.3, a0: a != null ? a : 0.7 });
  }

  function dust(x, y, dir) {
    for (var i = 0; i < 5; i++) {
      spawn({
        x: x + AL.U.rand(-3, 3), y: y,
        vx: dir * AL.U.rand(6, 34) + AL.U.rand(-10, 10),
        vy: AL.U.rand(-26, -4),
        life: AL.U.rand(0.18, 0.4), size: AL.U.rand(1, 2.4),
        color: AL.C.ashDim, grav: 120, drag: 0.9
      });
    }
  }

  function trail(x, y, color, life) {
    spawn({ x: x + AL.U.rand(-2, 2), y: y + AL.U.rand(-4, 4),
            vx: AL.U.rand(-8, 8), vy: AL.U.rand(-8, 8),
            life: life || 0.3, size: AL.U.rand(1, 2.5), color: color, drag: 0.9 });
  }

  return {
    spawn: spawn, update: update, draw: draw, clear: clear,
    burst: burst, ring: ring, glow: glow, dust: dust, trail: trail
  };
})();
