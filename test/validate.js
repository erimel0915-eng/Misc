/* Structural validation + conservative reachability analysis for every room. */
const { load } = require('./harness.js');
const win = load();
const AL = win.AL;
const { rooms } = AL.Levels;

const KNOWN = new Set(' #-~?^v<>*oPXK+abcABDEFrldu MSRTW=_'.split(''));
let problems = [], notes = [];

function err(id, m) { problems.push(`${id}: ${m}`); }
function note(id, m) { notes.push(`${id}: ${m}`); }

/* ------------------------------------------------- structural validation */
let totalShards = 0, totalMotes = 0;
for (const r of rooms) {
  const id = r.id;
  const COLS = r.map[0].length, ROWS = r.map.length;
  if (ROWS < 17) err(id, `only ${ROWS} rows`);
  r.map.forEach((row, y) => {
    if (row.length !== COLS) err(id, `row ${y} is ${row.length} chars, expected ${COLS}`);
    for (const ch of row) if (!KNOWN.has(ch)) err(id, `unknown char '${ch}' in row ${y}`);
  });

  const count = c => r.map.join('').split('').filter(x => x === c).length;
  if (count('P') !== 1) err(id, `${count('P')} spawn points`);
  const exits = count('X');
  if (r.id === 'c7b') { if (exits !== 0) err(id, 'final room should have no exit'); }
  else if (exits !== 1) err(id, `${exits} exits`);

  const shards = count('*');
  totalShards += shards;
  totalMotes += count('o');
  if (r.chamber < 7 && shards < 1) err(id, 'no emberlight — exit would never open');

  // cfg arrays must cover every char that consumes one
  const need = { movers: 'M', lasers: 'rldu', shades: 'S', runes: 'R', altars: 'T', iris: 'W', lamps: '+' };
  for (const [key, chars] of Object.entries(need)) {
    let n = 0;
    for (const c of chars) n += count(c);
    const have = (r.cfg && r.cfg[key]) ? r.cfg[key].length : 0;
    if (key === 'lamps') continue;              // lamps are happy with defaults
    if (n > 0 && have < n) err(id, `${n} '${chars}' but cfg.${key} has ${have}`);
    if (have > n) err(id, `cfg.${key} has ${have} entries but only ${n} chars`);
  }

  // every referenced script must exist
  if (r.onEnter && !AL.Story.scripts[r.onEnter]) err(id, `onEnter script '${r.onEnter}' missing`);
  for (const rn of (r.cfg && r.cfg.runes) || []) {
    if (rn.key && !AL.Story.scripts[rn.key]) err(id, `rune script '${rn.key}' missing`);
  }
  for (const al of (r.cfg && r.cfg.altars) || []) {
    if (al.script && !AL.Story.scripts[al.script]) err(id, `altar script '${al.script}' missing`);
    if (!['echo','twin','longbreath','dash','lightwake','choir'].includes(al.ability))
      err(id, `unknown ability '${al.ability}'`);
  }
  for (const ir of (r.cfg && r.cfg.iris) || []) {
    if (ir.script && !AL.Story.scripts[ir.script]) err(id, `iris script '${ir.script}' missing`);
  }

  // spawn must have ground beneath it somewhere below
  let py = -1, px = -1;
  r.map.forEach((row, y) => { const x = row.indexOf('P'); if (x >= 0) { py = y; px = x; } });
  if (py >= 0) {
    let found = false;
    for (let y = py + 1; y < ROWS; y++) {
      const c = r.map[y][px];
      if ('#-~?EFABD'.includes(c)) { found = true; break; }
    }
    if (!found) err(id, 'spawn has no floor beneath it');
  }
}

/* --------------------------------------------- reachability (optimistic) */
/* Treats every switchable tile as passable-when-needed, so the question is
 * "reachable once the switches are solved", not "reachable right now". */
/* Optimistic geometry: the question is "reachable once the switches are
 * solved", so a gate counts as a floor you may stand on AND as a doorway you
 * may walk through — whichever the route needs. Only stone and crumble block. */
const SOLIDISH = new Set('#~'.split(''));
const STANDABLE = new Set('#~?-ABDEF'.split(''));

