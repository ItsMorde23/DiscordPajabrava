import { useEffect, useState } from 'react';

// Un componente genérico para renderizar Video o un Marco con Audio y Volume Slider
const PeerVideo = ({ peerId, username, streamData, isLocal }) => {
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audioEl = document.getElementById(`peer-audio-${peerId}`);
    if (audioEl) {
      audioEl.volume = volume;
    }
  }, [volume, peerId]);

  const hasVideo = streamData?.stream?.getVideoTracks().length > 0;

  return (
    <div className="bg-[#1e1f22] rounded-lg overflow-hidden flex flex-col min-h-[250px] relative group border border-[#2b2d31] shadow-xl m-2 flex-1 basis-[300px]">
      {/* Video or Audio Placeholder */}
      {hasVideo ? (
        <video 
          autoPlay 
          muted={isLocal} // Siempre mutear nuestro propio feedback
          ref={el => { if (el && el.srcObject !== streamData.stream) el.srcObject = streamData.stream; }}
          className="w-full h-full object-contain bg-black absolute inset-0"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center absolute inset-0">
          <div className={`w-24 h-24 rounded-full bg-[#da373c] flex items-center justify-center text-white text-3xl font-bold border-4 border-transparent shadow-lg transition`}>
            {username?.[0]?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Overlay: Name */}
      <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 flex items-center rounded text-sm font-semibold z-10 transition opacity-80 backdrop-blur-sm">
        <span className={isLocal ? "text-green-400" : "text-white"}>{username} {isLocal ? '(Tú)' : ''}</span>
      </div>

      {/* Overlay: Volume Control (Only for remotes) */}
      {!isLocal && (
        <div className="absolute top-3 right-3 bg-black/70 p-2 rounded flex flex-col items-center opacity-0 group-hover:opacity-100 transition duration-200 z-10 backdrop-blur-md">
          <span className="text-xs text-[#b5bac1] font-bold mb-2">Vol: {Math.round(volume * 100)}%</span>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="0.05" 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20"
          />
        </div>
      )}
    </div>
  );
};

export default function VoicePanel({ webrtc, user, channelName }) {
  return (
    <div className="flex-1 flex flex-col bg-[#000000] p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-white font-bold text-2xl flex items-center">
            <span className="text-[#80848e] mr-2">🔊</span> {channelName || 'Canal de Voz'}
          </h2>
          <p className="text-[#b5bac1] text-sm font-medium mt-1">Conectado a la red de voz. P2P WebRTC Mesh activado.</p>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={webrtc.shareScreen}
             className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-2 rounded font-semibold transition flex items-center shadow-lg"
           >
             <span className="mr-2">🖥️</span> {webrtc.screenStream ? 'Dejar de compartir' : 'Compartir Pantalla'}
           </button>
           <button 
             onClick={webrtc.leaveVoiceChannel}
             className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold transition shadow-lg"
           >
             Desconectar
           </button>
        </div>
      </div>

      {/* Grid de Webcams / Pantallas */}
      <div className="flex-1 flex flex-wrap content-start">
        {/* Local Stream */}
        <PeerVideo 
          peerId={user.id} 
          username={user.username} 
          streamData={{ stream: webrtc.screenStream || webrtc.localStream }} 
          isLocal={true} 
        />

        {/* Remote Streams */}
        {Object.entries(webrtc.remoteStreams).map(([peerId, streamData]) => (
          <PeerVideo 
            key={peerId} 
            peerId={peerId} 
            username={streamData.username} 
            streamData={streamData} 
            isLocal={false} 
          />
        ))}
      </div>
    </div>
  );
}
