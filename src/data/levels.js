/* Room data.
 *
 * Each room is 30x17 tiles — exactly one screen. Maps are written WITHOUT
 * padding and are BOTTOM-ALIGNED by `frame()`, so the last authored rows are
 * the floor and a hole in them is a hole in the world. `frame()` also seals
 * the ceiling and both side walls, so a room can never leak.
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
 *   T  altar (ability)        W  Iris
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

  var PAD = '                              ';   // 30 spaces

  // Bottom-align the authored rows, pad to 30 columns, seal the shell.
  function frame(rows) {
    var out = [];
    var off = AL.ROWS - rows.length;             // push content to the floor
    for (var y = 0; y < AL.ROWS; y++) {
      var src = y - off;
      var s = ((src >= 0 && rows[src] != null) ? rows[src] : '') + PAD;
      var a = s.slice(0, AL.COLS).split('');
      if (y === 0) { for (var x = 0; x < AL.COLS; x++) a[x] = '#'; }
      a[0] = '#';
      a[AL.COLS - 1] = '#';
      out.push(a.join(''));
    }
    return out;
  }

  var G = '##############################';   // solid floor row

  function R(def) { def.map = frame(def.map); return def; }

  var rooms = [

  /* ================================================================= I === */
  /* THE WAKING SHELF — learn to move, then learn that what you leave behind
     can hold a door open.                                                   */

  R({ id: 'c1r1', chamber: 1, name: 'First Light', dark: 0.08,
      onEnter: 'prologue',
      hint: 'ARROWS MOVE  ·  Z JUMPS',
      cfg: { runes: [{ key: 'rune_ash' }] },
      map: [
        '',
        '  +                       +   ',
        '',
        '',
        '',
        '',
        '',
        '                 *            ',
        '              ######          ',
        '',
        '         *                    ',
        '      ######                  ',
        '',
        ' P  R                     X   ',
        G, G
      ] }),

  R({ id: 'c1r2', chamber: 1, name: "The Warden's Glove", dark: 0.10,
      assist: 'step',
      hint: 'X RECORDS  ·  X AGAIN RELEASES  ·  STAND ON YOURSELF',
      cfg: {
        altars: [{ ability: 'echo', script: 'get_echo' }],
        runes: [{ key: 'rune_glove' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '          *                   ',
        '      ##########              ',
        '',
        '',
        ' P   T            R       X   ',
        G, G
      ] }),

  R({ id: 'c1r3', chamber: 1, name: 'Weight', dark: 0.12,
      hint: 'SOMETHING MUST STAND ON THE PLATE',
      cfg: { runes: [{ key: 'rune_weight' }] },
      map: [
        '              A               ',
        '  +           A            +  ',
        '              A               ',
        '              A               ',
        '              A               ',
        '              A               ',
        '         o    A               ',
        '       #####  A               ',
        '              A               ',
        '              A               ',
        '              A    *          ',
        '   #####      A   ####        ',
        '              A               ',
        ' P   a        A  R    *   X   ',
        G, G
      ] }),

  R({ id: 'c1r4', chamber: 1, name: 'The Shelf', dark: 0.14,
      cfg: { runes: [{ key: 'rune_shelf' }] },
      map: [
        '                   A          ',
        '  +                A       +  ',
        '                   A          ',
        '                   A          ',
        '            *      A          ',
        '          ######   A          ',
        '                   A          ',
        '      *            A          ',
        '    ######         A          ',
        '                   A          ',
        '                   A          ',
        '         #####     A          ',
        '                   A          ',
        ' P   a     R       A    *  X  ',
        G, G
      ] }),

  /* ================================================================ II === */
  /* THE HOLLOW STAIR — two of you at once, and the discovery that an Echo
     mid-jump will carry you up with it.                                     */

  R({ id: 'c2r1', chamber: 2, name: 'The Hollow Stair', dark: 0.18,
      onEnter: 'ch2_open',
      hint: 'THE BRIDGE HOLDS WHILE THE PLATE IS HELD',
      cfg: { runes: [{ key: 'rune_bridge' }] },
      map: [
        '',
        '   +                      +   ',
        '',
        '',
        '',
        '',
        '                    *         ',
        '                 #####        ',
        '',
        '',
        '         *                    ',
        '      #####          ####     ',
        '',
        ' P  a           R        X    ',
        '##############EEEEEEEE########',
        '##############        ########'
      ] }),

  R({ id: 'c2r2', chamber: 2, name: 'Rise', dark: 0.18,
      assist: 'ride',
      hint: 'RECORD A JUMP  ·  THEN RIDE YOUR OWN SHOULDERS',
      cfg: {
        altars: [{ ability: 'twin', script: 'get_twin' }],
        runes: [{ key: 'rune_rise' }]
      },
      map: [
        '',
        '        o                     ',
        '      #####                   ',
        '',
        '            *                 ',
        '         ######               ',
        '',
        '     *                        ',
        '   #####                      ',
        '',
        '',
        '',
        '        #                     ',
        ' P  T   #   R             X   ',
        G, G
      ] }),

  R({ id: 'c2r3', chamber: 2, name: 'Counterweight', dark: 0.20,
      hint: 'TWO DOORS. TWO OF YOU.',
      cfg: { runes: [{ key: 'rune_counter' }] },
      map: [
        '                  A B         ',
        '   +              A B      +  ',
        '                  A B         ',
        '                  A B         ',
        '                  A B         ',
        '                  A B         ',
        '                  A B         ',
        '          *       A B         ',
        '        #####     A B         ',
        '                  A B         ',
        '    *             A B         ',
        '  #####           A B         ',
        '                  A B         ',
        ' P  a    b    R   A B  *  X   ',
        G, G
      ] }),

  R({ id: 'c2r4', chamber: 2, name: 'The Long Hold', dark: 0.22,
      cfg: { runes: [{ key: 'rune_hold' }] },
      map: [
        '                  A           ',
        '   +              A        +  ',
        '                  A           ',
        '          o       A           ',
        '        ######    A           ',
        '                  A           ',
        '                  A           ',
        '          *       A           ',
        '        ######    A           ',
        '                  A           ',
        '                  A     *     ',
        '   #####          A   #####   ',
        '                  A           ',
        ' P a      R       A  *     X  ',
        G, G
      ] }),

  /* =============================================================== III === */
  /* THE LONG BREATH — the Spire's machinery still runs, and a longer
     recording lets an Echo keep pace with it.                               */

  R({ id: 'c3r1', chamber: 3, name: 'The Long Breath', dark: 0.26,
      onEnter: 'ch3_open',
      hint: 'RIDE THE RAIL',
      cfg: {
        altars: [{ ability: 'longbreath', script: 'get_breath' }],
        movers: [{ dx: 0, dy: -7, dur: 3.2, w: 2 }],
        runes: [{ key: 'rune_breath' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '           *                  ',
        '        ######                ',
        '',
        '',
        '                  *           ',
        '               #####          ',
        '',
        '',
        '     M                        ',
        '',
        ' P  T       R             X   ',
        G, G
      ] }),

  R({ id: 'c3r2', chamber: 3, name: 'Rails', dark: 0.28,
      cfg: {
        movers: [
          { dx: 0, dy: -4, dur: 2.6, w: 2 },
          { dx: 9, dy: 0, dur: 3.6, w: 2 }
        ],
        runes: [{ key: 'rune_rails' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '',
        '               *              ',
        '            ######            ',
        '',
        '',
        '          *                   ',
        '',
        '          M                   ',
        '            *                 ',
        '       M                      ',
        ' P   R                    X   ',
        '#######          #############',
        '#######          #############'
      ] }),

  R({ id: 'c3r3', chamber: 3, name: 'Patience', dark: 0.30,
      cfg: {
        movers: [
          { dx: 0, dy: -7, dur: 3.6, w: 2 },
          { dx: 0, dy: -5, dur: 3.0, w: 2 }
        ],
        runes: [{ key: 'rune_patience' }]
      },
      map: [
        '              A               ',
        '   +          A            +  ',
        '              A      o        ',
        '              A   ######      ',
        '              A               ',
        '              A               ',
        '        *     A               ',
        '     #####    A               ',
        '              A               ',
        '              A        M      ',
        '              A               ',
        '   M          A    *          ',
        '              A  #####        ',
        ' P      a R   A  *        X   ',
        G, G
      ] }),

  R({ id: 'c3r4', chamber: 3, name: 'The Loom', dark: 0.30,
      hint: 'THE FLOOR IS PROVISIONAL',
      cfg: { runes: [{ key: 'rune_loom' }] },
      map: [
        '',
        '   +                      +   ',
        '         *                    ',
        '       ~~~~~~                 ',
        '',
        '              *               ',
        '           ######             ',
        '',
        '     *                        ',
        '   ~~~~~~                     ',
        '',
        '          ######              ',
        '',
        ' P  R                     X   ',
        G, G
      ] }),

  /* ================================================================ IV === */
  /* THE ASHWORKS — the machine that made her. Light that cuts, and a body
     to put in front of it.                                                  */

  R({ id: 'c4r1', chamber: 4, name: 'Ashstep', dark: 0.34,
      onEnter: 'ch4_open',
      hint: 'C DASHES  ·  HOLD A DIRECTION TO AIM IT',
      cfg: {
        altars: [{ ability: 'dash', script: 'get_dash' }],
        runes: [{ key: 'rune_dash' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '',
        '',
        '',
        '',
        '              *               ',
        '           ######             ',
        '',
        '       *                      ',
        '    ######                    ',
        '',
        ' P  T     R               X   ',
        '##########    ################',
        '##########    ################'
      ] }),

  R({ id: 'c4r2', chamber: 4, name: 'Cut', dark: 0.36,
      hint: 'A BODY STOPS THE LIGHT',
      cfg: {
        lasers: [{}],
        runes: [{ key: 'rune_cut' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '',
        '          o                   ',
        '       ######                 ',
        '',
        '              *               ',
        '           ######             ',
        '',
        ' r        *                   ',
        '  ###########                 ',
        '',
        ' P   R           *        X   ',
        G, G
      ] }),

  R({ id: 'c4r3', chamber: 4, name: 'The Furnace', dark: 0.38,
      cfg: {
        lasers: [{ blink: [1.5, 1.2, 0] }, { blink: [1.3, 1.4, 0.7] }],
        runes: [{ key: 'rune_furnace' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '',
        '           *                  ',
        '        ~~~~~~                ',
        '',
        ' r            *               ',
        '           ######             ',
        '',
        ' r       *                    ',
        '      ######                  ',
        '',
        ' P  R                     X   ',
        G, G
      ] }),

  R({ id: 'c4r4', chamber: 4, name: 'Assembly', dark: 0.40,
      cfg: {
        movers: [{ dx: 8, dy: 0, dur: 4.0, w: 2 }],
        lasers: [{ chan: 'A' }],
        runes: [{ key: 'rune_assembly' }]
      },
      map: [
        '',
        '   +                      +   ',
        '',
        '             o                ',
        '          ######              ',
        '',
        '',
        '                  *           ',
        '               ######         ',
        '',
        ' r        *                   ',
        '   ########         ######    ',
        '',
        ' P  a  R  M           *  X    ',
        '##########          ##########',
        '##########          ##########'
      ] }),

  /* ================================================================= V === */
  /* THE UNLIT VAULT — the forgetting is thickest here. Floors that only
     exist where light falls, and the ones who stopped.                      */

  R({ id: 'c5r1', chamber: 5, name: 'Lightwake', dark: 0.80,
      onEnter: 'ch5_open',
      hint: 'YOUR ECHOES CARRY THE LIGHT NOW',
      cfg: {
        altars: [{ ability: 'lightwake', script: 'get_light' }],
        runes: [{ key: 'rune_light' }]
      },
      map: [
        '',
        '   +                          ',
        '',
        '',
        '',
        '',
        '',
        '              *               ',
        '           ??????             ',
        '',
        '       *                      ',
        '    ??????                    ',
        '',
        ' P  T     R               X   ',
        G, G
      ] }),

  R({ id: 'c5r2', chamber: 5, name: 'What the Dark Keeps', dark: 0.84,
      cfg: { runes: [{ key: 'rune_dark' }] },
      map: [
        '',
        '   +                          ',
        '          *                   ',
        '        ?????                 ',
        '',
        '            *                 ',
        '          ?????               ',
        '',
        '         *                    ',
        '       ?????                  ',
        '',
        '         ?????                ',
        '',
        ' P  R                     X   ',
        G, G
      ] }),

  R({ id: 'c5r3', chamber: 5, name: 'What Walks', dark: 0.86,
      hint: 'LIGHT UNMAKES THEM',
      cfg: {
        shades: [{ dir: -1, speed: 24 }, { dir: 1, speed: 28 }],
        runes: [{ key: 'rune_shade' }]
      },
      map: [
        '',
        '   +                          ',
        '',
        '          o                   ',
        '       ######                 ',
        '',
        '                  *           ',
        '               ######         ',
        '            S                 ',
        '         ######               ',
        '',
        '     *                        ',
        '  ######                      ',
        ' P  R        S       *    X   ',
        G, G
      ] }),

  R({ id: 'c5r4', chamber: 5, name: 'The Vault', dark: 0.88,
      cfg: {
        shades: [{ dir: 1, speed: 26 }],
        runes: [{ key: 'rune_vault' }]
      },
      map: [
        '              A               ',
        '   +          A            +  ',
        '              A               ',
        '              A               ',
        '              A               ',
        '              A               ',
        '              A               ',
        '              A               ',
        '              A     *         ',
        '              A   ??????      ',
        '    *         A       *       ',
        '  ??????      A    ??????     ',
        '              A               ',
        ' P    a  R    A  S        X   ',
        G, G
      ] }),

  /* ================================================================ VI === */
  /* THE CHOIR OF ONE — three of you. Everything the Spire has, at once.     */

  R({ id: 'c6r1', chamber: 6, name: 'Choir', dark: 0.52,
      onEnter: 'ch6_open',
      cfg: {
        altars: [{ ability: 'choir', script: 'get_choir' }],
        runes: [{ key: 'rune_choir' }]
      },
      map: [
        '',
        '   +                      +   ',
        '          o                   ',
        '       ######                 ',
        '',
        '              *               ',
        '           ######             ',
        '',
        '       *                      ',
        '    ######                    ',
        '',
        '           ######             ',
        '',
        ' P  T     R               X   ',
        G, G
      ] }),

  R({ id: 'c6r2', chamber: 6, name: 'Three Voices', dark: 0.54,
      hint: 'THREE DOORS. THREE OF YOU.',
      cfg: { runes: [{ key: 'rune_three' }] },
      map: [
        '             A B D            ',
        '   +         A B D         +  ',
        '             A B D            ',
        '             A B D            ',
        '             A B D            ',
        '             A B D            ',
        '             A B D            ',
        '             A B D            ',
        '             A B D            ',
        '             A B D            ',
        '    *        A B D    *       ',
        '  ######     A B D  ######    ',
        '             A B D            ',
        ' P a b c R   A B D    *   X   ',
        G, G
      ] }),

  R({ id: 'c6r3', chamber: 6, name: 'The Long Way Down', dark: 0.56,
      cfg: {
        movers: [{ dx: 10, dy: 0, dur: 4.2, w: 2 }],
        lasers: [{ blink: [1.1, 1.0, 0] }],
        runes: [{ key: 'rune_down' }]
      },
      map: [
        '',
        '   +                      +   ',
        '           *                  ',
        '        ~~~~~~                ',
        ' r                            ',
        '             ######           ',
        '',
        '                    *         ',
        '                  ######      ',
        '',
        '',
        '            *        ######   ',
        '       M                      ',
        ' P   R                    X   ',
        '#########           ##########',
        '#########           ##########'
      ] }),

  R({ id: 'c6r4', chamber: 6, name: 'One Voice', dark: 0.58,
      cfg: {
        lasers: [{}, {}],
        runes: [{ key: 'rune_one' }]
      },
      map: [
        '                A   B         ',
        '   +            A   B      +  ',
        '                A   B         ',
        '                A   B         ',
        ' r       o      A   B         ',
        '        ######  A   B         ',
        '                A   B         ',
        '                A   B  *      ',
        '    ######      A   B #####   ',
        '                A   B         ',
        ' r        *     A   B         ',
        '       #####    A   B  #####  ',
        '                A   B         ',
        ' P a  b  R      A   B    * X  ',
        G, G
      ] }),

  /* =============================================================== VII === */
  /* THE LUMEN — no traps. She stopped building this far down.               */

  R({ id: 'c7r1', chamber: 7, name: 'The Last Door', dark: 0.30,
      onEnter: 'ch7_open',
      cfg: {
        runes: [{ key: 'rune_last1' }, { key: 'rune_last2' }, { key: 'rune_last3' }],
        lamps: [{ r: 72 }, { r: 72 }, { r: 72 }, { r: 72 }]
      },
      map: [
        '',
        '    +      +      +      +    ',
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
        ' P    R        R       R    X ',
        G, G
      ] }),

  R({ id: 'c7r2', chamber: 7, name: 'The Lumen', dark: 0.16,
      cfg: { iris: [{ script: 'finale' }] },
      map: [
        '',
        '    +                    +    ',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '              _               ',
        '           _     _            ',
        ' P                  W         ',
        G, G
      ] })

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
