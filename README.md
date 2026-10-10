# ASHLIGHT

*a narrative puzzle-platformer about the pieces of yourself you leave behind*

The world is forgetting itself, starting at the edges. One light is left, at the
bottom of the Spire of Ash, and somebody has been holding it for a thousand
years. You are Wren. You are eleven days old. You are going down to ask her to
rest.

**To play: open `index.html` in a browser.** No install, no build step, no
server — it runs straight off the disk.

---

## The mechanic

Wren can record a few seconds of her own movement and release it as an **Echo**:
a looping, solid ghost of herself.

An Echo is a body. You can stand on it. It holds a pressure plate down forever.
It will take a laser for you. Later it carries a light, and some floors in the
Spire only exist where light falls.

Every puzzle in the game is the same question in a different shape: *where do
you need to be, while also being somewhere else?*

The last room asks it one more time, and means it.

## Controls

| | |
|---|---|
| **Arrows** / **WASD** | move |
| **Z** / **Space** | jump *(hold for height)* |
| **X** | start recording · press again to release the Echo · recalls when you're at capacity |
| **C** | dash *(once you've found it)* |
| **Q** | recall every Echo |
| **R** | restart the room — free, instant, use it constantly |
| **Esc** | pause |
| **M** / **F** / **V** | sound · fullscreen · CRT filter |

A gamepad works too.

## What's in it

- **26 hand-built rooms** across **7 chambers**, each one screen, each with a
  restart that costs you nothing.
- **Six abilities** found on altars: the Echo itself, a second Echo, a longer
  breath, the Ashstep dash, Lightwake, and finally the Choir — three of you at
  once.
- **62 Emberlight** to gather (a room's door opens when you've taken all of its)
  and **9 Memory Motes** hidden off the critical path.
- **Three endings.** Two are always on the table. The third only becomes
  possible if you found all nine memories, and it is the one the game is
  actually about.

Progress saves automatically. Chamber Select unlocks as you descend.

## How it's built

Vanilla JavaScript and one `<canvas>`. No libraries, no bundler, no asset files
of any kind:

- **Music and sound are synthesised at runtime** through WebAudio — nine
  tracks driven by a step sequencer, with a reverb impulse response generated
  from a noise burst on startup.
- **Art is drawn with rectangles.** Lighting is a darkness layer with holes
  punched in it, plus an additive bloom pass.
- **The simulation runs on a fixed 1/60 timestep.** This is load-bearing: an
  Echo is a buffer of recorded frames, so a variable timestep would make every
  loop drift. Fixed steps keep a replay bit-exact forever.

```
index.html
src/
  core/    util · input · audio · particles · draw · save
  game/    level · entities · echo · player · world · dialogue · scenes
  data/    levels · story
  main.js
```

### Level design, in brief

Rooms are 30×17 ASCII grids (see the legend at the top of `src/data/levels.js`).
They're laid out against measured jump arcs rather than guesswork:

| from | you can reach |
|---|---|
| any surface | 3 tiles up |
| an Echo standing on that surface | 4 tiles up |
| riding an Echo's jump | 7 tiles up |

...with a 4-tile horizontal maximum. Rooms whose *required* path deliberately
breaks the 3-tile rule declare `assist: 'step'` or `assist: 'ride'`; optional
memory motes are allowed to demand an Echo anywhere.

## Tests

```
node test/run.js
```

A headless harness stubs the browser and runs the real game logic — level
structure and reachability, beam coverage against standable ground, the Echo
mechanic (including that a replay stays bit-exact across loops), every dialogue
script, all three endings, the first Echo puzzle solved move by move, the laser
corridor solved the intended way, and a full 26-room playthrough.

The reachability and beam checks are the ones that earn their keep: an Echo can
only exist where Wren survived standing, so a beam that never switches off over
a whole ledge makes that ledge unreachable forever. That is a bug you cannot see
by looking at the map.

## Credits

Written in one sitting. The best ending belongs to Warden 940, who worked it out
first.
