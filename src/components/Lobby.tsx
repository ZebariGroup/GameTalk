import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Dices, Sparkles, ShieldCheck } from 'lucide-react';
import Avatar from 'boring-avatars';
import { generateName } from '@/lib/generateName';

export const AVATAR_VARIANTS = ['beam', 'marble', 'pixel', 'sunset', 'ring', 'bauhaus'] as const;
export const COLOR_PALETTES = [
  { name: 'Neon', colors: ['#34d399', '#38bdf8', '#818cf8', '#c084fc', '#fbbf24'] },
  { name: 'Fire', colors: ['#ef4444', '#f97316', '#f59e0b', '#fbbf24', '#fef08a'] },
  { name: 'Ocean', colors: ['#0ea5e9', '#0284c7', '#0369a1', '#075985', '#082f49'] },
  { name: 'Cyberpunk', colors: ['#fdf000', '#ff003c', '#00e6f6', '#05d9e8', '#01012b'] },
  { name: 'Pastel', colors: ['#fbcfe8', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#f5d0fe'] },
  { name: 'Forest', colors: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e'] },
  { name: 'Monochrome', colors: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#e2e8f0'] }
];

interface LobbyProps {
  onCreateRoom: (maxMembers: number) => void;
  onJoinRoom: (code: string) => void;
  isCreating: boolean;
  username: string;
  setUsername: (name: string) => void;
  avatarVariant: typeof AVATAR_VARIANTS[number];
  setAvatarVariant: (variant: typeof AVATAR_VARIANTS[number]) => void;
  avatarColors: string[];
  setAvatarColors: (colors: string[]) => void;
  isMomMode: boolean;
  setIsMomMode: (isMomMode: boolean) => void;
}

export function Lobby({
  onCreateRoom,
  onJoinRoom,
  isCreating,
  username,
  setUsername,
  avatarVariant,
  setAvatarVariant,
  avatarColors,
  setAvatarColors,
  isMomMode,
  setIsMomMode
}: LobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [maxMembers, setMaxMembers] = useState<number>(3);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      onJoinRoom(joinCode.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-12 flex flex-col items-center">
          <h1 className="sr-only">Minevine - Safe Audio Chat for Kids Gaming</h1>
          <img src="/logo.png" alt="Minevine Logo" className="h-24 md:h-32 mb-4 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" />
          <h2 className="text-slate-400 text-lg font-medium">Fun, safe audio chat for gaming.</h2>
        </div>

        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 space-y-8">
          
          {/* Profile Builder Section */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 text-center space-y-6">
            <div className="flex justify-center relative">
              <motion.div
                key={`${avatarVariant}-${avatarColors.join('')}-${username}`}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              >
                <Avatar
                  size={128}
                  name={username}
                  variant={avatarVariant}
                  colors={avatarColors}
                />
              </motion.div>
              <button 
                onClick={() => {
                  setAvatarVariant(AVATAR_VARIANTS[Math.floor(Math.random() * AVATAR_VARIANTS.length)]);
                  setAvatarColors(COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)].colors);
                }}
                className="absolute -bottom-2 bg-indigo-500 hover:bg-indigo-400 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110"
                title="Randomize Avatar!"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-center gap-3 mb-1">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{username}</span>
                <button 
                  onClick={() => setUsername(generateName())}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                  title="Roll new name"
                >
                  <Dices className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Your Secret Identity</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700">
              <label htmlFor="maxMembers" className="text-sm font-medium text-slate-300">
                Max Kids Allowed:
              </label>
              <select
                id="maxMembers"
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
              >
                <option value={2}>2 Kids</option>
                <option value={3}>3 Kids</option>
                <option value={4}>4 Kids</option>
                <option value={5}>5 Kids</option>
                <option value={6}>6 Kids</option>
              </select>
            </div>

            <button
              onClick={() => onCreateRoom(maxMembers)}
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 text-lg"
            >
              {isCreating ? 'Creating Room...' : 'Create New Room'}
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER ROOM CODE"
                className="flex-grow bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center text-lg tracking-widest font-bold uppercase"
                maxLength={20}
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 px-8 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Join
              </button>
            </form>
          </div>
        </div>
        
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setIsMomMode(!isMomMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isMomMode 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {isMomMode ? 'Mom Mode Active (Observer)' : 'Enable Mom Mode'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
