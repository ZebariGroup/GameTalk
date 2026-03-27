import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Users, Copy, Check, Send, Smile, Eye, Wifi, MessageSquare } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import confetti from 'canvas-confetti';
import Avatar from 'boring-avatars';
import { AudioPlayer } from '@/components/AudioPlayer';
import { VoiceEffect } from '@/lib/audioEffects';
import { UserRole, ChatMessage, Reaction } from '@/hooks/useAudioChat';

type AvatarVariantName = 'beam' | 'marble' | 'pixel' | 'sunset' | 'ring' | 'bauhaus';

interface RoomViewProps {
  roomCode: string;
  username: string;
  role: UserRole;
  avatarVariant: AvatarVariantName;
  avatarColors: string[];
  peers: { [id: string]: MediaStream };
  peerNames: { [id: string]: { name: string, role: UserRole, avatarVariant?: AvatarVariantName, avatarColors?: string[] } };
  kidCount: number;
  peerVolumes: { [id: string]: number };
  setPeerVolume: (peerId: string, volume: number) => void;
  peerQuality: { [id: string]: 'good' | 'fair' | 'poor' };
  isMuted: boolean;
  toggleMute: () => void;
  error: string | null;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  sendMessage: (text: string) => void;
  voiceEffect: VoiceEffect;
  setVoiceEffect: (effect: VoiceEffect) => void;
  sendReaction: (emoji: string, type?: 'emoji' | 'sticker', text?: string) => void;
  triggerSound: (soundId: string, audioData?: string) => void;
  triggerMinigame: (gameType: string, action?: 'start' | 'guess' | 'end', data?: { word?: string, letter?: string }) => void;
  activeMinigame: { type: string, starter: string, word?: string, guesses?: string[] } | null;
  floatingReactions: Reaction[];
  removeReaction: (id: string) => void;
  timeoutUntil: number | null;
  timeoutReason: string | null;
  timeLeft: number;
  isSpeaking: boolean;
  isOnline: boolean;
  isReconnecting: boolean;
  onLeaveRoom: () => void;
}

