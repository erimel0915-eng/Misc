/* Level data.
 *
 * A level is as large as it was authored; the camera scrolls to fit. Some run
 * wide and are walked left to right, one runs as a shaft and is climbed down.
 * Maps are written WITHOUT padding and are BOTTOM-ALIGNED by `frame()`, so the
 * last authored rows are the floor and a hole in them is a hole in the world.
 * `frame()` seals the ceiling and both side walls, so a level cannot leak.
 *
 * These maps are generated from a declarative spec rather than counted out by
 * hand — at 100 columns a miscount is invisible — but what lands here is plain
 * ASCII and can be edited directly.
 *
 * LEGEND
 *   space .  empty            #  stone              -  one-way platform
 *   ~  crumbling floor        ?  phantom (solid only in light)
 *   ^v<>  spikes (facing)     =  strut (decor)      _  ash (decor)
 *   P  spawn                  X  exit door          +  wall lamp
 *   *  emberlight (required)  o  memory mote (optional)
 *   a b c  pressure plates  -> channels A B C
 *   A B D  gates: solid until that channel is powered
 *   E F    gates: solid WHILE channel A / B is powered  (switchable bridges)
 *   r l d u  laser emitters, facing right/left/down/up
 *   M  moving platform        S  shade              R  rune (story)
 *   T  altar (ability)        K  checkpoint        W  Iris
 *
 * THE VERTICAL VOCABULARY, measured off the actual jump arc:
 *   from any surface                -> a surface 3 rows higher is reachable
 *   off an Echo standing on it      -> 4 rows        (assist: 'step')
 *   riding an Echo's rising jump    -> 7 rows        (assist: 'ride')
 *   horizontal gap                  -> 4 tiles max, 3 comfortable
 *
 * So every room is laid out on a ladder of surfaces 3 rows apart, and a
 * collectible always sits in the row directly above its platform. `assist`
 * marks the rooms whose REQUIRED path deliberately breaks that rule and needs
 * an Echo; optional memory motes are allowed to need one anywhere.
 *
 * Authored rows are indexed 0..15 and land on grid rows 1..16:
 *   idx 13 -> the floor you walk on      idx 14,15 -> the floor itself
 *   ledges at idx 11, 8, 5, 2 form a perfect 3-row climb
 */
