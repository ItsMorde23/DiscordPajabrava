import { useEffect, useState, useRef } from 'react';

// Iconos SVG inline
const MicOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
  </svg>
);
const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
  </svg>
);
const DeafenOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
  </svg>
);
const DeafenOnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);
const ScreenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12z"/>
  </svg>
);
const PhoneOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
  </svg>
);

// Card de participante
const PeerVideo = ({ peerId, username, streamData, isLocal, isMuted, isDeafened, isScreenSharing }) => {
  const [volume, setVolume] = useState(1);
  const [isHidden, setHidden] = useState(false);
  const videoRef = useRef(null);

  // Aplicar volumen al element de audio oculto
  useEffect(() => {
    const audioEl = document.getElementById(`peer-audio-${peerId}`);
    if (audioEl) {
      audioEl.volume = Math.min(1, Math.max(0, volume));
    }
  }, [volume, peerId]);

  // Aplicar volumen también al video (para screen share con audio)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = Math.min(1, Math.max(0, volume));
    }
  }, [volume]);

  const hasVideoTrack = streamData?.stream?.getVideoTracks().length > 0;
  const hasVideo = hasVideoTrack && !isHidden;

  const borderStyle = isScreenSharing
    ? 'border-red-500 shadow-red-500/20 shadow-xl'
    : 'border-transparent';

  return (
    <div className={`bg-[#1e1f22] rounded-xl overflow-hidden flex flex-col relative group border-2 ${borderStyle} transition-all duration-300
      ${isScreenSharing ? 'w-full' : 'flex-1 basis-[220px]'}
    `}
      style={{ minHeight: isScreenSharing ? '55vh' : '160px' }}
    >
      {/* Video o Placeholder */}
      {hasVideo ? (
        <video
          autoPlay
          muted={isLocal}
          ref={el => {
            videoRef.current = el;
            if (el && el.srcObject !== streamData.stream) el.srcObject = streamData.stream;
          }}
          className="w-full h-full object-contain bg-black absolute inset-0"
        />
      ) : (
        <>
          <div className="w-full h-full flex flex-col items-center justify-center absolute inset-0 bg-gradient-to-b from-[#1e1f22] to-[#111214]">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg
              ${isLocal && isMuted ? 'bg-red-600' : 'bg-[#5865f2]'}
            `}>
              {username?.[0]?.toUpperCase()}
            </div>
          </div>
          {/* CRITICAL: Render an audio element to play the voice for remote users! */}
          {!isLocal && streamData?.stream && (
            <audio
              id={`peer-audio-${peerId}`}
              autoPlay
              ref={el => {
                if (el && el.srcObject !== streamData.stream) el.srcObject = streamData.stream;
              }}
              style={{ display: 'none' }}
            />
          )}
        </>
      )}

      {/* Overlay: Nombre + iconos */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 flex items-center gap-1.5 z-10">
        <span className={`text-sm font-semibold truncate flex-1 ${isLocal ? 'text-green-400' : 'text-white'}`}>
          {username}{isLocal ? ' (Tú)' : ''}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isScreenSharing && (
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">LIVE</span>
          )}
          {isMuted && (
            <span className="text-red-400" title="Silenciado">
              <MicOffIcon />
            </span>
          )}
          {isDeafened && (
            <span className="text-red-400" title="Ensordecido">
              <DeafenOffIcon />
            </span>
          )}
        </div>
      </div>

      {/* Control de volumen remoto */}
      {!isLocal && (
        <div className="absolute top-2 right-2 bg-black/80 p-2 rounded-lg flex flex-col items-center opacity-0 group-hover:opacity-100 transition duration-200 z-20 backdrop-blur-sm gap-1.5">
          <span className="text-[10px] text-[#b5bac1] font-bold">{Math.round(Math.min(volume, 1) * 100)}%</span>
          <input
            type="range"
            min="0" max="1" step="0.02"
            value={Math.min(volume, 1)}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="w-16 accent-[#5865f2]"
            style={{ writingMode: 'horizontal-tb' }}
          />
          <button
            onClick={() => setVolume(v => v > 0 ? 0 : 1)}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${volume === 0 ? 'bg-red-500 text-white' : 'bg-[#35373c] text-[#b5bac1] hover:bg-[#404249]'}`}
          >
            {volume === 0 ? 'Silenciado' : 'Vol'}
          </button>
        </div>
      )}

      {/* Botón para ocultar/mostrar pantalla remota */}
      {hasVideoTrack && !isLocal && (
        <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => setHidden(!isHidden)}
            className="bg-black/80 text-white hover:bg-[#35373c] px-2.5 py-1 rounded-lg text-[11px] font-semibold backdrop-blur-sm flex items-center gap-1 transition"
          >
            {isHidden ? '👁️ Mostrar' : '🙈 Ocultar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default function VoicePanel({ webrtc, user, channelName, participants }) {
  return (
    <div className="flex-1 flex flex-col bg-[#111214] overflow-hidden min-h-0">
      {/* Header — solo info del canal */}
      <div className="shrink-0 px-5 py-3 flex items-center border-b border-[#1e1f22] bg-[#111214]">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <span className="text-[#80848e]">🔊</span>
          {channelName || 'Canal de Voz'}
        </h2>
        <span className="ml-3 text-[#6d6f78] text-xs">{Object.keys(webrtc.remoteStreams).length + 1} participante(s)</span>
      </div>

      {/* Grid de participantes */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-wrap content-start gap-2">
        {/* Local */}
        <PeerVideo
          peerId={user.id}
          username={user.username}
          streamData={{ stream: webrtc.screenStream || webrtc.localStream }}
          isLocal={true}
          isMuted={webrtc.isMuted}
          isDeafened={webrtc.isDeafened}
          isScreenSharing={!!webrtc.screenStream}
        />

        {/* Remotos */}
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

      {/* Barra de controles centrada en el fondo — estilo Discord */}
      <div className="shrink-0 flex items-center justify-center gap-2 py-4 px-6 bg-[#111214] border-t border-[#1e1f22]">
        {/* Mute */}
        <button
          onClick={webrtc.toggleMute}
          title={webrtc.isMuted ? 'Activar micrófono' : 'Silenciar'}
          className={`group/btn relative w-12 h-12 flex items-center justify-center rounded-full transition shadow-lg
            ${webrtc.isMuted ? 'bg-red-600/30 text-red-400 hover:bg-red-600/50' : 'bg-[#292b2f] text-[#dbdee1] hover:bg-[#35373c]'}`}
        >
          {webrtc.isMuted ? <MicOffIcon /> : <MicIcon />}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-30 transition">
            {webrtc.isMuted ? 'Activar micro' : 'Silenciar'}
          </div>
          {webrtc.isMuted && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </div>
          )}
        </button>

        {/* Deafen */}
        <button
          onClick={webrtc.toggleDeafen}
          title={webrtc.isDeafened ? 'Dejar de ensordecer' : 'Ensordecer'}
          className={`group/btn relative w-12 h-12 flex items-center justify-center rounded-full transition shadow-lg
            ${webrtc.isDeafened ? 'bg-red-600/30 text-red-400 hover:bg-red-600/50' : 'bg-[#292b2f] text-[#dbdee1] hover:bg-[#35373c]'}`}
        >
          {webrtc.isDeafened ? <DeafenOffIcon /> : <DeafenOnIcon />}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-30 transition">
            {webrtc.isDeafened ? 'Dejar de ensordecer' : 'Ensordecer'}
          </div>
          {webrtc.isDeafened && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </div>
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={webrtc.shareScreen}
          title={webrtc.screenStream ? 'Dejar de compartir' : 'Compartir pantalla'}
          className={`group/btn relative w-12 h-12 flex items-center justify-center rounded-full transition shadow-lg
            ${webrtc.screenStream ? 'bg-green-600/30 text-green-400 hover:bg-green-600/50' : 'bg-[#292b2f] text-[#dbdee1] hover:bg-[#35373c]'}`}
        >
          <ScreenIcon />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-30 transition">
            {webrtc.screenStream ? 'Dejar de compartir' : 'Pantalla'}
          </div>
          {webrtc.screenStream && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
          )}
        </button>

        <div className="w-px h-8 bg-[#292b2f] mx-1"></div>

        {/* Disconnect — rojo más grande */}
        <button
          onClick={webrtc.leaveVoiceChannel}
          title="Desconectar"
          className="group/btn relative w-12 h-12 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white transition shadow-lg"
        >
          <PhoneOffIcon />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-30 transition">
            Desconectar
          </div>
        </button>
      </div>
    </div>
  );
}
