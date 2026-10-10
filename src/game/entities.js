/* Every interactive object in a room. Each entity implements update/draw and
 * may contribute lights. Anything that should block a laser or carry the player
 * also exposes `solid` + a box.
 */
AL.Entities = (function () {
  var C = AL.C, U = AL.U, T = AL.TILE;

  /* ------------------------------------------------------------- Emberlight */

  function Shard(x, y, idx) {
    this.x = x; this.y = y; this.w = T; this.h = T;
    this.idx = idx;
    this.t = Math.random() * 6.28;
    this.taken = false;
    this.pop = 0;
  }
  Shard.prototype.update = function (dt, world) {
    this.t += dt;
    if (this.pop > 0) this.pop -= dt;
    if (this.taken) return;
    var p = world.player;
    if (p && !p.dead && U.rectsOverlap(p.x, p.y, p.w, p.h, this.x + 3, this.y + 3, T - 6, T - 6)) {
      this.taken = true;
      this.pop = 0.4;
      world.collectShard(this);
    }
    if (Math.random() < 0.12) {
      AL.Particles.spawn({
        x: this.x + T / 2 + U.rand(-3, 3), y: this.y + T / 2 + U.rand(-3, 3),
        vx: U.rand(-4, 4), vy: U.rand(-14, -4), life: U.rand(0.4, 0.9),
        size: 1, color: C.ember, kind: 'dot'
      });
    }
  };
  Shard.prototype.lights = function (out) {
    if (this.taken) return;
    var b = Math.sin(this.t * 2) * 2;
    out.push({ wx: this.x + T / 2, wy: this.y + T / 2 + b, r: 40, color: C.ember,
               intensity: 0.26, reveals: false, soft: 0.2 });
  };
  Shard.prototype.draw = function (g, world) {
    if (this.taken) return;
    var cx = this.x + T / 2, cy = this.y + T / 2 + Math.sin(this.t * 2) * 2;
    var pulse = 0.78 + Math.sin(this.t * 4) * 0.22;
    g.save();
    g.translate(Math.round(cx), Math.round(cy));
    g.rotate(this.t * 0.6);
    // diamond
    g.fillStyle = C.ember;
    g.fillRect(-1, -4, 2, 8);
    g.fillRect(-4, -1, 8, 2);
    g.fillStyle = C.emberHot;
    g.fillRect(-1, -2, 2, 4);
    g.fillRect(-2, -1, 4, 2);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, Math.round(cx), Math.round(cy), 11 * pulse, C.ember, 0.5, 0);
    g.restore();
  };

  /* ------------------------------------------------------- Memory mote */

  function Mote(x, y, id) {
    this.x = x; this.y = y; this.id = id;
    this.t = Math.random() * 6.28;
    this.taken = false;
  }
  Mote.prototype.update = function (dt, world) {
    this.t += dt;
    if (this.taken) return;
    if (world.save.memories[this.id]) { this.taken = true; return; }
    var p = world.player;
    if (p && !p.dead && U.rectsOverlap(p.x, p.y, p.w, p.h, this.x + 2, this.y + 2, T - 4, T - 4)) {
      this.taken = true;
      world.collectMote(this);
    }
    if (Math.random() < 0.3) {
      var a = this.t * 2;
      AL.Particles.spawn({
        x: this.x + T / 2 + Math.cos(a) * 6, y: this.y + T / 2 + Math.sin(a * 1.3) * 6,
        vx: 0, vy: U.rand(-6, 6), life: 0.7, size: 1, color: C.iris
      });
    }
  };
  Mote.prototype.lights = function (out) {
    if (this.taken) return;
    out.push({ wx: this.x + T / 2, wy: this.y + T / 2, r: 34, color: C.iris,
               intensity: 0.22, reveals: false, soft: 0.2 });
  };
  Mote.prototype.draw = function (g) {
    if (this.taken) return;
    var cx = Math.round(this.x + T / 2), cy = Math.round(this.y + T / 2 + Math.sin(this.t * 1.6) * 2);
    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, cx, cy, 10, C.iris, 0.45, 0);
    g.restore();
    g.fillStyle = C.iris;
    g.fillRect(cx - 1, cy - 1, 3, 3);
    g.fillStyle = '#ffffff';
    g.fillRect(cx, cy, 1, 1);
    // slow orbiting dust
    for (var i = 0; i < 3; i++) {
      var a = this.t * 1.1 + i * 2.09;
      g.globalAlpha = 0.5;
      g.fillStyle = C.iris;
      g.fillRect(Math.round(cx + Math.cos(a) * 6), Math.round(cy + Math.sin(a) * 6), 1, 1);
      g.globalAlpha = 1;
    }
  };

  /* -------------------------------------------------------------- Exit door */

  function Exit(x, y) {
    this.x = x; this.y = y - T; this.w = T; this.h = T * 2;
    this.open = 0;   // 0..1
    this.t = 0;
  }
  Exit.prototype.update = function (dt, world) {
    this.t += dt;
    var should = world.roomCleared() ? 1 : 0;
    var was = this.open;
    this.open = U.approach(this.open, should, dt * 2.2);
    if (was < 1 && this.open >= 0.999) {
      AL.Audio.sfx('door');
      AL.FX.addShake(2, 7);
      AL.Particles.ring(this.x + T / 2, this.y + T, C.ember, 34, 0.7, 2);
    }
    if (this.open > 0.9) {
      var p = world.player;
      if (p && !p.dead && U.rectsOverlap(p.x, p.y, p.w, p.h, this.x + 3, this.y + 6, T - 6, this.h - 6)) {
        world.exitRoom();
      }
      if (Math.random() < 0.25) {
        AL.Particles.spawn({ x: this.x + U.rand(3, T - 3), y: this.y + this.h - 2,
          vx: 0, vy: U.rand(-22, -8), life: 0.8, size: 1, color: C.ember });
      }
    }
  };
  Exit.prototype.lights = function (out) {
    if (this.open <= 0.02) return;
    out.push({ wx: this.x + T / 2, wy: this.y + T, r: 26 + this.open * 36, color: C.ember,
               intensity: 0.22 * this.open, reveals: false });
  };
  Exit.prototype.draw = function (g, world) {
    var x = this.x, y = this.y, o = this.open;
    // frame
    g.fillStyle = C.stone2;
    g.fillRect(x - 2, y - 2, T + 4, 3);
    g.fillRect(x - 2, y - 2, 3, this.h + 4);
    g.fillRect(x + T - 1, y - 2, 3, this.h + 4);
    // interior
    g.fillStyle = C.void0;
    g.fillRect(x + 1, y + 1, T - 2, this.h - 1);
    if (o < 1) {
      // sealed with light-bars; they lift as shards are gathered
      var need = world.level ? world.level.requiredShards : 0;
      var have = world.roomShards;
      var frac = need ? U.clamp(have / need, 0, 1) : 1;
      for (var i = 0; i < 4; i++) {
        var barY = y + 4 + i * 7;
        var on = (i / 4) >= frac;
        g.fillStyle = on ? U.rgba(C.bad, 0.75) : U.rgba(C.ember, 0.35);
        g.fillRect(x + 2, barY, T - 4, 2);
      }
      g.globalAlpha = 0.5;
      AL.Draw.text(g, need ? (have + '/' + need) : '', x + T / 2, y - 12,
                   { size: 7, align: 'center', color: C.ash });
      g.globalAlpha = 1;
    }
    if (o > 0.02) {
      var h = Math.round((this.h - 4) * o);
      var grad = g.createLinearGradient(0, y + this.h - h, 0, y + this.h);
      grad.addColorStop(0, U.rgba(C.emberHot, 0.0));
      grad.addColorStop(1, U.rgba(C.ember, 0.55 * o));
      g.fillStyle = grad;
      g.fillRect(x + 2, y + this.h - h - 2, T - 4, h);
      g.save();
      g.globalCompositeOperation = 'lighter';
      AL.Draw.radial(g, x + T / 2, y + this.h - 6, 16 * o, C.ember, 0.4 * o, 0);
      g.restore();
    }
  };

  /* ------------------------------------------------------------------ Lamp */

  function Lamp(x, y, cfg) {
    this.x = x; this.y = y;
    this.r = cfg.r || 62;
    this.reveals = !!cfg.reveals;
    this.t = Math.random() * 10;
    this.color = cfg.color || C.ember;
  }
  Lamp.prototype.update = function (dt) {
    this.t += dt;
    if (Math.random() < 0.08) {
      AL.Particles.spawn({ x: this.x + T / 2 + U.rand(-2, 2), y: this.y + 8,
        vx: U.rand(-3, 3), vy: U.rand(-20, -8), life: U.rand(0.5, 1.1), size: 1, color: this.color });
    }
  };
  Lamp.prototype.lights = function (out) {
    var fl = 1 + Math.sin(this.t * 7.3) * 0.035 + Math.sin(this.t * 2.1) * 0.05;
    out.push({ wx: this.x + T / 2, wy: this.y + 7, r: this.r * fl, color: this.color,
               intensity: 0.3, reveals: this.reveals });
  };
  Lamp.prototype.draw = function (g) {
    var cx = this.x + T / 2, cy = this.y + 7;
    g.fillStyle = C.stone2;
    g.fillRect(this.x + 6, this.y, 4, 4);
    g.fillRect(this.x + 4, this.y + 3, 8, 2);
    var fl = 1 + Math.sin(this.t * 7.3) * 0.1;
    g.fillStyle = this.color;
    g.fillRect(this.x + 6, this.y + 5, 4, 5);
    g.fillStyle = C.emberHot;
    g.fillRect(this.x + 7, this.y + 6, 2, 3);
    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, cx, cy, 20 * fl, this.color, 0.42, 0);
    g.restore();
  };

  /* ----------------------------------------------------------------- Plate */

  function Plate(x, y, chan) {
    this.x = x; this.y = y; this.chan = chan;
    this.on = false; this.press = 0;
    this.color = chan === 'A' ? C.plate : (chan === 'B' ? C.echo : C.iris);
  }
  Plate.prototype.sensor = function () { return { x: this.x + 1, y: this.y + 6, w: T - 2, h: 10 }; };
  Plate.prototype.update = function (dt, world) {
    var s = this.sensor();
    var hit = false;
    var p = world.player;
    if (p && !p.dead && U.rectsOverlap(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) hit = true;
    if (!hit) {
      var bs = world.solidBodies;
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        if (U.rectsOverlap(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) { hit = true; break; }
      }
    }
    if (hit !== this.on) {
      this.on = hit;
      AL.Audio.sfx('plate', hit);
      AL.Particles.ring(this.x + T / 2, this.y + 12, this.color, 16, 0.3, 1);
    }
    this.press = U.approach(this.press, this.on ? 1 : 0, dt * 14);
    if (this.on) world.power(this.chan);
  };
  Plate.prototype.lights = function (out) {
    if (this.press < 0.1) return;
    out.push({ wx: this.x + T / 2, wy: this.y + 12, r: 26 * this.press, color: this.color,
               intensity: 0.2 * this.press, reveals: false });
  };
  Plate.prototype.draw = function (g) {
    var d = Math.round(this.press * 3);
    g.fillStyle = C.stone2;
    g.fillRect(this.x, this.y + T - 3, T, 3);
    g.fillStyle = this.on ? this.color : U.rgba(this.color, 0.4);
    g.fillRect(this.x + 1, this.y + 9 + d, T - 2, 4 - Math.min(2, d));
    g.fillStyle = U.rgba(C.void0, 0.5);
    g.fillRect(this.x + 1, this.y + 13 + d, T - 2, 1);
    if (this.on) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      AL.Draw.radial(g, this.x + T / 2, this.y + 12, 13, this.color, 0.4, 0);
      g.restore();
    }
    // channel letter, so puzzles read at a glance
    AL.Draw.text(g, this.chan, this.x + T / 2, this.y + 1,
                 { size: 6, align: 'center', color: U.rgba(this.color, this.on ? 0.95 : 0.45) });
  };

  /* ---------------------------------------------------------------- Laser */

  function Laser(x, y, dx, dy, cfg) {
    this.x = x; this.y = y; this.dx = dx; this.dy = dy;
    this.cfg = cfg || {};
    this.chan = cfg.chan || null;      // powered channel toggles it
    this.invert = !!cfg.invert;        // invert: powered = ON
    this.blink = cfg.blink || null;    // [onSec, offSec, phaseSec]
    this.t = cfg.phase || 0;
    this.len = 0;
    this.active = true;
  }
  Laser.prototype.origin = function () {
    return { x: this.x + T / 2 + this.dx * 5, y: this.y + T / 2 + this.dy * 5 };
  };
  Laser.prototype.update = function (dt, world) {
    this.t += dt;
    var on = true;
    if (this.chan) {
      var powered = world.channel(this.chan);
      on = this.invert ? powered : !powered;
    }
    if (this.blink) {
      var period = this.blink[0] + this.blink[1];
      var ph = ((this.t + (this.blink[2] || 0)) % period + period) % period;
      on = on && ph < this.blink[0];
    }
    this.active = on;
    if (!on) { this.len = 0; return; }

    // march the beam until something solid stops it
    var o = this.origin();
    var step = 2, max = 520, L = 0;
    var bs = world.solidBodies;
    while (L < max) {
      var px = o.x + this.dx * L, py = o.y + this.dy * L;
      if (world.level.rectSolid(px - 1, py - 1, 2, 2)) break;
      var blocked = false;
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        if (U.rectsOverlap(px - 1, py - 1, 2, 2, b.x, b.y, b.w, b.h)) { blocked = true; break; }
      }
      if (blocked) break;
      L += step;
    }
    this.len = L;

    // player contact — thin beam hitbox
    var p = world.player;
    if (p && !p.dead) {
      var bx = Math.min(o.x, o.x + this.dx * L) - 1.5;
      var by = Math.min(o.y, o.y + this.dy * L) - 1.5;
      var bw = Math.abs(this.dx * L) + 3, bh = Math.abs(this.dy * L) + 3;
      if (U.rectsOverlap(p.x + 1, p.y + 1, p.w - 2, p.h - 2, bx, by, bw, bh)) p.kill('laser');
    }
    if (Math.random() < 0.3) {
      var ex = o.x + this.dx * L, ey = o.y + this.dy * L;
      AL.Particles.spawn({ x: ex, y: ey, vx: U.rand(-20, 20), vy: U.rand(-20, 0),
        life: 0.25, size: 1, color: C.bad });
    }
  };
  Laser.prototype.lights = function (out) {
    var o = this.origin();
    out.push({ wx: o.x, wy: o.y, r: this.active ? 26 : 10, color: C.bad,
               intensity: this.active ? 0.22 : 0.08, reveals: false });
    if (this.active && this.len > 8) {
      out.push({ wx: o.x + this.dx * this.len, wy: o.y + this.dy * this.len,
                 r: 18, color: C.bad, intensity: 0.18, reveals: false });
    }
  };
  Laser.prototype.draw = function (g) {
    // emitter housing
    g.fillStyle = C.stone2;
    g.fillRect(this.x + 2, this.y + 2, T - 4, T - 4);
    g.fillStyle = C.stone0;
    g.fillRect(this.x + 4, this.y + 4, T - 8, T - 8);
    g.fillStyle = this.active ? C.bad : U.rgba(C.bad, 0.3);
    var ex = this.x + T / 2 - 2 + this.dx * 4, ey = this.y + T / 2 - 2 + this.dy * 4;
    g.fillRect(ex, ey, 4, 4);

    if (!this.active || this.len <= 0) return;
    var o = this.origin();
    var jitter = Math.sin(this.t * 40) * 0.5;
    var w = Math.abs(this.dx) ? this.len : 3;
    var h = Math.abs(this.dy) ? this.len : 3;
    var bx = this.dx < 0 ? o.x - this.len : o.x - (this.dx ? 0 : 1.5);
    var by = this.dy < 0 ? o.y - this.len : o.y - (this.dy ? 0 : 1.5);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = U.rgba(C.bad, 0.22);
    g.fillRect(Math.round(bx - 1), Math.round(by - 1 + jitter), Math.round(w + 2), Math.round(h + 2));
    g.fillStyle = U.rgba(C.bad, 0.9);
    g.fillRect(Math.round(bx), Math.round(by + jitter), Math.round(w), Math.round(h));
    g.fillStyle = U.rgba('#ffffff', 0.7);
    var cw = Math.abs(this.dx) ? w : 1, chh = Math.abs(this.dy) ? h : 1;
    g.fillRect(Math.round(bx + (Math.abs(this.dx) ? 0 : 1)), Math.round(by + jitter + (Math.abs(this.dy) ? 0 : 1)), cw, chh);
    g.restore();
  };

  /* ---------------------------------------------------------------- Mover */

  /* A solid platform on a rail. Carries and pushes the player; `solid` makes it
   * block lasers and hold plates. */
  function Mover(x, y, cfg) {
    cfg = cfg || {};
    this.ox = x; this.oy = y;
    this.w = (cfg.w || 2) * T;
    this.h = (cfg.h || 1) * T * 0.5;
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.dx = (cfg.dx || 0) * T;
    this.dy = (cfg.dy || 0) * T;
    this.dur = cfg.dur || 2.4;
    this.t = (cfg.phase || 0) * this.dur;
    this.chan = cfg.chan || null;
    this.invert = !!cfg.invert;
    this.solid = true;
    this.ease = cfg.ease !== false;
  }
  Mover.prototype.update = function (dt, world) {
    this.px = this.x; this.py = this.y;
    var moving = true;
    if (this.chan) {
      var powered = world.channel(this.chan);
      moving = this.invert ? !powered : powered;
    }
    if (moving) this.t += dt;
    var phase = (this.t / this.dur) % 2;
    var k = phase < 1 ? phase : 2 - phase;
    if (this.ease) k = U.easeInOut(k);
    this.x = this.ox + this.dx * k;
    this.y = this.oy + this.dy * k;
    world.moveSolid(this, this.x - this.px, this.y - this.py);
  };
  Mover.prototype.draw = function (g) {
    var x = Math.round(this.x), y = Math.round(this.y);
    g.fillStyle = C.stone2;
    g.fillRect(x, y, this.w, this.h);
    g.fillStyle = C.edge;
    g.fillRect(x, y, this.w, 1);
    g.fillStyle = U.rgba(C.void0, 0.5);
    g.fillRect(x, y + this.h - 2, this.w, 2);
    g.fillStyle = U.rgba(C.ember, 0.5);
    for (var i = 4; i < this.w - 2; i += 8) g.fillRect(x + i, y + 3, 2, 1);
  };

  /* ---------------------------------------------------------------- Shade */

  /* A patrolling hazard. Walks its ledge, turns at walls and drops. Light
   * destroys it — which is what the Light Echo is for. */
  function Shade(x, y, cfg) {
    cfg = cfg || {};
    this.x = x + 3; this.y = y + 2; this.w = 10; this.h = 14;
    this.ox = this.x; this.oy = this.y;
    this.dir = cfg.dir || 1;
    this.odir = this.dir;
    this.speed = cfg.speed || 26;
    this.t = Math.random() * 6;
    this.burn = 0;
    this.dead = false;
  }
  Shade.prototype.reset = function () {
    this.x = this.ox; this.y = this.oy; this.dir = this.odir;
    this.burn = 0; this.dead = false;
  };
  Shade.prototype.update = function (dt, world) {
    this.t += dt;
    if (this.dead) return;

    // light burns it away
    var lit = 0;
    var ls = world.lights;
    for (var i = 0; i < ls.length; i++) {
      var L = ls[i];
      if (!L.reveals) continue;
      var dx = L.wx - (this.x + this.w / 2), dy = L.wy - (this.y + this.h / 2);
      if (dx * dx + dy * dy < L.r * L.r) { lit = 1; break; }
    }
    if (lit) {
      this.burn += dt * 1.9;
      AL.Particles.spawn({ x: this.x + U.rand(0, this.w), y: this.y + U.rand(0, this.h),
        vx: U.rand(-10, 10), vy: U.rand(-30, -10), life: 0.5, size: 2, color: C.ember });
      if (this.burn >= 1) {
        this.dead = true;
        AL.Particles.burst(this.x + this.w / 2, this.y + this.h / 2, C.ember, 22, 90, { life: 0.7 });
        AL.Particles.ring(this.x + this.w / 2, this.y + this.h / 2, C.ember, 30, 0.5, 2);
        AL.Audio.sfx('echoClear');
        return;
      }
    } else {
      this.burn = Math.max(0, this.burn - dt * 0.8);
    }

    var nx = this.x + this.dir * this.speed * dt;
    var lv = world.level;
    var wallAhead = lv.rectSolid(nx, this.y, this.w, this.h);
    var footX = this.dir > 0 ? nx + this.w + 1 : nx - 1;
    var groundAhead = lv.rectSolid(footX, this.y + this.h + 1, 1, 2) ||
                      lv.charAt(Math.floor(footX / T), Math.floor((this.y + this.h + 1) / T)) === '-';
    if (wallAhead || !groundAhead) this.dir = -this.dir;
    else this.x = nx;

    // settle onto the floor
    if (!lv.rectSolid(this.x, this.y + this.h, this.w, 2)) this.y += 60 * dt;

    var p = world.player;
    if (p && !p.dead && U.rectsOverlap(p.x + 1, p.y + 1, p.w - 2, p.h - 2, this.x + 1, this.y + 2, this.w - 2, this.h - 3))
      p.kill('shade');
  };
  Shade.prototype.lights = function (out) {
    if (this.dead) return;
    out.push({ wx: this.x + this.w / 2, wy: this.y + 6, r: 16, color: C.bad,
               intensity: 0.1, reveals: false });
  };
  Shade.prototype.draw = function (g) {
    if (this.dead) return;
    var x = Math.round(this.x), y = Math.round(this.y + Math.sin(this.t * 3) * 1);
    // smoky body
    g.fillStyle = U.rgba(C.void0, 0.92);
    g.fillRect(x, y + 2, this.w, this.h - 2);
    g.fillStyle = U.rgba(C.stone0, 0.9);
    g.fillRect(x + 1, y + 1, this.w - 2, 5);
    // eyes
    g.fillStyle = this.burn > 0.1 ? C.ember : C.bad;
    g.fillRect(x + (this.dir > 0 ? 5 : 2), y + 4, 2, 2);
    g.fillRect(x + (this.dir > 0 ? 8 : 5), y + 4, 2, 2);
    // fraying hem
    for (var i = 0; i < this.w; i += 2) {
      g.fillStyle = U.rgba(C.void0, 0.7);
      g.fillRect(x + i, y + this.h - 1 + Math.round(Math.sin(this.t * 6 + i) * 1), 2, 2);
    }
    if (this.burn > 0.05) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = this.burn * 0.7;
      g.fillStyle = C.ember;
      g.fillRect(x, y, this.w, this.h);
      g.restore();
      g.globalAlpha = 1;
    }
  };

  /* ----------------------------------------------------------------- Rune */

  /* A wall glyph that speaks once when you walk into it. */
  function Rune(x, y, cfg) {
    this.x = x; this.y = y; this.cfg = cfg || {};
    this.key = this.cfg.key || null;
    this.t = Math.random() * 6;
    this.fired = false;
    this.near = 0;
  }
  Rune.prototype.update = function (dt, world) {
    this.t += dt;
    var p = world.player;
    if (!p) return;
    var d = Math.abs((p.x + p.w / 2) - (this.x + T / 2));
    var dy = Math.abs((p.y + p.h / 2) - (this.y + T / 2));
    var close = d < 16 && dy < 20;
    this.near = U.approach(this.near, close ? 1 : 0, dt * 5);
    if (close && !this.fired) {
      this.fired = true;
      if (this.key) world.playScript(this.key, { once: this.cfg.repeat !== true });
    }
  };
  Rune.prototype.lights = function (out) {
    out.push({ wx: this.x + T / 2, wy: this.y + T / 2, r: 24 + this.near * 14,
               color: C.iris, intensity: 0.14 + this.near * 0.14, reveals: false });
  };
  Rune.prototype.draw = function (g) {
    var cx = this.x + T / 2, cy = this.y + T / 2;
    var a = 0.45 + this.near * 0.45 + Math.sin(this.t * 2) * 0.08;
    g.globalAlpha = a;
    g.fillStyle = C.iris;
    // a small fixed glyph
    g.fillRect(cx - 4, cy - 5, 8, 1);
    g.fillRect(cx - 1, cy - 5, 2, 10);
    g.fillRect(cx - 5, cy + 1, 3, 1);
    g.fillRect(cx + 3, cy + 1, 3, 1);
    g.fillRect(cx - 3, cy + 4, 6, 1);
    g.globalAlpha = 1;
    if (this.near > 0.2 && !this.fired) {
      AL.Draw.text(g, 'READ', cx, cy - 16, { size: 6, align: 'center', color: U.rgba(C.iris, this.near) });
    }
  };

  /* ---------------------------------------------------------------- Altar */

  /* Grants an ability, once, with a short scripted beat. */
  function Altar(x, y, cfg) {
    this.x = x; this.y = y; this.cfg = cfg || {};
    this.ability = this.cfg.ability || null;
    this.t = 0;
    this.used = false;
    this.charge = 0;
  }
  Altar.prototype.update = function (dt, world) {
    this.t += dt;
    if (world.save.abilities[this.ability]) this.used = true;
    if (this.used) { this.charge = U.approach(this.charge, 0, dt); return; }
    var p = world.player;
    if (p && !p.dead && U.rectsOverlap(p.x, p.y, p.w, p.h, this.x - 4, this.y - 8, T + 8, T + 10)) {
      this.used = true;
      world.grantAbility(this.ability, this.cfg.script, this.x + T / 2, this.y);
    }
    this.charge = U.approach(this.charge, 1, dt * 2);
    if (Math.random() < 0.4) {
      var a = Math.random() * 6.28;
      AL.Particles.spawn({ x: this.x + T / 2 + Math.cos(a) * 12, y: this.y + 10 + Math.sin(a) * 6,
        vx: -Math.cos(a) * 14, vy: -Math.sin(a) * 14 - 6, life: 0.6, size: 1, color: C.echo });
    }
  };
  Altar.prototype.lights = function (out) {
    out.push({ wx: this.x + T / 2, wy: this.y + 6, r: this.used ? 20 : 54,
               color: this.used ? C.ashDim : C.echo,
               intensity: this.used ? 0.08 : 0.3, reveals: !this.used });
  };
  Altar.prototype.draw = function (g) {
    var x = this.x, y = this.y;
    g.fillStyle = C.stone2;
    g.fillRect(x + 1, y + 10, T - 2, 6);
    g.fillRect(x + 4, y + 6, T - 8, 5);
    if (this.used) {
      g.fillStyle = U.rgba(C.ashDim, 0.6);
      g.fillRect(x + 6, y + 2, 4, 4);
      return;
    }
    var b = Math.sin(this.t * 2.4) * 2;
    g.save();
    g.translate(Math.round(x + T / 2), Math.round(y + 1 + b));
    g.rotate(this.t * 0.9);
    g.fillStyle = C.echo;
    g.fillRect(-2, -5, 4, 10);
    g.fillRect(-5, -2, 10, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(-1, -2, 2, 4);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, x + T / 2, y + 1 + b, 20, C.echo, 0.45, 0);
    g.restore();
  };

  /* ----------------------------------------------------------------- Iris */

  /* The Lumen herself. Not a puzzle piece — a destination. */
  function Iris(x, y, cfg) {
    this.x = x; this.y = y; this.cfg = cfg || {};
    this.t = 0;
    this.fired = false;
    this.bloom = 0;
  }
  Iris.prototype.update = function (dt, world) {
    this.t += dt;
    this.bloom = U.approach(this.bloom, 1, dt * 0.3);
    var p = world.player;
    if (p && !this.fired && Math.abs((p.x + p.w / 2) - (this.x + T / 2)) < 30) {
      this.fired = true;
      world.playScript(this.cfg.script || 'iris_meet', { once: false, finale: true });
    }
    for (var i = 0; i < 2; i++) {
      if (Math.random() < 0.5) {
        AL.Particles.spawn({ x: this.x + T / 2 + U.rand(-14, 14), y: this.y + U.rand(-4, 26),
          vx: U.rand(-5, 5), vy: U.rand(-20, -5), life: U.rand(0.8, 1.6), size: 1,
          color: Math.random() < 0.5 ? C.iris : C.emberHot });
      }
    }
  };
  Iris.prototype.lights = function (out) {
    var fl = 1 + Math.sin(this.t * 1.3) * 0.06 + Math.sin(this.t * 4.7) * 0.02;
    out.push({ wx: this.x + T / 2, wy: this.y + 12, r: (120 + this.bloom * 60) * fl,
               color: C.iris, intensity: 0.34, reveals: true, soft: 0.3 });
  };
  Iris.prototype.draw = function (g) {
    var cx = Math.round(this.x + T / 2), cy = Math.round(this.y + 12);
    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, cx, cy, 66 + this.bloom * 24, C.iris, 0.3, 0);
    AL.Draw.radial(g, cx, cy, 26, C.emberHot, 0.32, 0);
    g.restore();

    // a seated figure, half unravelled into light
    var sway = Math.sin(this.t * 0.9) * 1.2;
    g.fillStyle = U.rgba(C.iris, 0.9);
    g.fillRect(cx - 5, cy - 14 + sway, 10, 12);          // torso
    g.fillStyle = U.rgba('#ffffff', 0.85);
    g.fillRect(cx - 3, cy - 18 + sway, 6, 5);            // head
    g.fillStyle = U.rgba(C.iris, 0.55);
    g.fillRect(cx - 9, cy - 2, 18, 10);                  // skirt of light
    g.fillStyle = U.rgba(C.iris, 0.3);
    g.fillRect(cx - 12, cy + 6, 24, 4);
    // threads lifting off her
    for (var i = 0; i < 6; i++) {
      var a = this.t * 0.6 + i * 1.05;
      var rr = 16 + Math.sin(this.t + i) * 5;
      g.globalAlpha = 0.4;
      g.fillStyle = C.iris;
      g.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy - 6 + Math.sin(a) * rr * 0.6), 1, 1);
      g.globalAlpha = 1;
    }
  };

  return {
    Shard: Shard, Mote: Mote, Exit: Exit, Lamp: Lamp, Plate: Plate,
    Laser: Laser, Mover: Mover, Shade: Shade, Rune: Rune, Altar: Altar, Iris: Iris
  };
})();
