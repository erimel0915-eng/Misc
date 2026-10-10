/* Bootstrap, integer-scaled presentation, and the fixed-timestep loop.
 *
 * The simulation always advances in exact 1/60 steps. That is not just for
 * stable physics: Echo replay is a frame buffer, so a variable timestep would
 * make every loop drift. Fixed steps keep a recorded Echo bit-exact forever.
 */
AL.Game = (function () {
  var canvas, g;
  var scene = null, nextScene = null;
  var acc = 0, last = 0, running = false;
  var started = false;

  function fit() {
    var pad = 24;
    // Measure the page chrome rather than assuming it: this same code runs
    // under a one-line hint and under a two-line legend.
    var chrome = 20;
    var legend = document.getElementById('legend') || document.getElementById('hint');
    if (legend && legend.offsetHeight) chrome = legend.offsetHeight + 18;
    var availW = Math.max(160, window.innerWidth - pad);
    var availH = Math.max(120, window.innerHeight - pad - chrome);
    var scale = Math.min(availW / AL.W, availH / AL.H);
    // prefer crisp integer scaling, but never shrink below fitting the window
    var s = scale >= 1 ? Math.max(1, Math.floor(scale)) : scale;
    if (scale >= 1 && (AL.W * (s + 1) <= availW) && (AL.H * (s + 1) <= availH)) s += 1;
    var w = Math.round(AL.W * s), h = Math.round(AL.H * s);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var crt = document.getElementById('crt');
    if (crt) { crt.style.width = w + 'px'; crt.style.height = h + 'px'; }
  }

  function setScene(s) { nextScene = s; }

  function startPlay(room) { setScene(new AL.Scenes.Play(room)); }

  function applyScene() {
    if (!nextScene) return;
    scene = nextScene;
    nextScene = null;
    AL.Particles.clear();
    AL.FX.reset();
    AL.Input.clearBuffer();
    if (AL.Dialogue.active) AL.Dialogue.forceClose();
    if (scene.enter) scene.enter();
  }

  function step(dt) {
    AL.Input.update();
    if (!AL.FX.frozen()) {
      if (scene && scene.update) scene.update(dt);
    } else {
      AL.Particles.update(dt);
    }
    AL.FX.update(dt);
    AL.Input.lateUpdate();
    applyScene();
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    // A long stall (tab switch) must not fast-forward the simulation.
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    var steps = 0;
    while (acc >= AL.DT && steps < 5) {
      step(AL.DT);
      acc -= AL.DT;
      steps++;
    }
    if (steps === 5) acc = 0;

    AL.Audio.update(dt);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, AL.W, AL.H);
    if (scene && scene.draw) scene.draw(g);
  }

  function hotkeys(e) {
    if (e.code === 'KeyM') {
      var m = AL.Audio.toggleMute();
      var s = AL.Save.get(); s.muted = m; AL.Save.put();
      AL.Audio.sfx('ui');
    } else if (e.code === 'KeyF') {
      var el = document.documentElement;
      if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    } else if (e.code === 'KeyV') {
      var crt = document.getElementById('crt');
      if (crt) crt.classList.toggle('off');
      var s2 = AL.Save.get(); s2.crt = !(crt && crt.classList.contains('off')); AL.Save.put();
    }
  }

  function begin() {
    if (started) return;
    started = true;
    var boot = document.getElementById('boot');
    if (boot) boot.parentNode.removeChild(boot);
    AL.Audio.init();
    AL.Audio.resume();
    var save = AL.Save.get();
    if (save.muted) AL.Audio.setMuted(true);
    if (save.crt === false) {
      var crt = document.getElementById('crt');
      if (crt) crt.classList.add('off');
    }
    setScene(new AL.Scenes.Title());
    applyScene();
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  function init() {
    canvas = document.getElementById('game');
    g = canvas.getContext('2d', { alpha: false });
    g.imageSmoothingEnabled = false;
    g.textBaseline = 'top';

    AL.Input.init();
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('keydown', hotkeys);

    var boot = document.getElementById('boot');
    var go = function (e) { if (e) e.preventDefault(); begin(); };
    if (boot) {
      boot.addEventListener('click', go);
      boot.addEventListener('touchstart', go, { passive: false });
    }
    // any key also starts it
    window.addEventListener('keydown', function (e) {
      if (!started && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ')) go(e);
    });

    // keep the audio clock alive across tab switches
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) AL.Audio.resume();
    });

    // paint one frame of the canvas underneath the boot overlay
    g.fillStyle = AL.C.void0;
    g.fillRect(0, 0, AL.W, AL.H);
  }

  return { init: init, setScene: setScene, startPlay: startPlay, begin: begin,
           get scene() { return scene; } };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { AL.Game.init(); });
} else {
  AL.Game.init();
}