AL.Levels = (function () {

  function spaces(n) { return new Array(n + 1).join(' '); }

  /* Bottom-align the authored rows, pad every row to the level's width, and
   * seal the shell. A level is as wide and as tall as it was written: 30x17
   * is simply the one-screen case, and anything larger scrolls. */
  function frame(rows) {
    var cols = AL.COLS, i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].length > cols) cols = rows[i].length;
    }
    /* Always leave one row for the sealed ceiling, so authored row i lands on
     * grid row i+1 at every level height. Without the +1, a level taller than
     * one screen had its first authored row overwritten by the ceiling. */
    var total = Math.max(AL.ROWS, rows.length + 1);
    var off = total - rows.length;               // push content to the floor
    var pad = spaces(cols);
    var out = [];
    for (var y = 0; y < total; y++) {
      var src = y - off;
      var line = ((src >= 0 && rows[src] != null) ? rows[src] : '') + pad;
      var a = line.slice(0, cols).split('');
      if (y === 0) { for (var x = 0; x < cols; x++) a[x] = '#'; }
      a[0] = '#';
      a[cols - 1] = '#';
      out.push(a.join(''));
    }
    return out;
  }

  var G = '##############################';   // solid floor row

  function R(def) { def.map = frame(def.map); return def; }

  var rooms = [

  R({ id: 'c1', chamber: 1, name: 'The Waking Shelf', dark: 0.10,
      assist: 'step', onEnter: 'prologue', hint: 'ARROWS MOVE  \u00B7  Z JUMPS',
      cfg: {
        runes: [{ key: 'rune_ash' }, { key: 'rune_glove' }, { key: 'rune_weight' }, { key: 'rune_shelf' }],
        altars: [{ ability: 'echo', script: 'get_echo' }]
      },
      map: [
        '                                                   A',
        '   +                      +                       +A                  +',
        '                                                   A',
        '                                                   A',
        '                       o                           A',
        '                    #######                        A',
        '                                                   A                 o',
        '              *                                    A              #######',
        '            ######                                 A',
        '                                *                  A',
        '       *                    ##########             A',
        '     ######                                        A        ######',
        '                                                   A',
        '  P R              K  T  R              K  R a     A      *   K    R      X',
        ' ####################################################   ######################',
        ' ####################################################   #####################',
      ] }),

  R({ id: 'c2', chamber: 2, name: 'The Hollow Stair', dark: 0.20,
      assist: 'ride', onEnter: 'ch2_open', hint: 'THE WAY IS DOWN',
      cfg: {
        runes: [{ key: 'rune_bridge' }, { key: 'rune_counter' }, { key: 'rune_rise' }, { key: 'rune_hold' }],
        altars: [{ ability: 'twin', script: 'get_twin' }]
      },
      map: [
        '',
        '   +      *',
        '         ####',
        '',
        '   P  R',
        ' #############',
        '                        K    *',
        '                   ##############',
        '',
        '',
        '      T    R',
        '  ##############',
        '',
        '                             +',
        '                       a      K###',
        '                   ##############',
        '',
        '',
        '',
        ' AAAAAAAAAAAAAAAAAAAAAAAAAAoAAAAA',
        '                        #######',
        '',
        '        *  ^^^^',
        '   ##############',
        '',
        '',
        '                      K     R',
        '   + o            ##############',
        '  #######',
        '',
        '       *',
        '  #############',
        '',
        '',
        '                    ^^^^^    *',
        '                 ################',
        '',
        '',
        '     K',
        ' ############',
        '',
        '                             +',
        '                        *',
        '                #################',
        '',
        '',
        '',
        '     R                      X',
        ' ################################',
        ' ################################',
      ] }),

  R({ id: 'c3', chamber: 3, name: 'The Long Breath', dark: 0.28,
      onEnter: 'ch3_open', hint: 'RIDE THE RAIL',
      cfg: {
        runes: [{ key: 'rune_breath' }, { key: 'rune_rails' }, { key: 'rune_patience' }, { key: 'rune_loom' }],
        altars: [{ ability: 'longbreath', script: 'get_breath' }],
        movers: [{ dx: 0, dy: -7, dur: 3.4, w: 2 }, { dx: 10, dy: 0, dur: 4.2, w: 2 }, { dx: 8, dy: 0, dur: 3.8, w: 2 }]
      },
      map: [
        '',
        '     +                        +                         +                       +',
        '',
        '                                           * ^^',
        '                                        ########',
        '',
        '',
        '                                                                        o',
        '                                                                     ########',
        '',
        '             *',
        '           ######             ####### M                       #######',
        '',
        '  P R K  T       M             ^^^   R          K  M        ^^       R      K * R    X',
        ' #################           #######################       ###############################',
        ' #################           #######################       ##############################',
      ] }),

  R({ id: 'c4', chamber: 4, name: 'The Ashworks', dark: 0.38,
      onEnter: 'ch4_open', hint: 'C DASHES  \u00B7  HOLD A DIRECTION TO AIM IT',
      cfg: {
        runes: [{ key: 'rune_dash' }, { key: 'rune_furnace' }, { key: 'rune_cut' }, { key: 'rune_assembly' }],
        altars: [{ ability: 'dash', script: 'get_dash' }],
        lasers: [{ blink: [1.5, 2.4, 1.5] }, { blink: [1.4, 2.8, 1.4] }]
      },
      map: [
        '',
        '     +                            +                           +                       +',
        '',
        '',
        '',
        '',
        '',
        '                   o                                                           o',
        '                #######                                                     ########',
        '                                       ########################',
        '                   *                                               r   * ^^',
        '               ~~~~~~~~~                                            #######',
        '',
        '  P R K  T  R   ^^^   ^^^          K r          *        *    R K ^^                  R   X',
        ' #########################     ###############################################################',
        ' #########################     ##############################################################',
      ] }),

  R({ id: 'c5', chamber: 5, name: 'The Unlit Vault', dark: 0.86,
      onEnter: 'ch5_open', hint: 'YOUR ECHOES CARRY THE LIGHT NOW',
      cfg: {
        runes: [{ key: 'rune_light' }, { key: 'rune_dark' }, { key: 'rune_shade' }, { key: 'rune_vault' }],
        altars: [{ ability: 'lightwake', script: 'get_light' }],
        shades: [{ dir: -1, speed: 22 }, { dir: -1, speed: 26 }, { dir: 1, speed: 30 }]
      },
      map: [
        '',
        '      +                                     +',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '##########################################################',
        '',
        '',
        '',
        '',
        '                                       o',
        '                                    ???????',
        '',
        '                                               *',
        '                            ???????         #######',
        '',
        '                       *       S',
        '                    ???????',
        '',
        '               *',
        '            ???????',
        '',
        '  P R K  T          R   ^^^   S     K     S R       R X',
        ' ########################################################',
        ' ########################################################',
      ] }),

  R({ id: 'c6', chamber: 6, name: 'The Choir of One', dark: 0.55,
      assist: 'step', onEnter: 'ch6_open', hint: 'THREE DOORS. THREE OF YOU.',
      cfg: {
        runes: [{ key: 'rune_choir' }, { key: 'rune_three' }, { key: 'rune_down' }],
        altars: [{ ability: 'choir', script: 'get_choir' }],
        movers: [{ dx: 11, dy: 0, dur: 4.6, w: 2 }],
        lasers: [{ blink: [1.6, 2.4, 1.6] }],
        shades: [{ dir: -1, speed: 32 }]
      },
      map: [
        '                           A B D',
        '     +                     A B D+                           +                             +',
        '                           A B D',
        '                           A B D',
        '                           A B D',
        '                           A B D',
        '                           A B D                                                             o',
        '                           A B D                                                          #######',
        '                           A B D',
        '                           A B D                      #######################',
        '                           A B D                                                     * ^^',
        '                           A B D                                                  ~~~~~~~~',
        '                           A B D           *',
        '  P R K  T   a  b  c  R    A B D  KS M            K r         *        *    K R^^^              X',
        ' #####################################           ###################################################',
        ' #####################################           ##################################################',
      ] }),

  R({ id: 'c7a', chamber: 7, name: 'The Last Door', dark: 0.30,
      onEnter: 'ch7_open',
      cfg: {
        runes: [{ key: 'rune_last1' }, { key: 'rune_last2' }, { key: 'rune_last3' }]
      },
      map: [
        '',
        '      +       +       +       +',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '  P     R         R         R       X',
        ' #######################################',
        ' ######################################',
      ] }),

  R({ id: 'c7b', chamber: 7, name: 'The Lumen', dark: 0.16,
      cfg: {
        iris: [{ script: 'finale' }]
      },
      map: [
        '',
        '     +                     +',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '                 _',
        '               _   _',
        '  P                    W',
        ' #################################',
        ' ################################',
      ] }),

  ];

  /* ---------------------------------------------------------------- meta */

  var CHAMBERS = {
    1: 'The Waking Shelf',
    2: 'The Hollow Stair',
    3: 'The Long Breath',
    4: 'The Ashworks',
    5: 'The Unlit Vault',
    6: 'The Choir of One',
    7: 'The Lumen'
  };

  var MUSIC = {
    1: 'calm', 2: 'calm', 3: 'deep', 4: 'deep',
    5: 'dark', 6: 'choir', 7: 'lumen'
  };

  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  function firstRoomOfChamber(ch) {
    for (var i = 0; i < rooms.length; i++) if (rooms[i].chamber === ch) return i;
    return 0;
  }

  return {
    rooms: rooms,
    chamberName: function (c) { return CHAMBERS[c] || ''; },
    chamberMusic: function (c) { return MUSIC[c] || 'calm'; },
    roman: function (c) { return ROMAN[c] || String(c); },
    firstRoomOfChamber: firstRoomOfChamber,
    count: rooms.length
  };
})();
