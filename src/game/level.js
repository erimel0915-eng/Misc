/* A Level is exactly one screen of tiles plus the entities spawned from it.
 * Collision is a grid query; the grid is rebuilt every step because gates
 * retract, crumble tiles break, and phantom tiles only exist where there's
 * light.
 */
AL.T = {
  EMPTY: ' ',
  SOLID: '#',
  ONEWAY: '-',
  CRUMBLE: '~',
  PHANTOM: '?',
  SPIKE_U: '^', SPIKE_D: 'v', SPIKE_L: '<', SPIKE_R: '>',
  GATE_A: 'A', GATE_B: 'B', GATE_C: 'D',
  GATE_INV_A: 'E', GATE_INV_B: 'F',
  DECOR_STRUT: '=',
  DECOR_ASH: '_'
};

AL.Level = (function () {
  var TILE = AL.TILE;

  function Level(def, world) {
    this.def = def;
    this.name = def.name || '';
    this.chamber = def.chamber || 1;
    this.cols = AL.COLS;
    this.rows = AL.ROWS;
    this.base = [];          // char grid, immutable
    this.solid = [];         // recomputed each step
    this.lit = [];           // phantom lighting result
    this.crumbleTimer = [];  // per-cell: >0 means broken, counts down
    this.spawn = { x: 32, y: 32 };
    this.entities = [];
    this.requiredShards = 0;
    this.dark = def.dark != null ? def.dark : AL.Level.chamberDark(this.chamber);
    this.seed = def.seed || (def.id ? hashStr(def.id) : 1234);
    this.cfg = def.cfg || {};
    this.parse(world);
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  Level.chamberDark = function (ch) {
    // Ambient darkness per chamber: the Spire gets blacker as you descend,
    // then opens up at the Lumen.
    return [0, 0.10, 0.18, 0.28, 0.40, 0.80, 0.52, 0.16][ch] || 0.2;
  };

  Level.prototype.parse = function (world) {
    var rows = this.def.map;
    this._cc = {};             // cfg key -> how many consumed (reading order)
    this._motes = 0;
    this.entities.length = 0;

    for (var y = 0; y < this.rows; y++) {
      var line = rows[y] != null ? rows[y] : '';
      var brow = [], srow = [], lrow = [], crow = [];
      for (var x = 0; x < this.cols; x++) {
        var c = line.charAt(x) || ' ';
        if (c === '.') c = ' ';
        brow.push(c);
        srow.push(false);
        lrow.push(false);
        crow.push(0);

        this.spawnFor(c, x, y, world);
      }
      this.base.push(brow);
      this.solid.push(srow);
      this.lit.push(lrow);
      this.crumbleTimer.push(crow);
    }
    this.rebuild(world);
  };

  /* Extra per-entity config is authored as arrays matched in reading order
   * (top-to-bottom, left-to-right), one counter per cfg key. */
  Level.prototype.nextCfg = function (key) {
    var n = this._cc[key] || 0;
    this._cc[key] = n + 1;
    var arr = this.cfg[key];
    if (!arr) return {};
    return arr[n] || {};
  };

  Level.prototype.spawnFor = function (c, x, y, world) {
    var E = AL.Entities;
    var px = x * TILE, py = y * TILE;
    switch (c) {
      case 'P':
        this.spawn.x = px + TILE / 2;
        this.spawn.y = py + TILE - 1;
        break;
      case '*': this.entities.push(new E.Shard(px, py, this.requiredShards)); this.requiredShards++; break;
      case 'o': this.entities.push(new E.Mote(px, py, this.def.id + ':' + (this._motes++))); break;
      case 'X': this.entities.push(new E.Exit(px, py)); break;
      case '+': this.entities.push(new E.Lamp(px, py, this.nextCfg('lamps'))); break;
      case 'a': this.entities.push(new E.Plate(px, py, 'A')); break;
      case 'b': this.entities.push(new E.Plate(px, py, 'B')); break;
      case 'c': this.entities.push(new E.Plate(px, py, 'C')); break;
      case 'r': this.entities.push(new E.Laser(px, py, 1, 0, this.nextCfg('lasers'))); break;
      case 'l': this.entities.push(new E.Laser(px, py, -1, 0, this.nextCfg('lasers'))); break;
      case 'd': this.entities.push(new E.Laser(px, py, 0, 1, this.nextCfg('lasers'))); break;
      case 'u': this.entities.push(new E.Laser(px, py, 0, -1, this.nextCfg('lasers'))); break;
      case 'M': this.entities.push(new E.Mover(px, py, this.nextCfg('movers'))); break;
      case 'S': this.entities.push(new E.Shade(px, py, this.nextCfg('shades'))); break;
      case 'R': this.entities.push(new E.Rune(px, py, this.nextCfg('runes'))); break;
      case 'T': this.entities.push(new E.Altar(px, py, this.nextCfg('altars'))); break;
      case 'W': this.entities.push(new E.Iris(px, py, this.nextCfg('iris'))); break;
    }
  };

  /* ------------------------------------------------------------ collision */

  Level.prototype.inBounds = function (cx, cy) {
    return cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows;
  };

  Level.prototype.charAt = function (cx, cy) {
    if (!this.inBounds(cx, cy)) return '#';   // outside the room is wall
    return this.base[cy][cx];
  };

  // Rebuild the solid grid from base chars + current world state.
  Level.prototype.rebuild = function (world) {
    var chanA = world ? world.channel('A') : false;
    var chanB = world ? world.channel('B') : false;
    var chanC = world ? world.channel('C') : false;
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        var c = this.base[y][x];
        var s = false;
        switch (c) {
          case '#': s = true; break;
          case '~': s = this.crumbleTimer[y][x] <= 0; break;
          case '?': s = this.lit[y][x]; break;
          case 'A': s = !chanA; break;
          case 'B': s = !chanB; break;
          case 'D': s = !chanC; break;
          case 'E': s = chanA; break;     // inverse: solid while powered
          case 'F': s = chanB; break;
        }
        this.solid[y][x] = s;
      }
    }
  };

  // Mark which phantom tiles are currently inside a light.
  Level.prototype.applyLight = function (lightList) {
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        if (this.base[y][x] !== '?') { this.lit[y][x] = false; continue; }
        var cxp = x * TILE + TILE / 2, cyp = y * TILE + TILE / 2;
        var on = false;
        for (var i = 0; i < lightList.length; i++) {
          var L = lightList[i];
          if (!L.reveals) continue;
          var dx = L.wx - cxp, dy = L.wy - cyp;
          if (dx * dx + dy * dy <= L.r * L.r) { on = true; break; }
        }
        this.lit[y][x] = on;
      }
    }
  };

  Level.prototype.isSolid = function (cx, cy) {
    if (!this.inBounds(cx, cy)) return true;
    return this.solid[cy][cx];
  };

  // AABB (world px) against the solid grid.
  Level.prototype.rectSolid = function (x, y, w, h) {
    var x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    var y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (var cy = y0; cy <= y1; cy++)
      for (var cx = x0; cx <= x1; cx++)
        if (this.isSolid(cx, cy)) return true;
    return false;
  };

  /* One-way platforms: solid only when the mover's feet are above the tile top
   * and it is travelling downward. */
  Level.prototype.oneWayLanding = function (x, w, prevBottom, newBottom) {
    if (newBottom < prevBottom) return -1;
    var x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    var y0 = Math.floor(prevBottom / TILE), y1 = Math.floor(newBottom / TILE);
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        if (this.charAt(cx, cy) !== '-') continue;
        var top = cy * TILE;
        if (prevBottom <= top + 1 && newBottom >= top) return top;
      }
    }
    return -1;
  };

  // Hazard tiles (spikes) use a slim hitbox so they feel fair.
  Level.prototype.rectHazard = function (x, y, w, h) {
    var x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    var y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        var c = this.charAt(cx, cy);
        if (c !== '^' && c !== 'v' && c !== '<' && c !== '>') continue;
        var hx = cx * TILE, hy = cy * TILE, hw = TILE, hh = TILE;
        if (c === '^') { hy += 9; hh = 7; hx += 1; hw = 14; }
        else if (c === 'v') { hh = 7; hx += 1; hw = 14; }
        else if (c === '<') { hw = 7; hy += 1; hh = 14; }
        else if (c === '>') { hx += 9; hw = 7; hy += 1; hh = 14; }
        if (AL.U.rectsOverlap(x, y, w, h, hx, hy, hw, hh)) return true;
      }
    }
    return false;
  };

  Level.prototype.breakCrumble = function (cx, cy) {
    if (!this.inBounds(cx, cy)) return;
    if (this.base[cy][cx] !== '~') return;
    if (this.crumbleTimer[cy][cx] > 0) return;
    this.crumbleTimer[cy][cx] = 2.6;
    AL.Particles.burst(cx * TILE + 8, cy * TILE + 8, AL.C.stoneLit, 10, 70, { life: 0.5, size: 2 });
    AL.Audio.sfx('land', false);
  };

  // Crumble tiles the given box is resting on top of.
  Level.prototype.touchCrumble = function (x, w, bottom, dt) {
    var x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    var cy = Math.floor((bottom + 1) / TILE);
    for (var cx = x0; cx <= x1; cx++) {
      if (this.charAt(cx, cy) !== '~') continue;
      if (this.crumbleTimer[cy][cx] > 0) continue;
      this._warn = this._warn || {};
      var k = cx + ',' + cy;
      this._warn[k] = (this._warn[k] || 0) + dt;
      if (this._warn[k] > 0.34) { this._warn[k] = 0; this.breakCrumble(cx, cy); }
    }
  };

  Level.prototype.update = function (dt) {
    for (var y = 0; y < this.rows; y++)
      for (var x = 0; x < this.cols; x++)
        if (this.crumbleTimer[y][x] > 0) this.crumbleTimer[y][x] -= dt;
  };

  Level.prototype.reset = function () {
    for (var y = 0; y < this.rows; y++)
      for (var x = 0; x < this.cols; x++) this.crumbleTimer[y][x] = 0;
    this._warn = {};
  };

  /* -------------------------------------------------------------- drawing */

  Level.prototype.drawBackground = function (g, world) {
    var C = AL.C;
    // vertical gradient — the Spire's throat
    var grad = g.createLinearGradient(0, 0, 0, AL.H);
    var topc = AL.U.mix(C.void1, C.stone0, 0.25);
    grad.addColorStop(0, topc);
    grad.addColorStop(1, C.void0);
    g.fillStyle = grad;
    g.fillRect(0, 0, AL.W, AL.H);

    // parallax silhouettes, deterministic per room
    var rnd = AL.U.rng(this.seed);
    // Distant ruins. Kept darker than the sky and flatter than the tiles, so
    // they never read as something you could stand on.
    var layers = [
      { n: 7, a: 0.55, w: 54, hmin: 50, hmax: 120, col: '#121226' },
      { n: 9, a: 0.70, w: 34, hmin: 30, hmax: 80,  col: '#0a0a16' }
    ];
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li];
      g.globalAlpha = L.a;
      g.fillStyle = L.col;
      for (var i = 0; i < L.n; i++) {
        var bx = rnd() * (AL.W + 80) - 40;
        var bh = L.hmin + rnd() * (L.hmax - L.hmin);
        var bw = L.w * (0.5 + rnd());
        g.fillRect(Math.round(bx), AL.H - bh, Math.round(bw), bh);
        // a notch, so they read as ruins not bars
        g.globalAlpha = L.a * 0.5;
        g.fillRect(Math.round(bx + bw * 0.3), AL.H - bh - 10, Math.round(bw * 0.4), 12);
        g.globalAlpha = L.a;
      }
    }
    g.globalAlpha = 1;
  };

  Level.prototype.draw = function (g, world) {
    var C = AL.C;
    var T = TILE;
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        var c = this.base[y][x];
        var px = x * T, py = y * T;
        switch (c) {
          case '#': this.drawStone(g, x, y, px, py); break;
          case '-': this.drawOneWay(g, px, py); break;
          case '~': this.drawCrumble(g, x, y, px, py); break;
          case '?': this.drawPhantom(g, x, y, px, py); break;
          case '^': case 'v': case '<': case '>': this.drawSpike(g, c, px, py); break;
          case 'A': this.drawGate(g, px, py, this.solid[y][x], C.plate); break;
          case 'B': this.drawGate(g, px, py, this.solid[y][x], C.echo); break;
          case 'D': this.drawGate(g, px, py, this.solid[y][x], C.iris); break;
          case 'E': this.drawGate(g, px, py, this.solid[y][x], C.bad); break;
          case 'F': this.drawGate(g, px, py, this.solid[y][x], C.cloth); break;
          case '=': this.drawStrut(g, px, py); break;
          case '_': this.drawAshPile(g, x, y, px, py); break;
        }
      }
    }
  };

  Level.prototype.drawStone = function (g, cx, cy, px, py) {
    var C = AL.C;
    var openUp = !this.isSolidChar(cx, cy - 1);
    var openDown = !this.isSolidChar(cx, cy + 1);
    var openL = !this.isSolidChar(cx - 1, cy);
    var openR = !this.isSolidChar(cx + 1, cy);

    g.fillStyle = openUp ? C.stone1 : C.stone0;
    g.fillRect(px, py, TILE, TILE);

    // deterministic speckle
    var rnd = AL.U.rng(this.seed ^ ((cx * 73856093) ^ (cy * 19349663)));
    g.fillStyle = AL.U.rgba(C.stone2, 0.5);
    for (var i = 0; i < 4; i++) {
      var sx = px + Math.floor(rnd() * TILE), sy = py + Math.floor(rnd() * TILE);
      g.fillRect(sx, sy, 1, 1);
    }

    if (openUp) {
      // The lip is the single most important pixel row in a platformer:
      // it is what the player aims every jump at.
      g.fillStyle = C.edge;
      g.fillRect(px, py, TILE, 1);
      g.fillStyle = AL.U.rgba(C.stoneLit, 0.7);
      g.fillRect(px, py + 1, TILE, 2);
      g.fillStyle = AL.U.rgba(C.stoneLit, 0.25);
      g.fillRect(px, py + 3, TILE, 2);
    }
    if (openDown) { g.fillStyle = AL.U.rgba(C.void0, 0.55); g.fillRect(px, py + TILE - 2, TILE, 2); }
    if (openL) { g.fillStyle = AL.U.rgba(C.stone2, 0.45); g.fillRect(px, py, 1, TILE); }
    if (openR) { g.fillStyle = AL.U.rgba(C.void0, 0.35); g.fillRect(px + TILE - 1, py, 1, TILE); }
  };

  Level.prototype.isSolidChar = function (cx, cy) {
    if (!this.inBounds(cx, cy)) return true;
    var c = this.base[cy][cx];
    return c === '#';
  };

  Level.prototype.drawOneWay = function (g, px, py) {
    var C = AL.C;
    g.fillStyle = C.stone2;
    g.fillRect(px, py, TILE, 4);
    g.fillStyle = C.edge;
    g.fillRect(px, py, TILE, 1);
    g.fillStyle = AL.U.rgba(C.void0, 0.5);
    g.fillRect(px + 2, py + 4, 2, 3);
    g.fillRect(px + TILE - 4, py + 4, 2, 3);
  };

  Level.prototype.drawCrumble = function (g, cx, cy, px, py) {
    var C = AL.C;
    var t = this.crumbleTimer[cy][cx];
    if (t > 0) {
      // ghost outline while it regrows; flashes just before it returns
      var a = t < 0.6 ? (Math.sin(t * 30) > 0 ? 0.42 : 0.16) : 0.16;
      g.globalAlpha = a;
      AL.Draw.frame(g, px + 1, py + 1, TILE - 2, TILE - 2, C.ashDim);
      g.globalAlpha = 1;
      return;
    }
    var warn = (this._warn && this._warn[cx + ',' + cy]) || 0;
    g.fillStyle = warn > 0 ? AL.U.mix(C.stone1, C.cloth, Math.min(1, warn * 2.6)) : C.stone1;
    g.fillRect(px, py, TILE, TILE);
    g.fillStyle = AL.U.rgba(C.void0, 0.6);
    // cracks
    g.fillRect(px + 4, py + 2, 1, 5);
    g.fillRect(px + 5, py + 7, 1, 4);
    g.fillRect(px + 10, py + 3, 1, 7);
    g.fillRect(px + 2, py + 11, 6, 1);
    g.fillStyle = AL.U.rgba(C.edge, 0.7);
    g.fillRect(px, py, TILE, 1);
  };

  Level.prototype.drawPhantom = function (g, cx, cy, px, py) {
    var C = AL.C;
    if (this.lit[cy][cx]) {
      g.fillStyle = AL.U.rgba(C.echoDim, 0.85);
      g.fillRect(px, py, TILE, TILE);
      g.fillStyle = AL.U.rgba(C.echo, 0.9);
      g.fillRect(px, py, TILE, 1);
      g.fillStyle = AL.U.rgba(C.echo, 0.25);
      g.fillRect(px + 2, py + 4, TILE - 4, 1);
      g.fillRect(px + 4, py + 9, TILE - 8, 1);
    } else {
      g.globalAlpha = 0.3;
      g.strokeStyle = AL.U.rgba(C.echoDim, 0.9);
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      g.setLineDash([]);
      g.globalAlpha = 1;
    }
  };

  Level.prototype.drawSpike = function (g, c, px, py) {
    var C = AL.C;
    g.fillStyle = C.stone2;
    // base plate
    if (c === '^') g.fillRect(px, py + TILE - 3, TILE, 3);
    else if (c === 'v') g.fillRect(px, py, TILE, 3);
    else if (c === '<') g.fillRect(px, py, 3, TILE);
    else g.fillRect(px + TILE - 3, py, 3, TILE);

    g.fillStyle = C.bad;
    for (var i = 0; i < 4; i++) {
      var o = i * 4 + 1;
      if (c === '^')      for (var k = 0; k < 4; k++) g.fillRect(px + o + (k > 1 ? 1 : 0), py + TILE - 4 - (3 - k) * 2, 3 - (k > 1 ? 1 : 0), 2);
      else if (c === 'v') for (var k2 = 0; k2 < 4; k2++) g.fillRect(px + o + (k2 > 1 ? 1 : 0), py + 2 + (3 - k2) * 2, 3 - (k2 > 1 ? 1 : 0), 2);
      else if (c === '<') for (var k3 = 0; k3 < 4; k3++) g.fillRect(px + 2 + (3 - k3) * 2, py + o + (k3 > 1 ? 1 : 0), 2, 3 - (k3 > 1 ? 1 : 0));
      else                for (var k4 = 0; k4 < 4; k4++) g.fillRect(px + TILE - 4 - (3 - k4) * 2, py + o + (k4 > 1 ? 1 : 0), 2, 3 - (k4 > 1 ? 1 : 0));
    }
  };

  Level.prototype.drawGate = function (g, px, py, isSolid, color) {
    var C = AL.C;
    if (isSolid) {
      g.fillStyle = AL.U.mix(C.stone1, color, 0.18);
      g.fillRect(px, py, TILE, TILE);
      g.fillStyle = AL.U.rgba(color, 0.8);
      g.fillRect(px, py, TILE, 1);
      g.fillRect(px, py + TILE - 1, TILE, 1);
      g.fillStyle = AL.U.rgba(color, 0.22);
      g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      g.fillStyle = AL.U.rgba(color, 0.55);
      g.fillRect(px + TILE / 2 - 1, py + TILE / 2 - 1, 2, 2);
    } else {
      g.globalAlpha = 0.35;
      g.fillStyle = AL.U.rgba(color, 0.5);
      g.fillRect(px + 1, py, TILE - 2, 1);
      g.fillRect(px + 1, py + TILE - 1, TILE - 2, 1);
      g.globalAlpha = 1;
    }
  };

  Level.prototype.drawStrut = function (g, px, py) {
    g.fillStyle = AL.U.rgba(AL.C.stone2, 0.6);
    g.fillRect(px + 5, py, 6, TILE);
    g.fillStyle = AL.U.rgba(AL.C.void0, 0.5);
    g.fillRect(px + 7, py, 2, TILE);
  };

  Level.prototype.drawAshPile = function (g, cx, cy, px, py) {
    var rnd = AL.U.rng(this.seed ^ (cx * 31 + cy * 7));
    g.fillStyle = AL.U.rgba(AL.C.ashDim, 0.5);
    for (var i = 0; i < 7; i++) {
      var w = 2 + Math.floor(rnd() * 5);
      g.fillRect(px + Math.floor(rnd() * (TILE - w)), py + TILE - 1 - Math.floor(rnd() * 4), w, 1);
    }
  };

  return Level;
})();
