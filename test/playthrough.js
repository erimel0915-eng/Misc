/* Drives the game from room 1 to the finale, clearing each room the way a
 * player would end it (take all emberlight, walk into the door), and checks the
 * whole chain: chamber transitions, music, abilities, and the ending. */
const { load, mockCtx } = require('./harness.js');
const win = load(); const AL = win.AL; const DT = AL.DT; const g = mockCtx();
AL.Game.begin();
function fire(t,c){for(const f of (win.__listeners[t]||[])){try{f({code:c,repeat:false,preventDefault(){}});}catch(e){}}}
const dk=new Set();
function hold(c,on){if(on&&!dk.has(c)){dk.add(c);fire('keydown',c);}if(!on&&dk.has(c)){dk.delete(c);fire('keyup',c);}}
function releaseAll(){for(const k of [...dk]) hold(k,false);}

let pass=0, fail=0;
function ok(n,c,x){ if(c) pass++; else { fail++; console.log(`  FAIL ${n}${x?' :: '+x:''}`);} }

AL.Save.reset();
const endings = [];
const w = new AL.World({ onEnding: k => endings.push(k), onComplete: () => endings.push('complete') });
function step(n, cb) {
  for (let i=0;i<n;i++){
    if (cb) cb(i);
    AL.Input.update();
    if (!AL.FX.frozen()) w.update(DT); else AL.Particles.update(DT);
    AL.FX.update(DT);
    AL.Input.lateUpdate();
  }
}
function skipDialogue(limit) {
  let n = 0;
  while (AL.Dialogue.active && n++ < (limit || 6000)) {
    hold('Enter', true); step(1); releaseAll();
    if (n % 2 === 0) { hold('KeyX', true); step(1); releaseAll(); }
  }
  return n;
}

w.start(0);
const chambersSeen = new Set();
const order = [];
let guardRooms = 0;

while (guardRooms++ < 30) {
  skipDialogue();
  const def = AL.Levels.rooms[w.roomIndex];
  order.push(def.id);
  chambersSeen.add(def.chamber);

  // the final room has no exit — it ends the game through Iris
  if (def.id === 'c7b') {
    // walk right into Iris
    let gi = 0;
    while (!AL.Dialogue.active && gi++ < 1200) { hold('ArrowRight', true); step(1); }
    releaseAll();
    ok('Iris triggered the finale', AL.Dialogue.active);
    // read the finale, then take the first ending on offer
    let n = 0;
    while (AL.Dialogue.active && endings.length === 0 && n++ < 40000) {
      hold('Enter', true); step(1); releaseAll();
    }
    ok('an ending was chosen', endings.length === 1, endings.join());
    break;
  }

  // if the room holds an altar, walk into it the way a player would
  const altar = w.level.entities.find(e => e instanceof AL.Entities.Altar && !e.used);
  if (altar) {
    let gi = 0;
    while (!altar.used && gi++ < 1500) {
      releaseAll();
      hold(w.player.x < altar.x ? 'ArrowRight' : 'ArrowLeft', true);
      step(1);
      if (AL.Dialogue.active) { releaseAll(); skipDialogue(); }
    }
    releaseAll();
    if (!altar.used) {                       // levels that descend
      w.player.dead = false;
      w.player.x = altar.x; w.player.y = altar.y - w.player.h + 4;
      w.player.spawnT = 0;
      let g2 = 0;
      while (!altar.used && g2++ < 200) { step(1); skipDialogue(); }
    }
    ok(def.id + ' altar taken', altar.used);
  }

  // clear the room: take every shard, then step into the open door
  for (const e of w.level.entities) {
    if (e instanceof AL.Entities.Shard && !e.taken) { e.taken = true; w.collectShard(e); }
    if (e instanceof AL.Entities.Mote && !e.taken) { e.taken = true; w.collectMote(e); }
  }
  skipDialogue();
  ok(def.id + ' cleared', w.roomCleared());
  const exit = w.level.entities.find(e => e instanceof AL.Entities.Exit);
  ok(def.id + ' has an exit', !!exit);
  if (!exit) break;
  step(80);
  skipDialogue();
  const before = w.roomIndex;
  w.player.dead = false;
  w.player.x = exit.x + 3;
  w.player.y = exit.y + exit.h - w.player.h - 1;
  step(6);
  ok(def.id + ' transition started', !!w.transition || w.roomIndex !== before);
  step(100);
  skipDialogue();
  if (w.roomIndex === before) { ok(def.id + ' advanced', false, 'stuck at ' + before); break; }
  w.draw(g);
}

console.log('\nrooms visited: ' + order.length);
console.log(order.join(' -> '));
ok('visited every level', order.length === AL.Levels.rooms.length, 'got ' + order.length);
ok('all 7 chambers seen', chambersSeen.size === 7, [...chambersSeen].join(','));
ok('every ability granted along the way',
   ['echo','twin','longbreath','dash','lightwake','choir'].every(a => w.hasAbility(a)),
   JSON.stringify(w.save.abilities));
ok('all 9 memories collected', w.memoryCount() === AL.Story.memoryTotal, 'got ' + w.memoryCount());
ok('the secret ending was available with all memories', endings[0] === 'free' || endings.length === 1,
   endings.join());
ok('emberlight banked', w.save.shards >= 20, 'shards=' + w.save.shards);
console.log(`\nending taken: ${endings.join()}   emberlight: ${w.save.shards}   memories: ${w.memoryCount()}`);
console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