export function RoomView(props: RoomViewProps) {
  const {
    roomCode, username, role, avatarVariant, avatarColors,
    peers, peerNames, kidCount, peerVolumes, setPeerVolume, peerQuality,
    isMuted, toggleMute, error, isConnected, chatMessages,
    sendMessage, voiceEffect, setVoiceEffect, sendReaction, triggerSound,
    triggerMinigame, activeMinigame, floatingReactions, removeReaction,
    timeoutUntil, timeoutReason, timeLeft, isSpeaking, isOnline, isReconnecting,
    onLeaveRoom
  } = props;

  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showWordInput, setShowWordInput] = useState(false);
  const [secretWord, setSecretWord] = useState('');
  const [easterEgg, setEasterEgg] = useState<string | null>(null);
  const [customSound, setCustomSound] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  /** On small screens, show one panel at a time so users are not stuck scrolling past audio to reach chat. */
  const [mobileTab, setMobileTab] = useState<'room' | 'chat'>('room');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  const isOnlyEmojis = (str: string) => {
    const emojiRegex = /^[\p{Emoji}\s]+$/u;
    return emojiRegex.test(str) && str.trim().length > 0;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setCustomSound(base64data);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 3000);
    } catch (err) {
      console.error('Error accessing microphone for recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- easter-egg reactions tied to latest chat line */
  useEffect(() => {
    const chatScrollEl = chatScrollRef.current;
    if (chatScrollEl) {
      chatScrollEl.scrollTo({
        top: chatScrollEl.scrollHeight,
        behavior: 'smooth',
      });
    }
    
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      const text = lastMsg.text.toLowerCase();
      
      if (text === 'do a barrel roll') {
        setEasterEgg('barrel-roll');
        setTimeout(() => setEasterEgg(null), 2000);
      } else if (text === 'earthquake') {
        setEasterEgg('shake');
        setTimeout(() => setEasterEgg(null), 1500);
      } else if (text === 'matrix') {
        setEasterEgg(prev => prev === 'matrix' ? null : 'matrix');
      } else if (text === 'party') {
        confetti({ particleCount: 200, spread: 160 });
      } else if (text === 'poop') {
        for (let i = 0; i < 20; i++) {
          setTimeout(() => sendReaction('💩'), i * 100);
        }
      }
    }
  }, [chatMessages, sendReaction]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (isConnected && role === 'kid') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#34d399', '#38bdf8', '#818cf8', '#c084fc']
      });
    }
  }, [isConnected, role]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput.trim());
      setChatInput('');
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiObject: { emoji: string }) => {
    setChatInput(prev => prev + emojiObject.emoji);
  };

  const visiblePeers = Object.entries(peers).filter(([id]) => peerNames[id]?.role === 'kid');

  const eggClass =
    easterEgg === 'barrel-roll'
      ? 'animate-barrel-roll'
      : easterEgg === 'shake'
        ? 'animate-shake'
        : easterEgg === 'matrix'
          ? 'matrix-mode'
          : '';

  return (
    <div
      className={`h-[100dvh] bg-slate-900 text-white flex flex-col relative overflow-hidden ${eggClass}`}
    >
      
      {/* Network Status Banners */}
      {!isOnline && (
        <div role="status" aria-live="polite" className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-[200] font-bold animate-pulse shadow-lg">
          ⚠️ You are offline. Waiting for internet connection...
        </div>
      )}
      {isOnline && isReconnecting && (
        <div role="status" aria-live="polite" className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 z-[200] font-bold animate-pulse shadow-lg">
          🔄 Reconnecting to chat...
        </div>
      )}

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-700 text-center"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <PhoneOff className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Leaving so soon?</h3>
              <p className="text-slate-400 mb-8">Are you sure you want to leave the chat room?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
                >
                  No, stay
                </button>
                <button 
                  onClick={onLeaveRoom}
                  className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20"
                >
                  Yes, leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Reactions Layer */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 1, y: '100vh', x: `${reaction.x}vw`, scale: reaction.type === 'sticker' ? 0.5 : 1, rotate: reaction.type === 'sticker' ? (reaction.rotate || 0) : 0 }}
              animate={{ opacity: 0, y: '-10vh', scale: reaction.type === 'sticker' ? 2 : 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reaction.type === 'sticker' ? 4 : 3, ease: 'easeOut' }}
              className={`absolute ${reaction.type === 'sticker' ? 'z-50' : 'text-6xl z-40'}`}
              onAnimationComplete={() => removeReaction(reaction.id)}
            >
              {reaction.type === 'sticker' ? (
                <div className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] uppercase tracking-widest" style={{ WebkitTextStroke: '3px black' }}>
                  {reaction.text} {reaction.emoji}
                </div>
              ) : (
                reaction.emoji
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col min-h-0 md:flex-row md:items-stretch md:justify-center px-3 md:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-4 gap-3 md:gap-6">
      {/* Left Column: Audio & Controls */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`bg-slate-800 p-3 sm:p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-md md:self-center text-center border border-slate-700 flex flex-col min-h-0 overflow-y-auto md:overflow-visible md:flex-1 md:h-[85vh] ${
          mobileTab === 'room' ? 'flex flex-1' : 'hidden md:flex'
        }`}
      >
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-slate-300">Room Code</h2>
        <div 
          onClick={copyCode}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && copyCode()}
          aria-label="Copy room code"
          className="bg-slate-900 p-3 sm:p-4 rounded-xl text-2xl sm:text-3xl font-black text-emerald-400 mb-3 sm:mb-4 cursor-pointer active:bg-slate-950 transition-colors flex items-center justify-center gap-3 group min-h-[52px]"
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

        <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 flex-grow overflow-y-auto min-h-[100px] md:min-h-0">
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6 text-slate-300">
            <Users className="w-5 h-5" />
            <span className="font-medium">Kids in Chat: {kidCount}</span>
          </div>
          
          <div className="flex justify-center gap-6 flex-wrap">
            {/* Local User (Only show if kid) */}
            {role === 'kid' && (
              <motion.div 
                className="flex flex-col items-center gap-2"
                animate={easterEgg === 'shake' ? { y: [0, -10, 0, 10, 0], x: [0, -5, 5, 0] } : {}}
                transition={{ duration: 0.5, repeat: easterEgg === 'shake' ? Infinity : 0 }}
              >
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-4 border-indigo-400 relative overflow-hidden group bg-slate-800">
                  <motion.div 
                    animate={{ rotate: easterEgg === 'barrel-roll' ? 360 : 0 }} 
                    transition={{ duration: 1 }}
                    className="group-hover:scale-110 transition-transform w-full h-full"
                  >
                    <Avatar
                      size={80}
                      name={username}
                      variant={avatarVariant}
                      colors={avatarColors}
                    />
                  </motion.div>
                  {isSpeaking && (
                    <div className="absolute -inset-2 rounded-full border-4 border-indigo-400 animate-pulse pointer-events-none" />
                  )}
                  {isMuted && (
                    <div className="absolute -bottom-2 -right-2 bg-red-500 rounded-full p-1.5 border-2 border-slate-900 z-10">
                      <MicOff className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <span className="font-bold text-sm text-indigo-300">{username} (You)</span>
              </motion.div>
            )}

            {/* Observer Indicator (Only visible to observer) */}
            {role === 'observer' && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl shadow-lg border-4 border-slate-500 relative">
                  <Eye className="w-8 h-8 text-slate-400" />
                </div>
                <span className="font-bold text-sm text-slate-400">Invisible Observer</span>
              </div>
            )}
            
            {/* Remote Peers (Only Kids) */}
            {visiblePeers.map(([id, stream]) => {
              const quality = peerQuality[id] || 'good';
              const qualityColor = quality === 'good' ? 'text-emerald-400' : quality === 'fair' ? 'text-amber-400' : 'text-red-400';
              const peerName = peerNames[id]?.name || 'Kid';
              
              return (
                <motion.div 
                  key={id} 
                  className="flex flex-col items-center gap-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-600 relative overflow-hidden bg-slate-800">
                    <Avatar
                      size={80}
                      name={peerName}
                      variant={peerNames[id]?.avatarVariant || 'beam'}
                      colors={peerNames[id]?.avatarColors || ['#34d399', '#38bdf8', '#818cf8', '#c084fc', '#fbbf24']}
                    />
                    <AudioPlayer stream={stream} volume={peerVolumes[id] ?? 1} />
                  </div>
                  <div className="flex items-center gap-1" title={`Connection: ${quality}`}>
                    <span className="font-bold text-sm text-slate-300">{peerName}</span>
                    <Wifi className={`w-3 h-3 ${qualityColor}`} />
                  </div>
                  
                  {/* Volume Slider for this peer */}
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={peerVolumes[id] ?? 1}
                    onChange={(e) => setPeerVolume(id, parseFloat(e.target.value))}
                    className="w-24 sm:w-16 h-2 sm:h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 touch-pan-y"
                    title={`Volume for ${peerName}`}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {role === 'kid' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-slate-900 p-3 rounded-xl border border-slate-700">
              <label htmlFor="voiceEffect" className="text-sm font-medium text-slate-300 text-left sm:text-right">
                Voice Changer:
              </label>
              <select
                id="voiceEffect"
                value={voiceEffect}
                onChange={(e) => setVoiceEffect(e.target.value as VoiceEffect)}
                className="w-full sm:w-auto min-h-[44px] bg-slate-800 border border-slate-600 text-white text-base sm:text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2"
              >
                <option value="none">Normal 🗣️</option>
                <option value="robot">Robot 🤖</option>
                <option value="cave">Cave 🦇</option>
                <option value="radio">Radio 📻</option>
                <option value="chipmunk">Chipmunk 🐿️</option>
                <option value="monster">Monster 👹</option>
                <option value="alien">Alien 👽</option>
              </select>
            </div>

            <div className="flex gap-3 sm:gap-4">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex-1 min-h-[52px] py-3 sm:py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${
                  isMuted 
                    ? 'bg-red-500 active:bg-red-600 text-white shadow-red-500/20' 
                    : 'bg-emerald-500 active:bg-emerald-600 text-white shadow-emerald-500/20'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className="min-h-[52px] min-w-[52px] shrink-0 py-3 px-5 bg-slate-700 active:bg-red-500 text-white rounded-2xl font-bold transition-colors shadow-lg flex items-center justify-center"
                title="Leave Room"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
        
        {role === 'observer' && (
          <div className="mt-auto">
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full min-h-[52px] py-3.5 px-6 bg-red-500/20 active:bg-red-500 text-red-400 active:text-white border border-red-500/50 rounded-2xl font-bold transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-6 h-6" />
              Leave Observation
            </button>
          </div>
        )}
      </motion.div>

      {/* Right Column: Chat & Soundboard */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`bg-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-md md:self-center border border-slate-700 flex flex-col min-h-0 overflow-hidden md:flex-1 md:h-[85vh] ${
          mobileTab === 'chat' ? 'flex flex-1' : 'hidden md:flex'
        }`}
      >
        {/* Timeout Banner */}
        <AnimatePresence>
          {timeoutUntil && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500 text-white text-center py-2 px-4 font-bold text-sm flex items-center justify-between"
            >
              <span>🚨 TIMEOUT: {timeoutReason}</span>
              <span className="bg-red-700 px-2 py-1 rounded-md">{timeLeft}s</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minigame Banner */}
        <AnimatePresence>
          {activeMinigame && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-indigo-600 text-white p-3 text-sm flex flex-col gap-2"
            >
              <div className="flex justify-between items-center font-bold">
                <span>🎮 Word Guess (started by {activeMinigame.starter})</span>
                {activeMinigame.starter === username && (
                  <button onClick={() => triggerMinigame('word_guess', 'end')} className="text-indigo-200 hover:text-white text-xs bg-indigo-800 px-2 py-1 rounded">End Game</button>
                )}
              </div>
              
              {activeMinigame.word ? (
                <div className="text-center text-2xl tracking-widest font-mono">
                  {activeMinigame.word.split('').map((char, i) => (
                    <span key={i} className="mx-1">
                      {char === ' ' ? ' ' : (activeMinigame.guesses?.includes(char.toUpperCase()) ? char.toUpperCase() : '_')}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-center italic text-indigo-200">Guessing in progress...</div>
              )}
              
              <div className="text-xs text-indigo-200 text-center">
                Type a single letter in chat to guess!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Soundboard & Minigames (Only for kids) */}
        {role === 'kid' && (
          <div className="p-2 sm:p-4 bg-slate-900 border-b border-slate-700 flex flex-nowrap overflow-x-auto gap-2 shrink-0 z-10 touch-pan-x [scrollbar-width:thin]">
            
            {/* Minigames Dropdown */}
            <div className="relative dropdown-container">
              <button 
                type="button"
                onClick={() => toggleDropdown('minigames')}
                className="shrink-0 px-3 sm:px-4 py-2 min-h-[44px] bg-indigo-500 active:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                🎮 Minigames
              </button>
              <AnimatePresence>
                {activeDropdown === 'minigames' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 w-[min(92vw,16rem)] max-h-[min(50vh,280px)] overflow-y-auto z-50"
                  >
                    {!showWordInput && !activeMinigame ? (
                      <button 
                        onClick={() => setShowWordInput(true)} 
                        className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors text-left"
                      >
                        🎮 Start Word Guess
                      </button>
                    ) : showWordInput ? (
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          value={secretWord}
                          onChange={e => setSecretWord(e.target.value)}
                          placeholder="Secret word..."
                          className="bg-slate-900 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (secretWord.trim()) {
                                triggerMinigame('word_guess', 'start', { word: secretWord.trim().toUpperCase() });
                                setShowWordInput(false);
                                setSecretWord('');
                                setActiveDropdown(null);
                              }
                            }}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            Start
                          </button>
                          <button 
                            onClick={() => setShowWordInput(false)} 
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300 text-center py-2">Game in progress...</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Funny Sounds Dropdown */}
            <div className="relative dropdown-container">
              <button 
                type="button"
                onClick={() => toggleDropdown('sounds')}
                className="shrink-0 px-3 sm:px-4 py-2 min-h-[44px] bg-purple-500 active:bg-purple-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                🎵 Sounds
              </button>
              <AnimatePresence>
                {activeDropdown === 'sounds' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 w-[min(92vw,12rem)] max-h-[min(50vh,280px)] overflow-y-auto z-50 flex flex-col gap-1"
                  >
                    <button onClick={() => { triggerSound('laser'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">🔫 Laser</button>
                    <button onClick={() => { triggerSound('magic'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">✨ Magic</button>
                    <button onClick={() => { triggerSound('fart'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">💨 Fart</button>
                    <button onClick={() => { triggerSound('applause'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">👏 Applause</button>
                    <button onClick={() => { triggerSound('trombone'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">🎺 Sad Trombone</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Game Sounds Dropdown */}
            <div className="relative dropdown-container">
              <button 
                type="button"
                onClick={() => toggleDropdown('game_sounds')}
                className="shrink-0 px-3 sm:px-4 py-2 min-h-[44px] bg-emerald-500 active:bg-emerald-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                🎮 FX
              </button>
              <AnimatePresence>
                {activeDropdown === 'game_sounds' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 w-[min(92vw,12rem)] max-h-[min(50vh,280px)] overflow-y-auto z-50 flex flex-col gap-1"
                  >
                    <button onClick={() => { triggerSound('mc_break'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">⛏️ Block Break</button>
                    <button onClick={() => { triggerSound('fn_shield'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">🛡️ Shield Pop</button>
                    <button onClick={() => { triggerSound('mario_coin'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">🪙 Coin</button>
                    <button onClick={() => { triggerSound('roblox_oof'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">🤕 Oof</button>
                    <button onClick={() => { triggerSound('jump'); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center gap-2">🦘 Jump</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reactions Dropdown */}
            <div className="relative dropdown-container">
              <button 
                type="button"
                onClick={() => toggleDropdown('reactions')}
                className="shrink-0 px-3 sm:px-4 py-2 min-h-[44px] bg-amber-500 active:bg-amber-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                😂 React
              </button>
              <AnimatePresence>
                {activeDropdown === 'reactions' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 w-[min(92vw,12rem)] max-h-[min(50vh,280px)] overflow-y-auto z-50 grid grid-cols-3 gap-2"
                  >
                    <button onClick={() => { sendReaction('😂'); setActiveDropdown(null); }} className="h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-2xl flex items-center justify-center transition-transform hover:scale-110">😂</button>
                    <button onClick={() => { sendReaction('❤️'); setActiveDropdown(null); }} className="h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-2xl flex items-center justify-center transition-transform hover:scale-110">❤️</button>
                    <button onClick={() => { sendReaction('😮'); setActiveDropdown(null); }} className="h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-2xl flex items-center justify-center transition-transform hover:scale-110">😮</button>
                    <button onClick={() => { sendReaction('🔥'); setActiveDropdown(null); }} className="h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-2xl flex items-center justify-center transition-transform hover:scale-110">🔥</button>
                    <button onClick={() => { sendReaction('💀'); setActiveDropdown(null); }} className="h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-2xl flex items-center justify-center transition-transform hover:scale-110">💀</button>
                    <button onClick={() => { sendReaction('💯'); setActiveDropdown(null); }} className="h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-2xl flex items-center justify-center transition-transform hover:scale-110">💯</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stickers Dropdown */}
            <div className="relative dropdown-container">
              <button 
                type="button"
                onClick={() => toggleDropdown('stickers')}
                className="shrink-0 px-3 sm:px-4 py-2 min-h-[44px] bg-pink-500 active:bg-pink-400 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                🏷️ Stickers
              </button>
              <AnimatePresence>
                {activeDropdown === 'stickers' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 md:left-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 w-[min(92vw,10rem)] max-h-[min(50vh,280px)] overflow-y-auto z-50 flex flex-col gap-2"
                  >
                    <button onClick={() => { sendReaction('💀', 'sticker', 'BRUH'); setActiveDropdown(null); }} className="w-full py-2 bg-slate-700 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-black tracking-widest">BRUH</button>
                    <button onClick={() => { sendReaction('🤨', 'sticker', 'SUS'); setActiveDropdown(null); }} className="w-full py-2 bg-slate-700 hover:bg-red-500 text-white rounded-lg transition-colors text-xs font-black tracking-widest">SUS</button>
                    <button onClick={() => { sendReaction('🏆', 'sticker', 'EPIC'); setActiveDropdown(null); }} className="w-full py-2 bg-slate-700 hover:bg-emerald-500 text-white rounded-lg transition-colors text-xs font-black tracking-widest">EPIC</button>
                    <button onClick={() => { sendReaction('🤦‍♂️', 'sticker', 'NOOB'); setActiveDropdown(null); }} className="w-full py-2 bg-slate-700 hover:bg-amber-500 text-white rounded-lg transition-colors text-xs font-black tracking-widest">NOOB</button>
                    <button onClick={() => { sendReaction('🚽', 'sticker', 'SKIBIDI'); setActiveDropdown(null); }} className="w-full py-2 bg-slate-700 hover:bg-purple-500 text-white rounded-lg transition-colors text-xs font-black tracking-widest">SKIBIDI</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Record Custom Sound Dropdown */}
            <div className="relative dropdown-container">
              <button 
                type="button"
                onClick={() => toggleDropdown('record')}
                className={`shrink-0 px-3 sm:px-4 py-2 min-h-[44px] whitespace-nowrap ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-red-600 active:bg-red-500'} text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2`}
              >
                🎤 Record
              </button>
              <AnimatePresence>
                {activeDropdown === 'record' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 w-[min(92vw,14rem)] max-h-[min(50vh,280px)] overflow-y-auto z-50 flex flex-col gap-2"
                  >
                    {isRecording ? (
                      <button 
                        onClick={stopRecording}
                        className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        ⏹️ Stop Recording
                      </button>
                    ) : (
                      <button 
                        onClick={startRecording}
                        className="w-full py-2 bg-slate-700 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        ⏺️ Start Recording (3s)
                      </button>
                    )}

                    {customSound && !isRecording && (
                      <>
                        <div className="h-px bg-slate-700 my-1"></div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (customAudioRef.current) {
                                customAudioRef.current.src = customSound;
                                customAudioRef.current.play();
                              }
                            }}
                            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            ▶️ Play
                          </button>
                          <button 
                            onClick={() => setCustomSound(null)}
                            className="flex-1 py-2 bg-slate-700 hover:bg-red-500/50 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                            triggerSound('custom', customSound);
                            setActiveDropdown(null);
                          }}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 mt-1"
                        >
                          🚀 Send to Room
                        </button>
                        <audio ref={customAudioRef} className="hidden" />
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}

        <div ref={chatScrollRef} className="flex-grow p-4 overflow-y-auto space-y-4 bg-slate-800/50">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
              No messages yet. Say hi! 👋
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isMe = msg.senderName === username;
              const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const onlyEmojis = isOnlyEmojis(msg.text);
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-slate-400 mb-1 px-2">{msg.senderName} <span className="text-slate-500 ml-1">{timeString}</span></span>
                  <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isMe ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'} ${onlyEmojis ? 'text-5xl bg-transparent !p-0 !shadow-none' : 'text-lg'}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-700 flex gap-2 relative z-40">
          <button 
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            aria-label="Toggle emoji picker"
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
                className="absolute bottom-full left-0 right-0 mb-2 z-50 flex justify-center md:bottom-20 md:left-4 md:right-auto md:mb-0 md:block md:w-auto"
              >
                <div className="max-h-[40vh] overflow-y-auto rounded-xl shadow-2xl">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            aria-label="Chat message"
            className="flex-grow bg-slate-800 border border-slate-700 rounded-xl px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            type="submit"
            disabled={!chatInput.trim()}
            aria-label="Send message"
            className="p-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-colors"
          >
            <Send className="w-6 h-6" />
          </button>
        </form>
      </motion.div>
      </div>

      <nav
        className="md:hidden flex shrink-0 border-t border-slate-700/80 bg-slate-950/95 backdrop-blur-md z-[70] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
        aria-label="Room sections"
      >
        <button
          type="button"
          onClick={() => setMobileTab('room')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-xs font-bold transition-colors ${
            mobileTab === 'room' ? 'text-emerald-400' : 'text-slate-500 active:text-slate-300'
          }`}
        >
          <Users className="w-6 h-6" aria-hidden />
          Room
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-xs font-bold transition-colors ${
            mobileTab === 'chat' ? 'text-indigo-400' : 'text-slate-500 active:text-slate-300'
          }`}
        >
          <MessageSquare className="w-6 h-6" aria-hidden />
          Chat
        </button>
      </nav>
    </div>
  );
}
