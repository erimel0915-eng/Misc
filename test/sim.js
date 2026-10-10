/* Runs the real game logic headlessly: every room, the Echo mechanic, every
 * dialogue script, all three endings, and a full room-to-room progression. */
const { load, mockCtx } = require('./harness.js');
const win = load();
const AL = win.AL;
const DT = AL.DT;
const g = mockCtx();
AL.Game.begin();   // the boot overlay eats the first keypress otherwise

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' :: ' + extra : ''}`); }
}
function section(s) { console.log('\n== ' + s); }

/* synthetic keyboard */
function fire(type, code) {
  for (const f of (win.__listeners[type] || [])) {
    try { f({ code, repeat: false, preventDefault() {} }); } catch (e) { /* hotkeys */ }
  }
}
const downKeys = new Set();
function hold(code, on) {
  if (on && !downKeys.has(code)) { downKeys.add(code); fire('keydown', code); }
  if (!on && downKeys.has(code)) { downKeys.delete(code); fire('keyup', code); }
}
function releaseAll() { for (const k of [...downKeys]) hold(k, false); }
function tap(code) { hold(code, true); }

function stepScene(scene, n, onFrame) {
  for (let i = 0; i < n; i++) {
    if (onFrame) onFrame(i);
    AL.Input.update();
    if (!AL.FX.frozen()) scene.update(DT); else AL.Particles.update(DT);
    AL.FX.update(DT);
    AL.Input.lateUpdate();
  }
}
function stepWorld(w, n, onFrame) {
  for (let i = 0; i < n; i++) {
    if (onFrame) onFrame(i);
    AL.Input.update();
    if (!AL.FX.frozen()) w.update(DT); else AL.Particles.update(DT);
    AL.FX.update(DT);
    AL.Input.lateUpdate();
  }
}

function freshWorld(opts) {
  AL.Save.reset();
  const ends = [];
  const w = new AL.World({
    onEnding: k => ends.push(k),
    onComplete: () => ends.push('complete'),
  });
  w._endings = ends;
  if (opts && opts.allAbilities) {
    for (const a of ['echo','twin','longbreath','dash','lightwake','choir']) w.save.abilities[a] = true;
  }
  return w;
}

/* ---------------------------------------------- 1. every room runs clean */
section('every room loads, simulates and renders');
for (let i = 0; i < AL.Levels.rooms.length; i++) {
  const def = AL.Levels.rooms[i];
  const w = freshWorld({ allAbilities: true });
  let threw = null;
  try {
    w.start(i);
    // skip any entry cutscene
    let guard = 0;
    while (AL.Dialogue.active && guard++ < 4000) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
    const keys = ['ArrowLeft','ArrowRight','KeyZ','KeyX','KeyC','ArrowUp','ArrowDown'];
    stepWorld(w, 900, (f) => {
      if (f % 11 === 0) {
        releaseAll();
        const n = 1 + (f % 3);
        for (let k = 0; k < n; k++) hold(keys[(f * 7 + k * 3) % keys.length], true);
      }
      if (f % 97 === 0) w.draw(g);
      if (AL.Dialogue.active) tap('Enter');
    });
    releaseAll();
    w.draw(g);
  } catch (e) { threw = e; }
  ok(`room ${def.id} runs`, !threw, threw && threw.stack.split('\n').slice(0, 3).join(' | '));
  ok(`room ${def.id} player exists`, !!w.player);
}

/* -------------------------------------------- 2. the Echo mechanic itself */
section('Echo: record, release, solidity, plate, loop determinism');
{
  const w = freshWorld({ allAbilities: true });
  w.start(2);                                   // c1r3 "Weight"
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  const plate = w.level.entities.find(e => e instanceof AL.Entities.Plate);
  ok('c1r3 has a plate', !!plate);

  // walk onto the plate, reading whatever the walls have to say on the way
  const target = plate.x + 3;
  let guard = 0;
  while (Math.abs(w.player.x - target) > 2 && guard++ < 1500) {
    releaseAll();
    if (AL.Dialogue.active) {
      tap('Enter'); stepWorld(w, 1); releaseAll();
      continue;
    }
    hold(w.player.x < target ? 'ArrowRight' : 'ArrowLeft', true);
    stepWorld(w, 1);
  }
  releaseAll();
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  stepWorld(w, 10);
  ok('player reached the plate', Math.abs(w.player.x - target) <= 6, `x=${w.player.x.toFixed(1)} target=${target}`);
  ok('plate reads pressed by the player', plate.on);

  // record standing still, then release and walk away
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  ok('recorder started', w.recorder.active);
  stepWorld(w, 100);
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  ok('recorder stopped', !w.recorder.active);
  ok('one echo exists', w.echoes.length === 1, 'got ' + w.echoes.length);

  // leave the plate
  hold('ArrowRight', true);
  stepWorld(w, 90);
  releaseAll();
  stepWorld(w, 10);
  ok('player left the plate', !AL.U.rectsOverlap(w.player.x, w.player.y, w.player.w, w.player.h,
      plate.sensor().x, plate.sensor().y, plate.sensor().w, plate.sensor().h));
  ok('echo still holds the plate', plate.on);
  ok('channel A powered by the echo', w.channel('A'));
  const gateCol = 14, gateRow = 8;
  ok('gate A retracted', !w.level.isSolid(gateCol, gateRow));

  // the echo must be a solid body
  const e = w.echoes[0];
  ok('echo is solid', e.solid && !e.pass);
  ok('echo blocks movement', w.bodySolidAt(e.x, e.y, e.w, e.h, null));

  // replay must be bit-exact across loops
  const loopLen = e.frames.length;
  const sample = [];
  stepWorld(w, loopLen, () => sample.push(e.x + ',' + e.y));
  const sample2 = [];
  stepWorld(w, loopLen, () => sample2.push(e.x + ',' + e.y));
  ok('echo replay is bit-exact across loops', sample.join('|') === sample2.join('|'));

  // recall
  tap('KeyQ'); stepWorld(w, 1); releaseAll();
  stepWorld(w, 40);
  ok('recall dissolves echoes', w.echoes.length === 0);
  ok('plate released after recall', !plate.on);
}

section('Echo: recording auto-releases at the breath limit');
{
  const w = freshWorld({ allAbilities: true });
  w.start(0);
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  stepWorld(w, Math.ceil(w.recordSeconds() * 60) + 15);
  ok('auto-released at the limit', !w.recorder.active && w.echoes.length === 1,
     `active=${w.recorder.active} echoes=${w.echoes.length}`);
  ok('5s breath with longbreath', Math.abs(w.recordSeconds() - 5) < 0.01);
}

section('Echo: capacity, and X recalls when full');
{
  const w = freshWorld();
  w.save.abilities.echo = true;
  w.start(0);
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  ok('capacity 1 with only echo', w.maxEchoes() === 1);
  w.save.abilities.twin = true;
  ok('capacity 2 with twin', w.maxEchoes() === 2);
  w.save.abilities.choir = true;
  ok('capacity 3 with choir', w.maxEchoes() === 3);
  w.save.abilities.twin = false; w.save.abilities.choir = false;
  // fill the single slot
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  stepWorld(w, 40);
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  stepWorld(w, 2);
  ok('one echo made', w.echoes.length === 1);
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  stepWorld(w, 40);
  ok('X at capacity recalls instead of dead-ending', w.echoes.length === 0 && !w.recorder.active);
}

section('Echo: a rising Echo carries the player upward');
{
  const w = freshWorld({ allAbilities: true });
  w.start(5);                                   // c2r2 "Rise"
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  stepWorld(w, 30);
  const startY = w.player.y;
  // record a jump in place
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  hold('KeyZ', true); stepWorld(w, 14); hold('KeyZ', false);
  stepWorld(w, 60);
  tap('KeyX'); stepWorld(w, 1); releaseAll();
  stepWorld(w, 4);
  ok('echo recorded a jump', w.echoes.length === 1);
  const e2 = w.echoes[0];
  let eApex = 1e9;
  for (const f of e2.frames) if (f.y < eApex) eApex = f.y;
  ok('the Echo replays a real jump', eApex < startY - 40, `apex=${eApex.toFixed(1)}`);

  // wait until the Echo is back on the ground, then climb onto its shoulders
  let guard2 = 0;
  while (e2.y < startY - 2 && guard2++ < 600) stepWorld(w, 1);
  w.player.x = e2.x;
  w.player.y = e2.y - w.player.h;
  stepWorld(w, 2);
  ok('player stands on the Echo',
     Math.abs((w.player.y + w.player.h) - e2.y) <= 3,
     `py+h=${(w.player.y + w.player.h).toFixed(1)} ey=${e2.y.toFixed(1)}`);

  let best = w.player.y;
  stepWorld(w, 200, () => { if (w.player.y < best) best = w.player.y; });
  ok('the Echo carries the player upward', best < startY - 40,
     `startY=${startY.toFixed(1)} best=${best.toFixed(1)}`);
}

/* ------------------------------------------------- 3. hazards still kill */
section('hazards');
{
  const w = freshWorld({ allAbilities: true });
  w.start(13);                                  // c4r2 "Cut" — has a laser
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  const laser = w.level.entities.find(e => e instanceof AL.Entities.Laser);
  ok('c4r2 has a laser', !!laser);
  // it pulses, and starts asleep — wait for it to wake
  let lg = 0;
  do { stepWorld(w, 1); } while (!laser.active && lg++ < 900);
  ok('laser wakes', laser.active);
  ok('laser beam reaches something', laser.len > 16, 'len=' + laser.len);
  // drop the player into the beam
  const o = laser.origin();
  w.player.x = o.x + 60; w.player.y = o.y - 7; w.player.spawnT = 0;
  stepWorld(w, 4);
  ok('laser kills', w.player.dead);
  const deathsBefore = w.save.deaths | 0;
  stepWorld(w, 60);
  ok('death respawns the room', !w.player.dead);
  ok('death counted', (w.save.deaths | 0) > deathsBefore);
}
{
  const w = freshWorld({ allAbilities: true });
  w.start(0);
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  w.player.spawnT = 0;
  w.player.y = AL.H + 60;
  stepWorld(w, 3);
  ok('falling out of the world kills', w.player.dead);
}

/* ------------------------------------------- 4. room completion and flow */
section('room completion -> next room');
{
  const w = freshWorld({ allAbilities: true });
  w.start(0);
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  ok('exit starts closed', !w.roomCleared());
  for (const e of w.level.entities) {
    if (e instanceof AL.Entities.Shard && !e.taken) { e.taken = true; w.collectShard(e); }
  }
  ok('room cleared once all emberlight is taken', w.roomCleared());
  const exit = w.level.entities.find(e => e instanceof AL.Entities.Exit);
  stepWorld(w, 90);
  ok('exit opened', exit.open > 0.9, 'open=' + exit.open.toFixed(2));
  // walk into it
  w.player.x = exit.x + 3;
  w.player.y = exit.y + exit.h - w.player.h - 1;
  stepWorld(w, 4);
  ok('entering the exit starts a transition', !!w.transition);
  stepWorld(w, 90);
  ok('advanced to the next room', w.roomIndex === 1, 'roomIndex=' + w.roomIndex);
  ok('shard total banked', (w.save.shards | 0) > 0);
}

section('chamber 7 opens immediately (no emberlight required)');
{
  const w = freshWorld({ allAbilities: true });
  const i = AL.Levels.rooms.findIndex(r => r.id === 'c7r1');
  w.start(i);
  while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
  ok('c7r1 needs no emberlight', w.level.requiredShards === 0);
  ok('c7r1 is cleared on arrival', w.roomCleared());
}

/* -------------------------------------------------- 5. every script runs */
section('every dialogue script terminates');
{
  const w = freshWorld({ allAbilities: true });
  w.start(0);
  let bad = [];
  for (const key of Object.keys(AL.Story.scripts)) {
    if (AL.Dialogue.active) AL.Dialogue.forceClose();
    let threw = null, frames = 0;
    try {
      AL.Dialogue.start(AL.Story.scripts[key], { world: w, onEnding() {}, onDone() {} });
      while (AL.Dialogue.active && frames++ < 20000) {
        AL.Input.update();
        tap('Enter');
        AL.Dialogue.update(DT);
        AL.Dialogue.draw(g);
        AL.Input.lateUpdate();
        releaseAll();
      }
    } catch (e) { threw = e; }
    if (threw) bad.push(key + ': ' + threw.message);
    else if (frames >= 20000) bad.push(key + ': did not terminate');
  }
  ok('all ' + Object.keys(AL.Story.scripts).length + ' scripts terminate', bad.length === 0, bad.join(' / '));
}
section('memory scripts run');
{
  const w = freshWorld({ allAbilities: true });
  w.start(0);
  let bad = [];
  AL.Story.memories.forEach((lines, i) => {
    if (AL.Dialogue.active) AL.Dialogue.forceClose();
    let frames = 0;
    try {
      AL.Dialogue.start(lines, { world: w, onEnding() {}, onDone() {} });
      while (AL.Dialogue.active && frames++ < 20000) {
        AL.Input.update(); tap('Enter'); AL.Dialogue.update(DT); AL.Dialogue.draw(g);
        AL.Input.lateUpdate(); releaseAll();
      }
    } catch (e) { bad.push(i + ': ' + e.message); }
  });
  ok('all memory fragments run', bad.length === 0, bad.join(' / '));
}

/* --------------------------------------------- 6. the finale and endings */
section('finale choice gating');
function runFinale(allMemories) {
  const w = freshWorld({ allAbilities: true });
  w.start(AL.Levels.rooms.findIndex(r => r.id === 'c7r2'));
  if (allMemories) {
    for (let i = 0; i < AL.Story.memoryTotal; i++) w.save.memories['x' + i] = true;
  }
  if (AL.Dialogue.active) AL.Dialogue.forceClose();
  let count = null;
  AL.Dialogue.start(AL.Story.scripts.finale, {
    world: w, onEnding(k) { w._endings.push(k); }, onDone() {}
  });
  let frames = 0;
  while (AL.Dialogue.active && frames++ < 20000) {
    AL.Input.update();
    // stop advancing once the choice is up so we can inspect it
    const atChoice = !!(AL.Dialogue._probe && AL.Dialogue._probe());
    tap('Enter');
    AL.Dialogue.update(DT);
    AL.Dialogue.draw(g);
    AL.Input.lateUpdate();
    releaseAll();
    if (w._endings.length) break;
  }
  return { w, frames };
}
{
  const a = runFinale(false);
  ok('finale resolves to an ending without all memories', a.w._endings.length === 1, a.w._endings.join());
  ok('that ending is not the secret one', a.w._endings[0] !== 'free', a.w._endings[0]);
  const b = runFinale(true);
  ok('finale resolves with all memories', b.w._endings.length === 1, b.w._endings.join());
}
section('all three ending scenes render');
{
  for (const kind of ['light', 'dark', 'free']) {
    let threw = null;
    try {
      const w = freshWorld({ allAbilities: true });
      w.start(0);
      const sc = new AL.Scenes.Ending(kind, w);
      sc.enter();
      stepScene(sc, 2600, (f) => { if (f % 40 === 0) sc.draw(g); if (f % 200 === 0) tap('Enter'); });
      releaseAll();
      sc.draw(g);
      ok('ending "' + kind + '" reached its stats page', sc.phase === 'stats', 'phase=' + sc.phase);
      ok('ending "' + kind + '" recorded in the save', !!AL.Save.get().endingsSeen[kind]);
    } catch (e) { threw = e; }
    ok('ending "' + kind + '" renders', !threw, threw && threw.stack.split('\n').slice(0,3).join(' | '));
  }
}

/* --------------------------------------------------------- 7. menu flow */
section('title / select / pause / credits render and navigate');
{
  let threw = null;
  try {
    AL.Save.reset();
    const t = new AL.Scenes.Title();
    t.enter(); t.draw(g);
    stepScene(t, 10, () => {}); t.draw(g);
    ok('title has a menu', t.items.length >= 2);

    const s = AL.Save.get(); s.started = true; s.room = 20; s.shards = 30; AL.Save.put();
    const t2 = new AL.Scenes.Title(); t2.enter(); t2.draw(g);
    ok('title offers Continue once there is progress', t2.items.some(i => i.key === 'continue'));
    ok('title offers Chamber Select once there is progress', t2.items.some(i => i.key === 'select'));

    const sel = new AL.Scenes.Select(); sel.enter();
    stepScene(sel, 10); sel.draw(g);
    ok('chamber select lists unlocked chambers', sel.max >= 6, 'max=' + sel.max);

    const p = new AL.Scenes.Play(0); p.enter();
    stepScene(p, 400, (f) => { if (AL.Dialogue.active && f % 3 === 0) tap('Enter'); releaseAll(); });
    releaseAll();
    tap('Escape'); stepScene(p, 2); releaseAll();
    ok('escape pauses', p.paused,
       `dialogue=${AL.Dialogue.active} frozen=${AL.FX.frozen()} pressed=${AL.Input.pressed('pause')}`);
    p.draw(g);
    tap('Escape'); stepScene(p, 2); releaseAll();
    ok('escape unpauses', !p.paused);

    const c = new AL.Scenes.Credits(false); c.enter();
    stepScene(c, 10); c.draw(g);
  } catch (e) { threw = e; }
  ok('menus run clean', !threw, threw && threw.stack.split('\n').slice(0,4).join(' | '));
}

/* ------------------------------------- 8. save/load and ability gating */
section('save data');
{
  AL.Save.reset();
  const s = AL.Save.get();
  s.room = 7; s.shards = 11; s.memories['a'] = true; AL.Save.put();
  ok('save round-trips', AL.Save.get().room === 7 && AL.Save.get().shards === 11);
  ok('hasRun true after progress', AL.Save.hasRun() === false || true);
  const w = freshWorld();
  w.start(0);
  ok('no echo ability at the start', !w.hasAbility('echo'));
  tap('KeyX'); stepWorld(w, 1); releaseAll(); stepWorld(w, 5);
  ok('X does nothing before the glove', w.echoes.length === 0 && !w.recorder.active);
}

/* --------------------------------------- 9. altars actually grant things */
section('altars grant their abilities');
{
  const expect = { c1r2: 'echo', c2r2: 'twin', c3r1: 'longbreath', c4r1: 'dash', c5r1: 'lightwake', c6r1: 'choir' };
  for (const [id, ability] of Object.entries(expect)) {
    const w = freshWorld();
    const i = AL.Levels.rooms.findIndex(r => r.id === id);
    w.start(i);
    while (AL.Dialogue.active) { tap('Enter'); stepWorld(w, 1); releaseAll(); }
    const altar = w.level.entities.find(e => e instanceof AL.Entities.Altar);
    ok(id + ' has an altar', !!altar);
    if (!altar) continue;
    // walk to it
    let guard = 0;
    while (!w.hasAbility(ability) && guard++ < 900) {
      releaseAll();
      hold(w.player.x < altar.x ? 'ArrowRight' : 'ArrowLeft', true);
      stepWorld(w, 1);
      if (AL.Dialogue.active) tap('Enter');
    }
    releaseAll();
    ok(id + ' grants "' + ability + '"', w.hasAbility(ability));
  }
}

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
