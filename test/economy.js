/* The meta-game: emberlight, Warden rank, the Cache, and the Posts.
 *
 * The load-bearing test here is the last one. Levels are built on a measured
 * ladder — 3 tiles from a surface, 4 off an Echo's head, 7 riding one — so no
 * combination of purchases may lift Wren past 7, or the shop quietly unmakes
 * the puzzles. */
const { load, mockCtx } = require('./harness.js');
const win = load(); const AL = win.AL; const DT = AL.DT; const g = mockCtx();
AL.Game.begin();
function fire(t,c){for(const f of (win.__listeners[t]||[])){try{f({code:c,repeat:false,preventDefault(){}});}catch(e){}}}
const dk=new Set();
function hold(c,on){if(on&&!dk.has(c)){dk.add(c);fire('keydown',c);}if(!on&&dk.has(c)){dk.delete(c);fire('keyup',c);}}
function tap(c){hold(c,true);}
function releaseAll(){for(const k of [...dk]) hold(k,false);}

let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log(`  FAIL ${n}${x?' :: '+x:''}`);} };
const section=s=>console.log('\n== '+s);

function reset() { AL.Save.reset(); return AL.Save.get(); }
function stepScene(sc, n, cb) {
  for (let i=0;i<n;i++){ if(cb)cb(i); AL.Input.update(); sc.update(DT); AL.FX.update(DT); AL.Input.lateUpdate(); }
}

/* ------------------------------------------------------------- currency */
section('emberlight and rank');
{
  const s = reset();
  ok('starts empty', (s.ember|0) === 0 && AL.Meta.rank() === 0);
  const r1 = AL.Meta.award(100);
  ok('an award pays out', AL.Save.get().ember === r1.amount && r1.amount >= 100, 'got ' + r1.amount);
  ok('lifetime earnings track separately', AL.Save.get().earned === r1.amount);

  // rank climbs, and paying out gets better as it does
  reset();
  let ranks = 0, lastMult = AL.Meta.earnMultiplier();
  for (let i=0;i<60;i++) { const r = AL.Meta.award(100); if (r.rankUp) ranks++; }
  ok('rank climbs as you earn', AL.Meta.rank() > 0, 'rank=' + AL.Meta.rank());
  ok('rank-ups are reported', ranks === AL.Meta.rank(), ranks + ' vs ' + AL.Meta.rank());
  ok('earnings multiplier grows with rank', AL.Meta.earnMultiplier() > lastMult);
  ok('rank thresholds increase', AL.Meta.xpForRank(5) > AL.Meta.xpForRank(4));

  const rp = AL.Meta.rankProgress();
  ok('progress is a sane fraction', rp.frac >= 0 && rp.frac <= 1 && rp.hi > rp.lo);
}

/* ------------------------------------------------------------- the shop */
section('buying');
{
  const s = reset();
  ok('cannot buy with nothing', !AL.Meta.canBuy('stride'));
  s.ember = 10000; AL.Save.put();
  const c0 = AL.Meta.cost('stride');
  ok('first level is affordable', AL.Meta.canBuy('stride'));
  ok('buying works', AL.Meta.buy('stride'));
  ok('it was paid for', AL.Save.get().ember === 10000 - c0, 'ember=' + AL.Save.get().ember);
  ok('the level went up', AL.Meta.level('stride') === 1);
  ok('the next one costs more', AL.Meta.cost('stride') > c0);

  // max out and stop
  for (let i=0;i<20;i++) { AL.Save.get().ember = 1e9; AL.Meta.buy('stride'); }
  ok('stops at max', AL.Meta.level('stride') === AL.Meta.def('stride').max);
  ok('maxed reads as maxed', AL.Meta.maxed('stride'));
  ok('cannot buy past max', !AL.Meta.canBuy('stride'));
  ok('cost of a maxed upgrade is infinite', AL.Meta.cost('stride') === Infinity);
}

