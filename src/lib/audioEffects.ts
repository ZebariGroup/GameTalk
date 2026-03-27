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
  } else if (soundId === 'fart') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    
    // Add some noise/wobble
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 50;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.3);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (soundId === 'applause') {
    // White noise for applause
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Filter the noise to sound more like clapping
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;
    
    noise.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.3, now + 1.5);
    gain.gain.linearRampToValueAtTime(0, now + 2);
    
    noise.start(now);
    noise.stop(now + 2);
  } else if (soundId === 'trombone') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.4);
    osc.frequency.setValueAtTime(280, now + 0.4);
    osc.frequency.linearRampToValueAtTime(250, now + 0.8);
    osc.frequency.setValueAtTime(250, now + 0.8);
    osc.frequency.linearRampToValueAtTime(200, now + 1.5);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + 1.2);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.5);
    
    osc.start(now);
    osc.stop(now + 1.5);
  } else if (soundId === 'mc_break') {
    // Minecraft block break sound simulation
    const bufferSize = ctx.sampleRate * 0.2; // short sound
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    noise.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    noise.start(now);
  } else if (soundId === 'fn_shield') {
    // Fortnite shield pop simulation
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (soundId === 'mario_coin') {
    // Mario coin ring simulation
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.1); // E6
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (soundId === 'roblox_oof') {
    // Roblox OOF simulation (vocal-ish synth)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    osc.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }
}
