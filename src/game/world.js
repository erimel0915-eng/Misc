/* The playable world: one room at a time, plus progression, channels, solid
 * bodies, lighting and the HUD.
 *
 * A room is exactly one screen, so there is no camera to speak of — world
 * coordinates are screen coordinates, and the only transform is screen shake.
 */
AL.World = (function () {
  var C = AL.C, U = AL.U, T = AL.TILE;

  function World(opts) {
    this.save = AL.Save.get();
    this.onEnding = opts.onEnding || function () {};
    this.onComplete = opts.onComplete || function () {};

    this.roomIndex = 0;
    this.level = null;
    this.player = null;
    this.cam = new AL.Camera();
    this.respawn = { x: 0, y: 0 };
    this.echoes = [];
    this.recorder = new AL.Echo.Recorder();

    this.solidBodies = [];
    this.lights = [];
    this.powerNow = {};
    this.powerState = {};

    this.roomShards = 0;
    this.transition = null;
    this.titleCard = null;
    this.deathWait = 0;
    this.hintT = 0;
    this.hintText = '';
    this.toast = null;
    this.chamber = 0;
    this.ashSeed = 0;
    this.elapsed = 0;
    this.pendingAfterDialogue = null;
    this.finale = false;
  }

  /* ------------------------------------------------------------- abilities */

  World.prototype.hasAbility = function (n) { return !!this.save.abilities[n]; };

  World.prototype.recordSeconds = function () {
    return this.hasAbility('longbreath') ? 5.0 : 3.0;
  };

  World.prototype.maxEchoes = function () {
    if (this.hasAbility('choir')) return 3;
    if (this.hasAbility('twin')) return 2;
    return 1;
  };

  World.prototype.grantAbility = function (name, scriptKey, x, y) {
    this.save.abilities[name] = true;
    AL.Save.put();
    AL.Audio.sfx('unlock');
    AL.FX.addFlash(0.55, C.echo);
    AL.FX.addShake(4, 6);
    AL.Particles.burst(x, y, C.echo, 40, 150, { life: 1.1, grav: -30, size: 2 });
    AL.Particles.ring(x, y, C.echo, 90, 0.9, 3);
    AL.Particles.ring(x, y, '#ffffff', 50, 0.6, 2);
    if (scriptKey) this.playScript(scriptKey, { once: false });
  };

  /* ------------------------------------------------------------ room setup */

  World.prototype.start = function (roomIndex) {
    this.loadRoom(roomIndex || 0, true);
  };

  World.prototype.loadRoom = function (index, announce) {
    var rooms = AL.Levels.rooms;
    if (index >= rooms.length) { this.onComplete(); return; }
    this.roomIndex = index;
    var def = rooms[index];

    this.echoes.length = 0;
    this.recorder.cancel();
    this.powerNow = {}; this.powerState = {};
    this.roomShards = 0;
    this.deathWait = 0;

    this.level = new AL.Level(def, this);
    this.respawn = { x: this.level.spawn.x, y: this.level.spawn.y };
    this.player = new AL.Player(this.respawn.x, this.respawn.y);
    this.cam.focus(this.level, this.player.x + this.player.w / 2,
                               this.player.y + this.player.h / 2);
    this.ashSeed = def.id ? def.id.length * 977 : 101;

    if (def.chamber !== this.chamber) {
      this.chamber = def.chamber;
      if (announce !== false) {
        this.titleCard = { t: 0, dur: 3.1, roman: AL.Levels.roman(def.chamber),
                           name: AL.Levels.chamberName(def.chamber) };
      }
      AL.Audio.music(AL.Levels.chamberMusic(def.chamber));
    }

    if (def.hint) { this.hintText = def.hint; this.hintT = 6; }

    this.save.room = Math.max(this.save.room || 0, index);
    this.save.started = true;
    AL.Save.put();

    if (def.onEnter) this.playScript(def.onEnter, { once: true });
    AL.FX.reset();
    this.rebuildBodies();
    this.gatherLights();
    this.level.applyLight(this.lights);
    this.level.rebuild(this);
  };

  /* Levels are long now, so dying rolls you back to the last checkpoint
   * rather than to the top. Emberlight and memories you already took stay
   * taken; everything that moves goes back to where it started. */
  World.prototype.restartRoom = function () {
    this.echoes.length = 0;
    this.recorder.cancel();
    this.powerNow = {}; this.powerState = {};
    this.deathWait = 0;

    this.level.reset();
    var ents = this.level.entities;
    for (var i = 0; i < ents.length; i++) {
      if (ents[i].reset) ents[i].reset();
    }

    this.player = new AL.Player(this.respawn.x, this.respawn.y);
    this.cam.focus(this.level, this.player.x + this.player.w / 2,
                               this.player.y + this.player.h / 2);
    this.rebuildBodies();
    this.gatherLights();
    this.level.applyLight(this.lights);
    this.level.rebuild(this);
  };

  World.prototype.setCheckpoint = function (x, y) {
    if (Math.abs(this.respawn.x - x) < 2 && Math.abs(this.respawn.y - y) < 2) return false;
    this.respawn = { x: x, y: y };
    return true;
  };

  World.prototype.exitRoom = function () {
    if (this.transition) return;
    var def = AL.Levels.rooms[this.roomIndex];
    this.save.shards = (this.save.shards || 0) + this.level.requiredShards;
    AL.Save.put();
    AL.Audio.sfx('uiBig');
    AL.FX.addFlash(0.25, C.ember);
    var c = this.player.center();
    this.transition = { t: 0, dur: 0.95, next: this.roomIndex + 1, cx: c.x, cy: c.y };
  };

  World.prototype.roomCleared = function () {
    return this.roomShards >= this.level.requiredShards;
  };

  /* ------------------------------------------------------------ collectibles */

  World.prototype.collectShard = function (shard) {
    this.roomShards++;
    AL.Audio.sfx('shard', this.roomShards - 1);
    AL.FX.addShake(1.4, 9);
    AL.FX.addFreeze(0.03);
    var cx = shard.x + T / 2, cy = shard.y + T / 2;
    AL.Particles.burst(cx, cy, C.ember, 18, 110, { life: 0.6, grav: -20 });
    AL.Particles.ring(cx, cy, C.emberHot, 26, 0.4, 2);
    if (this.roomCleared()) {
      this.toast = { t: 0, text: 'THE WAY OPENS', color: C.ember };
    }
  };

  World.prototype.collectMote = function (mote) {
    this.save.memories[mote.id] = true;
    AL.Save.put();
    AL.Audio.sfx('memory');
    AL.FX.addFlash(0.3, C.iris);
    AL.Particles.burst(mote.x + T / 2, mote.y + T / 2, C.iris, 30, 120, { life: 1.0, grav: -40 });
    AL.Particles.ring(mote.x + T / 2, mote.y + T / 2, C.iris, 60, 0.8, 2);
    var n = this.memoryCount();
    var line = AL.Story.memories[n - 1];
    this.toast = { t: 0, text: 'MEMORY ' + n + '/' + AL.Story.memoryTotal, color: C.iris };
    if (line) this.playScript(null, { lines: line, once: false });
  };

  World.prototype.memoryCount = function () {
    var n = 0;
    for (var k in this.save.memories) if (this.save.memories[k]) n++;
    return n;
  };

  /* ---------------------------------------------------------------- power */

  World.prototype.power = function (chan) { this.powerNow[chan] = true; };
  World.prototype.channel = function (chan) { return !!this.powerState[chan]; };

  /* --------------------------------------------------------- solid bodies */

  World.prototype.rebuildBodies = function () {
    var b = this.solidBodies;
    b.length = 0;
    for (var i = 0; i < this.echoes.length; i++) {
      var e = this.echoes[i];
      if (e.solid && !e.dead && !e.pass) b.push(e);
    }
    var ents = this.level.entities;
    for (var j = 0; j < ents.length; j++) {
      if (ents[j].solid) b.push(ents[j]);
    }
  };

  World.prototype.bodySolidAt = function (x, y, w, h, exclude) {
    var b = this.solidBodies;
    for (var i = 0; i < b.length; i++) {
      var o = b[i];
      if (o === exclude) continue;
      if (U.rectsOverlap(x, y, w, h, o.x, o.y, o.w, o.h)) return true;
    }
    return false;
  };

  World.prototype.canPlace = function (p, x, y) {
    if (this.level.rectSolid(x, y, p.w, p.h)) return false;
    return !this.bodySolidAt(x, y, p.w, p.h, null);
  };

  /* A solid has already moved to (solid.x, solid.y) from (solid.px, solid.py).
   * Push the player out of the way, or carry them if they were standing on it.
   *
   * An Echo landing on your head should shove you aside, not grind you into
   * the floor, so a blocked push searches outward for the nearest free spot
   * before giving up. Only a genuinely sealed gap is a crush. */
  World.prototype.moveSolid = function (solid, dx, dy) {
    if (!dx && !dy) return;
    var p = this.player;
    if (!p || p.dead) return;
    if (solid.pass) return;

    var riding = Math.abs((p.y + p.h) - solid.py) <= 2 &&
                 p.x + p.w > solid.px && p.x < solid.px + solid.w;

    if (U.rectsOverlap(p.x, p.y, p.w, p.h, solid.x, solid.y, solid.w, solid.h)) {
      var spot = this.findFreeSpot(p, solid, dx, dy);
      if (!spot) { p.kill('crush'); return; }
      p.x = spot.x; p.y = spot.y;
      if (spot.axis === 'y') {
        if (dy > 0) p.vy = Math.max(p.vy, 0);
        else { p.grounded = true; p.vy = Math.min(p.vy, 0); }
      }
      return;
    }

    if (riding) {
      var nx = p.x + dx, ny = p.y + dy;
      if (this.canPlace(p, nx, ny)) { p.x = nx; p.y = ny; }
      else if (this.canPlace(p, nx, p.y)) { p.x = nx; }
      else if (this.canPlace(p, p.x, ny)) { p.y = ny; }
    }
  };

  /* Candidate escapes, cheapest first: along the solid's motion, then the
   * shortest sideways nudge, then straight up. */
  World.prototype.findFreeSpot = function (p, solid, dx, dy) {
    var cands = [];
    if (dy !== 0) {
      cands.push({ x: p.x, y: dy > 0 ? solid.y + solid.h : solid.y - p.h, axis: 'y' });
    }
    if (dx !== 0) {
      cands.push({ x: dx > 0 ? solid.x + solid.w : solid.x - p.w, y: p.y, axis: 'x' });
    }
    // sideways, nearer edge first
    var leftX = solid.x - p.w, rightX = solid.x + solid.w;
    var pc = p.x + p.w / 2, sc = solid.x + solid.w / 2;
    if (pc < sc) { cands.push({ x: leftX, y: p.y, axis: 'x' }, { x: rightX, y: p.y, axis: 'x' }); }
    else { cands.push({ x: rightX, y: p.y, axis: 'x' }, { x: leftX, y: p.y, axis: 'x' }); }
    cands.push({ x: p.x, y: solid.y - p.h, axis: 'y' });
    cands.push({ x: p.x, y: solid.y + solid.h, axis: 'y' });

    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!this.level.rectSolid(c.x, c.y, p.w, p.h) &&
          !this.bodySolidAt(c.x, c.y, p.w, p.h, solid)) return c;
    }
    return null;
  };

  /* --------------------------------------------------------------- lights */

  World.prototype.gatherLights = function () {
    var out = this.lights;
    out.length = 0;
    if (this.player && !this.player.dead) this.player.lights(out);
    for (var i = 0; i < this.echoes.length; i++) {
      if (!this.echoes[i].dead) this.echoes[i].lights(out, this);
    }
    var ents = this.level.entities;
    for (var j = 0; j < ents.length; j++) {
      if (ents[j].lights) ents[j].lights(out, this);
    }
  };

  /* ------------------------------------------------------------- dialogue */

  World.prototype.acceptsInput = function () {
    return !AL.Dialogue.active && !this.transition && !(this.player && this.player.dead);
  };

  World.prototype.playScript = function (key, opts) {
    opts = opts || {};
    var lines = opts.lines || (key ? AL.Story.scripts[key] : null);
    if (!lines) return;
    if (key && opts.once) {
      if (this.save.seenRunes[key]) return;
      this.save.seenRunes[key] = true;
      AL.Save.put();
    }
    var self = this;
    this.finale = !!opts.finale;
    AL.Dialogue.start(lines, {
      world: this,
      onEnding: function (kind) { self.onEnding(kind); },
      onDone: function () { self.finale = false; }
    });
  };

  /* --------------------------------------------------------------- echoes */

  World.prototype.toggleEcho = function () {
    var r = this.recorder;
    if (r.active) {
      this.releaseEcho();
      return;
    }
    if (this.echoes.length >= this.maxEchoes()) {
      this.clearEchoes();
      return;
    }
    if (!this.hasAbility('echo')) return;
    r.begin(this.player, this.recordSeconds());
  };

  World.prototype.releaseEcho = function () {
    var frames = this.recorder.end();
    if (frames.length < 6) {
      // too short to be useful — cancel cleanly instead of spawning a stub
      AL.Audio.sfx('echoClear');
      return;
    }
    var e = new AL.Echo(frames, this.echoes.length);
    e.pass = true;      // non-solid until the player steps clear of it
    this.echoes.push(e);
    this.save.echoesMade = (this.save.echoesMade || 0) + 1;
    AL.Audio.sfx('echoSpawn');
    AL.FX.addShake(2.2, 8);
    AL.FX.addFlash(0.16, C.echo);
    AL.Particles.ring(frames[0].x + 5, frames[0].y + 7, C.echo, 40, 0.6, 2);
  };

  World.prototype.clearEchoes = function () {
    if (!this.echoes.length) return;
    for (var i = 0; i < this.echoes.length; i++) this.echoes[i].dissolve();
    AL.Audio.sfx('echoClear');
  };

  /* --------------------------------------------------------------- update */

  World.prototype.update = function (dt) {
    this.elapsed += dt;
    this.save.time = (this.save.time || 0) + dt;

    // Hold the chamber card back while anyone is talking, so the opening
    // narration and the card never share the screen.
    if (this.titleCard && !AL.Dialogue.active) {
      this.titleCard.t += dt;
      if (this.titleCard.t >= this.titleCard.dur) this.titleCard = null;
    }
    if (this.toast) {
      this.toast.t += dt;
      if (this.toast.t > 2.2) this.toast = null;
    }
    if (this.hintT > 0) this.hintT -= dt;

    this.spawnAsh(dt);

    if (this.transition) {
      this.transition.t += dt;
      var tr = this.transition;
      if (tr.t >= tr.dur * 0.5 && !tr.loaded) {
        tr.loaded = true;
        this.loadRoom(tr.next);
      }
      if (tr.t >= tr.dur) this.transition = null;
      AL.Particles.update(dt);
      return;
    }

    if (AL.Dialogue.active) {
      AL.Dialogue.update(dt);
      AL.Particles.update(dt);
      // the world holds its breath, but keeps breathing
      for (var li = 0; li < this.level.entities.length; li++) {
        var le = this.level.entities[li];
        if (le instanceof AL.Entities.Iris || le instanceof AL.Entities.Lamp) le.update(dt, this);
      }
      this.gatherLights();
      return;
    }

    /* ---- one fixed step of the simulation ---- */
    this.powerState = this.powerNow;
    this.powerNow = {};

    this.gatherLights();
    this.level.applyLight(this.lights);
    this.level.rebuild(this);
    this.level.update(dt);
    this.rebuildBodies();

    // echoes move first: they are the world's clockwork
    for (var i = 0; i < this.echoes.length; i++) {
      var e = this.echoes[i];
      e.update(dt, this);
      if (e.pass && this.player && !U.rectsOverlap(this.player.x, this.player.y, this.player.w, this.player.h,
                                                   e.x, e.y, e.w, e.h)) {
        e.pass = false;
        this.rebuildBodies();
      }
    }
    for (var d = this.echoes.length - 1; d >= 0; d--) {
      if (this.echoes[d].dead) this.echoes.splice(d, 1);
    }

    var ents = this.level.entities;
    for (var j = 0; j < ents.length; j++) ents[j].update(dt, this);

    var p = this.player;
    if (p) {
      p.update(dt, this);
      if (this.recorder.active) {
        this.recorder.capture(p);
        if (this.recorder.full()) this.releaseEcho();
      }
    }
    this.cam.update(dt, this.level, this.player);

    /* ---- input: echo + reset ---- */
    if (this.acceptsInput()) {
      if (AL.Input.consume('echo')) this.toggleEcho();
      if (AL.Input.consume('clear')) this.clearEchoes();
      if (AL.Input.consume('reset')) {
        AL.Audio.sfx('echoClear');
        AL.FX.addFlash(0.12, C.echo);
        this.restartRoom();
        return;
      }
    }

    /* ---- death ---- */
    if (p && p.dead) {
      if (this.recorder.active) this.recorder.cancel();
      this.deathWait += dt;
      if (this.deathWait > 0.55) {
        this.save.deaths = (this.save.deaths || 0) + 1;
        AL.Save.put();
        this.restartRoom();
      }
    }

    AL.Particles.update(dt);
  };

  World.prototype.spawnAsh = function (dt) {
    // Ash is always falling. It is how the world forgets itself.
    var rate = 14 + this.chamber * 2;
    this._ashAcc = (this._ashAcc || 0) + rate * dt;
    while (this._ashAcc >= 1) {
      this._ashAcc -= 1;
      AL.Particles.spawn({
        x: this.cam.renderX() + U.rand(-10, AL.W + 10),
        y: this.cam.renderY() - 6,
        vx: U.rand(-6, 10), vy: U.rand(8, 26),
        life: U.rand(5, 12), size: 1, color: Math.random() < 0.2 ? C.ash : C.ashDim,
        kind: 'ash', a0: U.rand(0.25, 0.7)
      });
    }
  };

  /* ----------------------------------------------------------------- draw */

  World.prototype.draw = function (g) {
    var lv = this.level;
    if (!lv) return;

    var sh = AL.FX.offset();
    var cx = this.cam.renderX(), cy = this.cam.renderY();

    // Sky and distant ruin are drawn in screen space; they parallax themselves.
    g.save();
    g.translate(sh.x, sh.y);
    lv.drawBackground(g, this, this.cam);
    g.restore();

    // Everything else lives in world space.
    g.save();
    g.translate(-cx + sh.x, -cy + sh.y);

    AL.Particles.draw(g, 0, 0);
    lv.draw(g, this, this.cam);

    var ents = lv.entities;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e instanceof AL.Entities.Exit || e instanceof AL.Entities.Plate ||
          e instanceof AL.Entities.Rune || e instanceof AL.Entities.Lamp ||
          e instanceof AL.Entities.Altar || e instanceof AL.Entities.Iris ||
          e instanceof AL.Entities.Checkpoint) e.draw(g, this);
    }
    for (var k = 0; k < this.echoes.length; k++) this.echoes[k].draw(g, this);
    for (var m = 0; m < ents.length; m++) {
      var e2 = ents[m];
      if (e2 instanceof AL.Entities.Mover || e2 instanceof AL.Entities.Shade ||
          e2 instanceof AL.Entities.Shard || e2 instanceof AL.Entities.Mote ||
          e2 instanceof AL.Entities.Laser) e2.draw(g, this);
    }
    this.recorder.draw(g);
    if (this.player) this.player.draw(g, this);

    g.restore();

    /* The darkness pass is a full-screen overlay, so it has to happen outside
     * the world transform with every light converted to screen space. */
    var self = this;
    function toScreen(L) {
      return { x: L.wx - cx + sh.x, y: L.wy - cy + sh.y, r: L.r,
               color: L.color, intensity: L.intensity, soft: L.soft };
    }
    var screenLights = this.lights.map(toScreen);
    if (lv.dark > 0.02) AL.Draw.lights(g, screenLights, lv.dark, C.void0);
    AL.Draw.bloom(g, screenLights);

    AL.Draw.vignette(g, 0.26 + lv.dark * 0.18);
    this.drawHUD(g);

    if (this.transition) {
      var tr = this.transition;
      var t = tr.t / tr.dur;
      var a = t < 0.5 ? U.easeIn(t * 2) : U.easeOut(1 - (t - 0.5) * 2);
      AL.Draw.iris(g, 1 - a, tr.cx - cx, tr.cy - cy);
    }
    if (AL.FX.flash > 0.01) AL.Draw.fade(g, AL.FX.flash * 0.7, AL.FX.flashColor);
    if (AL.FX.chroma > 0.01) AL.Draw.scanTear(g, AL.FX.chroma);

    if (AL.Dialogue.active) AL.Dialogue.draw(g);
  };

  /* ------------------------------------------------------------------ HUD */

  World.prototype.drawHUD = function (g) {
    if (this.pausedView) return;      // the pause menu owns the screen
    var lv = this.level;
    var pad = 6;

    // chamber / room
    g.globalAlpha = 0.65;
    AL.Draw.text(g, AL.Levels.roman(lv.chamber) + '  ' + lv.name.toUpperCase(), pad, pad,
                 { size: 7, color: C.ashDim, spacing: 1.4 });
    g.globalAlpha = 1;

    // emberlight
    var need = lv.requiredShards;
    if (need > 0) {
      var bx = AL.W - pad;
      for (var i = need - 1; i >= 0; i--) {
        var got = i < this.roomShards;
        bx -= 7;
        g.fillStyle = got ? C.ember : U.rgba(C.ember, 0.2);
        g.fillRect(bx, pad + 1, 3, 3);
        g.fillRect(bx - 1, pad + 2, 5, 1);
        g.fillRect(bx + 1, pad, 1, 5);
      }
    }

    // echo pips + record meter
    if (this.hasAbility('echo')) {
      var maxE = this.maxEchoes();
      var ex = pad, ey = AL.H - 13;
      AL.Draw.text(g, 'ECHO', ex, ey - 8, { size: 6, color: U.rgba(C.echo, 0.6), spacing: 1.2 });
      for (var j = 0; j < maxE; j++) {
        var used = j < this.echoes.length;
        g.fillStyle = used ? C.echo : U.rgba(C.echo, 0.22);
        g.fillRect(ex + j * 7, ey, 5, 5);
        if (used) {
          g.fillStyle = U.rgba('#ffffff', 0.7);
          g.fillRect(ex + j * 7 + 1, ey + 1, 2, 2);
        }
      }
      if (this.recorder.active) {
        var w = 54, pr = this.recorder.progress();
        var mx = ex + maxE * 7 + 6;
        g.fillStyle = U.rgba(C.void0, 0.8);
        g.fillRect(mx, ey, w, 5);
        g.fillStyle = pr > 0.85 ? C.bad : C.echo;
        g.fillRect(mx, ey, Math.round(w * pr), 5);
        g.globalAlpha = 0.5 + Math.sin(this.elapsed * 14) * 0.4;
        AL.Draw.text(g, 'RECORDING', mx + w + 5, ey - 1, { size: 6, color: C.echo, spacing: 1 });
        g.globalAlpha = 1;
      } else if (this.echoes.length >= maxE) {
        AL.Draw.text(g, 'X RECALL', ex + maxE * 7 + 6, ey - 1,
                     { size: 6, color: U.rgba(C.ash, 0.45), spacing: 1 });
      }
    }

    // memory counter, only once you've found one
    var mc = this.memoryCount();
    if (mc > 0) {
      AL.Draw.text(g, mc + '/' + AL.Story.memoryTotal, AL.W - pad, AL.H - 12,
                   { size: 6, color: U.rgba(C.iris, 0.55), align: 'right', spacing: 1 });
      g.fillStyle = U.rgba(C.iris, 0.7);
      g.fillRect(AL.W - pad - 26, AL.H - 11, 2, 2);
    }

    // transient hint
    if (this.hintT > 0 && this.hintText) {
      var ha = U.clamp(this.hintT, 0, 1) * 0.8;
      AL.Draw.text(g, this.hintText, AL.W / 2, AL.H - 30,
                   { size: 7, align: 'center', color: C.ash, alpha: ha, spacing: 1.3 });
    }

    // toast
    if (this.toast) {
      var tt = this.toast.t;
      var a = tt < 0.25 ? tt / 0.25 : U.clamp((2.2 - tt) / 0.6, 0, 1);
      AL.Draw.text(g, this.toast.text, AL.W / 2, 34,
                   { size: 8, align: 'center', color: this.toast.color, alpha: a,
                     spacing: 2.4, glow: this.toast.color, glowSize: 8 });
    }

    // chamber title card
    if (this.titleCard && !AL.Dialogue.active) {
      var tc = this.titleCard, tp = tc.t / tc.dur;
      var ca = tp < 0.12 ? tp / 0.12 : U.clamp((1 - tp) / 0.3, 0, 1);
      g.globalAlpha = ca;
      AL.Draw.fade(g, 0.55 * ca, C.void0);
      AL.Draw.text(g, 'CHAMBER ' + tc.roman, AL.W / 2, AL.H / 2 - 18,
                   { size: 9, align: 'center', color: C.ember, spacing: 4,
                     glow: C.ember, glowSize: 10, alpha: ca });
      AL.Draw.text(g, tc.name.toUpperCase(), AL.W / 2, AL.H / 2 + 2,
                   { size: 12, align: 'center', color: C.bone, spacing: 3, alpha: ca });
      g.fillStyle = U.rgba(C.ember, 0.5 * ca);
      g.fillRect(AL.W / 2 - 40, AL.H / 2 + 22, 80, 1);
      g.globalAlpha = 1;
    }
  };

  return World;
})();
