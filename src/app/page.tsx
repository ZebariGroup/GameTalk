'use client';

import { useState, useEffect } from 'react';
import { generateRoomCode } from '@/lib/generateCode';
import { generateName } from '@/lib/generateName';
import { useAudioChat, UserRole } from '@/hooks/useAudioChat';
import { supabase } from '@/lib/supabase';
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
    
    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    let code: string | null = null;
    let dbError: { code?: string } | null = null;

    // Two-word codes have fewer combinations than the previous format.
    // Retry on primary-key collisions to keep room creation reliable.
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRoomCode();
      const { error } = await supabase.from('rooms').insert([
        { code: candidate, max_members: maxMembers, expires_at: expiresAt.toISOString() }
      ]);

      if (!error) {
        code = candidate;
        dbError = null;
        break;
      }

      dbError = error;
      if (error.code !== '23505') {
        break;
      }
    }

    setIsCreating(false);

    if (dbError || !code) {
      setError("Failed to create room. Please try again.");
      console.error(dbError);
      return;
    }

    setRoomCode(code);
  };

  const handleJoinRoom = (code: string) => {
    setRoomCode(code);
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 font-bold flex items-center gap-2">
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
