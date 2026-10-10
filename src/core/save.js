/* Save data in localStorage. Degrades to an in-memory object when storage is
 * unavailable (private browsing, file:// restrictions) so the game still runs.
 */
AL.Save = (function () {
  var KEY = 'ashlight.save.v1';
  var mem = null;
  var usable = true;

  function blank() {
    return {
      room: 0,              // furthest room index reached
      shards: 0,            // total emberlight collected
      memories: {},         // id -> true
      deaths: 0,
      echoesMade: 0,
      time: 0,              // seconds played
      abilities: {},        // name -> true
      seenRunes: {},
      ending: null,         // 'light' | 'dark' | 'free'
      endingsSeen: {},
      muted: false,
      crt: true,
      started: false
    };
  }

  function load() {
    if (mem) return mem;
    try {
      var raw = window.localStorage.getItem(KEY);
      mem = raw ? JSON.parse(raw) : blank();
      // Merge forward so an older save never crashes a newer build.
      var b = blank();
      for (var k in b) if (!(k in mem)) mem[k] = b[k];
    } catch (e) {
      usable = false;
      mem = blank();
    }
    return mem;
  }

  function save() {
    if (!mem) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { usable = false; }
  }

  function reset() { mem = blank(); save(); return mem; }

  return {
    get: load,
    put: save,
    reset: reset,
    usable: function () { return usable; },
    hasRun: function () { var d = load(); return !!d.started && (d.room > 0 || d.shards > 0); }
  };
})();
