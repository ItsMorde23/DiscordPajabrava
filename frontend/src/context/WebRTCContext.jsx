import { createContext, useState, useEffect, useRef, useContext } from 'react';

export const WebRTCContext = createContext();

export const WebRTCProvider = ({ children, socket, user }) => {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [inVoiceChannel, setInVoiceChannel] = useState(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // ── Feedback de audio con Web Audio API ───────────────────
  const playSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      if (type === 'mute') {
        // Tono descendente corto (indicar que te silenciaste)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'unmute') {
        // Tono ascendente (indicar que te desmuteaste)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'deafen') {
        // Doble beep descendente (ensordecido)
        [0, 0.15].forEach(offset => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, now + offset);
          osc.frequency.exponentialRampToValueAtTime(330, now + offset + 0.1);
          gain.gain.setValueAtTime(0.25, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
          osc.start(now + offset); osc.stop(now + offset + 0.12);
        });
      } else if (type === 'undeafen') {
        // Doble beep ascendente (dejar de ensordecerse)
        [0, 0.15].forEach(offset => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(330, now + offset);
          osc.frequency.exponentialRampToValueAtTime(660, now + offset + 0.1);
          gain.gain.setValueAtTime(0.25, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
          osc.start(now + offset); osc.stop(now + offset + 0.12);
        });
      }
    } catch (e) {
      // Web Audio no disponible, ignorar
    }
  };
  
  const peerConnections = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Helper para manejar volumen global (Deafen)
  useEffect(() => {
    Object.keys(remoteStreams).forEach(id => {
      const audioEl = document.getElementById(`peer-audio-${id}`);
      if (audioEl) {
        audioEl.muted = isDeafened;
      }
    });
  }, [isDeafened, remoteStreams]);

  useEffect(() => {
    if (!socket || !user) return;

    // --- WebRTC Signaling Events ---
    const handleUserJoined = async ({ userId, username, socketId }) => {
      console.log(`User ${username} joined, creating offer...`);
      const pc = createPeerConnection(socketId, userId, username);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('webrtc_offer', {
        targetSocketId: socketId,
        offer
      });
    };

    const handleOffer = async ({ offer, senderSocketId, senderUserId, senderUsername }) => {
      console.log(`Received offer from ${senderUsername}`);
      const pc = createPeerConnection(senderSocketId, senderUserId, senderUsername);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc_answer', {
        targetSocketId: senderSocketId,
        answer
      });
    };

    const handleAnswer = async ({ answer, senderSocketId }) => {
      console.log(`Received answer`);
      const pc = peerConnections.current[senderSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ candidate, senderSocketId }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      }
    };

    const handleUserLeft = ({ socketId, userId }) => {
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    };

    socket.on('user_joined_voice', handleUserJoined);
    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);
    socket.on('user_left_voice', handleUserLeft);

    return () => {
      socket.off('user_joined_voice', handleUserJoined);
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      socket.off('user_left_voice', handleUserLeft);
    };
  }, [socket, user]);

  const createPeerConnection = (socketId, peerUserId, peerUsername) => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnections.current[socketId] = pc;

    // Add local tracks from refs
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      currentLocalStream.getTracks().forEach(track => {
        pc.addTrack(track, currentLocalStream);
      });
    }

    const currentScreenStream = screenStreamRef.current;
    if (currentScreenStream && currentLocalStream) {
       currentScreenStream.getTracks().forEach(track => {
         pc.addTrack(track, currentLocalStream);
       });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // Receive remote tracks - merge into existing streams safely
    pc.ontrack = (event) => {
      // Sometimes event.streams is empty depending on the signaling, fallback to a stream with just the track
      const incomingStream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      
      setRemoteStreams(prev => {
        const existing = prev[peerUserId];
        if (existing && existing.stream) {
          // Add each incoming track to a NEW MediaStream containing the old tracks, to force React to detect the change
          const newStream = new MediaStream(existing.stream.getTracks());
          incomingStream.getTracks().forEach(track => {
            if (!newStream.getTrackById(track.id)) {
              newStream.addTrack(track);
            }
          });
          return {
            ...prev,
            [peerUserId]: { username: peerUsername, stream: newStream }
          };
        }
        
        // First time: just use the incoming stream
        return {
          ...prev,
          [peerUserId]: { username: peerUsername, stream: incomingStream }
        };
      });
    };

    return pc;
  };

  const joinVoiceChannel = async (channelId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      setInVoiceChannel(channelId);
      socket.emit('join_voice', channelId);
    } catch (err) {
      console.error("Failed to access microphone", err);
      alert("No se pudo acceder al micrófono.");
    }
  };

  const leaveVoiceChannel = () => {
    if (inVoiceChannel) {
      socket.emit('leave_voice', inVoiceChannel);
      setInVoiceChannel(null);
      
      // Stop all tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }

      // Close all PCs
      Object.keys(peerConnections.current).forEach(socketId => {
        peerConnections.current[socketId].close();
      });
      peerConnections.current = {};
      setRemoteStreams({});
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !newMuted;
    }
    setIsMuted(newMuted);
    playSound(newMuted ? 'mute' : 'unmute');

    // Emitir estado al servidor para que todos lo vean
    if (socket && inVoiceChannel) {
      socket.emit('voice_state_update', {
        channelId: inVoiceChannel,
        isMuted: newMuted,
        isDeafened
      });
    }
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    playSound(newDeafened ? 'deafen' : 'undeafen');

    // Si te ensordeces, también mutearte el micro localmente
    if (newDeafened && !isMuted && localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = false;
    } else if (!newDeafened && !isMuted && localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = true;
    }

    // Emitir estado al servidor
    if (socket && inVoiceChannel) {
      socket.emit('voice_state_update', {
        channelId: inVoiceChannel,
        isMuted: newDeafened ? true : isMuted,
        isDeafened: newDeafened
      });
    }
  };

  const shareScreen = async () => {
    try {
      if (screenStream) {
        // Stop sharing
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
        if (socket && inVoiceChannel) {
          socket.emit('voice_state_update', {
            channelId: inVoiceChannel,
            isScreenSharing: false
          });
        }
        // Need to renegotiate peers (remove track). Keep simple for now: renegotiation requires full implementation. 
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(stream);

        if (socket && inVoiceChannel) {
          socket.emit('voice_state_update', {
            channelId: inVoiceChannel,
            isScreenSharing: true
          });
        }

        // Add track to existing connections and renegotiate
        Object.keys(peerConnections.current).forEach(async (socketId) => {
          const pc = peerConnections.current[socketId];
          stream.getTracks().forEach(track => {
             // Add track associated with the local audio stream
             pc.addTrack(track, localStreamRef.current);
          });
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetSocketId: socketId,
            offer
          });
        });
      }
    } catch (err) {
      console.error("Error sharing screen", err);
    }
  };

  // Set local stream mute state based on global state
  useEffect(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
         audioTrack.enabled = !isMuted;
      }
    }
  }, [localStream, isMuted]);

  return (
    <WebRTCContext.Provider value={{
      localStream,
      screenStream,
      remoteStreams,
      inVoiceChannel,
      isMuted,
      isDeafened,
      joinVoiceChannel,
      leaveVoiceChannel,
      toggleMute,
      toggleDeafen,
      shareScreen
    }}>
      {children}
      {/* Hidden Audio Elements for Remote Streams */}
      {Object.entries(remoteStreams).map(([peerId, streamData]) => (
        <audio
          key={peerId}
          id={`peer-audio-${peerId}`}
          autoPlay
          ref={el => {
            if (el && el.srcObject !== streamData.stream) {
              // Filtrar el audio del stream principal si existe
              el.srcObject = streamData.stream;
            }
          }}
        />
      ))}
    </WebRTCContext.Provider>
  );
};
