/* Can the very first Echo puzzle actually be solved? c1r2 puts a shard on a
 * ledge exactly one tile above a normal jump: you must stand on your Echo. */
const { load, mockCtx } = require('./harness.js');
const win = load(); const AL = win.AL; const DT = AL.DT;
AL.Game.begin();
function fire(t,c){for(const f of (win.__listeners[t]||[])){try{f({code:c,repeat:false,preventDefault(){}});}catch(e){}}}
const dk=new Set();
function hold(c,on){if(on&&!dk.has(c)){dk.add(c);fire('keydown',c);}if(!on&&dk.has(c)){dk.delete(c);fire('keyup',c);}}
function releaseAll(){for(const k of [...dk]) hold(k,false);}

function mk(roomId, abilities) {
  AL.Save.reset();
  const w = new AL.World({ onEnding(){}, onComplete(){} });
  for (const a of abilities) w.save.abilities[a] = true;
  w.start(AL.Levels.rooms.findIndex(r => r.id === roomId));
  return w;
}
function step(w,n,cb){for(let i=0;i<n;i++){if(cb)cb(i);AL.Input.update();if(!AL.FX.frozen())w.update(DT);AL.FX.update(DT);AL.Input.lateUpdate();}}
function skip(w){let n=0;while(AL.Dialogue.active&&n++<4000){hold('Enter',true);step(w,1);releaseAll();}}

let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log(`  FAIL ${n}${x?' :: '+x:''}`);} };

/* --- the reach ladder, measured rather than assumed --- */
function maxReachFrom(surfaceY) {
  // simulate a pure vertical jump off a surface and record peak height
  const w = mk('c1r1', []);
  skip(w);
  const p = w.player;
  p.x = 340; p.y = surfaceY - p.h;   // clear headroom in c1r1 p.vy = 0; p.grounded = true; p.spawnT = 0;
  step(w, 2);
  hold('KeyZ', true);
  let best = p.y + p.h;
  step(w, 40, () => { if (p.y + p.h < best) best = p.y + p.h; });
  hold('KeyZ', false);
  step(w, 40, () => { if (p.y + p.h < best) best = p.y + p.h; });
  releaseAll();
  return best;
}
const groundY = 15 * 16;                 // surface of a standard floor
const fromGround = maxReachFrom(groundY);
const rise = groundY - fromGround;
const ECHO_H = 14;
const fromEchoHead = groundY - ECHO_H - rise;    // an Echo's head is 14px up
console.log(`jump rise: ${rise.toFixed(1)}px  (${(rise / 16).toFixed(2)} tiles)`);
console.log(`  from a floor at y=${groundY} -> reaches y=${fromGround.toFixed(1)}`);
console.log(`  off an Echo standing on it   -> reaches y=${fromEchoHead.toFixed(1)}`);

ok('a plain jump clears 3 tiles', fromGround <= 12 * 16, `needs <= 192, got ${fromGround.toFixed(1)}`);
ok('a plain jump does NOT clear 4 tiles', fromGround > 11 * 16, `needs > 176, got ${fromGround.toFixed(1)}`);
ok('standing on an Echo clears 4 tiles', fromEchoHead <= 11 * 16, `needs <= 176, got ${fromEchoHead.toFixed(1)}`);
ok('standing on an Echo does NOT clear 5 tiles', fromEchoHead > 10 * 16, `needs > 160, got ${fromEchoHead.toFixed(1)}`);

/* --- actually solve c1r2 --- */
{
  const w = mk('c1r2', ['echo']);
  skip(w);
  const shard = w.level.entities.find(e => e instanceof AL.Entities.Shard);
  ok('c1r2 has one emberlight', !!shard && w.level.requiredShards === 1);

  // The ledge runs cols 6..15 at grid row 11. Park an Echo just right of it.
  const standX = 17 * 16 + 3;
  let guard = 0;
  while (Math.abs(w.player.x - standX) > 2 && guard++ < 2000) {
    releaseAll();
    if (AL.Dialogue.active) { skip(w); continue; }   // the altar talks on the way past
    hold(w.player.x < standX ? 'ArrowRight' : 'ArrowLeft', true);
    step(w, 1);
  }
  releaseAll(); skip(w); step(w, 20); skip(w);
  ok('walked to the launch spot', Math.abs(w.player.x - standX) <= 6, 'x=' + w.player.x.toFixed(1));

  // record standing still, release
  hold('KeyX', true); step(w, 1); releaseAll();
  step(w, 70);
  hold('KeyX', true); step(w, 1); releaseAll();
  step(w, 4);
  ok('echo ability granted by walking past the altar', w.hasAbility('echo'));
  ok('echo placed', w.echoes.length === 1);
  const e = w.echoes[0];
  if (!e) { console.log(`\n  ${pass} passed, ${fail} failed`); process.exit(1); }

  // step off so the Echo turns solid, then hop onto its head
  hold('ArrowRight', true); step(w, 20); releaseAll(); step(w, 20);
  ok('echo became solid', !e.pass);

  // hop onto the Echo from the right and settle there
  function onEcho() {
    return w.player.grounded &&
           Math.abs((w.player.y + w.player.h) - e.y) <= 2 &&
           w.player.x + w.player.w > e.x && w.player.x < e.x + e.w;
  }
  let settled = false, g2 = 0;
  while (!settled && g2++ < 600) {
    releaseAll();
    if (w.player.x > e.x + 2) hold('ArrowLeft', true);
    else if (w.player.x < e.x - 2) hold('ArrowRight', true);
    if (g2 % 30 === 0 && w.player.grounded) hold('KeyZ', true);
    step(w, 1);
    settled = onEcho();
  }
  releaseAll();
  step(w, 6);
  ok('player can stand on the Echo', onEcho(),
     'feet=' + (w.player.y + w.player.h).toFixed(1) + ' echoTop=' + e.y.toFixed(1) +
     ' grounded=' + w.player.grounded);

  if (onEcho()) {
    // full-height jump, drifting left onto the ledge (cols 6..15, top y=176)
    let landed = false;
    hold('ArrowLeft', true);
    hold('KeyZ', true);
    step(w, 18, () => {
      if (w.player.grounded && w.player.y + w.player.h <= 11 * 16 + 1) landed = true;
    });
    hold('KeyZ', false);
    step(w, 70, () => {
      if (w.player.grounded && w.player.y + w.player.h <= 11 * 16 + 1) landed = true;
    });
    releaseAll();
    step(w, 10);
    ok('player reached the ledge from the Echo', landed,
       'feet=' + (w.player.y + w.player.h).toFixed(1) + ' (ledge top is 176)');

    // walk along the ledge to the emberlight
    let g4 = 0;
    while (!shard.taken && g4++ < 600) {
      releaseAll();
      hold((w.player.x + 5) < (shard.x + 8) ? 'ArrowRight' : 'ArrowLeft', true);
      step(w, 1);
    }
    releaseAll();
    ok('emberlight collected', shard.taken);
    ok('room cleared', w.roomCleared());
  }
}

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
