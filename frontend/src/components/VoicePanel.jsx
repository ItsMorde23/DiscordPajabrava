import { useEffect, useState } from 'react';

// Componente para renderizar Video o un Marco con Audio y Volume Slider
const PeerVideo = ({ peerId, username, streamData, isLocal, isMuted, isDeafened, isScreenSharing }) => {
  const [volume, setVolume] = useState(1); // 0 a 2, pero mostramos 0-200%
  const [isHidden, setHidden] = useState(false);

  useEffect(() => {
    const audioEl = document.getElementById(`peer-audio-${peerId}`);
    if (audioEl) {
      // Clampear el volumen entre 0 y 1 para que no rompa el HTMLMediaElement
      audioEl.volume = Math.min(1, Math.max(0, volume));
    }
  }, [volume, peerId]);

  const hasVideoTrack = streamData?.stream?.getVideoTracks().length > 0;
  const hasVideo = hasVideoTrack && !isHidden;

  // Color del borde: rojo si transmite
  const borderColor = isScreenSharing ? 'border-red-500' : isLocal && isMuted ? 'border-red-500/50' : 'border-transparent';

  return (
    <div className={`bg-[#1e1f22] rounded-lg overflow-hidden flex flex-col relative group border-2 ${borderColor} shadow-xl m-2 transition-all ${isScreenSharing ? 'w-full min-h-[400px] h-[60vh] order-first' : 'flex-1 basis-[280px] min-h-[200px]'}`}>
      {/* Video o Placeholder */}
      {hasVideo ? (
        <video
          autoPlay
          muted={isLocal}
          ref={el => { if (el && el.srcObject !== streamData.stream) el.srcObject = streamData.stream; }}
          className="w-full h-full object-contain bg-black absolute inset-0"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center absolute inset-0">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg transition ${isLocal && isMuted ? 'bg-red-600' : 'bg-[#5865f2]'}`}>
            {username?.[0]?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Overlay: Nombre + iconos de estado */}
      <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 flex items-center gap-1.5 rounded text-sm font-semibold z-10 backdrop-blur-sm">
        <span className={isLocal ? 'text-green-400' : 'text-white'}>{username}{isLocal ? ' (Tú)' : ''}</span>
        {isLocal && isMuted && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" title="Silenciado">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
          </svg>
        )}
        {isLocal && isDeafened && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" title="Ensordecido">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        )}
      </div>

      {/* Control de volumen (solo remotos) */}
      {!isLocal && (
        <div className="absolute top-3 right-3 bg-black/70 p-2 rounded flex flex-col items-center opacity-0 group-hover:opacity-100 transition duration-200 z-10 backdrop-blur-md">
          <span className="text-xs text-[#b5bac1] font-bold mb-1.5">
            {Math.round(Math.min(volume, 2) * 100)}%
          </span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={Math.min(volume, 2)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
            }}
            className="w-20 accent-[#5865f2]"
          />
        </div>
      )}
      {/* Botón para ocultar/mostrar (solo si hay video) */}
      {hasVideoTrack && !isLocal && (
        <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
          <button 
            onClick={() => setHidden(!isHidden)} 
            className="bg-black/70 text-white hover:bg-[#35373c] px-3 py-1.5 rounded text-xs font-semibold"
          >
            {isHidden ? '👁️ Mostrar Pantalla' : '🙈 Ocultar Pantalla'}
          </button>
        </div>
      )}
    </div>
  );
};

export default function VoicePanel({ webrtc, user, channelName, participants }) {
  return (
    <div className="flex-1 flex flex-col bg-[#111214] p-4 overflow-y-auto min-h-0">
      <div className="flex justify-between items-center mb-6 shrink-0 flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-2xl flex items-center">
            <span className="text-[#80848e] mr-2">🔊</span> {channelName || 'Canal de Voz'}
          </h2>
          <p className="text-[#b5bac1] text-sm font-medium mt-1">Conectado · P2P WebRTC Mesh</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Mute */}
          <button
            onClick={webrtc.toggleMute}
            title={webrtc.isMuted ? 'Activar micrófono' : 'Silenciar'}
            className={`flex items-center gap-2 px-3 py-2 rounded font-semibold transition shadow-lg text-sm ${webrtc.isMuted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'}`}
          >
            {webrtc.isMuted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
            )}
            {webrtc.isMuted ? 'Silenciado' : 'Micrófono'}
          </button>

          {/* Deafen */}
          <button
            onClick={webrtc.toggleDeafen}
            title={webrtc.isDeafened ? 'Dejar de ensordecerse' : 'Ensordecerse'}
            className={`flex items-center gap-2 px-3 py-2 rounded font-semibold transition shadow-lg text-sm ${webrtc.isDeafened ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'}`}
          >
            {webrtc.isDeafened ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            )}
            {webrtc.isDeafened ? 'Ensordecido' : 'Sonido'}
          </button>

          {/* Compartir pantalla */}
          <button
            onClick={webrtc.shareScreen}
            className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-3 py-2 rounded font-semibold transition flex items-center gap-2 shadow-lg text-sm"
          >
            <span>🖥️</span> {webrtc.screenStream ? 'Dejar de compartir' : 'Pantalla'}
          </button>

          {/* Desconectar */}
          <button
            onClick={webrtc.leaveVoiceChannel}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold transition shadow-lg text-sm"
          >
            Desconectar
          </button>
        </div>
      </div>

      {/* Grid de participantes */}
      <div className="flex-1 flex flex-wrap content-start">
        {/* Stream local */}
        <PeerVideo
          peerId={user.id}
          username={user.username}
          streamData={{ stream: webrtc.screenStream || webrtc.localStream }}
          isLocal={true}
          isMuted={webrtc.isMuted}
          isDeafened={webrtc.isDeafened}
          isScreenSharing={!!webrtc.screenStream}
        />

        {/* Streams remotos */}
        {Object.entries(webrtc.remoteStreams).map(([peerId, streamData]) => {
          const p = participants?.find(p => p.userId === peerId) || {};
          return (
            <PeerVideo
              key={peerId}
              peerId={peerId}
              username={streamData.username}
              streamData={streamData}
              isLocal={false}
              isMuted={p.isMuted || false}
              isDeafened={p.isDeafened || false}
              isScreenSharing={p.isScreenSharing || false}
            />
          );
        })}
      </div>
    </div>
  );
}
