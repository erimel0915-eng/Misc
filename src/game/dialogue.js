/* Dialogue: a typewriter box, speaker sigils, inline stage directions, and the
 * branching choice that ends the game.
 *
 * A script is an array of nodes:
 *   {who, text}                 a spoken line
 *   {act, arg}                  a stage direction (shake / flash / music / wait / quake)
 *   {choice:[{label, ending}]}  the finale
 */
AL.Dialogue = (function () {
  var C = AL.C, U = AL.U;

  var SPEAKERS = {
    wren:  { name: 'WREN',          color: C.bone,  sigil: 'wren' },
    echo:  { name: '◇',        color: C.echo,  sigil: 'echo' },
    iris:  { name: 'IRIS',          color: C.iris,  sigil: 'iris' },
    lumen: { name: 'THE LUMEN',     color: C.iris,  sigil: 'iris' },
    spire: { name: 'THE SPIRE',     color: C.ashDim,sigil: 'none' },
    none:  { name: '',              color: C.ash,   sigil: 'none' }
  };

  var S = {
    active: false,
    lines: null,
    i: 0,
    chars: 0,
    charT: 0,
    speed: 46,            // characters per second
    node: null,
    wrapped: [],
    waiting: 0,
    opts: null,
    choiceIndex: 0,
    choiceOpts: null,
    choiceGrace: 0,
    panel: 0,             // slide-in
    closing: false,
    finished: false
  };

  var COLS = 52;
  var SPEED_FAST = 300;

  function start(lines, opts) {
    S.active = true;
    S.lines = lines.slice();
    S.i = -1;
    S.opts = opts || {};
    S.panel = 0;
    S.closing = false;
    S.choiceIndex = 0;
    AL.Input.clearBuffer();
    advance();
  }

  function currentSpeaker() {
    if (!S.node) return SPEAKERS.none;
    return SPEAKERS[S.node.who || 'none'] || SPEAKERS.none;
  }

  function advance() {
    S.i++;
    if (S.i >= S.lines.length) { finish(); return; }
    var n = S.lines[S.i];
    S.node = n;
    S.chars = 0;
    S.charT = 0;
    S.speed = n.slow ? 24 : (n.fast ? 72 : 46);

    if (n.act) { doAct(n); return; }
    if (n.choice) {
      S.choiceOpts = filterChoices(n.choice);
      S.choiceIndex = 0;
      S.wrapped = AL.Draw.wrap(n.prompt || '', COLS);
      /* This is the decision the whole game is for. Throw away any press the
       * player was still mashing and make them reach for it deliberately. */
      AL.Input.clearBuffer();
      S.choiceGrace = 0.5;
      AL.__choiceUp = true;
      return;
    }
    S.wrapped = AL.Draw.wrap(n.text || '', COLS);
  }

  /* Some endings are only on the table if you earned them. */
  function meets(req) {
    var w = S.opts && S.opts.world;
    if (!req) return true;
    if (req === 'allMemories') {
      return !!w && w.memoryCount() >= AL.Story.memoryTotal;
    }
    return true;
  }

  function filterChoices(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) if (meets(list[i].requires)) out.push(list[i]);
    return out;
  }

  function doAct(n) {
    switch (n.act) {
      case 'shake':  AL.FX.addShake(n.arg || 4, 5); break;
      case 'flash':  AL.FX.addFlash(n.amount || 0.5, n.arg || '#ffffff'); break;
      case 'music':  AL.Audio.music(n.arg); break;
      case 'stopmusic': AL.Audio.stopMusic(); break;
      case 'sfx':    AL.Audio.sfx(n.arg); break;
      case 'quake':
        AL.Audio.sfx('quake'); AL.FX.addShake(5, 2.2);
        break;
      case 'wait':   S.waiting = n.arg || 0.6; return;
    }
    advance();
  }

  function finish() {
    S.closing = true;
    S.finished = true;
  }

  function hardClose() {
    AL.__choiceUp = false;
    S.active = false;
    S.lines = null;
    S.node = null;
    S.finished = false;
    S.closing = false;
    AL.Input.clearBuffer();
    if (S.opts && S.opts.onDone) S.opts.onDone();
  }

  function fullyTyped() {
    if (!S.node) return true;
    var total = 0;
    for (var i = 0; i < S.wrapped.length; i++) total += S.wrapped[i].length;
    return S.chars >= total;
  }

  function update(dt) {
    if (S.closing) {
      S.panel = U.approach(S.panel, 0, dt * 6);
      if (S.panel <= 0.001) hardClose();
      return;
    }
    S.panel = U.approach(S.panel, 1, dt * 7);

    if (S.waiting > 0) {
      S.waiting -= dt;
      if (S.waiting <= 0) advance();
      return;
    }
    if (!S.node) return;

    var In = AL.Input;

    if (S.node.choice) {
      if (S.choiceGrace > 0) {
        S.choiceGrace -= dt;
        AL.Input.clearBuffer();
        return;
      }
      var opts = S.choiceOpts || S.node.choice;
      if (In.consume('up') || In.consume('left')) {
        S.choiceIndex = (S.choiceIndex - 1 + opts.length) % opts.length;
        AL.Audio.sfx('blip');
      }
      if (In.consume('down') || In.consume('right')) {
        S.choiceIndex = (S.choiceIndex + 1) % opts.length;
        AL.Audio.sfx('blip');
      }
      if (In.consume('accept')) {
        var chosen = opts[S.choiceIndex];
        AL.Audio.sfx('uiBig');
        if (chosen.ending && S.opts.onEnding) {
          S.active = false;
          S.node = null;
          S.opts.onEnding(chosen.ending);
          return;
        }
        advance();
      }
      return;
    }

    // typewriter
    var done = fullyTyped();
    if (!done) {
      var sp = In.held('accept') ? SPEED_FAST : S.speed;
      S.charT += dt * sp;
      while (S.charT >= 1) {
        S.charT -= 1;
        S.chars++;
        if (S.chars % 3 === 0) AL.Audio.sfx('blip');
      }
      if (In.consume('back')) {
        // skip to the end of this line
        S.chars = 9999;
      }
    } else {
      if (In.consume('accept') || In.consume('back')) advance();
    }
  }

  /* ---------------------------------------------------------------- draw */

  function drawSigil(g, kind, x, y, color) {
    g.fillStyle = color;
    if (kind === 'wren') {
      g.fillRect(x + 3, y, 6, 5);
      g.fillStyle = C.cloth;
      g.fillRect(x + 3, y + 5, 6, 2);
      g.fillStyle = color;
      g.fillRect(x + 3, y + 7, 6, 5);
    } else if (kind === 'echo') {
      // a diamond, hollow
      g.fillRect(x + 5, y + 1, 2, 2);
      g.fillRect(x + 3, y + 3, 2, 2); g.fillRect(x + 7, y + 3, 2, 2);
      g.fillRect(x + 1, y + 5, 2, 2); g.fillRect(x + 9, y + 5, 2, 2);
      g.fillRect(x + 3, y + 7, 2, 2); g.fillRect(x + 7, y + 7, 2, 2);
      g.fillRect(x + 5, y + 9, 2, 2);
    } else if (kind === 'iris') {
      g.fillRect(x + 2, y + 4, 8, 4);
      g.fillRect(x + 4, y + 2, 4, 8);
      g.fillStyle = '#ffffff';
      g.fillRect(x + 5, y + 5, 2, 2);
    }
  }

  function draw(g) {
    if (!S.active) return;
    if (S.node && S.node.choice) { drawChoice(g); return; }
    if (!S.node || S.waiting > 0) return;

    var sp = currentSpeaker();
    var h = 60;
    var slide = U.easeOut(S.panel);
    var y = AL.H - h * slide;

    // panel
    g.globalAlpha = slide;
    g.fillStyle = U.rgba(C.void0, 0.94);
    g.fillRect(0, y, AL.W, h);
    g.fillStyle = U.rgba(sp.color, 0.55);
    g.fillRect(0, y, AL.W, 1);
    g.fillStyle = U.rgba(sp.color, 0.12);
    g.fillRect(0, y + 1, AL.W, 2);

    // speaker
    var tx = 14;
    if (sp.sigil !== 'none') {
      drawSigil(g, sp.sigil, 8, y + 9, sp.color);
      tx = 26;
    }
    if (sp.name) {
      AL.Draw.text(g, sp.name, tx, y + 8, { size: 7, color: sp.color, spacing: 2.2 });
    }

    // body text, revealed a character at a time
    var budget = S.chars;
    var lineY = y + 21;
    for (var i = 0; i < S.wrapped.length; i++) {
      var line = S.wrapped[i];
      if (budget <= 0) break;
      var shown = line.slice(0, Math.min(line.length, budget));
      budget -= line.length;
      AL.Draw.text(g, shown, 10, lineY, { size: 8, color: C.text, spacing: 1.1 });
      lineY += 11;
    }

    // continue caret
    if (fullyTyped()) {
      var blink = Math.sin(performance.now() / 150) > -0.2;
      if (blink) {
        g.fillStyle = U.rgba(sp.color, 0.8);
        g.fillRect(AL.W - 16, y + h - 12, 5, 2);
        g.fillRect(AL.W - 15, y + h - 10, 3, 2);
        g.fillRect(AL.W - 14, y + h - 8, 1, 2);
      }
    }
    g.globalAlpha = 1;
  }

  function drawChoice(g) {
    var opts = S.choiceOpts || S.node.choice;
    AL.Draw.fade(g, 0.78 * S.panel, C.void0);

    g.globalAlpha = S.panel;
    var promptY = 50;
    for (var i = 0; i < S.wrapped.length; i++) {
      AL.Draw.text(g, S.wrapped[i], AL.W / 2, promptY, {
        size: 8, align: 'center', color: C.text, spacing: 1.4
      });
      promptY += 12;
    }

    g.fillStyle = U.rgba(C.iris, 0.4);
    g.fillRect(AL.W / 2 - 60, promptY + 8, 120, 1);

    // Rows are a fixed height whether or not the note is showing, so the list
    // never jumps around under the cursor.
    var anyNote = false;
    for (var n0 = 0; n0 < opts.length; n0++) if (opts[n0].note) anyNote = true;
    var rowH = anyNote ? 32 : 24;
    var oy = promptY + 24;

    for (var j = 0; j < opts.length; j++) {
      var sel = j === S.choiceIndex;
      var col = opts[j].color || (sel ? C.ember : C.ashDim);
      if (sel) {
        var pulse = 0.5 + Math.sin(performance.now() / 220) * 0.25;
        g.fillStyle = U.rgba(col, 0.1 + pulse * 0.08);
        g.fillRect(AL.W / 2 - 112, oy - 5, 224, 15);
        g.fillStyle = U.rgba(col, 0.75);
        g.fillRect(AL.W / 2 - 112, oy - 5, 2, 15);
      }
      AL.Draw.text(g, opts[j].label.toUpperCase(), AL.W / 2, oy, {
        size: 9, align: 'center', color: sel ? col : U.rgba(C.ash, 0.42),
        spacing: 2.4, glow: sel ? col : null, glowSize: 8
      });
      if (sel && opts[j].note) {
        AL.Draw.text(g, opts[j].note, AL.W / 2, oy + 14, {
          size: 6, align: 'center', color: U.rgba(C.ash, 0.6), spacing: 1.4
        });
      }
      oy += rowH;
    }

    AL.Draw.text(g, '↑ ↓   SELECT        Z   CHOOSE', AL.W / 2, AL.H - 16, {
      size: 6, align: 'center', color: U.rgba(C.ash, 0.35), spacing: 1.6
    });
    g.globalAlpha = 1;
  }

  return {
    start: start, update: update, draw: draw,
    get active() { return S.active; },
    forceClose: hardClose
  };
})();
