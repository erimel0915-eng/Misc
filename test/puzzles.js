/* The jump ladder, measured rather than assumed, and the first Echo puzzle
 * solved move by move — because if chamber I's shelf cannot be climbed, the
 * game stops at the second thing it asks you to do. */
const { load } = require('./harness.js');
const win = load(); const AL = win.AL; const DT = AL.DT;
AL.Game.begin();
function fire(t,c){for(const f of (win.__listeners[t]||[])){try{f({code:c,repeat:false,preventDefault(){}});}catch(e){}}}
const dk=new Set();
function hold(c,on){if(on&&!dk.has(c)){dk.add(c);fire('keydown',c);}if(!on&&dk.has(c)){dk.delete(c);fire('keyup',c);}}
function releaseAll(){for(const k of [...dk]) hold(k,false);}

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log(`  FAIL ${n}${x ? ' :: ' + x : ''}`); } };

function mk(id, abilities) {
  AL.Save.reset();
  const w = new AL.World({ onEnding(){}, onComplete(){} });
  for (const a of abilities) w.save.abilities[a] = true;
  w.start(AL.Levels.rooms.findIndex(r => r.id === id));
  return w;
}
function step(w, n, cb) {
  for (let i = 0; i < n; i++) {
    if (cb) cb(i);
    AL.Input.update();
    if (!AL.FX.frozen()) w.update(DT); else AL.Particles.update(DT);
    AL.FX.update(DT);
    AL.Input.lateUpdate();
  }
}
function skip(w) { let n = 0; while (AL.Dialogue.active && n++ < 6000) { hold('Enter', true); step(w, 1); releaseAll(); } }

/* ----------------------------------------------- the vertical vocabulary */
/* Find a column with real sky above it, so the measurement is of the jump
 * and not of a ceiling. */
function clearColumn(lv, floorRow) {
  for (let x = 2; x < lv.cols - 2; x++) {
    if (!lv.isSolid(x, floorRow)) continue;
    let clear = true;
    for (let y = floorRow - 1; y >= floorRow - 6; y--) if (lv.isSolid(x, y)) { clear = false; break; }
    if (clear) return x;
  }
  return -1;
}

const probe = mk('c1', []);
skip(probe);
const FLOOR_ROW = probe.level.rows - 2;          // the top row of the floor
const col = clearColumn(probe.level, FLOOR_ROW);
ok('found open sky to measure under', col > 0, 'col=' + col);

const groundY = FLOOR_ROW * 16;
function maxReach() {
  const w = mk('c1', []);
  skip(w);
  const p = w.player;
  p.x = col * 16 + 3; p.y = groundY - p.h; p.vy = 0; p.grounded = true; p.spawnT = 0;
  step(w, 2);
  hold('KeyZ', true);
  let best = p.y + p.h;
  step(w, 40, () => { if (p.y + p.h < best) best = p.y + p.h; });
  hold('KeyZ', false);
  step(w, 40, () => { if (p.y + p.h < best) best = p.y + p.h; });
  releaseAll();
  return best;
}
const fromGround = maxReach();
const rise = groundY - fromGround;
const ECHO_H = 14;
const fromEcho = groundY - ECHO_H - rise;
console.log(`jump rise: ${rise.toFixed(1)}px  (${(rise / 16).toFixed(2)} tiles)`);
console.log(`  from the floor at y=${groundY} -> reaches y=${fromGround.toFixed(1)}`);
console.log(`  off an Echo standing on it   -> reaches y=${fromEcho.toFixed(1)}`);

ok('a plain jump clears 3 tiles', fromGround <= groundY - 3 * 16, `got ${fromGround.toFixed(1)}`);
ok('a plain jump does NOT clear 4 tiles', fromGround > groundY - 4 * 16, `got ${fromGround.toFixed(1)}`);
ok('standing on an Echo clears 4 tiles', fromEcho <= groundY - 4 * 16, `got ${fromEcho.toFixed(1)}`);
ok('standing on an Echo does NOT clear 5 tiles', fromEcho > groundY - 5 * 16, `got ${fromEcho.toFixed(1)}`);

