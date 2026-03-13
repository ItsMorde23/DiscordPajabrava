import { createContext, useState, useEffect, useRef, useContext } from 'react';

export const WebRTCContext = createContext();

export const WebRTCProvider = ({ children, socket, user }) => {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [inVoiceChannel, setInVoiceChannel] = useState(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const peerConnections = useRef({});

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
  }, [socket, user, localStream, screenStream]);

  const createPeerConnection = (socketId, peerUserId, peerUsername) => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnections.current[socketId] = pc;

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    if (screenStream) {
       screenStream.getTracks().forEach(track => {
         pc.addTrack(track, screenStream);
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

    // Receive remote tracks
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [peerUserId]: {
          username: peerUsername,
          stream: event.streams[0]
        }
      }));
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
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    } else {
       setIsMuted(!isMuted); // toggle state even before joining
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const shareScreen = async () => {
    try {
      if (screenStream) {
        // Stop sharing
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
        // Need to renegotiate peers (remove track). Keep simple for now: renegotiation requires full implementation. 
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setScreenStream(stream);

        // Add track to existing connections and renegotiate
        Object.keys(peerConnections.current).forEach(async (socketId) => {
          const pc = peerConnections.current[socketId];
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
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
