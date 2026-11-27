// Procedural sound only — WebAudio oscillators and filtered noise, no audio
// files. Engine hum follows throttle, wind follows speed, with a chime for
// rings and a thud for landings. Starts on the first user gesture.
export function createAudio() {
  let ctx = null; let engine = null; let engineGain = null; let wind = null; let windGain = null;
  let muted = false; let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth'; engine.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engine.connect(engineGain).connect(ctx.destination);
      engine.start();
      const len = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      wind = ctx.createBufferSource();
      wind.buffer = buffer; wind.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 500;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      wind.connect(filter).connect(windGain).connect(ctx.destination);
      wind.start();
    } catch { ctx = null; }
  }
  function beep(freq, dur = 0.18, type = 'sine', vol = 0.25) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    ensure,
    update(throttle, speed, airborne) {
      if (!ctx || muted) return;
      if (ctx.state === 'suspended') ctx.resume();
      engine.frequency.value = 45 + throttle * 70 + speed * 0.4;
      engineGain.gain.value = airborne ? 0.05 + throttle * 0.05 : 0.03 + throttle * 0.04;
      windGain.gain.value = airborne ? Math.min(0.12, speed * 0.0016) : 0;
    },
    ring() { beep(880, 0.25); setTimeout(() => beep(1320, 0.3), 90); },
    land() { beep(220, 0.3, 'triangle', 0.4); },
    crash() { beep(90, 0.6, 'sawtooth', 0.4); },
    click() { beep(660, 0.08, 'square', 0.12); },
    toggleMute() {
      muted = !muted;
      if (ctx) { if (engineGain) engineGain.gain.value = 0; if (windGain) windGain.gain.value = 0; }
      return muted;
    },
    get muted() { return muted; },
  };
}