section('upgrades gated on abilities');
{
  const s = reset();
  s.ember = 1e9; AL.Save.put();
  ok('dash upgrades hidden before the Ashstep', !AL.Meta.available('quick'));
  ok('and cannot be bought', !AL.Meta.canBuy('quick'));
  ok('echo-light upgrade hidden before Lightwake', !AL.Meta.available('wake'));
  s.abilities.dash = true; s.abilities.lightwake = true; AL.Save.put();
  ok('they appear once the ability exists', AL.Meta.available('quick') && AL.Meta.available('wake'));
}

section('purchases actually change the game');
{
  const s = reset();
  s.ember = 1e9; s.abilities = { echo:1, twin:1, longbreath:1, dash:1, lightwake:1, choir:1 };
  AL.Save.put();
  const w = new AL.World({ onEnding(){}, onComplete(){} });
  const breath0 = w.recordSeconds(), echoes0 = w.maxEchoes();
  const run0 = AL.Meta.runScale(), cool0 = AL.Meta.dashCoolScale();

  AL.Meta.buy('breath'); AL.Meta.buy('voice'); AL.Meta.buy('stride'); AL.Meta.buy('quick');
  ok('breath is longer',  w.recordSeconds() > breath0, breath0 + ' -> ' + w.recordSeconds());
  ok('one more Echo',     w.maxEchoes() === echoes0 + 1);
  ok('running is faster', AL.Meta.runScale() > run0);
  ok('dash recharges sooner', AL.Meta.dashCoolScale() < cool0);

  AL.Meta.buy('lantern'); AL.Meta.buy('draw'); AL.Meta.buy('wake'); AL.Meta.buy('grace');
  ok('lantern is bigger',  AL.Meta.lanternScale() > 1);
  ok('pickup reach grew',  AL.Meta.drawRadius() > 0);
  ok('echo light is brighter', AL.Meta.echoLightScale() > 1);
  ok('respawn mercy is longer', AL.Meta.graceBonus() > 0);
}

/* ------------------------------------------------------------ idle income */
section('the Posts');
{
  const s = reset();
  ok('nothing earns at the start', AL.Meta.yieldPerSecond() === 0);
  s.ember = 1e9; AL.Save.put();
  AL.Meta.buy('post');
  const one = AL.Meta.yieldPerSecond();
  ok('one Post earns', one > 0, one.toFixed(2) + '/s');
  AL.Meta.buy('post');
  ok('two Posts earn more', AL.Meta.yieldPerSecond() > one);
  const before = AL.Meta.yieldPerSecond();
  AL.Meta.buy('roots');
  ok('Deeper Roots multiplies the yield', AL.Meta.yieldPerSecond() > before);

  // the drip
  const purse = AL.Save.get().ember;
  let dripped = 0;
  for (let i=0;i<600;i++) dripped += AL.Meta.tick(DT);
  ok('ten seconds of play drips emberlight', dripped > 0, dripped + ' over 10s');
  ok('the drip reaches the purse', AL.Save.get().ember === purse + dripped);
}

section('what the Posts earn while away');
{
  const s = reset();
  s.ember = 1e9; AL.Save.put();
  AL.Meta.buy('post'); AL.Meta.buy('post');
  AL.Save.get().ember = 0;
  AL.Save.get().lastSeen = Date.now() - 60 * 1000;      // a minute ago
  AL.Save.put();
  const got = AL.Meta.collectOffline();
  const rate = AL.Meta.yieldPerSecond();
  ok('a minute away pays about a minute of yield',
     Math.abs(got.amount - rate * 60) <= 2, got.amount + ' vs ' + (rate*60).toFixed(1));

  // and it is capped
  AL.Save.get().ember = 0;
  AL.Save.get().lastSeen = Date.now() - 48 * 3600 * 1000;   // two days
  AL.Save.put();
  const big = AL.Meta.collectOffline();
  ok('offline earnings are capped', big.amount <= Math.ceil(rate * AL.Meta.OFFLINE_CAP) + 1,
     big.amount + ' vs cap ' + Math.ceil(rate * AL.Meta.OFFLINE_CAP));
  ok('collecting twice in a row pays nothing the second time',
     AL.Meta.collectOffline().amount === 0);
}

