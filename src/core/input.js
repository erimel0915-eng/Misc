/* Input: keyboard + gamepad, exposed as a tiny intent layer.
 * Buffered presses (`pressed`) are consumed by the game loop each fixed step so
 * a tap can never be eaten by a slow frame.
 */
AL.Input = (function () {
  var MAP = {
    left:   ['ArrowLeft', 'KeyA'],
    right:  ['ArrowRight', 'KeyD'],
    up:     ['ArrowUp', 'KeyW'],
    down:   ['ArrowDown', 'KeyS'],
    jump:   ['KeyZ', 'Space', 'KeyJ'],
    echo:   ['KeyX', 'KeyK', 'ShiftLeft', 'ShiftRight'],
    dash:   ['KeyC', 'KeyL'],
    clear:  ['KeyQ'],
    reset:  ['KeyR'],
    pause:  ['Escape', 'KeyP'],
    accept: ['KeyZ', 'Space', 'Enter', 'KeyJ'],
    back:   ['KeyX', 'Backspace', 'KeyK']
  };

  var down = {};        // raw key state by code
  var held = {};        // action -> bool
  var pressedBuf = {};  // action -> frames of unconsumed press
  var anyKeyFlag = false;
  var pads = { ax: 0, ay: 0, btn: {} };

  function actionsFor(code) {
    var out = [];
    for (var a in MAP) if (MAP[a].indexOf(code) >= 0) out.push(a);
    return out;
  }

  function onKey(e, isDown) {
    var code = e.code;
    // Let the browser keep its own shortcuts, but stop the page scrolling.
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(code) >= 0) e.preventDefault();
    if (isDown && e.repeat) return;
    if (down[code] === isDown) return;
    down[code] = isDown;
    var acts = actionsFor(code);
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (isDown) { pressedBuf[a] = 4; anyKeyFlag = true; }
    }
  }

  function init() {
    window.addEventListener('keydown', function (e) { onKey(e, true); }, { passive: false });
    window.addEventListener('keyup',   function (e) { onKey(e, false); }, { passive: false });
    window.addEventListener('blur', function () { down = {}; held = {}; });
  }

  function pollPad() {
    if (!navigator.getGamepads) return;
    var gp = navigator.getGamepads()[0];
    if (!gp) { pads.ax = 0; pads.ay = 0; pads.btn = {}; return; }
    var dz = 0.35;
    pads.ax = Math.abs(gp.axes[0] || 0) > dz ? gp.axes[0] : 0;
    pads.ay = Math.abs(gp.axes[1] || 0) > dz ? gp.axes[1] : 0;
    var b = gp.buttons;
    function pressed(i) { return b[i] && b[i].pressed; }
    var next = {
      jump:  pressed(0),
      echo:  pressed(2) || pressed(5) || pressed(7),
      dash:  pressed(1) || pressed(4) || pressed(6),
      pause: pressed(9),
      clear: pressed(3),
      left:  pressed(14) || pads.ax < -dz,
      right: pressed(15) || pads.ax > dz,
      up:    pressed(12) || pads.ay < -dz,
      down:  pressed(13) || pads.ay > dz
    };
    next.accept = next.jump;
    next.back = next.dash;
    for (var k in next) {
      if (next[k] && !pads.btn[k]) { pressedBuf[k] = 4; anyKeyFlag = true; }
    }
    pads.btn = next;
  }

  // Called once per fixed update, before game logic.
  function update() {
    pollPad();
    for (var a in MAP) {
      var isHeld = false;
      var codes = MAP[a];
      for (var i = 0; i < codes.length; i++) if (down[codes[i]]) { isHeld = true; break; }
      if (pads.btn[a]) isHeld = true;
      held[a] = isHeld;
    }
  }

  // Called after game logic — clears one frame of press buffer.
  function lateUpdate() {
    for (var a in pressedBuf) if (pressedBuf[a] > 0) pressedBuf[a]--;
    anyKeyFlag = false;
  }

  return {
    init: init, update: update, lateUpdate: lateUpdate,
    held:    function (a) { return !!held[a]; },
    pressed: function (a) { return (pressedBuf[a] | 0) > 0; },
    consume: function (a) { var v = (pressedBuf[a] | 0) > 0; pressedBuf[a] = 0; return v; },
    anyKey:  function () { return anyKeyFlag; },
    // horizontal intent, -1..1
    xAxis: function () { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    yAxis: function () { return (held.down ? 1 : 0) - (held.up ? 1 : 0); },
    clearBuffer: function () { pressedBuf = {}; }
  };
})();
