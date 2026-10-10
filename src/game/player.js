/* Wren. Coyote time, jump buffering, variable jump height, apex float and a
 * cancellable 8-way dash — the small mercies that make a platformer feel fair.
 */
AL.Player = (function () {
  var C = AL.C, U = AL.U;
  var ST = { IDLE: 0, RUN: 1, JUMP: 2, FALL: 3, DASH: 4 };

  var K = {
    RUN_MAX:    112,
    ACC_GROUND: 1050,
    ACC_AIR:    820,
    FRICTION:   1350,
    AIR_DRAG:   320,
    GRAV:       1020,
    GRAV_APEX:  660,     // gentler near the top of a jump
    APEX_BAND:  42,
    MAX_FALL:   340,
    /* Tuned so the vertical vocabulary lands on clean tile steps:
     *   from a surface            -> 3 tiles up
     *   off an Echo standing on it -> 4 tiles up
     *   riding an Echo's jump      -> 7 tiles up
     * Each has ~7px of slack either side, so no jump is frame-perfect and
     * none accidentally clears the next tier. */
    JUMP_V:    -336,
    JUMP_CUT:   0.40,
    COYOTE:     0.09,
    BUFFER:     0.13,
    DASH_SPEED: 268,
    DASH_TIME:  0.145,
    DASH_END:   0.55,    // fraction of dash speed kept afterwards
    DASH_COOL:  0.22
  };

  function Player(x, y) {
    this.w = 10; this.h = 14;
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.face = 1;
    this.grounded = false;
    this.wasGrounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.dead = false;
    this.deathT = 0;
    this.deathCause = null;
    this.spawnT = 0.3 + (AL.Meta ? AL.Meta.graceBonus() : 0);
    this.dash = 0;          // remaining dash time
    this.dashCool = 0;
    this.dashReady = true;
    this.dashCharges = 1;
    this.dashDirX = 0; this.dashDirY = 0;
    this.squashX = 1; this.squashY = 1;
    this.landT = 0;
    this.scarf = [];
    for (var i = 0; i < 6; i++) this.scarf.push({ x: this.x, y: this.y });
    this.ridingSolid = null;
    this.lanternT = 0;
  }

  Player.ST = ST;
  Player.K = K;

  Player.prototype.animState = function () {
    if (this.dash > 0) return ST.DASH;
    if (!this.grounded) return this.vy < -12 ? ST.JUMP : ST.FALL;
    return Math.abs(this.vx) > 12 ? ST.RUN : ST.IDLE;
  };

  Player.prototype.center = function () { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; };

  /* ------------------------------------------------------------- movement */

  Player.prototype.update = function (dt, world) {
    this.lanternT += dt;

    if (this.dead) {
      this.deathT += dt;
      return;
    }
    if (this.spawnT > 0) this.spawnT -= dt;

    var In = AL.Input;
        var canAct = world.acceptsInput();
    var ix = canAct ? In.xAxis() : 0;
    var iy = canAct ? In.yAxis() : 0;

    this.wasGrounded = this.grounded;

    /* ---- dash ---- */
    if (this.dashCool > 0) this.dashCool -= dt;
    if (world.hasAbility('dash')) {
      var maxCharges = 1 + AL.Meta.airDashes();
      if (this.grounded && this.dash <= 0) this.dashCharges = maxCharges;
      if (canAct && In.pressed('dash') && this.dashCharges > 0 && this.dash <= 0 && this.dashCool <= 0) {
        In.consume('dash');
        var dx = ix, dy = iy;
        /* A Second Wind carries you forward, not up. The first dash off the
         * ground is yours to aim; any extra one bought in the Cache is
         * horizontal only, so no purchase can lift Wren past the 7 tiles the
         * level design already grants for riding an Echo. */
        var isAirDash = this.dashCharges < maxCharges;
        if (isAirDash) { dy = 0; if (!dx) dx = this.face; }
        if (!dx && !dy) dx = this.face;
        var m = Math.sqrt(dx * dx + dy * dy) || 1;
        this.dashDirX = dx / m; this.dashDirY = dy / m;
        this.dash = K.DASH_TIME;
        this.dashCharges--;
        this.dashCool = K.DASH_COOL * AL.Meta.dashCoolScale();
        this.vx = this.dashDirX * K.DASH_SPEED;
        this.vy = this.dashDirY * K.DASH_SPEED;
        if (dx) this.face = U.sign(dx);
        this.squashX = 1.4; this.squashY = 0.68;
        AL.Audio.sfx('dash');
        AL.FX.addShake(2.0, 9);
        AL.FX.addFreeze(0.045);
        AL.Particles.burst(this.x + this.w / 2, this.y + this.h / 2, C.bone, 12, 110,
                           { life: 0.3, grav: 0, drag: 0.86 });
        AL.Particles.ring(this.x + this.w / 2, this.y + this.h / 2, C.bone, 20, 0.3, 2);
      }
    }

    if (this.dash > 0) {
      this.dash -= dt;
      this.vx = this.dashDirX * K.DASH_SPEED;
      this.vy = this.dashDirY * K.DASH_SPEED;
      AL.Particles.trail(this.x + this.w / 2, this.y + this.h / 2, C.bone, 0.2);
      if (this.dash <= 0) {
        this.vx *= K.DASH_END;
        this.vy *= this.dashDirY < 0 ? 0.62 : K.DASH_END;
      }
    } else {
      /* ---- horizontal ---- */
      var acc = this.grounded ? K.ACC_GROUND : K.ACC_AIR;
      if (ix !== 0) {
        this.face = ix;
        // turning around is snappier than accelerating from rest
        var turn = (U.sign(this.vx) !== 0 && U.sign(this.vx) !== ix) ? 1.9 : 1;
        this.vx = U.approach(this.vx, ix * K.RUN_MAX * AL.Meta.runScale(), acc * turn * dt);
      } else {
        var f = this.grounded ? K.FRICTION : K.AIR_DRAG;
        this.vx = U.decay(this.vx, f * dt);
      }

      /* ---- gravity ---- */
      var g = K.GRAV;
      if (Math.abs(this.vy) < K.APEX_BAND && !this.grounded) g = K.GRAV_APEX;
      if (this.jumping && this.vy < 0 && !(canAct && In.held('jump'))) {
        this.vy *= Math.pow(K.JUMP_CUT, dt * 18);
        if (this.vy > -40) this.jumping = false;
      }
      this.vy = Math.min(this.vy + g * dt, K.MAX_FALL);
    }

    /* ---- jump ---- */
    var foot = AL.Meta.footingScale();
    if (this.grounded) this.coyote = K.COYOTE * foot; else this.coyote = Math.max(0, this.coyote - dt);
    if (canAct && In.pressed('jump')) this.buffer = K.BUFFER * foot;
    this.buffer = Math.max(0, this.buffer - dt);

    if (this.buffer > 0 && this.coyote > 0 && this.dash <= 0) {
      this.buffer = 0; this.coyote = 0;
      In.consume('jump');
      this.vy = K.JUMP_V;
      this.jumping = true;
      this.grounded = false;
      this.squashX = 0.72; this.squashY = 1.34;
      AL.Audio.sfx('jump');
      AL.Particles.dust(this.x + this.w / 2, this.y + this.h, -U.sign(this.vx));
    }

    /* ---- integrate + collide ---- */
    this.moveX(this.vx * dt, world);
    this.moveY(this.vy * dt, world);

    /* ---- landing ---- */
    if (this.grounded && !this.wasGrounded) {
      var hard = this._fallSpeed > 250;
      AL.Audio.sfx('land', hard);
      this.squashX = hard ? 1.42 : 1.2;
      this.squashY = hard ? 0.62 : 0.82;
      this.landT = 0.18;
      if (hard) AL.FX.addShake(1.6, 10);
      AL.Particles.dust(this.x + this.w / 2, this.y + this.h, 1);
      AL.Particles.dust(this.x + this.w / 2, this.y + this.h, -1);
      this.jumping = false;
    }
    if (!this.grounded) this._fallSpeed = this.vy;
    if (this.landT > 0) this.landT -= dt;

    this.squashX = U.approach(this.squashX, 1, dt * 5.5);
    this.squashY = U.approach(this.squashY, 1, dt * 5.5);

    /* ---- hazards ---- */
    var lv = world.level;
    if (lv.rectHazard(this.x + 1, this.y + 1, this.w - 2, this.h - 2)) this.kill('spike');
    if (this.y > world.level.heightPx + 40) this.kill('fall');
    if (this.grounded) lv.touchCrumble(this.x, this.w, this.y + this.h, dt);

    /* ---- running dust + scarf ---- */
    if (this.grounded && Math.abs(this.vx) > 70 && Math.random() < 0.28) {
      AL.Particles.spawn({ x: this.x + this.w / 2, y: this.y + this.h - 1,
        vx: -U.sign(this.vx) * U.rand(10, 30), vy: U.rand(-14, -2),
        life: U.rand(0.15, 0.3), size: 1.5, color: C.ashDim, grav: 90, drag: 0.9 });
    }
    this.updateScarf();
  };

  Player.prototype.updateScarf = function () {
    var hx = this.x + this.w / 2 - this.face * 3;
    var hy = this.y + 5;
    for (var i = 0; i < this.scarf.length; i++) {
      var s = this.scarf[i];
      var tx = i === 0 ? hx : this.scarf[i - 1].x;
      var ty = i === 0 ? hy : this.scarf[i - 1].y;
      var k = 0.45 - i * 0.02;
      s.x = U.lerp(s.x, tx - this.face * 2.2 - this.vx * 0.012, k);
      s.y = U.lerp(s.y, ty + 1.6 - this.vy * 0.006, k);
    }
  };

  /* Axis-separated AABB sweep. Resolving one axis at a time is what lets you
   * slide along walls instead of catching on tile seams. */
  Player.prototype.moveX = function (amount, world) {
    if (amount === 0) return;
    var step = U.sign(amount);
    var remain = Math.abs(amount);
    var lv = world.level;
    while (remain > 0) {
      var d = Math.min(remain, 1) * step;
      var nx = this.x + d;
      if (lv.rectSolid(nx, this.y, this.w, this.h) || world.bodySolidAt(nx, this.y, this.w, this.h, this)) {
        this.vx = 0;
        if (this.dash > 0) { this.dash = 0; this.dashDirX = 0; }
        return;
      }
      this.x = nx;
      remain -= 1;
    }
  };

  Player.prototype.moveY = function (amount, world) {
    var lv = world.level;
    this.grounded = false;
    if (amount === 0) {
      // still need a ground probe when standing perfectly still
      if (lv.rectSolid(this.x, this.y + 1, this.w, this.h) ||
          world.bodySolidAt(this.x, this.y + 1, this.w, this.h, this) ||
          lv.oneWayLanding(this.x, this.w, this.y + this.h, this.y + this.h + 1) >= 0) {
        this.grounded = true;
      }
      return;
    }
    var step = U.sign(amount);
    var remain = Math.abs(amount);
    while (remain > 0) {
      var d = Math.min(remain, 1) * step;
      var ny = this.y + d;
      var hit = lv.rectSolid(this.x, ny, this.w, this.h) ||
                world.bodySolidAt(this.x, ny, this.w, this.h, this);
      if (!hit && step > 0) {
        var top = lv.oneWayLanding(this.x, this.w, this.y + this.h, ny + this.h);
        if (top >= 0) { this.y = top - this.h; this.vy = 0; this.grounded = true; return; }
      }
      if (hit) {
        if (step > 0) { this.grounded = true; }
        else if (this.dash > 0 && this.dashDirY < 0) { this.dash = 0; }
        this.vy = 0;
        if (this.dash > 0 && this.dashDirY !== 0) this.dash = 0;
        return;
      }
      this.y = ny;
      remain -= 1;
    }
    if (step > 0) {
      if (lv.rectSolid(this.x, this.y + 1, this.w, this.h) ||
          world.bodySolidAt(this.x, this.y + 1, this.w, this.h, this)) this.grounded = true;
    }
  };

  /* ------------------------------------------------------------ life/death */

  Player.prototype.kill = function (cause) {
    if (this.dead || this.spawnT > 0) return;
    this.dead = true;
    this.deathT = 0;
    this.deathCause = cause || 'death';
    AL.Audio.sfx('die');
    AL.FX.addShake(5, 7);
    AL.FX.addFlash(0.42, C.bad);
    AL.FX.addFreeze(0.09);
    AL.FX.addChroma(0.8);
    var c = this.center();
    AL.Particles.burst(c.x, c.y, C.bone, 26, 150, { life: 0.7, grav: 320, size: 2 });
    AL.Particles.burst(c.x, c.y, C.cloth, 10, 110, { life: 0.8, grav: 280, size: 2 });
    AL.Particles.ring(c.x, c.y, C.bad, 38, 0.5, 2);
  };

  Player.prototype.lights = function (out) {
    // Wren carries a dying lantern; it is barely enough.
    var fl = 1 + Math.sin(this.lanternT * 9) * 0.04 + Math.sin(this.lanternT * 3.1) * 0.05;
    out.push({ wx: this.x + this.w / 2, wy: this.y + 6, r: 54 * fl * AL.Meta.lanternScale(), color: C.ember,
               intensity: 0.26, reveals: false, soft: 0.35 });
  };

  /* -------------------------------------------------------------- drawing */

  /* Shared by Wren and her Echoes, so a copy of you always moves like you.
   * The leg phase is derived from world position rather than a timer, which
   * makes a replayed Echo animate identically every loop. */
  Player.drawFigure = function (g, x, y, face, state, main, accent, isEcho) {
    var legPhase = Math.floor(x / 5) & 1;

    if (state === ST.DASH) {
      g.fillStyle = main;
      g.fillRect(x - 1, y + 3, 12, 8);
      g.fillStyle = accent;
      g.fillRect(x + (face > 0 ? 6 : 1), y + 4, 3, 3);
      return;
    }

    // legs
    g.fillStyle = main;
    if (state === ST.RUN) {
      if (legPhase) { g.fillRect(x + 1, y + 10, 3, 4); g.fillRect(x + 6, y + 10, 3, 3); }
      else          { g.fillRect(x + 2, y + 10, 3, 3); g.fillRect(x + 6, y + 10, 3, 4); }
    } else if (state === ST.JUMP) {
      g.fillRect(x + 2, y + 10, 3, 3); g.fillRect(x + 6, y + 9, 3, 3);
    } else if (state === ST.FALL) {
      g.fillRect(x + 1, y + 10, 3, 4); g.fillRect(x + 6, y + 10, 3, 4);
    } else {
      g.fillRect(x + 2, y + 10, 3, 4); g.fillRect(x + 6, y + 10, 3, 4);
    }

    // torso
    g.fillRect(x + 2, y + 5, 6, 6);
    // arms
    if (state === ST.FALL)      { g.fillRect(x, y + 4, 2, 3); g.fillRect(x + 8, y + 4, 2, 3); }
    else if (state === ST.JUMP) { g.fillRect(x, y + 6, 2, 3); g.fillRect(x + 8, y + 6, 2, 3); }
    else if (state === ST.RUN)  {
      if (legPhase) { g.fillRect(x + (face > 0 ? 8 : 0), y + 6, 2, 3); }
      else          { g.fillRect(x + (face > 0 ? 0 : 8), y + 6, 2, 3); }
    } else { g.fillRect(x + 1, y + 6, 2, 4); g.fillRect(x + 7, y + 6, 2, 4); }

    // head
    g.fillRect(x + 2, y, 6, 5);
    // eye / visor
    g.fillStyle = accent;
    g.fillRect(x + (face > 0 ? 5 : 3), y + 2, 2, 2);
    if (!isEcho) {
      // the scarf knot: the only warm colour on her
      g.fillStyle = AL.C.cloth;
      g.fillRect(x + 2, y + 4, 6, 2);
    } else {
      g.fillStyle = accent;
      g.fillRect(x + 2, y + 4, 6, 1);
    }
  };

  Player.prototype.draw = function (g, world) {
    if (this.dead) return;
    var x = Math.round(this.x), y = Math.round(this.y);

    // scarf trail
    for (var i = this.scarf.length - 1; i >= 0; i--) {
      var s = this.scarf[i];
      g.fillStyle = U.rgba(C.cloth, 0.85 - i * 0.12);
      var sz = Math.max(1, 3 - Math.floor(i / 2));
      g.fillRect(Math.round(s.x) - 1, Math.round(s.y), sz, sz);
    }

    g.save();
    // squash & stretch around the feet
    if (Math.abs(this.squashX - 1) > 0.01 || Math.abs(this.squashY - 1) > 0.01) {
      g.translate(x + this.w / 2, y + this.h);
      g.scale(this.squashX, this.squashY);
      g.translate(-(x + this.w / 2), -(y + this.h));
    }
    if (this.spawnT > 0) g.globalAlpha = 0.4 + 0.6 * (1 - this.spawnT / 0.3);
    AL.Player.drawFigure(g, x, y, this.face, this.animState(), C.bone, C.void1, false);
    g.restore();
    g.globalAlpha = 1;

    // lantern glow at her hip
    g.save();
    g.globalCompositeOperation = 'lighter';
    AL.Draw.radial(g, x + this.w / 2, y + 7, 15, C.ember, 0.3, 0);
    g.restore();
  };

  return Player;
})();
