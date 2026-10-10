/* Procedural audio. There are no sound files in this repository — every note
 * and every effect below is synthesised at runtime through WebAudio, including
 * the reverb (a noise-burst impulse response baked on init).
 */
AL.Audio = (function () {
  var ctx = null, ready = false;
  var master, musicBus, sfxBus, verb, verbSend;
  var muted = false;
  var musicVol = 0.40, sfxVol = 0.55;

  /* ---------------------------------------------------------------- setup */

  function makeImpulse(seconds, decay) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        // noise shaped by an exponential tail; slight stereo decorrelation
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (ch ? 0.92 : 1);
      }
    }
    return buf;
  }

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0.85;

    // Gentle glue so stacked voices never clip.
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 24;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.005;
    comp.release.value = 0.22;

    master.connect(comp);
    comp.connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = musicVol;
    sfxBus   = ctx.createGain(); sfxBus.gain.value   = sfxVol;
    musicBus.connect(master);
    sfxBus.connect(master);

    verb = ctx.createConvolver();
    verb.buffer = makeImpulse(2.6, 2.4);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.9;
    verbSend.connect(verb);
    verb.connect(master);

    ready = true;
  }

  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* ------------------------------------------------------------ primitives */

  /* One synth voice. Everything in the game's audio is built from this and
   * `noise` below. */
  function voice(o) {
    if (!ready || muted) return;
    var t0 = o.t != null ? o.t : now();
    var dur = o.dur || 0.25;
    var vol = o.vol != null ? o.vol : 0.3;
    var bus = o.bus || sfxBus;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);

    var atk = o.atk != null ? o.atk : 0.006;
    var rel = o.rel != null ? o.rel : Math.max(0.04, dur * 0.6);
    var sus = o.sus != null ? o.sus : 0.6;

    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + atk);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * sus), t0 + atk + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dur + rel);

    var out = g;
    if (o.cut) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.q != null ? o.q : 1;
      f.frequency.setValueAtTime(o.cut, t0);
      if (o.cutTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.cutTo), t0 + dur);
      g.connect(f);
      out = f;
    }

    out.connect(bus);
    if (o.verb) {
      var sg = ctx.createGain();
      sg.gain.value = o.verb;
      out.connect(sg);
      sg.connect(verbSend);
    }

    var freq = o.freq || midi(o.note || 69);
    var count = o.detune ? 2 : 1;
    for (var i = 0; i < count; i++) {
      var osc = ctx.createOscillator();
      osc.type = o.type || 'triangle';
      var f0 = freq * (i === 1 ? Math.pow(2, (o.detune || 0) / 1200) : 1);
      osc.frequency.setValueAtTime(f0, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + atk + dur + rel + 0.02);
    }
  }

  var noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function noise(o) {
    if (!ready || muted) return;
    o = o || {};
    var t0 = o.t != null ? o.t : now();
    var dur = o.dur || 0.12;
    var vol = o.vol != null ? o.vol : 0.2;

    var src = ctx.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    src.playbackRate.value = o.rate || 1;

    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.Q.value = o.q != null ? o.q : 1.2;
    f.frequency.setValueAtTime(o.cut || 1200, t0);
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.cutTo), t0 + dur);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    if (o.verb) { var sg = ctx.createGain(); sg.gain.value = o.verb; g.connect(sg); sg.connect(verbSend); }
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ------------------------------------------------------------------ sfx */

  var S = {
    jump: function () {
      voice({ type: 'square', note: 69, slideTo: midi(81), dur: 0.1, vol: 0.10, cut: 2600, atk: 0.003, rel: 0.05 });
      noise({ dur: 0.07, vol: 0.05, cut: 900, cutTo: 2400, filter: 'highpass' });
    },
    land: function (hard) {
      noise({ dur: hard ? 0.16 : 0.09, vol: hard ? 0.16 : 0.07, cut: 420, cutTo: 120, filter: 'lowpass', q: 0.8 });
      if (hard) voice({ type: 'sine', freq: 90, slideTo: 48, dur: 0.14, vol: 0.14 });
    },
    dash: function () {
      noise({ dur: 0.22, vol: 0.14, cut: 2800, cutTo: 320, filter: 'bandpass', q: 1.6, verb: 0.2 });
      voice({ type: 'sawtooth', note: 64, slideTo: midi(52), dur: 0.18, vol: 0.07, cut: 1800, cutTo: 400 });
    },
    recordStart: function () {
      voice({ type: 'sine', note: 76, dur: 0.16, vol: 0.10, verb: 0.5, atk: 0.01 });
      voice({ type: 'sine', note: 83, dur: 0.22, vol: 0.06, verb: 0.6, atk: 0.02 });
    },
    recordTick: function () {
      voice({ type: 'sine', note: 88, dur: 0.03, vol: 0.035, rel: 0.02 });
    },
    echoSpawn: function () {
      // a shimmering minor-ninth stack: the sound of leaving something behind
      [64, 71, 76, 83, 88].forEach(function (n, i) {
        voice({ type: 'triangle', note: n, dur: 0.5 + i * 0.1, vol: 0.075 - i * 0.008,
                t: now() + i * 0.035, verb: 0.75, atk: 0.012, detune: 7 });
      });
    },
    echoClear: function () {
      [83, 76, 71, 64].forEach(function (n, i) {
        voice({ type: 'sine', note: n, dur: 0.22, vol: 0.055, t: now() + i * 0.035, verb: 0.4 });
      });
    },
    shard: function (i) {
      var pent = [69, 72, 74, 76, 79, 81, 84];
      var n = pent[Math.min(pent.length - 1, i || 0)];
      voice({ type: 'triangle', note: n, dur: 0.30, vol: 0.13, verb: 0.6, atk: 0.004, detune: 9 });
      voice({ type: 'sine', note: n + 12, dur: 0.18, vol: 0.07, verb: 0.5 });
    },
    memory: function () {
      [72, 77, 79, 84, 89].forEach(function (n, i) {
        voice({ type: 'sine', note: n, dur: 0.7, vol: 0.07, t: now() + i * 0.07, verb: 0.9, atk: 0.03 });
      });
    },
    die: function () {
      noise({ dur: 0.3, vol: 0.18, cut: 1600, cutTo: 90, filter: 'lowpass', verb: 0.3 });
      voice({ type: 'square', note: 55, slideTo: midi(31), dur: 0.42, vol: 0.12, cut: 900, cutTo: 200 });
    },
    door: function () {
      voice({ type: 'sine', freq: 70, slideTo: 42, dur: 0.5, vol: 0.18, verb: 0.4 });
      noise({ dur: 0.45, vol: 0.09, cut: 300, cutTo: 80, filter: 'lowpass' });
    },
    plate: function (on) {
      voice({ type: 'square', note: on ? 72 : 65, dur: 0.07, vol: 0.09, cut: 2200, rel: 0.04 });
    },
    laser: function () {
      noise({ dur: 0.1, vol: 0.05, cut: 3400, filter: 'highpass' });
    },
    blip: function () {
      voice({ type: 'square', note: 84, dur: 0.018, vol: 0.028, cut: 3000, rel: 0.012 });
    },
    ui: function () {
      voice({ type: 'triangle', note: 79, dur: 0.07, vol: 0.09, verb: 0.2 });
    },
    uiBig: function () {
      voice({ type: 'triangle', note: 72, dur: 0.3, vol: 0.12, verb: 0.6, detune: 8 });
      voice({ type: 'triangle', note: 79, dur: 0.4, vol: 0.09, verb: 0.6, t: now() + 0.06 });
    },
    unlock: function () {
      [60, 64, 67, 72, 76, 79].forEach(function (n, i) {
        voice({ type: 'triangle', note: n, dur: 0.7, vol: 0.09, t: now() + i * 0.09, verb: 0.85, detune: 6 });
      });
    },
    quake: function () {
      noise({ dur: 1.4, vol: 0.2, cut: 160, cutTo: 40, filter: 'lowpass', atk: 0.3, verb: 0.3 });
    },
    heartbeat: function () {
      voice({ type: 'sine', freq: 62, slideTo: 44, dur: 0.22, vol: 0.2, verb: 0.3 });
    }
  };

  function sfx(name, arg) {
    if (!ready || muted) return;
    var f = S[name];
    if (f) { try { f(arg); } catch (e) { /* audio is never fatal */ } }
  }

  /* ---------------------------------------------------------------- music */

  /* Tracks are 16th-note step sequences in A-minor. `0` is a rest.
   * Instruments are named presets applied in `playNote`. */
  var r = 0;
  var TRACKS = {
    title: {
      bpm: 58, steps: 32,
      voices: [
        { inst: 'pad',  vol: 0.30, pat: [45,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 43,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pad',  vol: 0.20, pat: [64,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 65,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'bell', vol: 0.26, pat: [r,r,r,r, 81,r,r,r, r,r,76,r, r,r,r,r, r,r,r,r, 79,r,r,r, r,r,72,r, r,r,r,r] },
        { inst: 'bell', vol: 0.13, pat: [r,r,r,r, r,r,r,r, 88,r,r,r, r,r,r,r, r,r,r,r, r,r,r,r, 84,r,r,r, r,r,r,r] }
      ]
    },
    calm: {
      bpm: 70, steps: 32,
      voices: [
        { inst: 'bass', vol: 0.30, pat: [33,r,r,r, r,r,r,r, 33,r,r,r, r,r,r,r, 36,r,r,r, r,r,r,r, 31,r,r,r, r,r,r,r] },
        { inst: 'pad',  vol: 0.17, pat: [57,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 60,r,r,r,r,r,r,r, 55,r,r,r,r,r,r,r] },
        { inst: 'pluck',vol: 0.17, pat: [69,r,72,r, 76,r,72,r, 69,r,67,r, 64,r,67,r, 72,r,76,r, 79,r,76,r, 67,r,71,r, 74,r,71,r] },
        { inst: 'bell', vol: 0.11, pat: [r,r,r,r, r,r,r,r, r,r,r,r, 88,r,r,r, r,r,r,r, r,r,r,r, r,r,r,r, 86,r,r,r] }
      ]
    },
    deep: {
      bpm: 78, steps: 32,
      voices: [
        { inst: 'bass', vol: 0.32, pat: [31,r,r,r, 31,r,r,r, 38,r,r,r, r,r,r,r, 36,r,r,r, 36,r,r,r, 33,r,r,r, 31,r,r,r] },
        { inst: 'pad',  vol: 0.16, pat: [62,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 60,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pluck',vol: 0.16, pat: [74,r,r,69, r,74,r,r, 77,r,r,72, r,77,r,r, 72,r,r,67, r,72,r,r, 69,r,r,64, r,69,r,r] },
        { inst: 'hat',  vol: 0.06, pat: [r,r,1,r, r,r,1,r, r,r,1,r, r,r,1,r, r,r,1,r, r,r,1,r, r,r,1,r, r,r,1,1] }
      ]
    },
    dark: {
      bpm: 62, steps: 32,
      voices: [
        { inst: 'drone',vol: 0.26, pat: [29,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pad',  vol: 0.15, pat: [56,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 57,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'bell', vol: 0.16, pat: [r,r,r,r, r,r,r,r, 80,r,r,r, r,r,r,r, r,r,r,r, r,r,r,r, 77,r,r,r, r,r,r,r] },
        { inst: 'bell', vol: 0.08, pat: [r,r,r,r, 68,r,r,r, r,r,r,r, r,r,r,r, r,r,r,r, 75,r,r,r, r,r,r,r, r,r,r,r] }
      ]
    },
    choir: {
      bpm: 92, steps: 32,
      voices: [
        { inst: 'bass', vol: 0.30, pat: [33,r,33,r, 33,r,r,33, 31,r,31,r, 31,r,r,31, 36,r,36,r, 36,r,r,36, 38,r,38,r, 38,r,r,38] },
        { inst: 'choir',vol: 0.17, pat: [69,r,r,r,r,r,r,r, 67,r,r,r,r,r,r,r, 72,r,r,r,r,r,r,r, 74,r,r,r,r,r,r,r] },
        { inst: 'pluck',vol: 0.15, pat: [81,76,72,76, 81,84,81,76, 79,76,71,76, 79,83,79,76, 84,79,76,79, 84,88,84,79, 86,81,77,81, 86,89,86,81] },
        { inst: 'hat',  vol: 0.07, pat: [1,r,1,r, 1,r,1,r, 1,r,1,r, 1,r,1,1, 1,r,1,r, 1,r,1,r, 1,r,1,r, 1,1,1,1] }
      ]
    },
    lumen: {
      bpm: 54, steps: 32,
      voices: [
        { inst: 'drone',vol: 0.20, pat: [36,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pad',  vol: 0.22, pat: [60,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 64,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pad',  vol: 0.15, pat: [67,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 72,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'bell', vol: 0.20, pat: [r,r,r,r, r,r,r,r, 84,r,r,r, r,r,79,r, r,r,r,r, r,r,r,r, 88,r,r,r, r,r,84,r] }
      ]
    },
    /* Endings. Same harmonic seed, three different answers. */
    endLight: {
      bpm: 56, steps: 32,
      voices: [
        { inst: 'pad',  vol: 0.24, pat: [41,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 36,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pad',  vol: 0.18, pat: [65,r,r,r,r,r,r,r, 69,r,r,r,r,r,r,r, 72,r,r,r,r,r,r,r, 76,r,r,r,r,r,r,r] },
        { inst: 'bell', vol: 0.19, pat: [89,r,r,r, r,r,84,r, r,r,r,r, 81,r,r,r, 88,r,r,r, r,r,84,r, r,r,r,r, 77,r,r,r] }
      ]
    },
    endDark: {
      bpm: 50, steps: 32,
      voices: [
        { inst: 'drone',vol: 0.22, pat: [29,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'pad',  vol: 0.17, pat: [53,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r, 55,r,r,r,r,r,r,r, r,r,r,r,r,r,r,r] },
        { inst: 'bell', vol: 0.14, pat: [r,r,r,r, r,r,r,r, r,r,r,r, 72,r,r,r, r,r,r,r, r,r,r,r, r,r,r,r, 68,r,r,r] }
      ]
    },
    endFree: {
      bpm: 64, steps: 32,
      voices: [
        { inst: 'bass', vol: 0.26, pat: [36,r,r,r, r,r,r,r, 43,r,r,r, r,r,r,r, 41,r,r,r, r,r,r,r, 38,r,r,r, r,r,r,r] },
        { inst: 'pad',  vol: 0.20, pat: [64,r,r,r,r,r,r,r, 67,r,r,r,r,r,r,r, 72,r,r,r,r,r,r,r, 69,r,r,r,r,r,r,r] },
        { inst: 'pluck',vol: 0.18, pat: [76,r,79,r, 84,r,79,r, 83,r,86,r, 91,r,86,r, 88,r,84,r, 79,r,84,r, 81,r,77,r, 72,r,77,r] },
        { inst: 'bell', vol: 0.12, pat: [r,r,r,r, r,r,r,r, 96,r,r,r, r,r,r,r, r,r,r,r, r,r,r,r, 93,r,r,r, r,r,r,r] }
      ]
    }
  };

  function playNote(inst, note, t, vol) {
    switch (inst) {
      case 'pad':
        voice({ type: 'triangle', note: note, t: t, dur: 1.9, vol: vol, atk: 0.5, rel: 1.3,
                sus: 0.8, cut: 900, detune: 11, verb: 0.9, bus: musicBus });
        voice({ type: 'sine', note: note + 12, t: t, dur: 1.6, vol: vol * 0.4, atk: 0.6, rel: 1.1,
                verb: 0.8, bus: musicBus });
        break;
      case 'drone':
        voice({ type: 'sawtooth', note: note, t: t, dur: 3.6, vol: vol, atk: 0.9, rel: 2.0,
                sus: 0.9, cut: 240, q: 2, detune: 14, verb: 0.6, bus: musicBus });
        break;
      case 'bell':
        voice({ type: 'triangle', note: note, t: t, dur: 0.9, vol: vol, atk: 0.004, rel: 0.9,
                sus: 0.22, detune: 6, verb: 0.95, bus: musicBus });
        voice({ type: 'sine', note: note + 19, t: t, dur: 0.5, vol: vol * 0.22, atk: 0.003,
                rel: 0.4, verb: 0.9, bus: musicBus });
        break;
      case 'pluck':
        voice({ type: 'square', note: note, t: t, dur: 0.22, vol: vol * 0.7, atk: 0.003, rel: 0.2,
                sus: 0.25, cut: 3000, cutTo: 700, verb: 0.45, bus: musicBus });
        break;
      case 'bass':
        voice({ type: 'triangle', note: note, t: t, dur: 0.5, vol: vol, atk: 0.01, rel: 0.3,
                sus: 0.5, cut: 420, verb: 0.15, bus: musicBus });
        voice({ type: 'sine', note: note - 12, t: t, dur: 0.5, vol: vol * 0.6, atk: 0.01,
                rel: 0.3, bus: musicBus });
        break;
      case 'choir':
        voice({ type: 'sawtooth', note: note, t: t, dur: 1.5, vol: vol * 0.6, atk: 0.35, rel: 0.9,
                sus: 0.8, cut: 1100, q: 1.4, detune: 16, verb: 0.9, bus: musicBus });
        break;
      case 'hat':
        noise({ t: t, dur: 0.045, vol: vol, cut: 7000, filter: 'highpass', bus: musicBus, verb: 0.2 });
        break;
    }
  }

  var M = {
    name: null, track: null, step: 0, nextT: 0, stepDur: 0.2,
    fade: 1, target: 1, pending: null
  };

  function play(name) {
    if (!ready) { M.pending = name; return; }
    if (M.name === name) return;
    if (M.name) { M.target = 0; M.pending = name; return; }  // crossfade out first
    start(name);
  }

  function start(name) {
    var t = TRACKS[name];
    if (!t) return;
    M.name = name; M.track = t; M.step = 0;
    M.stepDur = 60 / t.bpm / 4;
    M.nextT = now() + 0.08;
    M.fade = 0; M.target = 1; M.pending = null;
  }

  function stop() { M.target = 0; M.pending = null; }

  function scheduleStep(stepIndex, t) {
    var vs = M.track.voices;
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      var pat = v.pat;
      var n = pat[stepIndex % pat.length];
      if (!n) continue;
      playNote(v.inst, n, t, v.vol * M.fade);
    }
  }

  // Called every frame; schedules a short way ahead of the audio clock.
  function update(dt) {
    if (!ready) return;
    M.fade = AL.U.approach(M.fade, M.target, dt * 0.9);
    if (M.target === 0 && M.fade <= 0.001) {
      M.name = null; M.track = null;
      if (M.pending) start(M.pending);
      return;
    }
    if (!M.track) { if (M.pending) start(M.pending); return; }

    var lookahead = 0.25;
    var guard = 0;
    while (M.nextT < now() + lookahead && guard++ < 64) {
      scheduleStep(M.step, M.nextT);
      M.step = (M.step + 1) % M.track.steps;
      M.nextT += M.stepDur;
    }
    // If the tab was backgrounded the audio clock ran on without us.
    if (M.nextT < now()) M.nextT = now() + 0.05;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.85;
  }

  return {
    init: init, resume: resume, sfx: sfx, music: play, stopMusic: stop,
    update: update, isMuted: function () { return muted; }, setMuted: setMuted,
    toggleMute: function () { setMuted(!muted); return muted; },
    isReady: function () { return ready; }
  };
})();
