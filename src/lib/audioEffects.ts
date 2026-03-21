export type VoiceEffect = 'none' | 'robot' | 'cave' | 'radio';

let audioCtx: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

export function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function applyVoiceEffect(stream: MediaStream, effect: VoiceEffect): MediaStream {
  const ctx = getAudioContext();
  
  if (!sourceNode || sourceNode.mediaStream !== stream) {
    sourceNode = ctx.createMediaStreamSource(stream);
  }
  
  const destination = ctx.createMediaStreamDestination();
  
  // Disconnect previous routing
  sourceNode.disconnect();

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
  }

  return destination.stream;
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

export function playSound(soundId: string) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  
  if (soundId === 'laser') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (soundId === 'magic') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554, now + 0.1);
    osc.frequency.setValueAtTime(659, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (soundId === 'buzzer') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (soundId === 'jump') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}
