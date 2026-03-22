'use client';

import { useEffect, useRef, useState } from 'react';

export function AudioPlayer({ stream, muted = false, volume = 1 }: { stream: MediaStream; muted?: boolean; volume?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;

    // Set up audio context for volume analysis
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    
    // Resume context if suspended (browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = 256;
    
    sourceRef.current = ctx.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkVolume = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Threshold for speaking
      setIsSpeaking(average > 10);
      
      animationFrameRef.current = requestAnimationFrame(checkVolume);
    };

    checkVolume();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    };
  }, [stream]);

  return (
    <>
      <audio ref={audioRef} autoPlay muted={muted} playsInline />
      {isSpeaking && (
        <div className="absolute -inset-2 rounded-full border-4 border-emerald-400 animate-pulse pointer-events-none" />
      )}
    </>
  );
}
