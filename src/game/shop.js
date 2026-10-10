/* The Warden's Cache.
 *
 * Shown between levels and from the pause menu. Everything on sale here makes
 * Wren faster, brighter, longer-breathed or better accompanied — never taller,
 * because the levels are built on a measured jump and an extra tile of reach
 * would quietly unmake them.
 */
(function () {
  var C = AL.C, U = AL.U, D = AL.Draw;

  var ROWS = 6;              // visible rows in the list
  var ROW_H = 21;
  var LIST_TOP = 72;

  function Cache(opts) {
    opts = opts || {};
    this.next = opts.next != null ? opts.next : null;   // level to descend to
    this.summary = opts.summary || null;
    this.onLeave = opts.onLeave || null;
    this.t = 0;
    this.sel = 0;
    this.scroll = 0;
    this.offline = null;
    this.bought = 0;
    this.flash = 0;
    this.items = [];
  }

  Cache.prototype.refresh = function () {
    this.items = AL.Meta.UPGRADES.filter(function (u) { return AL.Meta.available(u.id); });
    if (this.sel >= this.items.length) this.sel = this.items.length - 1;
  };

  Cache.prototype.enter = function () {
    this.refresh();
    this.offline = AL.Meta.collectOffline();
    AL.Audio.music('calm');
  };

  Cache.prototype.update = function (dt) {
    this.t += dt;
    this.flash = U.decay(this.flash, dt * 2.2);
    AL.Meta.tick(dt);
    AL.Particles.update(dt);
    if (Math.random() < 0.35) {
      AL.Particles.spawn({ x: U.rand(-10, AL.W + 10), y: -6,
        vx: U.rand(-6, 10), vy: U.rand(8, 22), life: U.rand(5, 11), size: 1,
        color: Math.random() < 0.3 ? C.ember : C.ashDim, kind: 'ash', a0: U.rand(0.2, 0.5) });
    }

    var In = AL.Input;
    if (In.consume('up'))   { this.sel = (this.sel - 1 + this.items.length) % this.items.length; AL.Audio.sfx('blip'); }
    if (In.consume('down')) { this.sel = (this.sel + 1) % this.items.length; AL.Audio.sfx('blip'); }

    // keep the selection inside the window
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel > this.scroll + ROWS - 1) this.scroll = this.sel - ROWS + 1;
    this.scroll = U.clamp(this.scroll, 0, Math.max(0, this.items.length - ROWS));

    if (In.consume('accept')) {
      var it = this.items[this.sel];
      if (it && AL.Meta.buy(it.id)) {
        this.bought++;
        this.flash = 1;
        AL.Audio.sfx('unlock');
        AL.FX.addFlash(0.16, C.ember);
        this.refresh();
      } else {
        AL.Audio.sfx('blip');
      }
    }

    if (In.consume('back') || In.consume('pause')) this.leave();
  };

  Cache.prototype.leave = function () {
    AL.Audio.sfx('uiBig');
    AL.Save.get().lastSeen = Date.now();
    AL.Save.put();
    if (this.onLeave) { this.onLeave(); return; }
    if (this.next != null) AL.Game.startPlay(this.next);
    else AL.Game.setScene(new AL.Scenes.Title());
  };

  /* ------------------------------------------------------------------ draw */

  function pips(g, x, y, n, max, on, off) {
    for (var i = 0; i < max; i++) {
      g.fillStyle = i < n ? on : off;
      g.fillRect(x + i * 5, y, 3, 3);
    }
    return max * 5;
  }

  Cache.prototype.draw = function (g) {
    var save = AL.Save.get();
    D.fade(g, 1, '#07070e');

    // a warm pool behind the counter
    g.save();
    g.globalCompositeOperation = 'lighter';
    D.radial(g, AL.W / 2, 30, 210, C.ember, 0.10 + this.flash * 0.05, 0);
    g.restore();
    AL.Particles.draw(g, 0, 0);

    D.text(g, "THE WARDEN'S CACHE", AL.W / 2, 8,
           { size: 11, align: 'center', color: C.bone, spacing: 3.6, glow: C.ember, glowSize: 8 });

    // purse
    var ember = save.ember | 0;
    D.text(g, ember.toLocaleString(), AL.W / 2 - 6, 26, {
      size: 14, align: 'right', color: C.emberHot, spacing: 1,
      glow: this.flash > 0.02 ? '#ffffff' : C.ember, glowSize: 8
    });
    D.ember(g, AL.W / 2 + 2, 33, C.ember, 2);
    D.text(g, 'EMBERLIGHT', AL.W / 2 + 12, 31, { size: 6, color: U.rgba(C.ash, 0.55), spacing: 1.4 });

    // rank bar
    var rp = AL.Meta.rankProgress();
    var bw = 180, bx = AL.W / 2 - bw / 2, by = 48;
    D.text(g, 'WARDEN RANK ' + rp.r, bx, by - 9, { size: 6, color: U.rgba(C.iris, 0.85), spacing: 1.6 });
    D.text(g, (save.earned | 0).toLocaleString() + ' / ' + rp.hi.toLocaleString(), bx + bw, by - 9,
           { size: 6, align: 'right', color: U.rgba(C.ash, 0.45), spacing: 1 });
    g.fillStyle = U.rgba(C.void0, 0.9);
    g.fillRect(bx, by, bw, 4);
    g.fillStyle = C.iris;
    g.fillRect(bx, by, Math.round(bw * rp.frac), 4);
    D.text(g, '×' + AL.Meta.earnMultiplier().toFixed(2) + ' EARNINGS',
           AL.W / 2, by + 7, { size: 6, align: 'center', color: U.rgba(C.iris, 0.5), spacing: 1.2 });

    // the list
    var top = LIST_TOP;
    for (var i = 0; i < ROWS; i++) {
      var idx = this.scroll + i;
      if (idx >= this.items.length) break;
      var u = this.items[idx];
      var n = AL.Meta.level(u.id);
      var maxed = AL.Meta.maxed(u.id);
      var price = AL.Meta.cost(u.id);
      var afford = AL.Meta.canBuy(u.id);
      var on = idx === this.sel;
      var y = top + i * ROW_H;

      if (on) {
        var pulse = 0.5 + Math.sin(this.t * 5) * 0.2;
        g.fillStyle = U.rgba(afford ? C.ember : C.ash, 0.08 + pulse * 0.05);
        g.fillRect(14, y - 3, AL.W - 28, ROW_H - 2);
        g.fillStyle = U.rgba(afford ? C.ember : C.ashDim, 0.85);
        g.fillRect(14, y - 3, 2, ROW_H - 2);
      }

      var nameCol = maxed ? C.plate : (on ? C.bone : U.rgba(C.ash, 0.88));
      D.text(g, u.name.toUpperCase(), 22, y, { size: 8, color: nameCol, spacing: 1.3 });
      D.text(g, maxed ? u.detail(n) : u.blurb, 22, y + 10,
             { size: 6, color: U.rgba(C.ash, on ? 0.95 : 0.62), spacing: 1 });

      pips(g, 150, y + 2, n, u.max, maxed ? C.plate : C.ember, U.rgba(C.ember, 0.18));

      if (maxed) {
        D.text(g, 'FULL', AL.W - 22, y + 1, { size: 7, align: 'right', color: C.plate, spacing: 1.6 });
      } else {
        D.text(g, price.toLocaleString(), AL.W - 32, y + 1, {
          size: 8, align: 'right', color: afford ? C.emberHot : U.rgba(C.bad, 0.65), spacing: 1
        });
        D.ember(g, AL.W - 26, y + 5, afford ? C.ember : U.rgba(C.ember, 0.35));
      }
    }

    // scroll hint
    if (this.items.length > ROWS) {
      var frac = this.scroll / (this.items.length - ROWS);
      var trackH = ROWS * ROW_H - 8;
      g.fillStyle = U.rgba(C.ash, 0.12);
      g.fillRect(AL.W - 10, top, 2, trackH);
      g.fillStyle = U.rgba(C.ember, 0.6);
      g.fillRect(AL.W - 10, top + Math.round(frac * (trackH - 18)), 2, 18);
    }

    // what the selected thing will do next
    var selU = this.items[this.sel];
    var dy = top + ROWS * ROW_H + 4;
    if (selU) {
      var cur = AL.Meta.level(selU.id);
      var line = AL.Meta.maxed(selU.id)
        ? selU.detail(cur) + '  ·  nothing more to give'
        : (cur > 0 ? selU.detail(cur) + '   →   ' : '') + selU.detail(cur + 1);
      D.text(g, line, AL.W / 2, dy, { size: 7, align: 'center', color: C.text, spacing: 1.1 });
    }

    // the Posts line — the thing that earns while you are gone
    var ips = AL.Meta.yieldPerSecond();
    var pline = ips > 0
      ? 'POSTS EARN ' + ips.toFixed(2) + ' /s  ·  ' + Math.round(ips * 3600).toLocaleString() + ' AN HOUR'
      : 'A WARDEN POST EARNS WHILE YOU ARE AWAY';
    D.text(g, pline, AL.W / 2, dy + 12,
           { size: 6, align: 'center', color: U.rgba(C.plate, ips > 0 ? 0.75 : 0.4), spacing: 1.3 });

    // arrival notes
    var noteY = dy + 24;
    if (this.summary && this.summary.earned) {
      D.text(g, '+' + this.summary.earned.toLocaleString() + ' GATHERED IN ' +
                this.summary.level.name.toUpperCase(),
             AL.W / 2, noteY, { size: 6, align: 'center', color: U.rgba(C.ember, 0.8), spacing: 1.3 });
      noteY += 9;
    }
    if (this.offline && this.offline.amount > 0) {
      D.text(g, 'YOUR POSTS GATHERED ' + this.offline.amount.toLocaleString() + ' WHILE YOU WERE AWAY',
             AL.W / 2, noteY, { size: 6, align: 'center', color: U.rgba(C.plate, 0.8), spacing: 1.3 });
    }

    // controls
    var leaveWord = this.next != null ? 'X  DESCEND' : 'X  BACK';
    D.text(g, '↑ ↓  CHOOSE      Z  BUY      ' + leaveWord, AL.W / 2, AL.H - 12,
           { size: 6, align: 'center', color: U.rgba(C.ash, 0.45), spacing: 1.8 });

    D.vignette(g, 0.42);
  };

  AL.Scenes.Cache = Cache;
})();
