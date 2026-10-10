/* Play c4r2 "Cut" the intended way: wait for the beam to sleep, step onto the
 * ledge, leave an Echo standing in the beam's path, and collect the emberlight
 * that the Echo's shadow now protects. */
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
w.start(AL.Levels.rooms.findIndex(r => r.id === 'c4r2'));
function step(n,cb){for(let i=0;i<n;i++){if(cb)cb(i);AL.Input.update();if(!AL.FX.frozen())w.update(DT);AL.FX.update(DT);AL.Input.lateUpdate();}}
function skip(){let n=0;while(AL.Dialogue.active&&n++<4000){hold('Enter',true);step(1);releaseAll();}}
skip();

/* Restarting a room rebuilds every entity, so anything held across a death
 * has to be looked up again. */
let laser, shard;
function refetch() {
  laser = w.level.entities.find(e => e instanceof AL.Entities.Laser);
  shard = w.level.entities.find(e => e instanceof AL.Entities.Shard && Math.round(e.x / 16) === 19);
}
refetch();
ok('found the beam', !!laser);
ok('found the emberlight down the corridor', !!shard);

function walkTo(col, limit) {
  const tx = col * 16 + 3;
  let n = 0;
  while (Math.abs(w.player.x - tx) > 3 && n++ < (limit || 900)) {
    releaseAll();
    hold(w.player.x < tx ? 'ArrowRight' : 'ArrowLeft', true);
    step(1);
    if (AL.Dialogue.active) { releaseAll(); skip(); }
    if (w.player.dead) return false;
  }
  releaseAll();
  return !w.player.dead;
}

// 1. approach along the safe stretch left of the emitter
ok('walked up to the beam alive', walkTo(6) && !w.player.dead, 'x=' + w.player.x.toFixed(1));

// 2. prove the corridor is lethal while the beam is awake
{
  const probe = { x: w.player.x, y: w.player.y };
  let g = 0;
  while (!laser.active && g++ < 600) step(1);
  ok('the beam does wake', laser.active);
  w.player.x = 16 * 16; w.player.y = 15 * 16 - w.player.h; w.player.spawnT = 0;
  step(6);
  ok('standing in the awake beam kills', w.player.dead);
  step(70);                      // respawn
  ok('respawned', !w.player.dead);
  refetch();                     // the restart built new entities
}

// 3. do it properly: wait for sleep, step in, leave a body
ok('back at the start', walkTo(6) && !w.player.dead);
let g2 = 0;
const period = laser.blink[0] + laser.blink[1];
while (g2++ < 900) {
  step(1);
  if (!laser.active) {
    // commit only at the START of a sleep, so the whole window is ours
    const ph = ((laser.t + laser.blink[2]) % period + period) % period;
    if (ph >= laser.blink[0] && ph < laser.blink[0] + 0.35) break;
  }
}
ok('caught the beam asleep with room to work', !laser.active);

ok('stepped into the beam path', walkTo(10, 120) && !w.player.dead, 'x=' + w.player.x.toFixed(1));
hold('KeyX', true); step(1); releaseAll();
step(24);
hold('KeyX', true); step(1); releaseAll();
step(3);
ok('left an Echo standing in the corridor', w.echoes.length === 1 && !w.player.dead,
   'echoes=' + w.echoes.length + ' dead=' + w.player.dead);

// 4. hop over it and live through a full beam cycle in its shadow
hold('ArrowRight', true);
step(8);
hold('KeyZ', true); step(8); hold('KeyZ', false);
step(50);
releaseAll(); step(10);
ok('got past the Echo into its shadow', !w.player.dead && w.player.x > 11 * 16,
   'x=' + w.player.x.toFixed(1) + ' dead=' + w.player.dead);

let diedInCycle = false;
step(Math.ceil(period * 60) + 60, () => { if (w.player.dead) diedInCycle = true; });
ok('the Echo holds the beam for a whole cycle', !diedInCycle);
ok('the beam now stops at the Echo', laser.active ? (laser.len > 0 && laser.len < 90) : true,
   'len=' + laser.len + ' active=' + laser.active);

// 5. collect what the beam was guarding
let g3 = 0;
while (!shard.taken && g3++ < 600) {
  releaseAll();
  hold((w.player.x + 5) < (shard.x + 8) ? 'ArrowRight' : 'ArrowLeft', true);
  step(1);
  if (w.player.dead) break;
}
releaseAll();
ok('emberlight collected from inside the corridor', shard.taken, 'dead=' + w.player.dead);

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