function analyse(r, maxRise, maxGap) {
  const grid = r.map;
  const W = grid[0].length, H = grid.length;
  const solid = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? true : STANDABLE.has(grid[y][x]);
  const free = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? false : !SOLIDISH.has(grid[y][x]);
  const hazard = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? false : '^v<>'.includes(grid[y][x]);

  // candidate surfaces: solid tile with free space above
  const nodes = [];
  const index = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(x, y) && free(x, y - 1) && !hazard(x, y - 1)) {
      index.set(`${x},${y}`, nodes.length);
      nodes.push({ x, y });
    }
  }
  // moving platforms add surfaces along their rail
  for (const m of (r.cfg && r.cfg.movers) || []) {
    // find the Nth 'M'
  }
  let mi = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x] !== 'M') continue;
    const cfg = ((r.cfg && r.cfg.movers) || [])[mi++] || {};
    const w = cfg.w || 2;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const mx = Math.round(x + (cfg.dx || 0) * t);
      const my = Math.round(y + (cfg.dy || 0) * t);
      for (let dx = 0; dx < w; dx++) {
        const key = `${mx + dx},${my}`;
        if (!index.has(key) && mx + dx >= 0 && mx + dx < W && my >= 0 && my < H) {
          index.set(key, nodes.length); nodes.push({ x: mx + dx, y: my, mover: true });
        }
      }
    }
  }

  // start node: the surface under the spawn
  let sx = -1, sy = -1;
  grid.forEach((row, y) => { const x = row.indexOf('P'); if (x >= 0) { sx = x; sy = y; } });
  let start = -1;
  for (let y = sy + 1; y < H && start < 0; y++) {
    const k = index.get(`${sx},${y}`);
    if (k !== undefined) start = k;
  }
  if (start < 0) return { reach: new Set(), nodes, index };

  // BFS with generous movement: +3 rows up, any fall, 4 tiles horizontal
  const reach = new Set([start]);
  const q = [start];
  while (q.length) {
    const n = nodes[q.shift()];
    for (let dx = -maxGap; dx <= maxGap; dx++) {
      for (let y2 = 0; y2 < H; y2++) {
        const k = index.get(`${n.x + dx},${y2}`);
        if (k === undefined || reach.has(k)) continue;
        const rise = n.y - y2;                 // >0 means going up
        if (rise > maxRise) continue;          // too high without help
        if (rise > 0 && Math.abs(dx) > maxGap) continue;
        reach.add(k); q.push(k);
      }
    }
  }
  return { reach, nodes, index };
}

const ASSIST_RISE = { step: 4, ride: 7 };
for (const r of rooms) {
  // Required path: 3 rows, unless the room declares it needs an Echo.
  const strictRise = r.assist ? ASSIST_RISE[r.assist] : 3;
  // The Ashstep arrives in chamber 4; a dash-jump carries about 6 tiles.
  const maxGap = r.chamber >= 4 ? 6 : 4;
  const strict = analyse(r, strictRise, maxGap);
  // Optional motes may always lean on an Echo ride.
  const loose = analyse(r, 7, maxGap);
  const { reach, nodes, index } = strict;
  const reachable = (x, y) => {
    const k = index.get(`${x},${y}`);
    return k !== undefined && reach.has(k);
  };
  // something at (x,y) is gettable if a reachable surface is near and not too far below
  const near = (set, ns, x, y) => {
    for (const k of set) {
      const n = ns[k];
      if (Math.abs(n.x - x) > 4) continue;
      if (y + 1 >= n.y - 4 && y + 1 <= n.y + 1) return true;
    }
    return false;
  };
  const gettable = (x, y) => near(reach, nodes, x, y);
  const gettableLoose = (x, y) => near(loose.reach, loose.nodes, x, y);
  r.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '*' && !gettable(x, y)) note(r.id, `emberlight at ${x},${y} looks hard to reach`);
      if (c === 'o' && !gettableLoose(x, y)) note(r.id, `memory at ${x},${y} unreachable even with an Echo ride`);
      if (c === 'X' && !gettable(x, y)) note(r.id, `EXIT at ${x},${y} looks unreachable`);
      if (c === 'T' && !gettable(x, y)) note(r.id, `altar at ${x},${y} looks unreachable`);
      if (c === 'a' && !gettable(x, y)) note(r.id, `plate A at ${x},${y} looks unreachable`);
      if (c === 'b' && !gettable(x, y)) note(r.id, `plate B at ${x},${y} looks unreachable`);
      if (c === 'c' && !gettable(x, y)) note(r.id, `plate C at ${x},${y} looks unreachable`);
      if (c === 'W' && !gettable(x, y)) note(r.id, `IRIS at ${x},${y} looks unreachable`);
      if (c === 'K' && !gettable(x, y)) note(r.id, `checkpoint at ${x},${y} looks unreachable`);
    }
  });
}

