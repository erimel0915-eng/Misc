/* Progression: emberlight as currency, Warden rank, the upgrade catalogue, and
 * the Posts that keep earning while you are away.
 *
 * One rule governs what is for sale: nothing may change Wren's vertical reach.
 * The whole game is built on a measured ladder — 3 tiles from a surface, 4 off
 * an Echo's head, 7 riding one — and an upgrade that crossed a tile boundary
 * would quietly unmake every puzzle that depends on it. So the shop sells
 * speed, light, breath, voices and mercy, and never jump height.
 */
AL.Meta = (function () {
  var U = AL.U;

  /* ------------------------------------------------------------ catalogue */

  var UPGRADES = [
    { id: 'stride',  name: 'Ashstride',        blurb: 'Run faster',
      detail: function (n) { return '+' + (n * 5) + '% run speed'; },
      max: 8,  base: 60,   growth: 1.55, group: 'body' },

    { id: 'breath',  name: 'The Long Breath',  blurb: 'Record for longer',
      detail: function (n) { return '+' + (n * 0.4).toFixed(1) + 's recording'; },
      max: 6,  base: 90,   growth: 1.70, group: 'echo' },

    { id: 'lantern', name: 'Lantern Oil',      blurb: 'See further',
      detail: function (n) { return '+' + (n * 12) + '% lantern'; },
      max: 6,  base: 70,   growth: 1.50, group: 'body' },

    { id: 'draw',    name: 'Ember Draw',       blurb: 'Pull emberlight to you',
      detail: function (n) { return '+' + (n * 5) + 'px pickup reach'; },
      max: 6,  base: 50,   growth: 1.45, group: 'body' },

    { id: 'footing', name: 'Sure Footing',     blurb: 'Forgive a late jump',
      detail: function (n) { return '+' + (n * 20) + '% coyote time'; },
      max: 5,  base: 110,  growth: 1.60, group: 'body' },

    { id: 'quick',   name: 'Quickstep',        blurb: 'Dash again sooner',
      detail: function (n) { return '-' + (n * 12) + '% dash cooldown'; },
      max: 5,  base: 150,  growth: 1.70, group: 'body', needs: 'dash' },

    { id: 'wake',    name: 'Brighter Wake',    blurb: 'Your Echoes shine harder',
      detail: function (n) { return '+' + (n * 15) + '% Echo light'; },
      max: 5,  base: 130,  growth: 1.60, group: 'echo', needs: 'lightwake' },

    { id: 'grace',   name: "Warden's Grace",   blurb: 'Longer mercy on respawn',
      detail: function (n) { return '+' + (n * 0.15).toFixed(2) + 's invulnerable'; },
      max: 4,  base: 200,  growth: 1.90, group: 'body' },

    /* Capped at one, and horizontal only (see Player's dash). Together those
     * two constraints mean the most powerful thing in the shop extends reach
     * sideways without lifting Wren past the 7 tiles the level design already
     * grants for riding an Echo. */
    { id: 'wind',    name: 'Second Wind',      blurb: 'Dash again in mid-air, forward',
      detail: function (n) { return '+' + n + ' air dash (forward only)'; },
      max: 1,  base: 1200, growth: 3.00, group: 'body', needs: 'dash' },

    { id: 'voice',   name: 'Another Voice',    blurb: 'Hold one more Echo',
      detail: function (n) { return '+' + n + ' Echo' + (n > 1 ? 'es' : ''); },
      max: 2,  base: 800,  growth: 3.20, group: 'echo' },

    { id: 'post',    name: 'Warden Post',      blurb: 'Station an Echo. It keeps working.',
      detail: function (n) { return n + ' stationed  ·  ' + (n * POST_RATE).toFixed(2) + '/s'; },
      max: 12, base: 150,  growth: 1.50, group: 'posts' },

    { id: 'roots',   name: 'Deeper Roots',     blurb: 'Every Post yields more',
      detail: function (n) { return '+' + (n * 25) + '% Post yield'; },
      max: 10, base: 300,  growth: 1.60, group: 'posts' }
  ];

  var POST_RATE = 0.30;          // emberlight per second, per stationed Echo
  var OFFLINE_CAP = 2 * 3600;    // the Posts only remember two hours

  var byId = {};
  for (var i = 0; i < UPGRADES.length; i++) byId[UPGRADES[i].id] = UPGRADES[i];

  /* ----------------------------------------------------------------- state */

  function save() { return AL.Save.get(); }
  function lvl(id) { var u = save().upg || {}; return u[id] | 0; }

  function cost(id) {
    var d = byId[id];
    if (!d) return Infinity;
    var n = lvl(id);
    if (n >= d.max) return Infinity;
    return Math.round(d.base * Math.pow(d.growth, n));
  }

  function maxed(id) { return lvl(id) >= byId[id].max; }

  /* An upgrade stays hidden until the ability it modifies exists, so the shop
   * never advertises a dash upgrade to someone who cannot dash. */
  function available(id) {
    var d = byId[id];
    if (!d || !d.needs) return true;
    return !!save().abilities[d.needs];
  }

  function canBuy(id) { return available(id) && !maxed(id) && save().ember >= cost(id); }

  function buy(id) {
    if (!canBuy(id)) return false;
    var s = save();
    var c = cost(id);
    s.ember -= c;
    s.upg = s.upg || {};
    s.upg[id] = (s.upg[id] | 0) + 1;
    AL.Save.put();
    return true;
  }

  /* ------------------------------------------------------------------ rank */

  // Deliberately shallow: ranks should arrive often enough to feel like a drum.
  function xpForRank(r) { return Math.round(60 * Math.pow(r, 1.45)); }

  function rank() {
    var e = save().earned || 0;
    var r = 0;
    while (r < 99 && e >= xpForRank(r + 1)) r++;
    return r;
  }

  function rankProgress() {
    var e = save().earned || 0;
    var r = rank();
    var lo = r === 0 ? 0 : xpForRank(r);
    var hi = xpForRank(r + 1);
    return { r: r, lo: lo, hi: hi, frac: U.clamp((e - lo) / Math.max(1, hi - lo), 0, 1) };
  }

  // Rank pays a small, compounding dividend — the reason to keep earning.
  function earnMultiplier() { return 1 + rank() * 0.03; }

  /* -------------------------------------------------------------- currency */

  function award(base) {
    var s = save();
    var amount = Math.max(1, Math.round(base * earnMultiplier()));
    var before = rank();
    s.ember = (s.ember || 0) + amount;
    s.earned = (s.earned || 0) + amount;
    AL.Save.put();
    return { amount: amount, rankUp: rank() > before, rank: rank() };
  }

  /* ----------------------------------------------------------- idle income */

  function yieldPerSecond() {
    return lvl('post') * POST_RATE * (1 + lvl('roots') * 0.25);
  }

  /* Posts keep working while the game is closed, up to the cap. Returns how
   * much was waiting, so the Cache can show it. */
  function collectOffline() {
    var s = save();
    var now = Date.now();
    var last = s.lastSeen || now;
    s.lastSeen = now;
    var secs = U.clamp((now - last) / 1000, 0, OFFLINE_CAP);
    var rate = yieldPerSecond();
    if (rate <= 0 || secs < 1) { AL.Save.put(); return { amount: 0, secs: 0 }; }
    var amount = Math.floor(secs * rate);
    if (amount > 0) { s.ember += amount; s.earned += amount; }
    AL.Save.put();
    return { amount: amount, secs: secs };
  }

  var drip = 0;
  function tick(dt) {
    var rate = yieldPerSecond();
    if (rate <= 0) return 0;
    drip += rate * dt;
    if (drip < 1) return 0;
    var whole = Math.floor(drip);
    drip -= whole;
    var s = save();
    s.ember += whole;
    s.earned += whole;
    s.lastSeen = Date.now();
    return whole;
  }

  /* ------------------------------------------- what the upgrades actually do */

  return {
    UPGRADES: UPGRADES,
    POST_RATE: POST_RATE,
    OFFLINE_CAP: OFFLINE_CAP,
    def: function (id) { return byId[id]; },
    level: lvl, cost: cost, maxed: maxed, available: available,
    canBuy: canBuy, buy: buy,
    rank: rank, rankProgress: rankProgress, xpForRank: xpForRank,
    earnMultiplier: earnMultiplier,
    award: award, yieldPerSecond: yieldPerSecond,
    collectOffline: collectOffline, tick: tick,

    runScale:      function () { return 1 + lvl('stride') * 0.05; },
    breathBonus:   function () { return lvl('breath') * 0.4; },
    lanternScale:  function () { return 1 + lvl('lantern') * 0.12; },
    drawRadius:    function () { return lvl('draw') * 5; },
    footingScale:  function () { return 1 + lvl('footing') * 0.20; },
    dashCoolScale: function () { return Math.max(0.3, 1 - lvl('quick') * 0.12); },
    echoLightScale:function () { return 1 + lvl('wake') * 0.15; },
    graceBonus:    function () { return lvl('grace') * 0.15; },
    airDashes:     function () { return lvl('wind'); },
    extraEchoes:   function () { return lvl('voice'); }
  };
})();
