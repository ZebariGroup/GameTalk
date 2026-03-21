'use client';

import { useState, useEffect, useRef } from 'react';
import { generateRoomCode } from '@/lib/generateCode';
import { generateName } from '@/lib/generateName';
import { useAudioChat } from '@/hooks/useAudioChat';
import { AudioPlayer } from '@/components/AudioPlayer';
import { VoiceEffect } from '@/lib/audioEffects';
import { Mic, MicOff, PhoneOff, Users, Copy, Check, Dices, Send, Smile, Volume2, Sparkles, Zap, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import confetti from 'canvas-confetti';

export default function Home() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsername(generateName());
  }, []);

  const { 
    peers, 
    peerNames, 
    isMuted, 
    toggleMute, 
    error, 
    isConnected, 
    chatMessages, 
    sendMessage,
    voiceEffect,
    setVoiceEffect,
    sendReaction,
    triggerSound,
    floatingReactions,
    removeReaction
  } = useAudioChat(roomCode, username);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Confetti when connected
  useEffect(() => {
    if (isConnected) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#34d399', '#38bdf8', '#818cf8', '#c084fc']
      });
    }
  }, [isConnected]);

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput.trim());
      setChatInput('');
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    setChatInput(prev => prev + emojiObject.emoji);
  };

  if (roomCode) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col md:flex-row items-center justify-center p-4 gap-6 relative overflow-hidden">
        
        {/* Floating Reactions Layer */}
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <AnimatePresence>
            {floatingReactions.map(reaction => (
              <motion.div
                key={reaction.id}
                initial={{ opacity: 1, y: '100vh', x: `${reaction.x}vw`, scale: 1 }}
                animate={{ opacity: 0, y: '-10vh', scale: 2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: 'easeOut' }}
                className="absolute text-6xl"
                onAnimationComplete={() => removeReaction(reaction.id)}
              >
                {reaction.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Left Column: Audio & Controls */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-slate-700 flex flex-col h-[85vh]"
        >
          <h2 className="text-2xl font-bold mb-2 text-slate-300">Room Code</h2>
          <div 
            onClick={copyCode}
            className="bg-slate-900 p-4 rounded-xl text-3xl font-black text-emerald-400 mb-4 cursor-pointer hover:bg-slate-950 transition-colors flex items-center justify-center gap-3 group"
          >
            {roomCode}
            {copied ? <Check className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />}
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mb-4 text-slate-400">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 mb-4 flex-grow overflow-y-auto">
            <div className="flex items-center justify-center gap-3 mb-6 text-slate-300">
              <Users className="w-5 h-5" />
              <span className="font-medium">Kids in Chat: {Object.keys(peers).length + 1}</span>
            </div>
            
            <div className="flex justify-center gap-6 flex-wrap">
              {/* Local User */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-indigo-500 flex items-center justify-center text-3xl shadow-lg border-4 border-indigo-400 relative">
                  😎
                  {isMuted && (
                    <div className="absolute -bottom-2 -right-2 bg-red-500 rounded-full p-1.5 border-2 border-slate-900">
                      <MicOff className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <span className="font-bold text-sm text-indigo-300">{username} (You)</span>
              </div>
              
              {/* Remote Peers */}
              {Object.entries(peers).map(([id, stream]) => (
                <div key={id} className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-3xl shadow-lg border-4 border-emerald-400 relative">
                    <AudioPlayer stream={stream} />
                    👾
                  </div>
                  <span className="font-bold text-sm text-emerald-300">{peerNames[id] || 'Kid'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Voice Changer */}
          <div className="mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Voice Changer</p>
            <div className="flex justify-center gap-2">
              {(['none', 'robot', 'cave', 'radio'] as VoiceEffect[]).map((effect) => (
                <button
                  key={effect}
                  onClick={() => setVoiceEffect(effect)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    voiceEffect === effect 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {effect === 'none' ? 'Normal' : effect.charAt(0).toUpperCase() + effect.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-auto">
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

        {/* Right Column: Text Chat & Fun Zone */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-700 flex flex-col h-[85vh] overflow-hidden relative"
        >
          <div className="bg-slate-900 p-4 border-b border-slate-700">
            <h3 className="font-bold text-lg text-slate-200">Fun Zone 💬</h3>
          </div>
          
          {/* Soundboard & Reactions */}
          <div className="bg-slate-800/80 p-3 border-b border-slate-700 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Soundboard</span>
              <div className="flex gap-2">
                <button onClick={() => triggerSound('laser')} className="p-2 bg-slate-700 hover:bg-indigo-500 rounded-lg transition-colors text-xl" title="Laser">🔫</button>
                <button onClick={() => triggerSound('magic')} className="p-2 bg-slate-700 hover:bg-purple-500 rounded-lg transition-colors text-xl" title="Magic">✨</button>
                <button onClick={() => triggerSound('buzzer')} className="p-2 bg-slate-700 hover:bg-red-500 rounded-lg transition-colors text-xl" title="Buzzer">🚨</button>
                <button onClick={() => triggerSound('jump')} className="p-2 bg-slate-700 hover:bg-emerald-500 rounded-lg transition-colors text-xl" title="Jump">🦘</button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reactions</span>
              <div className="flex gap-2">
                <button onClick={() => sendReaction('😂')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-xl hover:scale-110 transform">😂</button>
                <button onClick={() => sendReaction('❤️')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-xl hover:scale-110 transform">❤️</button>
                <button onClick={() => sendReaction('😮')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-xl hover:scale-110 transform">😮</button>
                <button onClick={() => sendReaction('🔥')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-xl hover:scale-110 transform">🔥</button>
              </div>
            </div>
          </div>

          <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-slate-800/50">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                No messages yet. Say hi! 👋
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.senderName === username;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-slate-400 mb-1 px-2">{msg.senderName}</span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isMe ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-700 flex gap-2 relative z-40">
            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-yellow-400 transition-colors"
            >
              <Smile className="w-6 h-6" />
            </button>
            
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-20 left-4 z-50"
                >
                  <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow bg-slate-800 border border-slate-700 rounded-xl px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="p-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-colors"
            >
              <Send className="w-6 h-6" />
            </button>
          </form>
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
          
          {/* Username Generator Section */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700 text-center">
            <p className="text-sm text-slate-400 mb-2">Your Secret Name:</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-bold text-indigo-400">{username}</span>
              <button 
                onClick={() => setUsername(generateName())}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                title="Roll new name"
              >
                <Dices className="w-5 h-5" />
              </button>
            </div>
          </div>

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
