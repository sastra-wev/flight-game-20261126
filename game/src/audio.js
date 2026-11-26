// Every sound in Kestrel Isles is synthesised in WebAudio at the moment it is
// needed: a two-oscillator engine note that follows the throttle, wind noise
// that follows the airspeed, and little one-shot voices for gates, warnings
// and endings. No audio files exist, so nothing can fail to load. The context
// wakes on the first key or click, as browsers require.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function wake() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();

    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = context.createOscillator();
    engineSub.type = 'sine';
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    engineSub.start();

    const noise = context.createBufferSource();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    noise.start();
  }

  function tone(freq, at, dur, type, gain, glideTo) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime + at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, context.currentTime + at + dur);
    amp.gain.setValueAtTime(0, context.currentTime + at);
    amp.gain.linearRampToValueAtTime(gain, context.currentTime + at + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at + dur);
    osc.connect(amp);
    amp.connect(context.destination);
    osc.start(context.currentTime + at);
    osc.stop(context.currentTime + at + dur + 0.05);
  }

  return {
    wake,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
    /** Called every frame with the plane's state so the engine and wind track it. */
    update(plane, flying) {
      if (!context || muted) return;
      const rpm = 0.25 + plane.throttle * 0.75 + plane.speed * 0.002;
      engineOsc.frequency.value = 52 * rpm * 2;
      engineSub.frequency.value = 52 * rpm;
      engineGain.gain.value = flying ? 0.028 + plane.throttle * 0.05 : 0.012;
      windGain.gain.value = Math.min(0.11, Math.max(0, (plane.speed - 14) * 0.0022));
      windFilter.frequency.value = 320 + plane.speed * 9;
    },
    gateChime() {
      tone(880, 0, 0.16, 'sine', 0.16);
      tone(1318, 0.09, 0.24, 'sine', 0.14);
    },
    stallWarning() {
      tone(196, 0, 0.14, 'square', 0.05);
    },
    touchdown(quality) {
      if (quality === 'greased' || quality === 'firm') {
        tone(392, 0, 0.14, 'triangle', 0.14);
        tone(523, 0.1, 0.2, 'triangle', 0.12);
      } else {
        tone(90, 0, 0.3, 'sawtooth', 0.2, 45);
      }
    },
    crash() {
      tone(70, 0, 0.7, 'sawtooth', 0.3, 30);
      tone(48, 0.05, 0.9, 'square', 0.2, 24);
    },
    fanfare() {
      tone(523, 0, 0.16, 'triangle', 0.15);
      tone(659, 0.14, 0.16, 'triangle', 0.15);
      tone(784, 0.28, 0.3, 'triangle', 0.16);
    },
  };
}
