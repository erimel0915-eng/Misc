/* ASHLIGHT — core utilities.
 * Everything hangs off one global so the game can run from file:// with no
 * module loader, no bundler, no server.
 */
var AL = window.AL || {};
window.AL = AL;

AL.W = 480;          // internal render width
AL.H = 272;          // internal render height
AL.TILE = 16;
AL.COLS = 30;        // a room is exactly one screen
AL.ROWS = 17;
AL.DT = 1 / 60;      // fixed timestep: makes Echo replay bit-exact

AL.U = (function () {
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }
  function approach(v, target, delta) {
    return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
  }
  // Move `v` toward 0 by `d`, never overshooting.
  function decay(v, d) { return v > 0 ? Math.max(0, v - d) : Math.min(0, v + d); }

  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function easeIn(t) { return t * t; }
  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // Deterministic PRNG (mulberry32) — used for decor so rooms look identical
  // every visit instead of shimmering.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // "rgba()" string from hex + alpha, cached because we build a lot of these.
  var _rgbaCache = {};
  function rgba(hex, a) {
    var key = hex + '|' + a;
    var hit = _rgbaCache[key];
    if (hit) return hit;
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var s = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    _rgbaCache[key] = s;
    return s;
  }

  function mix(hexA, hexB, t) {
    function parse(hex) {
      var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var A = parse(hexA), B = parse(hexB);
    var r = Math.round(lerp(A[0], B[0], t));
    var g = Math.round(lerp(A[1], B[1], t));
    var b = Math.round(lerp(A[2], B[2], t));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  return {
    clamp: clamp, lerp: lerp, sign: sign, approach: approach, decay: decay,
    easeOut: easeOut, easeIn: easeIn, easeInOut: easeInOut,
    rng: rng, rand: rand, randInt: randInt, pick: pick,
    aabb: aabb, rectsOverlap: rectsOverlap, rgba: rgba, mix: mix
  };
})();

/* The palette. Kept in one place so the whole game reads as one object:
 * cold dead world, warm living light, cyan for the parts of you that stay. */
AL.C = {
  void0:   '#05050b',
  void1:   '#0d0d1a',
  stone0:  '#20203a',   // unlit mass
  stone1:  '#2e2e4a',   // a face with sky above it
  stone2:  '#3d3e5e',
  stoneLit:'#53547c',
  edge:    '#6a6d9b',   // the lip you aim your jumps at
  ash:     '#8a90a8',
  ashDim:  '#5a5f78',
  bone:    '#f2ead9',   // Wren
  cloth:   '#c2543f',   // Wren's scarf — the only red in the game
  ember:   '#ffb347',   // light, warmth, collectibles
  emberHot:'#ffe6b0',
  echo:    '#6fe6ff',   // your echoes
  echoDim: '#2b7f99',
  iris:    '#d8a7ff',   // the Lumen
  bad:     '#ff4d6d',   // hazards
  plate:   '#8ef0a0',
  text:    '#d7d2c4'
};
