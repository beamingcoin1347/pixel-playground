// Tiny Web Audio sound effects - no audio libraries, no asset files. The context is created
// lazily on the first real interaction so browsers don't block it.

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('pp-muted') === '1';
} catch {
  /* private mode - default to unmuted */
}

const listeners = new Set();

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  try {
    localStorage.setItem('pp-muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn(muted);
}

export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function tone({ freq = 440, dur = 0.08, type = 'square', gain = 0.04, delay = 0 }) {
  if (muted) return;
  const c = context();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  } catch {
    /* audio is a nicety, never a failure */
  }
}

export const sfx = {
  click: () => tone({ freq: 520, dur: 0.05 }),
  place: () => tone({ freq: 700, dur: 0.06 }),
  good: () => tone({ freq: 880, dur: 0.07 }),
  bad: () => tone({ freq: 160, dur: 0.14, type: 'sawtooth' }),
  win: () => {
    tone({ freq: 660, dur: 0.09 });
    tone({ freq: 880, dur: 0.09, delay: 0.1 });
    tone({ freq: 1180, dur: 0.14, delay: 0.2 });
  },
  lose: () => {
    tone({ freq: 300, dur: 0.12, type: 'triangle' });
    tone({ freq: 180, dur: 0.2, type: 'triangle', delay: 0.13 });
  },
  tick: () => tone({ freq: 1200, dur: 0.02, gain: 0.02 }),
};
