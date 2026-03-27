'use client';

import { useState, useEffect } from 'react';
import { generateName } from '@/lib/generateName';
import { useAudioChat, UserRole } from '@/hooks/useAudioChat';
import { Lobby, AVATAR_VARIANTS, COLOR_PALETTES } from '@/components/Lobby';
import { RoomView } from '@/components/RoomView';

export default function Home() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [isMomMode, setIsMomMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [avatarVariant, setAvatarVariant] = useState<typeof AVATAR_VARIANTS[number]>('beam');
  const [avatarColors, setAvatarColors] = useState<string[]>(COLOR_PALETTES[0].colors);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(generateName());
  }, []);

  const role: UserRole = isMomMode ? 'observer' : 'kid';

  const audioChat = useAudioChat(roomCode, username, role, avatarVariant, avatarColors);

  const handleCreateRoom = async (maxMembers: number) => {
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMembers }),
      });
      if (!res.ok) {
        setError('Failed to create room. Please try again.');
        return;
      }
      const data = (await res.json()) as { code: string };
      setRoomCode(data.code);
    } catch (e) {
      console.error(e);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/rooms/lookup?code=${encodeURIComponent(code)}`);
      if (res.status === 404) {
        setError('Invalid room code.');
        return;
      }
      if (res.status === 410) {
        setError('This room has expired. Please create a new one.');
        return;
      }
      if (!res.ok) {
        setError('Could not verify room. Please try again.');
        return;
      }
      const data = (await res.json()) as { code: string };
      setRoomCode(data.code);
    } catch (e) {
      console.error(e);
      setError('Could not verify room. Please try again.');
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
    setIsMomMode(false);
  };

  if (roomCode) {
    return (
      <RoomView
        roomCode={roomCode}
        username={username}
        role={role}
        avatarVariant={avatarVariant}
        avatarColors={avatarColors}
        onLeaveRoom={handleLeaveRoom}
        {...audioChat}
      />
    );
  }

  return (
    <div className="relative">
      {error && (
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 max-w-[calc(100vw-2rem)] bg-red-500 text-white px-4 sm:px-6 py-3 rounded-xl shadow-lg z-50 font-bold flex flex-wrap items-center justify-center gap-2 text-sm sm:text-base">
          <span>⚠️</span> {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-200 hover:text-white">✕</button>
        </div>
      )}
      <Lobby
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        isCreating={isCreating}
        username={username}
        setUsername={setUsername}
        avatarVariant={avatarVariant}
        setAvatarVariant={setAvatarVariant}
        avatarColors={avatarColors}
        setAvatarColors={setAvatarColors}
        isMomMode={isMomMode}
        setIsMomMode={setIsMomMode}
      />
    </div>
  );
}
