/* For every laser room: which standable surfaces does a beam make lethal, and
 * is there anywhere safe to stand ON that surface to place a blocking Echo?
 *
 * The trap: an Echo only exists where the player survived standing. If a beam
 * covers an entire ledge and never switches off, no Echo can ever be put in it,
 * so the ledge is unreachable forever. */
const { load } = require('./harness.js');
const AL = load().AL;
const SOLID = new Set('#~?ABDEF'.split(''));
const STAND = new Set('#~?-ABDEF'.split(''));

let problems = 0;
for (const r of AL.Levels.rooms) {
  const lasers = [];
  let li = 0;
  r.map.forEach((row, y) => {
    for (let x = 0; x < 30; x++) {
      if (!'rldu'.includes(row[x])) continue;
      const cfg = ((r.cfg && r.cfg.lasers) || [])[li++] || {};
      lasers.push({ x, y, dir: row[x], cfg });
    }
  });
  if (!lasers.length) continue;

  console.log(`\n${r.id} "${r.name}"`);
  for (const L of lasers) {
    const permanent = !L.cfg.blink && !L.cfg.chan;
    const by = L.y * 16 + 8;
    // march the beam through static geometry
    let endX = L.dir === 'r' ? 29 : 0;
    if (L.dir === 'r') {
      for (let x = L.x + 1; x < 30; x++) { if (SOLID.has(r.map[L.y][x])) { endX = x; break; } }
    } else if (L.dir === 'l') {
      for (let x = L.x - 1; x >= 0; x--) { if (SOLID.has(r.map[L.y][x])) { endX = x; break; } }
    }
    const lo = Math.min(L.x, endX), hi = Math.max(L.x, endX);

    // which surfaces does it make lethal, and is any part of each left safe?
    const hit = [];
    for (let sy = 0; sy < 17; sy++) {
      const feet = sy * 16, head = feet - 14;
      if (!(by >= head && by <= feet)) continue;     // beam crosses a body stood here
      let total = 0, safe = 0;
      for (let sx = 1; sx < 29; sx++) {
        if (!STAND.has(r.map[sy][sx])) continue;
        if (sy > 0 && SOLID.has(r.map[sy - 1][sx])) continue;
        total++;
        if (sx < lo || sx > hi) safe++;
      }
      if (total) hit.push({ sy, total, safe });
    }
    const tag = permanent ? 'ALWAYS ON' : (L.cfg.blink ? `blink on=${L.cfg.blink[0]}s off=${L.cfg.blink[1]}s` : `switched by ${L.cfg.chan}`);
    console.log(`  ${L.dir}@${L.x},${L.y}  beam y=${by} cols ${lo}..${hi}  [${tag}]`);
    for (const h of hit) {
      const bad = permanent && h.safe === 0;
      if (bad) problems++;
      console.log(`     surface row ${h.sy}: ${h.total} standable tiles, ${h.safe} outside the beam` +
                  (bad ? '   <-- IMPOSSIBLE: no safe tile, so no Echo can ever block it' : ''));
    }
  }
}
console.log(`\nimpossible surfaces: ${problems}`);
process.exit(problems ? 1 : 0);
