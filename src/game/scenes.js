/* Scenes: title, chamber select, play, pause, ending, credits.
 * A scene is just {enter, update, draw}; AL.Game swaps between them.
 */
AL.Scenes = (function () {
  var C = AL.C, U = AL.U, D = AL.Draw;

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return (h > 0 ? h + ':' : '') + p(m) + ':' + p(s);
  }

  /* ================================================================ TITLE */

  function Title(opts) {
    this.t = 0;
    this.sel = 0;
    this.items = [];
    this.flash = (opts && opts.flash) || null;
    this.buildMenu();
  }

  Title.prototype.buildMenu = function () {
    var save = AL.Save.get();
    var items = [];
    if (AL.Save.hasRun()) {
      items.push({ key: 'continue', label: 'Continue Descent',
                   note: 'chamber ' + AL.Levels.roman(chamberOfRoom(save.room)) });
    }
    items.push({ key: 'new', label: AL.Save.hasRun() ? 'Begin Again' : 'Begin the Descent' });
    if (save.room > 0) items.push({ key: 'select', label: 'Chamber Select' });
    items.push({ key: 'credits', label: 'Credits' });
    this.items = items;
    this.sel = 0;
  };

  function chamberOfRoom(i) {
    var r = AL.Levels.rooms[U.clamp(i | 0, 0, AL.Levels.rooms.length - 1)];
    return r ? r.chamber : 1;
  }

  Title.prototype.enter = function () {
    AL.Audio.music('title');
    this.buildMenu();
  };

  Title.prototype.update = function (dt) {
    this.t += dt;
    var In = AL.Input;
    if (In.consume('up'))   { this.sel = (this.sel - 1 + this.items.length) % this.items.length; AL.Audio.sfx('blip'); }
    if (In.consume('down')) { this.sel = (this.sel + 1) % this.items.length; AL.Audio.sfx('blip'); }
    if (In.consume('accept')) {
      AL.Audio.sfx('ui');
      var it = this.items[this.sel];
      if (it.key === 'continue') AL.Game.startPlay(AL.Save.get().room || 0);
      else if (it.key === 'new') { AL.Save.reset(); AL.Game.startPlay(0); }
      else if (it.key === 'select') AL.Game.setScene(new Select());
      else if (it.key === 'credits') AL.Game.setScene(new Credits(false));
    }
    AL.Particles.update(dt);
    if (Math.random() < 0.5) {
      AL.Particles.spawn({ x: U.rand(-10, AL.W + 10), y: -6,
        vx: U.rand(-8, 12), vy: U.rand(10, 28), life: U.rand(5, 12), size: 1,
        color: Math.random() < 0.25 ? C.ash : C.ashDim, kind: 'ash', a0: U.rand(0.2, 0.65) });
    }
  };

  Title.prototype.draw = function (g) {
    /* Composition: wordmark across the top, menu down the left, the Spire
     * standing on the right so its one lit window never collides with text. */
    var grad = g.createLinearGradient(0, 0, 0, AL.H);
    grad.addColorStop(0, '#16141f');
    grad.addColorStop(0.55, '#0a0a12');
    grad.addColorStop(1, '#05050a');
    g.fillStyle = grad;
    g.fillRect(0, 0, AL.W, AL.H);

    var base = AL.H - 22;
    var sx = 388;                     // the Spire's centre line, clear of the wordmark

    // distant ruins behind it
    var rnd = U.rng(99);
    g.fillStyle = '#0b0b16';
    for (var i = 0; i < 12; i++) {
      var bw = 14 + rnd() * 30;
      var bh = 20 + rnd() * 70;
      g.fillRect(Math.round(rnd() * AL.W - 10), base - bh, Math.round(bw), bh);
    }

    // the Spire
    var bodyH = 158;
    g.fillStyle = '#101020';
    g.fillRect(sx - 40, base - bodyH, 80, bodyH);
    g.fillStyle = '#141428';
    g.fillRect(sx - 27, base - bodyH - 34, 54, 36);
    g.fillRect(sx - 14, base - bodyH - 56, 28, 24);
    g.fillStyle = '#08080f';
    for (var j = 0; j < 7; j++) {
      g.fillRect(sx - 34 + j * 11, base - bodyH + 8 + (j % 3) * 9, 4, bodyH);
    }
    // a few dead windows
    g.fillStyle = '#16162c';
    for (var k = 0; k < 9; k++) {
      g.fillRect(sx - 30 + (k % 3) * 22, base - bodyH + 24 + Math.floor(k / 3) * 34, 5, 7);
    }

    // The one lit window sits low, near the foot of the tower — which is
    // exactly where the story says the last light is.
    var winY = base - 54;
    var fl = 0.62 + Math.sin(this.t * 2.3) * 0.18 + Math.sin(this.t * 7.1) * 0.06;
    g.fillStyle = U.rgba(C.ember, fl);
    g.fillRect(sx - 3, winY, 6, 8);
    g.save();
    g.globalCompositeOperation = 'lighter';
    D.radial(g, sx, winY + 4, 72 * fl, C.ember, 0.26, 0);
    D.radial(g, sx, winY + 4, 20 * fl, C.emberHot, 0.3, 0);
    g.restore();

    // ground
    g.fillStyle = '#07070d';
    g.fillRect(0, base, AL.W, AL.H - base);
    g.fillStyle = '#1a1a2e';
    g.fillRect(0, base, AL.W, 1);

    // Wren, arrived, looking up
    var wx = sx - 78, wy = base - 14;
    AL.Player.drawFigure(g, wx, wy, 1, 0, C.bone, C.void1, false);
    g.fillStyle = C.cloth;
    g.fillRect(wx + 2, wy + 4, 6, 2);
    g.save();
    g.globalCompositeOperation = 'lighter';
    D.radial(g, wx + 5, wy + 7, 20, C.ember, 0.28, 0);
    g.restore();

    AL.Particles.draw(g, 0, 0);

    // wordmark
    var bob = Math.sin(this.t * 0.8) * 1.2;
    D.text(g, 'ASHLIGHT', AL.W / 2, 26 + bob, {
      size: 30, align: 'center', color: '#f6eddd', spacing: 9,
      glow: C.ember, glowSize: 16
    });
    D.text(g, 'you are the places you have been', AL.W / 2, 62 + bob, {
      size: 7, align: 'center', color: U.rgba(C.ash, 0.75), spacing: 3.2
    });
    g.fillStyle = U.rgba(C.ember, 0.3);
    g.fillRect(AL.W / 2 - 86, 76, 172, 1);

    // menu, down the left, clear of the Spire
    var mx = 26, my = 104;
    for (var m = 0; m < this.items.length; m++) {
      var it = this.items[m];
      var on = m === this.sel;
      if (on) {
        var p = 0.5 + Math.sin(this.t * 5) * 0.2;
        g.fillStyle = U.rgba(C.ember, 0.08 + p * 0.05);
        g.fillRect(mx - 10, my - 4, 230, 15);
        g.fillStyle = U.rgba(C.ember, 0.8);
        g.fillRect(mx - 10, my - 4, 2, 15);
      }
      D.text(g, it.label.toUpperCase(), mx, my, {
        size: 9, color: on ? C.emberHot : U.rgba(C.ash, 0.42),
        spacing: 2.4, glow: on ? C.ember : null, glowSize: 7
      });
      if (on && it.note) {
        D.text(g, it.note.toUpperCase(), mx + 2, my + 11,
               { size: 6, color: U.rgba(C.ember, 0.5), spacing: 1.2 });
      }
      my += it.note && on ? 26 : 20;
    }

    // footer
    var save = AL.Save.get();
    var bits = [];
    if (save.shards) bits.push(save.shards + ' EMBERLIGHT');
    var mc = 0; for (var kk in save.memories) if (save.memories[kk]) mc++;
    if (mc) bits.push(mc + '/' + AL.Story.memoryTotal + ' MEMORIES');
    if (save.time > 5) bits.push(fmtTime(save.time));
    if (bits.length) {
      D.text(g, bits.join('   \u00B7   '), 26, AL.H - 30,
             { size: 6, color: U.rgba(C.ashDim, 0.75), spacing: 1.4 });
    }
    D.text(g, (AL.Audio.isMuted() ? 'M SOUND OFF' : 'M SOUND ON') + '    F FULLSCREEN    V CRT',
           26, AL.H - 14, { size: 6, color: U.rgba(C.ash, 0.55), spacing: 1.4 });

    if (!AL.Save.usable()) {
      D.text(g, 'PROGRESS CANNOT BE SAVED IN THIS BROWSER', 26, AL.H - 44,
             { size: 6, color: U.rgba(C.bad, 0.6), spacing: 1.2 });
    }
    D.vignette(g, 0.42);
  };

  /* ======================================================== CHAMBER SELECT */

  function Select() {
    this.t = 0;
    this.sel = 0;
    this.max = chamberOfRoom(AL.Save.get().room);
  }
  Select.prototype.enter = function () { this.sel = Math.max(0, this.max - 1); };
  Select.prototype.update = function (dt) {
    this.t += dt;
    var In = AL.Input;
    if (In.consume('up'))   { this.sel = (this.sel - 1 + this.max) % this.max; AL.Audio.sfx('blip'); }
    if (In.consume('down')) { this.sel = (this.sel + 1) % this.max; AL.Audio.sfx('blip'); }
    if (In.consume('accept')) {
      AL.Audio.sfx('ui');
      AL.Game.startPlay(AL.Levels.firstRoomOfChamber(this.sel + 1));
    }
    if (In.consume('pause') || In.consume('back')) { AL.Audio.sfx('blip'); AL.Game.setScene(new Title()); }
    AL.Particles.update(dt);
  };
  Select.prototype.draw = function (g) {
    D.fade(g, 1, '#07070e');
    AL.Particles.draw(g, 0, 0);
    D.text(g, 'CHAMBER SELECT', AL.W / 2, 22,
           { size: 12, align: 'center', color: C.bone, spacing: 4 });
    g.fillStyle = U.rgba(C.ember, 0.4);
    g.fillRect(AL.W / 2 - 70, 40, 140, 1);
    var y = 56;
    for (var i = 0; i < this.max; i++) {
      var on = i === this.sel;
      if (on) {
        g.fillStyle = U.rgba(C.ember, 0.08);
        g.fillRect(30, y - 4, AL.W - 60, 15);
      }
      D.text(g, AL.Levels.roman(i + 1), 44, y,
             { size: 8, align: 'right', color: on ? C.ember : U.rgba(C.ashDim, 0.6), spacing: 1.6 });
      D.text(g, AL.Levels.chamberName(i + 1).toUpperCase(), 58, y,
             { size: 8, color: on ? C.emberHot : U.rgba(C.ash, 0.45), spacing: 2 });
      y += 18;
    }
    D.text(g, 'Z  ENTER        X  BACK', AL.W / 2, AL.H - 18,
           { size: 6, align: 'center', color: U.rgba(C.ashDim, 0.5), spacing: 1.8 });
    D.vignette(g, 0.5);
  };

  /* ================================================================= PLAY */

  function Play(roomIndex) {
    var self = this;
    this.paused = false;
    this.pauseSel = 0;
    this.world = new AL.World({
      onEnding: function (kind) { AL.Game.setScene(new Ending(kind, self.world)); },
      onComplete: function () { AL.Game.setScene(new Ending('dark', self.world)); }
    });
    this.startRoom = roomIndex || 0;
  }

  Play.prototype.enter = function () {
    this.world.start(this.startRoom);
  };

  var PAUSE_ITEMS = [
    { key: 'resume', label: 'Resume' },
    { key: 'restart', label: 'Restart Room' },
    { key: 'sound', label: 'Sound' },
    { key: 'title', label: 'Abandon Descent' }
  ];

  Play.prototype.update = function (dt) {
    var In = AL.Input;
    if (this.paused) {
      if (In.consume('up'))   { this.pauseSel = (this.pauseSel - 1 + PAUSE_ITEMS.length) % PAUSE_ITEMS.length; AL.Audio.sfx('blip'); }
      if (In.consume('down')) { this.pauseSel = (this.pauseSel + 1) % PAUSE_ITEMS.length; AL.Audio.sfx('blip'); }
      if (In.consume('accept')) {
        var k = PAUSE_ITEMS[this.pauseSel].key;
        AL.Audio.sfx('ui');
        if (k === 'resume') this.resume();
        else if (k === 'restart') { this.world.restartRoom(); this.resume(); }
        else if (k === 'sound') AL.Audio.toggleMute();
        else if (k === 'title') { AL.Save.put(); AL.Game.setScene(new Title()); }
      }
      if (In.consume('pause')) { AL.Audio.sfx('blip'); this.resume(); }
      return;
    }
    if (In.consume('pause')) {
      this.paused = true;
      this.pauseSel = 0;
      AL.Audio.sfx('ui');
      // Drop anything still buffered, or a jump held on the way in would
      // immediately activate the first menu item.
      In.clearBuffer();
      return;
    }
    this.world.update(dt);
  };

  Play.prototype.resume = function () {
    this.paused = false;
    AL.Input.clearBuffer();      // and don't carry the menu press back into play
  };

  Play.prototype.draw = function (g) {
    this.world.pausedView = this.paused;
    this.world.draw(g);
    if (!this.paused) return;

    D.fade(g, 0.88, C.void0);
    D.text(g, 'PAUSED', AL.W / 2, 44,
           { size: 14, align: 'center', color: C.bone, spacing: 5, glow: C.ember, glowSize: 8 });
    var y = 86;
    for (var i = 0; i < PAUSE_ITEMS.length; i++) {
      var on = i === this.pauseSel;
      var label = PAUSE_ITEMS[i].label;
      if (PAUSE_ITEMS[i].key === 'sound') label += AL.Audio.isMuted() ? ':  OFF' : ':  ON';
      if (on) {
        g.fillStyle = U.rgba(C.ember, 0.08);
        g.fillRect(AL.W / 2 - 90, y - 4, 180, 15);
      }
      D.text(g, label.toUpperCase(), AL.W / 2, y, {
        size: 9, align: 'center', color: on ? C.emberHot : U.rgba(C.ash, 0.4), spacing: 2.4
      });
      y += 19;
    }
    var w = this.world;
    D.text(g, 'ARROWS MOVE   Z JUMP   X ECHO' + (w.hasAbility('dash') ? '   C DASH' : ''),
           AL.W / 2, AL.H - 34, { size: 6, align: 'center', color: U.rgba(C.ashDim, 0.55), spacing: 1.5 });
    D.text(g, 'Q RECALL ECHOES   R RESTART ROOM', AL.W / 2, AL.H - 24,
           { size: 6, align: 'center', color: U.rgba(C.ashDim, 0.55), spacing: 1.5 });
    D.text(g, 'DEATHS ' + (w.save.deaths | 0) + '   ECHOES ' + (w.save.echoesMade | 0) +
              '   ' + fmtTime(w.save.time),
           AL.W / 2, AL.H - 13, { size: 6, align: 'center', color: U.rgba(C.ashDim, 0.4), spacing: 1.4 });
  };

  /* =============================================================== ENDING */

  function Ending(kind, world) {
    this.e = AL.Story.endings[kind] || AL.Story.endings.dark;
    this.kind = kind;
    this.world = world;
    this.t = 0;
    this.scroll = 0;
    this.phase = 'white';   // white -> title -> crawl -> stats
    this.lines = this.e.lines;
    this.done = false;
  }

  Ending.prototype.enter = function () {
    var save = AL.Save.get();
    save.ending = this.kind;
    save.endingsSeen = save.endingsSeen || {};
    save.endingsSeen[this.kind] = true;
    AL.Save.put();
    AL.Audio.stopMusic();
    AL.FX.addFlash(1, this.kind === 'dark' ? '#000000' : '#ffffff');
    AL.Audio.sfx(this.kind === 'dark' ? 'quake' : 'unlock');
  };

  Ending.prototype.update = function (dt) {
    this.t += dt;
    if (this.phase === 'white') {
      if (this.t > 1.6) { this.phase = 'title'; this.t = 0; AL.Audio.music(this.e.music); }
    } else if (this.phase === 'title') {
      if (this.t > 3.4) { this.phase = 'crawl'; this.t = 0; }
      if (AL.Input.consume('accept') && this.t > 0.6) { this.phase = 'crawl'; this.t = 0; }
    } else if (this.phase === 'crawl') {
      var speed = AL.Input.held('accept') ? 58 : 15;
      this.scroll += speed * dt;
      var total = this.lines.length * 13 + 120;
      if (this.scroll > total) { this.phase = 'stats'; this.t = 0; }
    } else {
      if (this.t > 1.2 && AL.Input.consume('accept')) {
        AL.Game.setScene(new Credits(true, this.kind));
      }
    }
    AL.Particles.update(dt);
    if (Math.random() < 0.45) {
      AL.Particles.spawn({ x: U.rand(-10, AL.W + 10), y: -6,
        vx: U.rand(-8, 12), vy: U.rand(8, 22), life: U.rand(6, 13), size: 1,
        color: this.e.color, kind: 'ash', a0: U.rand(0.1, 0.4) });
    }
  };

  Ending.prototype.draw = function (g) {
    D.fade(g, 1, '#05050a');
    // a slow bloom in the ending's colour
    g.save();
    g.globalCompositeOperation = 'lighter';
    var pulse = 0.14 + Math.sin(this.t * 0.7) * 0.04;
    D.radial(g, AL.W / 2, AL.H / 2, 200, this.e.color, pulse, 0);
    g.restore();
    AL.Particles.draw(g, 0, 0);

    if (this.phase === 'white') {
      var a = U.clamp(1 - this.t / 1.6, 0, 1);
      D.fade(g, a, this.kind === 'dark' ? '#000000' : '#ffffff');
      return;
    }

    if (this.phase === 'title') {
      var ta = U.clamp(this.t / 0.9, 0, 1) * U.clamp((3.4 - this.t) / 0.6, 0, 1);
      D.text(g, this.e.title, AL.W / 2, AL.H / 2 - 12, {
        size: 18, align: 'center', color: this.e.color, spacing: 7,
        glow: this.e.color, glowSize: 14, alpha: ta
      });
      g.fillStyle = U.rgba(this.e.color, 0.4 * ta);
      g.fillRect(AL.W / 2 - 60, AL.H / 2 + 16, 120, 1);
      return;
    }

    if (this.phase === 'crawl') {
      g.save();
      g.beginPath(); g.rect(0, 16, AL.W, AL.H - 32); g.clip();
      var y = AL.H - 10 - this.scroll;
      for (var i = 0; i < this.lines.length; i++) {
        var raw = this.lines[i];
        if (raw === '') { y += 13; continue; }
        var wrapped = D.wrap(raw, 54);
        for (var j = 0; j < wrapped.length; j++) {
          if (y > 4 && y < AL.H) {
            // fade near the top and bottom edges
            var edge = Math.min(1, (y - 16) / 40) * Math.min(1, (AL.H - 24 - y) / 40);
            D.text(g, wrapped[j], AL.W / 2, y, {
              size: 8, align: 'center', color: C.text, spacing: 1.2,
              alpha: U.clamp(edge, 0, 1) * 0.92
            });
          }
          y += 13;
        }
      }
      g.restore();
      D.text(g, 'HOLD Z TO HURRY', AL.W / 2, AL.H - 10,
             { size: 6, align: 'center', color: U.rgba(C.ashDim, 0.35), spacing: 1.4 });
      return;
    }

    // stats
    var save = AL.Save.get();
    var mc = 0; for (var k in save.memories) if (save.memories[k]) mc++;
    D.text(g, this.e.title, AL.W / 2, 40, {
      size: 14, align: 'center', color: this.e.color, spacing: 5,
      glow: this.e.color, glowSize: 10
    });
    var rows = [
      ['EMBERLIGHT GATHERED', (save.shards | 0) + ''],
      ['MEMORIES RECOVERED', mc + ' / ' + AL.Story.memoryTotal],
      ['ECHOES LEFT BEHIND', (save.echoesMade | 0) + ''],
      ['TIMES UNMADE', (save.deaths | 0) + ''],
      ['TIME IN THE SPIRE', fmtTime(save.time)]
    ];
    var y2 = 78;
    for (var r = 0; r < rows.length; r++) {
      D.text(g, rows[r][0], AL.W / 2 - 8, y2,
             { size: 7, align: 'right', color: U.rgba(C.ash, 0.5), spacing: 1.3 });
      D.text(g, rows[r][1], AL.W / 2 + 10, y2,
             { size: 7, color: C.bone, spacing: 1.3 });
      y2 += 14;
    }
    if (mc < AL.Story.memoryTotal) {
      D.text(g, 'SOME OF THEM ARE STILL DOWN THERE.', AL.W / 2, y2 + 10,
             { size: 6, align: 'center', color: U.rgba(C.iris, 0.55), spacing: 1.6 });
    }
    if (this.t > 1.2) {
      var b = Math.sin(this.t * 4) > -0.3 ? 0.7 : 0.25;
      D.text(g, 'PRESS Z', AL.W / 2, AL.H - 22,
             { size: 7, align: 'center', color: U.rgba(C.ember, b), spacing: 2.4 });
    }
  };

  /* ============================================================== CREDITS */

  function Credits(afterEnding, kind) {
    this.t = 0;
    this.after = !!afterEnding;
    this.kind = kind;
  }
  Credits.prototype.enter = function () {
    if (!this.after) AL.Audio.music('title');
  };
  Credits.prototype.update = function (dt) {
    this.t += dt;
    if (this.t > 0.8 && (AL.Input.consume('accept') || AL.Input.consume('back') || AL.Input.consume('pause'))) {
      AL.Audio.sfx('ui');
      AL.Game.setScene(new Title());
    }
    AL.Particles.update(dt);
  };
  Credits.prototype.draw = function (g) {
    D.fade(g, 1, '#06060c');
    AL.Particles.draw(g, 0, 0);
    var a = U.clamp(this.t / 1.2, 0, 1);
    g.globalAlpha = a;

    D.text(g, 'ASHLIGHT', AL.W / 2, 28,
           { size: 20, align: 'center', color: '#f6eddd', spacing: 7, glow: C.ember, glowSize: 12 });

    var save = AL.Save.get();
    var seen = save.endingsSeen || {};
    var nSeen = (seen.light ? 1 : 0) + (seen.dark ? 1 : 0) + (seen.free ? 1 : 0);

    var lines = [
      ['DESIGN, CODE, WORDS, SOUND', 'written for you, in one sitting'],
      ['ENGINE', 'HTML5 canvas · no libraries'],
      ['MUSIC & SFX', 'synthesised live · no audio files'],
      ['ART', 'drawn with rectangles'],
      ['ENDINGS FOUND', nSeen + ' of 3']
    ];
    var y = 74;
    for (var i = 0; i < lines.length; i++) {
      D.text(g, lines[i][0], AL.W / 2, y,
             { size: 7, align: 'center', color: U.rgba(C.ember, 0.65), spacing: 2.2 });
      D.text(g, lines[i][1], AL.W / 2, y + 11,
             { size: 7, align: 'center', color: U.rgba(C.ash, 0.55), spacing: 1.2 });
      y += 28;
    }

    if (nSeen < 3) {
      D.text(g, 'THERE IS MORE THAN ONE WAY OUT OF THE LAST ROOM.', AL.W / 2, AL.H - 44,
             { size: 6, align: 'center', color: U.rgba(C.iris, 0.5), spacing: 1.5 });
    } else {
      D.text(g, 'YOU FOUND ALL THREE. THANK YOU FOR WALKING ALL THE WAY DOWN.',
             AL.W / 2, AL.H - 44,
             { size: 6, align: 'center', color: U.rgba(C.iris, 0.7), spacing: 1.3 });
    }
    D.text(g, 'PRESS Z', AL.W / 2, AL.H - 22,
           { size: 7, align: 'center', color: U.rgba(C.ember, 0.55), spacing: 2.4 });
    g.globalAlpha = 1;
    D.vignette(g, 0.5);
  };

  return { Title: Title, Select: Select, Play: Play, Ending: Ending, Credits: Credits };
})();
