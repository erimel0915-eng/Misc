/* The laser corridor in chamber IV, solved the way it is meant to be solved:
 * wait for the beam to sleep, step into it, leave a body standing in it, and
 * walk out through the shadow your own Echo is casting.
 *
 * It first proves the beam really does kill, so the puzzle cannot quietly
 * become trivial, and it is written against whatever columns the level
 * actually uses rather than hard-coded ones. */
const { load } = require('./harness.js');
const win = load(); const AL = win.AL; const DT = AL.DT;
AL.Game.begin();
function fire(t,c){for(const f of (win.__listeners[t]||[])){try{f({code:c,repeat:false,preventDefault(){}});}catch(e){}}}
const dk=new Set();
function hold(c,on){if(on&&!dk.has(c)){dk.add(c);fire('keydown',c);}if(!on&&dk.has(c)){dk.delete(c);fire('keyup',c);}}
function releaseAll(){for(const k of [...dk]) hold(k,false);}

let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log(`  FAIL ${n}${x?' :: '+x:''}`);} };

AL.Save.reset();
const w = new AL.World({onEnding(){},onComplete(){}});
for (const a of ['echo','twin','longbreath','dash']) w.save.abilities[a]=true;
w.start(AL.Levels.rooms.findIndex(r => r.id === 'c4'));
function step(n,cb){for(let i=0;i<n;i++){if(cb)cb(i);AL.Input.update();if(!AL.FX.frozen())w.update(DT);AL.FX.update(DT);AL.Input.lateUpdate();}}
function skip(){let n=0;while(AL.Dialogue.active&&n++<6000){hold('Enter',true);step(1);releaseAll();}}
skip();

const FLOOR_ROW = w.level.rows - 2;
const WALK_ROW = FLOOR_ROW - 1;

/* Restarting rebuilds every entity, so anything held across a death is stale. */
let laser, shard, laserCol;
function refetch() {
  laser = w.level.entities.find(e =>
    e instanceof AL.Entities.Laser && Math.round(e.y / 16) === WALK_ROW);
  if (laser) laserCol = Math.round(laser.x / 16);
  shard = w.level.entities.find(e =>
    e instanceof AL.Entities.Shard && Math.round(e.y / 16) === WALK_ROW &&
    Math.round(e.x / 16) > laserCol);
}
refetch();
ok('found the floor-level beam', !!laser, 'col=' + laserCol);
ok('found emberlight down the corridor', !!shard,
   shard ? 'col=' + Math.round(shard.x / 16) : 'none');
if (!laser || !shard) { console.log(`\n  ${pass} passed, ${fail+1} failed`); process.exit(1); }

function walkTo(col, limit) {
  const tx = col * 16 + 3;
  let n = 0;
  while (Math.abs(w.player.x - tx) > 3 && n++ < (limit || 3000)) {
    releaseAll();
    if (AL.Dialogue.active) { skip(); continue; }
    hold(w.player.x < tx ? 'ArrowRight' : 'ArrowLeft', true);
    step(1);
    if (w.player.dead) return false;
  }
  releaseAll();
  skip();
  return !w.player.dead && Math.abs(w.player.x - tx) <= 6;   // arrived, not timed out
}

// 1. there is somewhere safe to stand on the approach
w.player.x = (laserCol - 3) * 16;
w.player.y = FLOOR_ROW * 16 - w.player.h;
w.player.spawnT = 0;
step(10);
let survivedApproach = !w.player.dead;
step(Math.ceil((laser.blink[0] + laser.blink[1]) * 60) + 20, () => {
  if (w.player.dead) survivedApproach = false;
});
ok('the approach stays safe through a whole beam cycle', survivedApproach,
   'x=' + w.player.x.toFixed(1));

// 2. the corridor really is lethal while the beam is awake
{
  let g = 0;
  do { step(1); } while (!laser.active && g++ < 900);
  ok('the beam does wake', laser.active);
  w.player.x = (laserCol + 8) * 16;
  w.player.y = FLOOR_ROW * 16 - w.player.h;
  w.player.spawnT = 0;
  step(6);
  ok('standing in the awake beam kills', w.player.dead);
  step(90);
  ok('respawned at a checkpoint', !w.player.dead);
  refetch();
}

// 3. do it properly. Navigation is not what this test is for — put her on the
//    safe side, wait for the window, and run the actual maneuver.
w.player.dead = false;
w.player.x = (laserCol - 3) * 16;
w.player.y = FLOOR_ROW * 16 - w.player.h;
w.player.spawnT = 0;
step(10);
ok('back on the safe side', !w.player.dead, 'x=' + w.player.x.toFixed(1));

const period = laser.blink[0] + laser.blink[1];
let g2 = 0, caught = false;
while (g2++ < 1200) {
  step(1);
  const ph = ((laser.t + laser.blink[2]) % period + period) % period;
  if (!laser.active && ph >= laser.blink[0] && ph < laser.blink[0] + 0.3) { caught = true; break; }
}
ok('caught the beam at the start of a sleep', caught && !laser.active);

ok('stepped into the beam path', walkTo(laserCol + 3, 200) && !w.player.dead,
   'x=' + w.player.x.toFixed(1) + ' want=' + ((laserCol + 3) * 16 + 3));
hold('KeyX', true); step(1); releaseAll();
step(20);
hold('KeyX', true); step(1); releaseAll();
step(3);
ok('left an Echo standing in the corridor', w.echoes.length === 1 && !w.player.dead,
   'echoes=' + w.echoes.length + ' dead=' + w.player.dead);

// 4. hop over it and live through a full cycle in its shadow
hold('ArrowRight', true);
step(8);
hold('KeyZ', true); step(8); hold('KeyZ', false);
step(60);
releaseAll(); step(10);
ok('got past the Echo into its shadow', !w.player.dead && w.player.x > (laserCol + 4) * 16,
   'x=' + w.player.x.toFixed(1) + ' dead=' + w.player.dead);

let diedInCycle = false;
step(Math.ceil(period * 60) + 60, () => { if (w.player.dead) diedInCycle = true; });
ok('the Echo holds the beam for a whole cycle', !diedInCycle);

// 5. collect what the beam was guarding
let g3 = 0;
while (!shard.taken && g3++ < 900) {
  releaseAll();
  hold((w.player.x + 5) < (shard.x + 8) ? 'ArrowRight' : 'ArrowLeft', true);
  step(1);
  if (w.player.dead) break;
}
releaseAll();
ok('emberlight collected from inside the corridor', shard.taken, 'dead=' + w.player.dead);

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
