/* Rendering helpers: text, shapes, the light/darkness compositor, and the
 * screen-level effects (shake, flash, fades, letterbox).
 */
AL.Draw = (function () {
  var lightCanvas = null, lg = null;

  function initLight() {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = AL.W; lightCanvas.height = AL.H;
    lg = lightCanvas.getContext('2d');
  }

  /* ----------------------------------------------------------------- text */

  // Small caps-ish tracked text. Monospace + letter-spacing reads as "terminal"
  // without shipping a font file.
  function font(g, size, weight) {
    g.font = (weight || '') + ' ' + size + 'px "Courier New", Courier, monospace';
  }

  function text(g, str, x, y, o) {
    o = o || {};
    var size = o.size || 8;
    var sp = o.spacing != null ? o.spacing : 1;
    font(g, size, o.weight);
    g.textBaseline = o.baseline || 'top';
    g.textAlign = 'left';

    var chars = String(str).split('');
    var cw = g.measureText('M').width;
    var total = chars.length * (cw + sp) - sp;
    var sx = x;
    if (o.align === 'center') sx = x - total / 2;
    else if (o.align === 'right') sx = x - total;
    sx = Math.round(sx);

    if (o.glow) {
      g.save();
      g.shadowColor = o.glow;
      g.shadowBlur = o.glowSize || 6;
      drawChars(g, chars, sx, Math.round(y), cw, sp, o.color || AL.C.text, o.alpha);
      g.restore();
    }
    drawChars(g, chars, sx, Math.round(y), cw, sp, o.color || AL.C.text, o.alpha);
    return total;
  }

  function drawChars(g, chars, sx, y, cw, sp, color, alpha) {
    if (alpha != null) g.globalAlpha = alpha;
    g.fillStyle = color;
    var x = sx;
    for (var i = 0; i < chars.length; i++) {
      if (chars[i] !== ' ') g.fillText(chars[i], x, y);
      x += cw + sp;
    }
    if (alpha != null) g.globalAlpha = 1;
  }

  function textWidth(g, str, size, spacing) {
    font(g, size || 8);
    var cw = g.measureText('M').width;
    var sp = spacing != null ? spacing : 1;
    var n = String(str).length;
    return n ? n * (cw + sp) - sp : 0;
  }

  // Greedy word wrap, in characters (monospace makes this exact).
  function wrap(str, cols) {
    var words = String(str).split(' ');
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!cur.length) { cur = w; }
      else if ((cur + ' ' + w).length <= cols) { cur += ' ' + w; }
      else { lines.push(cur); cur = w; }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }

  /* --------------------------------------------------------------- shapes */

  function rect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function frame(g, x, y, w, h, color, lw) {
    g.strokeStyle = color;
    g.lineWidth = lw || 1;
    g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  }

  function panel(g, x, y, w, h, fill, border, alpha) {
    g.globalAlpha = alpha != null ? alpha : 1;
    rect(g, x, y, w, h, fill || AL.U.rgba(AL.C.void0, 0.88));
    if (border) frame(g, x, y, w, h, border);
    g.globalAlpha = 1;
  }

  function radial(g, x, y, r, color, a0, a1) {
    if (r <= 0) return;
    var grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, AL.U.rgba(color, a0 != null ? a0 : 0.5));
    grad.addColorStop(1, AL.U.rgba(color, a1 != null ? a1 : 0));
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* ---------------------------------------------------------- light layer */

  /* Darkness is a full-screen wash with holes punched out of it. `lights` is a
   * list of {x,y,r,soft} in screen space. */
  function lights(g, list, strength, tint) {
    if (!lightCanvas) initLight();
    if (strength <= 0.001) return;

    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = tint || AL.C.void0;
    lg.globalAlpha = 1;
    lg.fillRect(0, 0, AL.W, AL.H);

    lg.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < list.length; i++) {
      var L = list[i];
      if (L.r <= 0) continue;
      var grad = lg.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      var core = L.soft != null ? L.soft : 0.55;
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(core, 'rgba(0,0,0,0.82)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = grad;
      lg.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    lg.globalCompositeOperation = 'source-over';

    g.globalAlpha = strength;
    g.drawImage(lightCanvas, 0, 0);
    g.globalAlpha = 1;
  }

  /* Additive warm bloom over the top of the scene — this is what sells "light"
   * rather than just "less dark". */
  function bloom(g, list) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < list.length; i++) {
      var L = list[i];
      if (L.r <= 0) continue;
      radial(g, L.x, L.y, L.r * (L.bloomScale || 0.75), L.color || AL.C.ember,
             (L.intensity != null ? L.intensity : 0.3), 0);
    }
    g.restore();
  }

  /* --------------------------------------------------------- full screen */

  function vignette(g, amount, color) {
    var grad = g.createRadialGradient(AL.W / 2, AL.H / 2, AL.H * 0.28,
                                      AL.W / 2, AL.H / 2, AL.W * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, AL.U.rgba(color || '#000000', amount));
    g.fillStyle = grad;
    g.fillRect(0, 0, AL.W, AL.H);
  }

  function fade(g, a, color) {
    if (a <= 0) return;
    g.fillStyle = AL.U.rgba(color || AL.C.void0, AL.U.clamp(a, 0, 1));
    g.fillRect(0, 0, AL.W, AL.H);
  }

  function letterbox(g, h, color) {
    if (h <= 0) return;
    g.fillStyle = color || '#000';
    g.fillRect(0, 0, AL.W, h);
    g.fillRect(0, AL.H - h, AL.W, h);
  }

  /* Iris wipe used for room transitions and the ending. */
  function iris(g, t, cx, cy, invert) {
    var maxR = Math.sqrt(AL.W * AL.W + AL.H * AL.H) * 0.55;
    var r = (invert ? 1 - t : t) * maxR;
    g.save();
    g.beginPath();
    g.rect(0, 0, AL.W, AL.H);
    g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true);
    g.fillStyle = AL.C.void0;
    g.fill();
    g.restore();
  }

  function scanTear(g, amount) {
    if (amount <= 0.001) return;
    for (var i = 0; i < 5; i++) {
      var y = Math.random() * AL.H;
      var h = AL.U.rand(1, 3);
      g.globalAlpha = AL.U.rand(0.05, 0.22) * amount;
      g.fillStyle = AL.C.echo;
      g.fillRect(AL.U.rand(-10, 10), y, AL.W, h);
    }
    g.globalAlpha = 1;
  }

  return {
    text: text, textWidth: textWidth, wrap: wrap, font: font,
    rect: rect, frame: frame, panel: panel, radial: radial,
    lights: lights, bloom: bloom,
    vignette: vignette, fade: fade, letterbox: letterbox, iris: iris,
    scanTear: scanTear
  };
})();

