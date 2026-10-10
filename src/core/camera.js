/* A following camera with a dead zone.
 *
 * Levels are no longer one screen. The camera tracks Wren through a box she
 * can move inside without the view shifting, leads slightly in the direction
 * she is facing so there is room to read what is coming, and clamps hard to
 * the level bounds so the world never shows its edge.
 */
AL.Camera = (function () {
  var U = AL.U;

  function Camera() {
    this.x = 0; this.y = 0;
    this.tx = 0; this.ty = 0;
    this.lead = 0;
    this.shakeX = 0; this.shakeY = 0;
  }

  // Half-width/height of the box the player moves in freely, in pixels.
  var DEAD_X = 34, DEAD_Y = 22;
  var LEAD_X = 40;          // how far ahead of her facing the view sits
  var EASE   = 7.5;         // higher is snappier

  Camera.prototype.bounds = function (level) {
    return {
      maxX: Math.max(0, level.widthPx - AL.W),
      maxY: Math.max(0, level.heightPx - AL.H)
    };
  };

  Camera.prototype.focus = function (level, px, py) {
    var b = this.bounds(level);
    this.x = U.clamp(px - AL.W / 2, 0, b.maxX);
    this.y = U.clamp(py - AL.H / 2, 0, b.maxY);
    this.tx = this.x; this.ty = this.y;
    this.lead = 0;
  };

  Camera.prototype.update = function (dt, level, player) {
    if (!player) return;
    var b = this.bounds(level);
    var cx = player.x + player.w / 2;
    var cy = player.y + player.h / 2;

    // lead the view in the direction she is actually travelling
    var want = 0;
    if (Math.abs(player.vx) > 20) want = U.sign(player.vx) * LEAD_X;
    this.lead = U.lerp(this.lead, want, 1 - Math.pow(0.001, dt));

    var focusX = cx + this.lead;
    var focusY = cy;

    // dead zone: only move once she leaves the middle box
    var viewCX = this.tx + AL.W / 2;
    var viewCY = this.ty + AL.H / 2;
    if (focusX > viewCX + DEAD_X) this.tx += focusX - (viewCX + DEAD_X);
    else if (focusX < viewCX - DEAD_X) this.tx += focusX - (viewCX - DEAD_X);
    if (focusY > viewCY + DEAD_Y) this.ty += focusY - (viewCY + DEAD_Y);
    else if (focusY < viewCY - DEAD_Y) this.ty += focusY - (viewCY - DEAD_Y);

    this.tx = U.clamp(this.tx, 0, b.maxX);
    this.ty = U.clamp(this.ty, 0, b.maxY);

    var k = 1 - Math.pow(0.0001, dt * (EASE / 8));
    this.x = U.lerp(this.x, this.tx, k);
    this.y = U.lerp(this.y, this.ty, k);

    // Snap to whole pixels. A fractional camera on a pixel-art scene makes
    // every tile edge shimmer as it scrolls.
    if (Math.abs(this.x - this.tx) < 0.2) this.x = this.tx;
    if (Math.abs(this.y - this.ty) < 0.2) this.y = this.ty;
  };

  Camera.prototype.renderX = function () { return Math.round(this.x); };
  Camera.prototype.renderY = function () { return Math.round(this.y); };

  // World point -> screen point
  Camera.prototype.toScreenX = function (wx) { return wx - this.renderX(); };
  Camera.prototype.toScreenY = function (wy) { return wy - this.renderY(); };

  Camera.prototype.visibleTiles = function (level) {
    var T = AL.TILE;
    var x0 = Math.max(0, Math.floor(this.renderX() / T) - 1);
    var y0 = Math.max(0, Math.floor(this.renderY() / T) - 1);
    var x1 = Math.min(level.cols - 1, Math.ceil((this.renderX() + AL.W) / T) + 1);
    var y1 = Math.min(level.rows - 1, Math.ceil((this.renderY() + AL.H) / T) + 1);
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  };

  return Camera;
})();