/* --------------------------------------------------------------- the UI */
section('the Cache');
{
  const s = reset();
  s.ember = 5000; s.started = true; s.abilities = { echo:1 }; AL.Save.put();
  let threw = null, left = false;
  try {
    const sc = new AL.Scenes.Cache({ onLeave: function () { left = true; } });
    sc.enter();
    sc.draw(g);
    ok('the Cache lists what is available', sc.items.length > 0, sc.items.length + ' items');
    ok('it hides what is not', !sc.items.some(i => i.id === 'quick'));

    const before = AL.Save.get().ember;
    // walk down the list and buy whatever is selected
    stepScene(sc, 2, () => tap('ArrowDown'));
    releaseAll();
    stepScene(sc, 2, () => tap('KeyZ'));
    releaseAll();
    sc.draw(g);
    ok('buying in the Cache spends emberlight', AL.Save.get().ember < before,
       before + ' -> ' + AL.Save.get().ember);

    // scrolling keeps the selection on screen
    for (let i=0;i<20;i++) { stepScene(sc, 1, () => tap('ArrowDown')); releaseAll(); }
    sc.draw(g);
    ok('the selection stays inside the window',
       sc.sel >= sc.scroll && sc.sel < sc.scroll + 6, `sel=${sc.sel} scroll=${sc.scroll}`);

    stepScene(sc, 2, () => tap('KeyX'));
    releaseAll();
    ok('X leaves the Cache', left);
  } catch (e) { threw = e; }
  ok('the Cache renders without throwing', !threw, threw && threw.stack.split('\n').slice(0,3).join(' | '));
}

section('finishing a level hands off to the Cache');
{
  const s = reset();
  s.abilities = { echo:1, twin:1, longbreath:1, dash:1, lightwake:1, choir:1 }; AL.Save.put();
  let handed = null;
  const w = new AL.World({ onEnding(){}, onComplete(){}, onLevelComplete(sum){ handed = sum; } });
  w.start(0);
  while (AL.Dialogue.active) { tap('Enter'); AL.Input.update(); w.update(DT); AL.Input.lateUpdate(); releaseAll(); }
  for (const e of w.level.entities) {
    if (e instanceof AL.Entities.Shard && !e.taken) { e.taken = true; w.collectShard(e); }
  }
  const exit = w.level.entities.find(e => e instanceof AL.Entities.Exit);
  for (let i=0;i<90;i++){ AL.Input.update(); w.update(DT); AL.Input.lateUpdate(); }
  w.player.x = exit.x + 3; w.player.y = exit.y + exit.h - w.player.h - 1;
  for (let i=0;i<120 && !handed;i++){ AL.Input.update(); w.update(DT); AL.Input.lateUpdate(); }
  ok('the level hands off', !!handed);
  ok('it reports what was earned', handed && handed.earned > 0, handed && handed.earned);
  ok('it names the next level', handed && handed.next === 1, handed && handed.next);
}

