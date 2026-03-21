'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// STUN servers to help peers connect over the internet
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export function useAudioChat(roomCode: string | null, username: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [id: string]: string }>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const myId = useRef(Math.random().toString(36).substring(2, 15));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});

  useEffect(() => {
    if (!roomCode) return;

    let mounted = true;

    const initChat = async () => {
      try {
        // 1. Get local audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!mounted) return;
        setLocalStream(stream);

        // 2. Join Supabase Channel for signaling
        const channel = supabase.channel(`room-${roomCode}`);
        channelRef.current = channel;

        channel
          .on('broadcast', { event: 'peer-joined' }, async ({ payload }) => {
            const { peerId, peerName } = payload;
            if (peerId === myId.current) return;
            
            setPeerNames(prev => ({ ...prev, [peerId]: peerName || 'Kid' }));

            // A new peer joined, let's create a connection and send an offer
            const pc = createPeerConnection(peerId, stream, channel);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { target: peerId, sender: myId.current, senderName: username, signal: { type: 'offer', sdp: offer } }
            });
          })
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const { target, sender, senderName, signal } = payload;
            if (target !== myId.current) return;

            if (senderName) {
              setPeerNames(prev => ({ ...prev, [sender]: senderName }));
            }

            let pc = peerConnections.current[sender];
            
            if (signal.type === 'offer') {
              if (!pc) {
                pc = createPeerConnection(sender, stream, channel);
              }
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { target: sender, sender: myId.current, senderName: username, signal: { type: 'answer', sdp: answer } }
              });
            } else if (signal.type === 'answer') {
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              }
            } else if (signal.candidate) {
              if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              }
            }
          })
          .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
            setChatMessages(prev => [...prev, payload]);
          })
          .on('broadcast', { event: 'peer-left' }, ({ payload }) => {
            const { peerId } = payload;
            removePeer(peerId);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              // Announce we have joined
              channel.send({
                type: 'broadcast',
                event: 'peer-joined',
                payload: { peerId: myId.current, peerName: username }
              });
            }
          });

      } catch (err: any) {
        console.error('Error joining chat:', err);
        setError(err.message || 'Failed to access microphone');
      }
    };

    initChat();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'peer-left',
          payload: { peerId: myId.current }
        });
        supabase.removeChannel(channelRef.current);
      }
      
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomCode]);

  const createPeerConnection = (peerId: string, stream: MediaStream, channel: RealtimeChannel) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[peerId] = pc;

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle incoming ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { target: peerId, sender: myId.current, signal: { candidate: event.candidate } }
        });
      }
    };

    // Handle incoming audio stream
    pc.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [peerId]: event.streams[0]
      }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removePeer(peerId);
      }
    };

    return pc;
  };

  const removePeer = (peerId: string) => {
    if (peerConnections.current[peerId]) {
      peerConnections.current[peerId].close();
      delete peerConnections.current[peerId];
    }
    setPeers(prev => {
      const newPeers = { ...prev };
      delete newPeers[peerId];
      return newPeers;
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!localStream.getAudioTracks()[0].enabled);
    }
  };

  const sendMessage = (text: string) => {
    if (!channelRef.current || !isConnected) return;
    
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: myId.current,
      senderName: username,
      text,
      timestamp: Date.now(),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: message
    });

    setChatMessages(prev => [...prev, message]);
  };

  return {
    localStream,
    peers,
    peerNames,
    isMuted,
    toggleMute,
    error,
    isConnected,
    chatMessages,
    sendMessage
  };
}
