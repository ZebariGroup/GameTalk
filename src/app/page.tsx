'use client';

import { useState } from 'react';
import { generateRoomCode } from '@/lib/generateCode';
import { useAudioChat } from '@/hooks/useAudioChat';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Mic, MicOff, PhoneOff, Users, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const { peers, isMuted, toggleMute, error, isConnected } = useAudioChat(roomCode);

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    setRoomCode(code);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      setRoomCode(joinCode.trim());
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
    setJoinCode('');
  };

  const copyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (roomCode) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-700"
        >
          <h2 className="text-2xl font-bold mb-2 text-slate-300">Room Code</h2>
          <div 
            onClick={copyCode}
            className="bg-slate-900 p-4 rounded-xl text-3xl font-black text-emerald-400 mb-6 cursor-pointer hover:bg-slate-950 transition-colors flex items-center justify-center gap-3 group"
          >
            {roomCode}
            {copied ? <Check className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />}
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mb-8 text-slate-400">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4 text-slate-300">
              <Users className="w-5 h-5" />
              <span className="font-medium">Kids in Chat: {Object.keys(peers).length + 1}</span>
            </div>
            
            <div className="flex justify-center gap-4 flex-wrap">
              {/* Local User */}
              <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-xl font-bold shadow-lg border-2 border-indigo-400 relative">
                Me
                {isMuted && (
                  <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border-2 border-slate-900">
                    <MicOff className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              
              {/* Remote Peers */}
              {Object.entries(peers).map(([id, stream]) => (
                <div key={id} className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-xl font-bold shadow-lg border-2 border-emerald-400 relative">
                  <AudioPlayer stream={stream} />
                  Kid
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-colors ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-emerald-400 to-cyan-400 text-transparent bg-clip-text">
            GameTalk
          </h1>
          <p className="text-slate-400 text-lg">Fun, safe audio chat for gaming.</p>
        </div>

        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 space-y-8">
          <div>
            <button
              onClick={handleCreateRoom}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg shadow-emerald-500/20"
            >
              Create New Chat
            </button>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 font-medium">OR</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-400 mb-2">
                Have a code? Enter it here:
              </label>
              <input
                id="code"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. BlueMonkeyHappy"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg shadow-indigo-500/20 disabled:shadow-none"
            >
              Join Chat
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
