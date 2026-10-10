/* The Echo.
 *
 * While recording, every fixed step of Wren's motion is appended to a frame
 * buffer. On release, that buffer becomes a body that replays it forever — and
 * because the whole game runs on a fixed 1/60 timestep, the replay is bit-exact
 * every loop. An Echo is solid: you stand on it, it holds plates down, and it
 * takes a laser for you.
 */
AL.Echo = (function () {
  var C = AL.C, U = AL.U;

  var ST = { IDLE: 0, RUN: 1, JUMP: 2, FALL: 3, DASH: 4 };

  function Echo(frames, index) {
    this.frames = frames;
    this.i = 0;
    this.index = index;          // 0,1,2 — used for hue + HUD
    this.w = 10; this.h = 14;
    var f0 = frames[0];
    this.x = f0.x; this.y = f0.y;
    this.px = this.x; this.py = this.y;
    this.face = f0.f;
    this.state = f0.s;
    this.solid = true;
    this.born = 0;               // fade-in
    this.seam = 1;               // flashes at the loop point
    this.dying = 0;
    this.dead = false;
    this.vx = 0; this.vy = 0;
    this.scarf = [];
    for (var k = 0; k < 5; k++) this.scarf.push({ x: this.x, y: this.y });
  }

  Echo.prototype.box = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };

  Echo.prototype.dissolve = function () {
    if (this.dying > 0) return;
    this.dying = 0.35;
    this.solid = false;
    AL.Particles.burst(this.x + this.w / 2, this.y + this.h / 2, C.echo, 16, 70, { life: 0.5, grav: -20 });
    AL.Particles.ring(this.x + this.w / 2, this.y + this.h / 2, C.echo, 26, 0.4, 2);
  };

  Echo.prototype.update = function (dt, world) {
    this.born = Math.min(1, this.born + dt * 5);
    this.seam = Math.max(0, this.seam - dt * 4);

    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.dead = true;
      return;
    }

    this.px = this.x; this.py = this.y;
    this.i++;
    if (this.i >= this.frames.length) {
      this.i = 0;
      this.seam = 1;
      // a soft tick at the seam so players can hear the loop
      AL.Particles.ring(this.frames[0].x + this.w / 2, this.frames[0].y + this.h / 2,
                        C.echoDim, 14, 0.25, 1);
    }
    var f = this.frames[this.i];
    this.face = f.f;
    this.state = f.s;

    var ndx = f.x - this.x, ndy = f.y - this.y;
    this.vx = ndx * 60; this.vy = ndy * 60;
    this.x = f.x; this.y = f.y;
    // Move as a solid so the player gets carried / pushed, not clipped.
    world.moveSolid(this, ndx, ndy, true);

    // scarf follows with lag
    var hx = this.x + this.w / 2, hy = this.y + 4;
    for (var i = 0; i < this.scarf.length; i++) {
      var s = this.scarf[i];
      var tx = i === 0 ? hx : this.scarf[i - 1].x;
      var ty = i === 0 ? hy : this.scarf[i - 1].y;
      s.x = U.lerp(s.x, tx - this.face * 2, 0.42);
      s.y = U.lerp(s.y, ty + 1.5, 0.42);
    }

    if (this.state === ST.DASH && Math.random() < 0.5) {
      AL.Particles.trail(this.x + this.w / 2, this.y + this.h / 2, C.echoDim, 0.22);
    }
  };

  Echo.prototype.lights = function (out, world) {
    var lit = world.hasAbility('lightwake');
    var a = this.born * (this.dying > 0 ? this.dying / 0.35 : 1);
    out.push({
      wx: this.x + this.w / 2, wy: this.y + this.h / 2,
      r: (lit ? 74 * AL.Meta.echoLightScale() : 22) * a,
      color: lit ? C.echo : C.echoDim,
      intensity: (lit ? 0.3 : 0.12) * a,
      reveals: lit
    });
  };

  // The looping path, drawn faintly so a puzzle can be read before it's run.
  Echo.prototype.drawPath = function (g, alpha) {
    var fr = this.frames;
    if (fr.length < 4) return;
    g.globalAlpha = alpha;
    g.fillStyle = C.echoDim;
    for (var i = 0; i < fr.length; i += 4) {
      g.fillRect(Math.round(fr[i].x + this.w / 2), Math.round(fr[i].y + this.h / 2), 1, 1);
    }
    g.globalAlpha = 1;
  };

  Echo.prototype.draw = function (g, world) {
    var a = this.born * (this.dying > 0 ? U.clamp(this.dying / 0.35, 0, 1) : 1);
    if (a <= 0.01) return;
    var lit = world.hasAbility('lightwake');
    var body = lit ? C.echo : C.echoDim;

    this.drawPath(g, 0.14 * a);

    var x = Math.round(this.x), y = Math.round(this.y);

    g.save();
    g.globalAlpha = a * 0.9;

    // scarf
    for (var i = this.scarf.length - 1; i >= 0; i--) {
      var s = this.scarf[i];
      g.fillStyle = U.rgba(lit ? C.echo : C.echoDim, 0.5 - i * 0.07);
      var sz = 3 - Math.floor(i / 2);
      g.fillRect(Math.round(s.x) - 1, Math.round(s.y), sz, sz);
    }

    AL.Player.drawFigure(g, x, y, this.face, this.state, body,
                         lit ? '#eafdff' : U.rgba(C.echo, 0.55), true);

    // outline pulse at the loop seam
    if (this.seam > 0.02) {
      g.globalAlpha = a * this.seam * 0.8;
      AL.Draw.frame(g, x - 2, y - 2, this.w + 4, this.h + 4, lit ? '#ffffff' : C.echo);
    }
    g.restore();
    g.globalAlpha = 1;

    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, x + this.w / 2, y + this.h / 2, lit ? 26 : 13, body, 0.3 * a, 0);
    g.restore();
  };

  /* ------------------------------------------------------------- Recorder */

  function Recorder() {
    this.active = false;
    this.frames = [];
    this.max = 0;
    this.startX = 0; this.startY = 0;
    this.tick = 0;
  }

  Recorder.prototype.begin = function (player, seconds) {
    this.active = true;
    this.frames = [];
    this.max = Math.floor(seconds * 60);
    this.startX = player.x; this.startY = player.y;
    this.tick = 0;
    AL.Audio.sfx('recordStart');
    AL.Particles.ring(player.x + player.w / 2, player.y + player.h / 2, C.echo, 24, 0.4, 2);
  };

  Recorder.prototype.capture = function (player) {
    if (!this.active) return;
    this.frames.push({ x: player.x, y: player.y, f: player.face, s: player.animState() });
    this.tick++;
    if (this.tick % 20 === 0) AL.Audio.sfx('recordTick');
  };

  Recorder.prototype.full = function () { return this.frames.length >= this.max; };

  Recorder.prototype.end = function () {
    this.active = false;
    var f = this.frames;
    this.frames = [];
    return f;
  };

  Recorder.prototype.cancel = function () { this.active = false; this.frames = []; };

  Recorder.prototype.progress = function () {
    return this.max ? AL.U.clamp(this.frames.length / this.max, 0, 1) : 0;
  };

  // Live preview of the path being recorded.
  Recorder.prototype.draw = function (g) {
    if (!this.active) return;
    var fr = this.frames;
    g.globalAlpha = 0.5;
    g.fillStyle = C.echo;
    for (var i = 0; i < fr.length; i += 3) {
      g.fillRect(Math.round(fr[i].x + 5), Math.round(fr[i].y + 7), 1, 1);
    }
    g.globalAlpha = 1;
    // where the echo will begin its loop
    var bl = 0.5 + Math.sin(performance.now() / 90) * 0.3;
    g.globalAlpha = bl;
    AL.Draw.frame(g, this.startX - 1, this.startY - 1, 12, 16, C.echo);
    g.globalAlpha = 1;
  };

  Echo.ST = ST;
  Echo.Recorder = Recorder;
  return Echo;
})();