/* ------------------------------------------- comfortable onward connections */
/* The reachability pass above asks "is there a route at all", and will happily
 * route you up an Echo ride. This asks a blunter question of every ledge: can
 * you get off it with room to spare? A jump that only works by three pixels is
 * a bug report waiting to happen — which is exactly how the shaft shipped a
 * five-tile gap with a two-row drop. */
const K = AL.Player.K;
function jumpSpan(dropPx) {
  const rise = (K.JUMP_V * K.JUMP_V) / (2 * K.GRAV);
  const tUp = -K.JUMP_V / K.GRAV;
  const tDown = Math.sqrt(2 * Math.max(1, rise + dropPx) / K.GRAV);
  return K.RUN_MAX * (tUp + tDown);
}

const MARGIN = 12;          // pixels of slack we insist on
for (const r of rooms) {
  const grid = r.map, W = grid[0].length, H = grid.length;
  const spans = [];
  for (let y = 0; y < H; y++) {
    let s = -1;
    for (let x = 0; x <= W; x++) {
      const solid = x < W && STANDABLE.has(grid[y][x]);
      const headroom = x < W && y > 0 && !SOLIDISH.has(grid[y - 1][x]);
      if (solid && headroom) { if (s < 0) s = x; }
      else if (s >= 0) { spans.push({ y, x0: s, x1: x - 1 }); s = -1; }
    }
  }
  const dashes = r.chamber >= 4;
  for (const a of spans) {
    if (a.y >= H - 2) continue;                    // the floor needs no exit
    if (a.x1 - a.x0 < 1) continue;                 // a single tile is a perch
    let best = -1e9, bestTo = null;
    for (const b of spans) {
      if (b === a) continue;
      const drop = (b.y - a.y) * 16;
      if (drop < -3 * 16) continue;                // more than a jump upward
      if (drop > 24 * 16) continue;                // far below: a different area
      const gap = (b.x0 > a.x1) ? (b.x0 - a.x1 - 1)
                : (a.x0 > b.x1) ? (a.x0 - b.x1 - 1) : -1;
      if (gap < 0) { best = 1e9; bestTo = b; break; }   // overlapping: walk off
      const need = gap * 16;
      const have = jumpSpan(Math.max(0, drop)) * (dashes ? 1.9 : 1);
      if (have - need > best) { best = have - need; bestTo = b; }
    }
    if (bestTo && best < MARGIN) {
      note(r.id, `ledge row ${a.y} cols ${a.x0}..${a.x1} has only ${best.toFixed(0)}px of slack ` +
                 `on its best jump (to row ${bestTo.y})` + (dashes ? '' : ' and there is no dash yet'));
    }
  }
}

console.log(`rooms: ${rooms.length}   emberlight: ${totalShards}   motes: ${totalMotes} (story expects ${AL.Story.memoryTotal})`);
if (totalMotes !== AL.Story.memoryTotal) problems.push(`mote count ${totalMotes} != Story.memoryTotal ${AL.Story.memoryTotal}`);

console.log('\n--- ERRORS (' + problems.length + ') ---');
problems.forEach(p => console.log('  ' + p));
console.log('\n--- REACHABILITY NOTES (' + notes.length + ') ---');
notes.forEach(p => console.log('  ' + p));
const EXIT = problems.length ? 1 : 0;

/* ------------------------------------------------- laser coverage report */
console.log('\n--- LASER COVERAGE ---');
for (const r of rooms) {
  const beams = [];
  r.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!'rldu'.includes(c)) continue;
      const bx = x * 16 + 8 + (c === 'r' ? 5 : c === 'l' ? -5 : 0);
      const by = y * 16 + 8 + (c === 'd' ? 5 : c === 'u' ? -5 : 0);
      if (c === 'r' || c === 'l') {
        // which standing surfaces does a horizontal beam at `by` endanger?
        const rows = [];
        for (let s = 0; s < r.map.length; s++) if (by >= s * 16 - 14 && by <= s * 16) rows.push(s);
        beams.push(`${c}@${x},${y} beam y=${by} threatens surface row(s) ${rows.join(',') || 'NONE'}`);
      } else {
        beams.push(`${c}@${x},${y} vertical beam x=${bx}`);
      }
    }
  });
  if (beams.length) console.log('  ' + r.id + ': ' + beams.join(' | '));
}
process.exit(EXIT);
