/* Headless harness: stubs the browser just enough to load and run the game. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function mockCtx() {
  const grad = { addColorStop() {} };
  const ctx = {
    canvas: null,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '', textBaseline: '', textAlign: '',
    shadowColor: '', shadowBlur: 0,
    imageSmoothingEnabled: false,
    fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {}, strokeText() {},
    measureText() { return { width: 6 }; },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {},
    fill() {}, stroke() {}, clip() {}, setLineDash() {},
    createLinearGradient() { return grad; }, createRadialGradient() { return grad; },
    drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; },
    putImageData() {},
  };
  return ctx;
}

function makeEl(tag) {
  const el = {
    tagName: (tag || '').toUpperCase(),
    width: 480, height: 272, style: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
                 toggle(c){ this._s.has(c)?this._s.delete(c):this._s.add(c); },
                 contains(c){ return this._s.has(c); } },
    getContext() { const c = mockCtx(); c.canvas = el; return c; },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, removeChild() {},
    parentNode: { removeChild() {} },
  };
  return el;
}

function createSandbox() {
  const store = {};
  const elements = {};
  const doc = {
    readyState: 'complete',
    fullscreenElement: null,
    documentElement: { requestFullscreen() {} },
    exitFullscreen() {},
    hidden: false,
    createElement: makeEl,
    getElementById(id) {
      if (!(id in elements)) elements[id] = makeEl(id === 'game' ? 'canvas' : 'div');
      return elements[id];
    },
    addEventListener() {}, removeEventListener() {},
  };
  const listeners = {};
  const win = {
    innerWidth: 1600, innerHeight: 900,
    document: doc,
    localStorage: {
      getItem(k) { return k in store ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
    navigator: {},
    performance: { now: () => Date.now() },
    requestAnimationFrame() { return 0; },
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener() {},
    AudioContext: undefined,          // keeps the synth inert but exercised
    Math, Date, JSON, parseInt, parseFloat, isNaN, console,
  };
  win.window = win;
  win.globalThis = win;
  win.self = win;
  const sandbox = vm.createContext(win);
  return { sandbox, win, listeners, elements, store };
}

const FILES = [
  'src/core/util.js', 'src/core/input.js', 'src/core/audio.js',
  'src/core/particles.js', 'src/core/camera.js', 'src/core/draw.js', 'src/core/save.js',
  'src/data/levels.js', 'src/data/story.js',
  'src/game/meta.js', 'src/game/level.js', 'src/game/entities.js', 'src/game/echo.js',
  'src/game/player.js', 'src/game/world.js', 'src/game/dialogue.js',
  'src/game/scenes.js', 'src/game/shop.js', 'src/main.js',
];

function load() {
  const { sandbox, win, listeners } = createSandbox();
  win.__listeners = listeners;
  for (const f of FILES) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    try {
      vm.runInContext(code, sandbox, { filename: f });
    } catch (e) {
      console.error(`LOAD FAIL ${f}: ${e.stack}`);
      process.exit(1);
    }
  }
  return win;
}

module.exports = { load, mockCtx };