/* Screen shake + hit flash, shared by every scene. */
AL.FX = (function () {
  var shake = 0, shakeDecay = 1, flash = 0, flashColor = '#fff';
  var freeze = 0;      // hitstop, in seconds
  var chroma = 0;

  function addShake(amount, decay) {
    shake = Math.max(shake, amount);
    shakeDecay = decay || 6;
  }
  function addFlash(amount, color) { flash = Math.max(flash, amount); flashColor = color || '#fff'; }
  function addFreeze(sec) { freeze = Math.max(freeze, sec); }
  function addChroma(a) { chroma = Math.max(chroma, a); }

  function update(dt) {
    shake = AL.U.decay(shake, shakeDecay * dt * 10);
    flash = AL.U.decay(flash, dt * 3.4);
    chroma = AL.U.decay(chroma, dt * 2.5);
    if (freeze > 0) freeze = Math.max(0, freeze - dt);
  }

  function offset() {
    if (shake <= 0.01) return { x: 0, y: 0 };
    return {
      x: Math.round(AL.U.rand(-shake, shake)),
      y: Math.round(AL.U.rand(-shake, shake))
    };
  }

  return {
    addShake: addShake, addFlash: addFlash, addFreeze: addFreeze, addChroma: addChroma,
    update: update, offset: offset,
    get flash() { return flash; },
    get flashColor() { return flashColor; },
    get chroma() { return chroma; },
    frozen: function () { return freeze > 0; },
    reset: function () { shake = 0; flash = 0; freeze = 0; chroma = 0; }
  };
})();
