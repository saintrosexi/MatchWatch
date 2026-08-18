// MatchWatch — Web Audio API Procedural SFX Synthesizer

let audioCtx = null;
let soundEnabled = true;

// Auto-unlock AudioContext on first user interaction anywhere in the window
const unlockAudio = () => {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
  window.addEventListener('click', unlockAudio, { once: true });
}

const getAudioContext = () => {
  unlockAudio();
  return audioCtx;
};

export const setSoundEnabled = (enabled) => {
  soundEnabled = enabled;
  try {
    localStorage.setItem('mw_sound_enabled', JSON.stringify(enabled));
  } catch (e) {}
};

export const getSoundEnabled = () => {
  try {
    const stored = localStorage.getItem('mw_sound_enabled');
    if (stored !== null) return JSON.parse(stored);
  } catch (e) {}
  return true;
};

export const playSound = (type) => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  switch (type) {
    case 'swipe_pass': {
      // Crisp subtle downward whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }

    case 'swipe_like': {
      // Warm resonant velvet chord chime (sunset harmony)
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.03);
        gain.gain.setValueAtTime(0.25, now + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.03);
        osc.stop(now + 0.38 + i * 0.03);
      });
      break;
    }

    case 'superlike': {
      // Celestial bright golden bell chime
      [659.25, 830.61, 987.77, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.28, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 + i * 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + 0.48 + i * 0.04);
      });
      break;
    }

    case 'match_celebration': {
      // Epic triumphant cinema brass fanfare
      const notes = [
        { f: 523.25, t: 0, d: 0.18 },
        { f: 659.25, t: 0.14, d: 0.18 },
        { f: 783.99, t: 0.28, d: 0.22 },
        { f: 1046.5, t: 0.46, d: 0.7 },
        { f: 1318.51, t: 0.46, d: 0.7 }
      ];
      notes.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.35, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + d + 0.05);
      });
      break;
    }

    case 'wheel_tick': {
      // Mechanical crisp tick for fortune roulette
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
      break;
    }

    case 'tap':
    default: {
      // Clear tactile pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      break;
    }
  }
};
