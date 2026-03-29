import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Sparkles, ShieldCheck } from 'lucide-react';
import Avatar from 'boring-avatars';
import { generateName } from '@/lib/generateName';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';

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
    <div className="min-h-[100dvh] w-full max-w-md mx-auto bg-slate-900 text-white flex flex-col items-center justify-center px-3 py-4 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] box-border">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full"
      >
        <div className="text-center mb-6 sm:mb-10 md:mb-12 flex flex-col items-center">
          <h1 className="sr-only">Minevine - Safe Audio Chat for Kids Gaming</h1>
          <img src="/logo.png" alt="Minevine Logo" className="h-20 sm:h-24 md:h-32 mb-3 sm:mb-4 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" />
          <h2 className="text-slate-400 text-base sm:text-lg font-medium px-2">Fun, safe audio chat for gaming.</h2>
        </div>

        <div className="bg-slate-800 p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700 space-y-6 sm:space-y-8">
          
          {/* Profile Builder Section */}
          <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-700 text-center space-y-4 sm:space-y-6">
            <div className="flex justify-center relative">
              <motion.div
                key={`${avatarVariant}-${avatarColors.join('')}-${username}`}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              >
                <Avatar
                  size={128}
                  name={username}
                  variant={avatarVariant}
                  colors={avatarColors}
                />
              </motion.div>
              <button 
                type="button"
                onClick={() => {
                  setAvatarVariant(AVATAR_VARIANTS[Math.floor(Math.random() * AVATAR_VARIANTS.length)]);
                  setAvatarColors(COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)].colors);
                }}
                className="absolute -bottom-1 sm:-bottom-2 bg-indigo-500 active:bg-indigo-400 text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
                title="Randomize Avatar!"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-1 px-1">
                <span className="text-2xl sm:text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 break-words max-w-full">{username}</span>
                <button 
                  type="button"
                  onClick={() => setUsername(generateName())}
                  className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center bg-slate-800 active:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                  title="Roll new name"
                >
                  <Dices className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Your Secret Identity</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-900 p-3 rounded-xl border border-slate-700">
              <label htmlFor="maxMembers" className="text-sm font-medium text-slate-300">
                Max Kids Allowed:
              </label>
              <select
                id="maxMembers"
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full sm:w-auto min-h-[44px] bg-slate-800 border border-slate-600 text-white text-base rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2"
              >
                <option value={2}>2 Kids</option>
                <option value={3}>3 Kids</option>
                <option value={4}>4 Kids</option>
                <option value={5}>5 Kids</option>
                <option value={6}>6 Kids</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => onCreateRoom(maxMembers)}
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 active:from-indigo-400 active:to-purple-400 text-white font-bold min-h-[52px] py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-500/30 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 text-base sm:text-lg"
            >
              {isCreating ? 'Creating Room...' : 'Create New Room'}
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 sm:py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center text-base sm:text-lg tracking-wide font-bold"
                maxLength={32}
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="shrink-0 bg-slate-700 active:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold min-h-[48px] sm:min-h-0 py-3.5 sm:py-4 px-6 sm:px-8 rounded-2xl transition-transform active:scale-[0.98] sm:w-auto w-full"
              >
                Join
              </button>
            </form>
          </div>
        </div>
        
        <PwaInstallPrompt />

        <div className="mt-6 sm:mt-8 flex justify-center px-1">
          <button
            type="button"
            onClick={() => setIsMomMode(!isMomMode)}
            className={`flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-colors w-full sm:w-auto ${
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