/* ----------------------------------------------- the invariant that matters */
section('no purchase can out-climb the level design');
{
  const s = reset();
  s.ember = 1e12;
  s.abilities = { echo:1, twin:1, longbreath:1, dash:1, lightwake:1, choir:1 };
  AL.Save.put();
  // buy absolutely everything, to the cap
  for (const u of AL.Meta.UPGRADES) {
    for (let i=0;i<u.max;i++) { AL.Save.get().ember = 1e12; AL.Meta.buy(u.id); }
    ok('maxed ' + u.id, AL.Meta.level(u.id) === u.max, AL.Meta.level(u.id) + '/' + u.max);
  }

  const w = new AL.World({ onEnding(){}, onComplete(){} });
  w.start(0);
  while (AL.Dialogue.active) { tap('Enter'); AL.Input.update(); w.update(DT); AL.Input.lateUpdate(); releaseAll(); }
  const lv = w.level;
  const FLOOR = lv.rows - 2, groundY = FLOOR * 16;

  // a column with real sky over it
  let col = -1;
  for (let x = 2; x < lv.cols - 2 && col < 0; x++) {
    if (!lv.isSolid(x, FLOOR)) continue;
    let clear = true;
    for (let y = FLOOR - 1; y >= FLOOR - 10; y--) if (lv.isSolid(x, y)) { clear = false; break; }
    if (clear) col = x;
  }
  /* Sweep the dash timing instead of guessing it: the invariant is about the
   * BEST she can do, so try dashing on every frame of the jump and keep the
   * highest result. */
  function reachWith(dashFrames) {
    const p = w.player;
    p.dead = false;
    p.x = col * 16 + 3; p.y = groundY - p.h; p.vy = 0; p.vx = 0;
    p.grounded = true; p.spawnT = 0; p.dash = 0; p.dashCool = 0;
    p.dashCharges = 1 + AL.Meta.airDashes();
    releaseAll();
    for (let i=0;i<3;i++){ AL.Input.update(); w.update(DT); AL.Input.lateUpdate(); }
    let best = p.y + p.h;
    hold('KeyZ', true); hold('ArrowUp', true);
    for (let i=0;i<80;i++){
      if (i === 10) hold('KeyZ', false);
      if (dashFrames.indexOf(i) >= 0) { hold('KeyC', false); tap('KeyC'); }
      AL.Input.update(); w.update(DT); AL.FX.update(DT); AL.Input.lateUpdate();
      if (p.y + p.h < best) best = p.y + p.h;
    }
    releaseAll();
    return groundY - best;
  }

  let peak = 0, peakAt = null;
  for (let a = 0; a <= 26; a++) {
    for (const b of [a + 6, a + 12, a + 20]) {
      const r = reachWith([a, b]);
      if (r > peak) { peak = r; peakAt = [a, b]; }
    }
  }
  const tiles = peak / 16;
  console.log(`best fully-upgraded climb found: ${peak.toFixed(0)}px  (${tiles.toFixed(2)} tiles), dashing on frames ${peakAt}`);
  ok('fully upgraded, she still cannot out-climb an Echo ride (7 tiles)',
     tiles <= 7.0, tiles.toFixed(2) + ' tiles');
  ok('and the shop does give her more than a bare jump', tiles > 3.8, tiles.toFixed(2));

  // and the same sweep with nothing bought, for comparison
  AL.Save.get().upg = {}; AL.Save.put();
  let basePeak = 0;
  for (let a = 0; a <= 26; a++) { const r = reachWith([a, a + 40]); if (r > basePeak) basePeak = r; }
  console.log(`for comparison, un-upgraded with the Ashstep: ${(basePeak/16).toFixed(2)} tiles`);
  ok('the shop adds at most a tile of climb over the base dash',
     tiles - basePeak / 16 <= 1.0, (tiles - basePeak / 16).toFixed(2) + ' tiles added');
}

section('the Cache does not restart the level under you');
{
  const s = reset();
  s.ember = 3000; s.started = true;
  s.abilities = { echo:1, twin:1, longbreath:1, dash:1, lightwake:1, choir:1 };
  AL.Save.put();
  const play = new AL.Scenes.Play(0);
  play.enter();
  // walk a little way into the level
  for (let i=0;i<900;i++){
    if (AL.Dialogue.active) { hold('ArrowRight', false); tap('Enter'); }
    else { hold('Enter', false); hold('ArrowRight', true); }
    AL.Input.update();
    play.update(DT);
    AL.Input.lateUpdate();
    hold('Enter', false);
  }
  releaseAll();
  const whereWeWere = play.world.player.x;
  ok('walked somewhere', whereWeWere > 60, 'x=' + whereWeWere.toFixed(1));

  // open the Cache from the pause menu and come straight back
  play.paused = true;
  play.enter();                       // what setScene(play) would do on return
  ok('re-entering does not restart the level',
     Math.abs(play.world.player.x - whereWeWere) < 2,
     whereWeWere.toFixed(1) + ' -> ' + play.world.player.x.toFixed(1));
  ok('and the level index is unchanged', play.world.roomIndex === 0);
}

console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
process.exit(fail ? 1 : 0);
