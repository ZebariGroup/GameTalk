export type VoiceEffect = 'none' | 'robot' | 'cave' | 'radio' | 'chipmunk' | 'monster' | 'alien';

let audioCtx: AudioContext | null = null;

export function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

export function applyVoiceEffect(stream: MediaStream, effect: VoiceEffect): { stream: MediaStream, cleanup: () => void } {
  const ctx = getAudioContext();
  
  const sourceNode = ctx.createMediaStreamSource(stream);
  const destination = ctx.createMediaStreamDestination();
  
  const cleanupFns: (() => void)[] = [];
  
  const cleanup = () => {
    sourceNode.disconnect();
    cleanupFns.forEach(fn => fn());
  };

  if (effect === 'none') {
    sourceNode.connect(destination);
  } else if (effect === 'robot') {
    const waveShaper = ctx.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(50);
    sourceNode.connect(waveShaper);
    waveShaper.connect(destination);
  } else if (effect === 'cave') {
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.4;
    
    delay.connect(feedback);
    feedback.connect(delay);
    
    sourceNode.connect(delay);
    delay.connect(destination);
    sourceNode.connect(destination); // Dry mix
  } else if (effect === 'radio') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 2.0;
    sourceNode.connect(filter);
    filter.connect(destination);
  } else if (effect === 'chipmunk') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    
    const waveShaper = ctx.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(10);
    
    sourceNode.connect(filter);
    filter.connect(waveShaper);
    waveShaper.connect(destination);
  } else if (effect === 'monster') {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    const waveShaper = ctx.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(80);
    
    sourceNode.connect(filter);
    filter.connect(waveShaper);
    waveShaper.connect(destination);
  } else if (effect === 'alien') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 50;
    
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    
    osc.connect(gainNode.gain);
    osc.start();
    
    cleanupFns.push(() => osc.stop());
    
    sourceNode.connect(gainNode);
    gainNode.connect(destination);
    
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.5;
    sourceNode.connect(dryGain);
    dryGain.connect(destination);
  }

  return { stream: destination.stream, cleanup };
}

function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/** Short buzzer when a user is timed out (moderation). */
export function playTimeoutBuzzer() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, now);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
  osc.start(now);
  osc.stop(now + 0.5);
}
