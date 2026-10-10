/* All of the game's text.
 *
 * Voices:
 *   wren  — the last Warden. Dry, tired, stubborn. Short sentences.
 *   echo  — a voice she assumes is the glove. It knows too much.
 *   iris  — the first Warden. Gentle, ancient, unbearably tired.
 *   spire — the building itself. Cold, procedural, indifferent.
 */
AL.Story = (function () {

  var scripts = {

  /* ------------------------------------------------------------ prologue */

  prologue: [
    { who: 'none', text: 'The world is forgetting itself.', slow: true },
    { who: 'none', text: 'It began at the edges. A coastline nobody could name. '
                       + 'Then a city. Then the word for the colour of a city at dusk.' },
    { act: 'wait', arg: 0.5 },
    { who: 'none', text: 'There is one light left, at the bottom of the Spire of Ash. '
                       + 'They say a Warden tends it.' },
    { who: 'none', text: 'They say she has tended it for a thousand years.' },
    { act: 'wait', arg: 0.6 },
    { who: 'wren', text: 'So I will go down and ask her to rest.' }
  ],

  rune_ash: [
    { who: 'spire', text: 'WARDEN 1000. DESCENT AUTHORISED.' },
    { who: 'wren', text: 'A thousand. That is a lot of wardens for one lamp.' }
  ],

  /* --------------------------------------------------------- chamber one */

  get_echo: [
    { act: 'wait', arg: 0.4 },
    { who: 'wren', text: 'A glove. Warm, like someone just took it off.' },
    { who: 'none', text: 'Wren can leave an ECHO now: a few seconds of herself, '
                       + 'recorded and set loose to repeat forever.' },
    { who: 'none', text: 'Press X to begin recording. Press X again to release it. '
                       + 'An Echo is solid. It will hold your weight.' },
    { act: 'wait', arg: 0.4 },
    { who: 'echo', text: 'You left something behind.' },
    { who: 'wren', text: '...the glove talks.' },
    { who: 'echo', text: 'Something like that.' }
  ],

  rune_glove: [
    { who: 'spire', text: 'THE WARDEN\'S GLOVE RETURNS WHAT IS PUT INTO IT. '
                        + 'NOTHING MORE. NOTHING LESS.' },
    { who: 'wren', text: 'Comforting.' }
  ],

  rune_weight: [
    { who: 'echo', text: 'The plate wants weight. Any weight. It does not ask '
                       + 'whether the weight is still alive.' },
    { who: 'wren', text: 'That is a strange way to put it.' },
    { who: 'echo', text: 'It is the only way I know to put it.' }
  ],

  rune_shelf: [
    { who: 'echo', text: 'You are good at this.' },
    { who: 'wren', text: 'I grew up climbing. Rooftops in Belleret. '
                       + 'My mother shouted at me from the well.' },
    { who: 'echo', text: 'Yes. The well was blue. There was a chip in the rim '
                       + 'shaped like a bird.' },
    { act: 'wait', arg: 0.7 },
    { who: 'wren', text: 'I never told you that.' }
  ],

  /* --------------------------------------------------------- chamber two */

  ch2_open: [
    { act: 'quake' },
    { who: 'none', text: 'The stair goes down further than the Spire is tall.' },
    { who: 'wren', text: 'That should not be possible.' },
    { who: 'echo', text: 'Very little here is. Keep walking.' }
  ],

  rune_bridge: [
    { who: 'spire', text: 'STRUCTURE HELD BY LOAD. REMOVE LOAD, REMOVE STRUCTURE.' },
    { who: 'wren', text: 'So the floor only exists while someone stands on the switch.' },
    { who: 'echo', text: 'Then stand on it. And also, do not.' }
  ],

  get_twin: [
    { who: 'none', text: 'Wren can hold TWO Echoes at once.' },
    { who: 'echo', text: 'Easier, isn\'t it. Being in more than one place.' },
    { who: 'wren', text: 'It doesn\'t feel easier.' },
    { who: 'echo', text: 'No. It never does.' }
  ],

  rune_rise: [
    { who: 'echo', text: 'Record yourself waiting a moment, and then jumping.' },
    { who: 'echo', text: 'Let her go. Then climb onto her shoulders '
                       + 'and wait for the jump to come round again.' },
    { who: 'echo', text: 'She will carry you higher than you can throw yourself.' },
    { who: 'wren', text: 'She?' },
    { act: 'wait', arg: 0.6 },
    { who: 'echo', text: 'You. I meant you.' }
  ],

  rune_counter: [
    { who: 'spire', text: 'TWO SEALS. TWO LOADS. SIMULTANEOUS.' },
    { who: 'wren', text: 'Whoever built this did not expect one person.' },
    { who: 'echo', text: 'They expected exactly one person. '
                       + 'They simply expected her to be several.' }
  ],

  rune_hold: [
    { who: 'wren', text: 'Can I ask you something?' },
    { who: 'echo', text: 'You can ask.' },
    { who: 'wren', text: 'How many of us have come down here?' },
    { act: 'wait', arg: 0.8 },
    { who: 'echo', text: 'Enough that the stairs are worn in the middle.' }
  ],

  /* ------------------------------------------------------- chamber three */

  ch3_open: [
    { act: 'music', arg: 'deep' },
    { who: 'none', text: 'The walls here are covered in names. '
                       + 'Thousands of them, scratched in a tight, careful hand.' },
    { who: 'wren', text: 'They are all the same name.' },
    { act: 'wait', arg: 0.5 },
    { who: 'wren', text: 'They are all my handwriting.' },
    { who: 'echo', text: 'Don\'t stop. Please.' }
  ],

  get_breath: [
    { who: 'none', text: 'THE LONG BREATH. Recordings can run five seconds '
                       + 'instead of three.' },
    { who: 'echo', text: 'A longer breath means your echo can get further from you '
                       + 'before it has to become itself again.' },
    { who: 'wren', text: 'Is that a good thing?' },
    { who: 'echo', text: 'It is a useful thing. Those are different.' }
  ],

  rune_breath: [
    { who: 'spire', text: 'WARDEN CAPACITY INCREASED. DESCENT RATE NOMINAL.' },
    { who: 'wren', text: 'It talks about me like a bucket.' }
  ],

  rune_rails: [
    { who: 'echo', text: 'The machines still run. Nobody has asked them to stop.' },
    { who: 'wren', text: 'What were they for?' },
    { who: 'echo', text: 'Lifting things down. Mostly down.' }
  ],

  rune_patience: [
    { who: 'echo', text: 'I have done this before.' },
    { who: 'wren', text: 'Done what?' },
    { who: 'echo', text: 'Stood here. Said a thing like this. '
                       + 'Hoped it landed differently.' }
  ],

  rune_loom: [
    { who: 'spire', text: 'FLOOR INTEGRITY: PROVISIONAL. DO NOT LINGER.' },
    { who: 'wren', text: 'Finally, some honest advice.' }
  ],

  /* -------------------------------------------------------- chamber four */

  ch4_open: [
    { act: 'quake' },
    { who: 'none', text: 'The Ashworks. Vats, cradles, a thousand empty moulds '
                       + 'in the shape of a girl.' },
    { who: 'wren', text: '...' },
    { who: 'wren', text: 'Say it.' },
    { who: 'echo', text: 'You were not born in Belleret.' },
    { who: 'echo', text: 'You were made here, eleven days ago, '
                       + 'and given a village to miss.' },
    { act: 'wait', arg: 1.0 },
    { who: 'wren', text: 'The well. The chip shaped like a bird.' },
    { who: 'echo', text: 'Mine. I\'m sorry. It was the only childhood I had to give you.' }
  ],

  get_dash: [
    { who: 'none', text: 'THE ASHSTEP. Press C to dash. Hold a direction to aim it.' },
    { who: 'wren', text: 'Eleven days old and I can already move like that.' },
    { who: 'echo', text: 'You were built well. That is not an insult.' },
    { who: 'wren', text: 'It isn\'t a comfort either.' }
  ],

  rune_dash: [
    { who: 'spire', text: 'UNIT 1000. FINAL CASTING. NO MATERIAL REMAINS.' },
    { who: 'wren', text: 'Final. So there is no one after me.' },
    { who: 'echo', text: 'No.' }
  ],

  rune_cut: [
    { who: 'echo', text: 'The light will cut you. It cuts anything that is there.' },
    { who: 'wren', text: 'Then I will put something there that doesn\'t mind.' },
    { who: 'echo', text: 'She minds. She just does it anyway.' }
  ],

  rune_furnace: [
    { who: 'wren', text: 'Were the others like me?' },
    { who: 'echo', text: 'Some were braver. Some were kinder. '
                       + 'One of them sang the whole way down.' },
    { who: 'wren', text: 'What happened to her?' },
    { who: 'echo', text: 'She got here. Then she made the same choice they all made.' }
  ],

  rune_assembly: [
    { who: 'spire', text: 'ASSEMBLY COMPLETE. THANK YOU FOR YOUR SERVICE.' },
    { who: 'wren', text: 'I haven\'t done anything yet.' },
    { who: 'spire', text: 'THANK YOU FOR YOUR SERVICE.' }
  ],

  /* -------------------------------------------------------- chamber five */

  ch5_open: [
    { act: 'music', arg: 'dark' },
    { who: 'none', text: 'The Unlit Vault. Wren\'s lantern reaches about as far '
                       + 'as her arm.' },
    { who: 'echo', text: 'This is where it is worst. The forgetting is thickest here.' },
    { who: 'wren', text: 'Tell me what you are.' },
    { who: 'echo', text: 'Not yet. Light first.' }
  ],

  get_light: [
    { who: 'none', text: 'LIGHTWAKE. Your Echoes now carry light — '
                       + 'and some floors only exist where light falls.' },
    { who: 'echo', text: 'There. Now you can leave a lamp behind you '
                       + 'in the shape of yourself.' },
    { who: 'wren', text: 'That is a horrible sentence.' },
    { who: 'echo', text: 'I have been working on it for nine hundred years.' }
  ],

  rune_light: [
    { who: 'spire', text: 'PHANTOM STRUCTURE. REAL WHERE OBSERVED.' },
    { who: 'wren', text: 'So the Spire only bothers to exist when it is watched.' },
    { who: 'echo', text: 'Most things are like that. The Spire is just honest about it.' }
  ],

  rune_dark: [
    { who: 'echo', text: 'You are not afraid of the dark.' },
    { who: 'wren', text: 'I am eleven days old. I haven\'t learned yet.' },
    { who: 'echo', text: 'Don\'t. It never helped me.' }
  ],

  rune_shade: [
    { who: 'echo', text: 'Those are not monsters. They are the places '
                       + 'where somebody used to be.' },
    { who: 'wren', text: 'Wardens?' },
    { who: 'echo', text: 'The ones who stopped. Light unmakes them. '
                       + 'It is the kindest thing left to do for them.' }
  ],

  rune_vault: [
    { who: 'wren', text: 'You said "nine hundred years".' },
    { act: 'wait', arg: 0.9 },
    { who: 'echo', text: 'I did.' }
  ],

  /* --------------------------------------------------------- chamber six */

  ch6_open: [
    { act: 'music', arg: 'choir' },
    { act: 'quake' },
    { who: 'none', text: 'The chamber is full of voices. All of them are hers. '
                       + 'All of them are slightly wrong.' },
    { who: 'wren', text: 'Enough. Who are you.' },
    { act: 'wait', arg: 0.8 },
    { who: 'iris', text: 'Iris.' },
    { who: 'iris', text: 'Warden One. I have been holding the light for '
                       + 'one thousand and six years.' },
    { who: 'iris', text: 'I cannot put it down. So I learned to send pieces of myself '
                       + 'up the stair, to meet whoever was coming.' },
    { who: 'wren', text: 'You have been in my head since the first step.' },
    { who: 'iris', text: 'I have been in your head since before you had one. '
                       + 'I am sorry. I was so lonely, and you were so new.' }
  ],

  get_choir: [
    { who: 'none', text: 'THE CHOIR. Three Echoes at once.' },
    { who: 'iris', text: 'This is the last thing I have to give you. '
                       + 'After this there is only the room, and the question.' },
    { who: 'wren', text: 'Ask it now.' },
    { who: 'iris', text: 'No. Walk the rest of the way first. '
                       + 'You should get to choose while your legs still ache.' }
  ],

  rune_choir: [
    { who: 'iris', text: 'Nine hundred and ninety-nine came down before you.' },
    { who: 'wren', text: 'And every one of them said no.' },
    { who: 'iris', text: 'No. Every one of them said yes.' },
    { act: 'wait', arg: 0.7 },
    { who: 'iris', text: 'And not one of them could hold it. '
                       + 'The light does not want a replacement. It wants me.' }
  ],

  rune_three: [
    { who: 'iris', text: 'Three doors. You will need all three of you.' },
    { who: 'wren', text: 'I am getting used to that.' },
    { who: 'iris', text: 'That is what frightens me about you.' }
  ],

  rune_down: [
    { who: 'wren', text: 'What happens to the ones who fail?' },
    { who: 'iris', text: 'They stay. In pieces. In the dark part of the vault.' },
    { who: 'wren', text: 'The shades.' },
    { who: 'iris', text: 'They were girls. They were all girls, Wren, '
                       + 'and I called every one of them down here myself.' }
  ],

  rune_one: [
    { who: 'iris', text: 'One more room.' },
    { who: 'wren', text: 'Iris. Did you ever want to put it down?' },
    { who: 'iris', text: 'Every second of every day for a thousand years.' },
    { who: 'iris', text: 'That is not the same as wanting the world to end. '
                       + 'I need you to understand that those are different.' },
    { who: 'wren', text: 'I understand.' }
  ],

  /* ------------------------------------------------------- chamber seven */

  ch7_open: [
    { act: 'music', arg: 'lumen' },
    { who: 'none', text: 'No traps. No locks. A corridor, four lamps, '
                       + 'and a door standing open.' },
    { who: 'iris', text: 'I stopped building after this point. '
                       + 'There seemed no reason to test anyone this close to the end.' }
  ],

  rune_last1: [
    { who: 'wren', text: 'Belleret never existed.' },
    { who: 'iris', text: 'It existed. It was mine. It is at the bottom of the forgetting now, '
                       + 'with everything else I remember and nobody else does.' }
  ],

  rune_last2: [
    { who: 'wren', text: 'Why me? Why the thousandth?' },
    { who: 'iris', text: 'Because there is no material left. '
                       + 'Whatever happens in that room happens for good.' }
  ],

  rune_last3: [
    { who: 'iris', text: 'Wren. Whatever you choose, I want to have said this: '
                       + 'you are eleven days old and you walked the whole way down.' },
    { who: 'iris', text: 'That was not nothing. That was never going to be nothing.' }
  ],

  /* --------------------------------------------------------------- finale */

  finale: [
    { act: 'stopmusic' },
    { act: 'wait', arg: 0.8 },
    { who: 'none', text: 'She is smaller than a thousand years should be.', slow: true },
    { who: 'none', text: 'She is sitting with her hands open, and the light is sitting in them, '
                       + 'and it has been sitting there so long it has worn her thin.' },
    { act: 'wait', arg: 0.6 },
    { who: 'iris', text: 'Hello. Oh, hello. Look at you.' },
    { who: 'wren', text: 'Hello, Iris.' },
    { act: 'wait', arg: 0.5 },
    { who: 'iris', text: 'You know what it is now. It is not a lamp. '
                       + 'It is one second of my life, held open.' },
    { who: 'iris', text: 'The second I decided the world should keep going. '
                       + 'I have been repeating it ever since. That is all the light is.' },
    { who: 'iris', text: 'An echo. The first one. You have been making little sisters of it '
                       + 'all the way down the stair.' },
    { act: 'wait', arg: 0.7 },
    { who: 'wren', text: 'And if I take it?' },
    { who: 'iris', text: 'Then I stop, and you begin, and in a thousand years '
                       + 'someone very tired will say hello to someone very new.' },
    { who: 'wren', text: 'And if I don\'t?' },
    { who: 'iris', text: 'Then I put my hands down, and we sit together, '
                       + 'and the forgetting comes up the stair to meet us.' },
    { who: 'iris', text: 'It will not hurt. It is not cruel. It is only an ending.' },
    { act: 'wait', arg: 0.9 },
    { who: 'iris', text: 'Choose. Please. I have waited a thousand years '
                       + 'and I would like someone else to decide.' },
    { act: 'wait', arg: 0.5 },
    {
      prompt: 'What does Wren do?',
      choice: [
        { label: 'Relight the Lumen',
          note: 'take her place · hold the world · forever',
          ending: 'light', color: AL.C.ember },
        { label: 'Let her put it down',
          note: 'release her · let the world forget · together',
          ending: 'dark', color: AL.C.ash },
        { label: 'Break the loop',
          note: 'call the nine hundred and ninety-nine',
          ending: 'free', color: AL.C.iris, requires: 'allMemories' }
      ]
    }
  ]

  };

  /* --------------------------------------------------------- memory motes */

  /* Nine fragments. Each one is a Warden who came down before. Collect all
   * nine and a third answer becomes possible in the final room. */
  var memories = [
    [ { who: 'none', text: 'A MEMORY, not hers.' },
      { who: 'none', text: '"Warden 4. I am not afraid. I have written that down '
                         + 'so that I can read it later and know I meant it."' } ],

    [ { who: 'none', text: '"Warden 61. The stair is longer going down than coming up, '
                         + 'and nobody comes up."' } ],

    [ { who: 'none', text: '"Warden 112. I sang the whole way. If you are reading this, '
                         + 'please sing a little. It helps the walls."' } ],

    [ { who: 'none', text: '"Warden 288. She calls us sisters. I have decided to let her. '
                         + 'She has nobody and I have eleven days."' } ],

    [ { who: 'none', text: '"Warden 401. I held it for nine seconds. '
                         + 'Nine whole seconds. Tell her that was not nothing."' } ],

    [ { who: 'none', text: '"Warden 603. The light does not want to be held by one person. '
                         + 'I think that is the whole problem."' } ],

    [ { who: 'none', text: '"Warden 777. We are all still here, you know. '
                         + 'Thinned out. Looped. But here."' } ],

    [ { who: 'none', text: '"Warden 940. If enough of us hold it for a moment, '
                         + 'nobody has to hold it for a thousand years."' } ],

    [ { who: 'none', text: '"Warden 999. I could not do it alone. '
                         + 'Neither could she. Neither can you."' },
      { act: 'wait', arg: 0.6 },
      { who: 'none', text: '"So don\'t."' },
      { who: 'wren', text: 'Nine hundred and ninety-nine echoes, still looping.' },
      { who: 'wren', text: 'Still here.' } ]
  ];

  /* -------------------------------------------------------------- endings */

  var endings = {
    light: {
      title: 'THE LAMPLIGHTER',
      music: 'endLight',
      color: AL.C.ember,
      lines: [
        'Wren put her hands under the light and Iris took hers away.',
        'It was heavier than a thousand years should be.',
        '',
        'Iris stood for the first time since the world had a coastline. '
          + 'She walked up the stair, slowly, and did not look back, '
          + 'because looking back is a thing you do when you might return.',
        '',
        'The forgetting stopped at the edges and held.',
        'Nobody noticed. That is what holding looks like from outside.',
        '',
        'Wren is eleven days old. Wren is a thousand years old.',
        'She repeats one second, over and over, and in it she is deciding '
          + 'that the world should keep going.',
        '',
        'Sometimes she hears footsteps on the stair, coming down.',
        'She practises saying hello.'
      ]
    },
    dark: {
      title: 'THE LONG EVENING',
      music: 'endDark',
      color: AL.C.ash,
      lines: [
        'Wren sat down beside her and said: put it down.',
        'Iris said: are you sure. Wren said: no. Put it down anyway.',
        '',
        'So she did.',
        '',
        'The light went out the way a held breath goes out — all at once, '
          + 'and with enormous relief.',
        '',
        'They talked for a while. Iris described Belleret: the blue well, '
          + 'the chip in the rim shaped like a bird, her mother shouting up '
          + 'from the dark of it.',
        'Wren said: I remember. Iris said: I know. I\'m sorry. '
          + 'Wren said: don\'t be, it was a good well.',
        '',
        'The forgetting came up the stair, unhurried, almost polite.',
        'It took the Spire, and the names on the walls, and the moulds '
          + 'in the shape of a girl.',
        '',
        'It took them in the middle of a sentence about the well.',
        'Neither of them was alone. That turned out to be the whole of it.'
      ]
    },
    free: {
      title: 'THE CHOIR',
      music: 'endFree',
      color: AL.C.iris,
      lines: [
        'Wren did not reach for the light. She reached past it, '
          + 'into the dark part of the vault, and called them by number.',
        '',
        'Four. Sixty-one. One hundred and twelve. Two hundred and eighty-eight.',
        'Four hundred and one. Six hundred and three. Seven hundred '
          + 'and seventy-seven. Nine hundred and forty. Nine hundred '
          + 'and ninety-nine.',
        '',
        'They came out of the walls thin as held breath — a thousand echoes '
          + 'of a thousand girls, each one still looping the moment '
          + 'she had decided to try.',
        '',
        'They took the light in turns.',
        'A second each. Nobody for longer. Nobody alone.',
        '',
        'Iris put her hands down and did not stop shaking for an hour, '
          + 'and then she laughed, which was a sound the Spire had never '
          + 'recorded before and did not have a procedure for.',
        '',
        'The forgetting went back out to the edges, where the coastlines are, '
          + 'and began — slowly, badly, with a lot of argument — '
          + 'to give some of them back.',
        '',
        'Eleven days old, and she walked the whole way down,',
        'and then she refused the only two endings she was offered.'
      ]
    }
  };

  return {
    scripts: scripts,
    memories: memories,
    memoryTotal: memories.length,
    endings: endings
  };
})();
