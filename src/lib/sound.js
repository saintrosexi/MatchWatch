/**
 * Звук на Web Audio API — без файлов, всё синтезируется.
 *
 * Причина: свайп-лента должна откликаться мгновенно, а загрузка семплов
 * на мобильном интернете это ломает. Плюс ноль веса в бандле.
 */

let ctx = null;
let enabled = true;
let master = null;

export const setSoundEnabled = (value) => { enabled = Boolean(value); };
export const isSoundEnabled = () => enabled;

function audio() {
  if (!enabled) return null;
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

/** Браузеры запускают звук только после жеста — вызываем на первом тапе. */
export function unlockAudio() {
  const c = audio();
  if (c?.state === 'suspended') c.resume().catch(() => {});
}

function tone({ freq, duration = 0.12, type = 'sine', gain = 1, delay = 0, sweepTo = null }) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  like: () => tone({ freq: 520, sweepTo: 780, duration: 0.14, type: 'triangle', gain: 0.5 }),
  pass: () => tone({ freq: 220, sweepTo: 150, duration: 0.12, type: 'sine', gain: 0.34 }),
  favorite: () => {
    tone({ freq: 660, duration: 0.1, type: 'triangle', gain: 0.42 });
    tone({ freq: 990, duration: 0.14, type: 'triangle', gain: 0.34, delay: 0.07 });
  },
  /** Фанфара мэтча — мажорное трезвучие с восходящим хвостом. */
  match: () => {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      tone({ freq, duration: 0.32, type: 'triangle', gain: 0.44, delay: i * 0.075 });
    });
    tone({ freq: 1046.5, duration: 0.5, type: 'sine', gain: 0.34, delay: 0.26 });
  },
  tick: () => tone({ freq: 1200, duration: 0.03, type: 'square', gain: 0.14 }),
  reel: () => tone({ freq: 340, sweepTo: 180, duration: 0.06, type: 'sawtooth', gain: 0.16 }),
  error: () => {
    tone({ freq: 190, duration: 0.13, type: 'square', gain: 0.24 });
    tone({ freq: 140, duration: 0.18, type: 'square', gain: 0.2, delay: 0.1 });
  },
  join: () => {
    tone({ freq: 440, duration: 0.12, type: 'sine', gain: 0.32 });
    tone({ freq: 660, duration: 0.16, type: 'sine', gain: 0.28, delay: 0.09 });
  },
};
