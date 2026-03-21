'use client';

import { useEffect, useRef } from 'react';

export function AudioPlayer({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay muted={muted} playsInline />;
}