/* ------------------------------------------- the Ashstep, against real gaps */
/* Chamber IV onward puts holes in the floor. Measure the dash-jump, then check
 * every hole in the game is either narrow enough to clear or spanned by a
 * moving platform. A hole that is neither is a wall the player cannot pass. */
{
  // measure in the longest open stretch, so nothing is clipped by a ledge
  const probe2 = mk('c1', ['echo', 'dash']);
  skip(probe2);
  const lv = probe2.level;
  let bestRun = 0, bestStart = -1, run = 0, runStart = -1;
  for (let x = 1; x < lv.cols - 1; x++) {
    let open = lv.isSolid(x, FLOOR_ROW);
    for (let y = FLOOR_ROW - 1; y >= FLOOR_ROW - 6 && open; y--) if (lv.isSolid(x, y)) open = false;
    if (open) { if (runStart < 0) runStart = x; run++; if (run > bestRun) { bestRun = run; bestStart = runStart; } }
    else { run = 0; runStart = -1; }
  }
  ok('found a long open stretch to measure in', bestRun >= 8, 'run=' + bestRun);

  const p = probe2.player;
  p.x = bestStart * 16 + 3; p.y = groundY - p.h; p.vy = 0; p.grounded = true; p.spawnT = 0;
  step(probe2, 2);
  const x0 = p.x;
  hold('ArrowRight', true);
  step(probe2, 30);                       // build up speed
  const liftoff = p.x;
  hold('KeyZ', true); step(probe2, 6); hold('KeyZ', false);
  hold('KeyC', true); step(probe2, 2); hold('KeyC', false);
  let far = p.x, landed = -1;
  step(probe2, 70, () => {
    if (p.x > far) far = p.x;
    if (landed < 0 && p.grounded && p.x > liftoff + 10) landed = p.x;
  });
  releaseAll();
  const span = far - liftoff;
  console.log(`dash-jump carries ${span.toFixed(0)}px from a standing run  (${(span / 16).toFixed(1)} tiles)`);
  ok('the dash-jump goes further than a plain jump', span > 74, span.toFixed(0) + 'px');

  // every hole in every floor must be crossable
  const unreachable = [];
  for (const r of AL.Levels.rooms) {
    const floor = r.map[r.map.length - 2];
    const movers = [];
    let mi = 0;
    r.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'M') continue;
        const cfg = ((r.cfg && r.cfg.movers) || [])[mi++] || {};
        movers.push({ x0: Math.min(x, x + (cfg.dx || 0)), x1: Math.max(x, x + (cfg.dx || 0)) + (cfg.w || 2) });
      }
    });
    let g = 0, start = -1;
    for (let i = 1; i <= floor.length; i++) {
      const hole = i < floor.length && floor[i] === ' ';
      if (hole) { if (start < 0) start = i; g++; continue; }
      if (g > 0) {
        const ferried = movers.some(m => m.x0 <= start && m.x1 >= start + g - 1);
        // a plain jump clears about 4 tiles; the dash-jump more
        if (g * 16 > span && !ferried) {
          unreachable.push(`${r.id}: ${g}-tile hole at col ${start}, no mover spans it`);
        }
      }
      g = 0; start = -1;
    }
  }
  ok('every hole in the floor is crossable', unreachable.length === 0, unreachable.join(' / '));
}

/* ------------------------------------- the shelf you need an Echo to climb */
{
  const w = mk('c1', []);
  skip(w);
  const lv = w.level;
  // the shelf is the one four rows above the floor
  const shelfRow = FLOOR_ROW - 4;
  // the FIRST contiguous run on that row — a full-height gate also has a
  // tile up here, and it is not the shelf
  let x0 = -1, x1 = -1;
  for (let x = 1; x < lv.cols; x++) {
    if (lv.isSolid(x, shelfRow)) {
      if (x0 < 0) { x0 = x; x1 = x; } else if (x === x1 + 1) { x1 = x; } else break;
    }
  }
  ok('c1 has a shelf four rows up', x0 > 0 && x1 > x0, `cols ${x0}..${x1}`);

  const shard = w.level.entities.find(e =>
    e instanceof AL.Entities.Shard && Math.round(e.y / 16) === shelfRow - 1);
  ok('it carries emberlight', !!shard);

  function walkTo(c, limit) {
    const tx = c * 16 + 3;
    let n = 0;
    while (Math.abs(w.player.x - tx) > 3 && n++ < (limit || 2500)) {
      releaseAll();
      if (AL.Dialogue.active) { skip(w); continue; }
      hold(w.player.x < tx ? 'ArrowRight' : 'ArrowLeft', true);
      step(w, 1);
      if (w.player.dead) return false;
    }
    releaseAll();
    skip(w);
    return !w.player.dead;
  }

  // walking past the altar is how the glove is found
  ok('walked to the far side of the shelf', walkTo(x1 + 2), 'x=' + w.player.x.toFixed(1));
  ok('picked up the glove on the way', w.hasAbility('echo'));

  // leave a body on the floor beside the shelf
  hold('KeyX', true); step(w, 1); releaseAll();
  step(w, 60);
  hold('KeyX', true); step(w, 1); releaseAll();
  step(w, 4);
  ok('left an Echo beside the shelf', w.echoes.length === 1);
  const e = w.echoes[0];

  // step clear so it turns solid, then climb onto it
  hold('ArrowRight', true); step(w, 22); releaseAll(); step(w, 16);
  ok('the Echo is solid', e && !e.pass);

  function onEcho() {
    return w.player.grounded &&
           Math.abs((w.player.y + w.player.h) - e.y) <= 2 &&
           w.player.x + w.player.w > e.x && w.player.x < e.x + e.w;
  }
  let g = 0;
  while (!onEcho() && g++ < 700) {
    releaseAll();
    if (w.player.x > e.x + 2) hold('ArrowLeft', true);
    else if (w.player.x < e.x - 2) hold('ArrowRight', true);
    if (g % 30 === 0 && w.player.grounded) hold('KeyZ', true);
    step(w, 1);
  }
  releaseAll(); step(w, 6);
  ok('climbed onto the Echo', onEcho(), 'feet=' + (w.player.y + w.player.h).toFixed(1) + ' echo=' + e.y.toFixed(1));

  // and from its shoulders, onto the shelf
  let landed = false;
  const shelfY = shelfRow * 16;
  hold('ArrowLeft', true); hold('KeyZ', true);
  step(w, 18, () => { if (w.player.grounded && w.player.y + w.player.h <= shelfY + 1) landed = true; });
  hold('KeyZ', false);
  step(w, 70, () => { if (w.player.grounded && w.player.y + w.player.h <= shelfY + 1) landed = true; });
  releaseAll(); step(w, 10);
  ok('reached the shelf from the Echo', landed,
     'feet=' + (w.player.y + w.player.h).toFixed(1) + ' shelf top=' + shelfY);

  let g2 = 0;
  while (shard && !shard.taken && g2++ < 600) {
    releaseAll();
    hold((w.player.x + 5) < (shard.x + 8) ? 'ArrowRight' : 'ArrowLeft', true);
    step(w, 1);
    if (w.player.dead) break;
  }
  releaseAll();
  ok('emberlight collected', !!shard && shard.taken, 'dead=' + w.player.dead);
}

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
