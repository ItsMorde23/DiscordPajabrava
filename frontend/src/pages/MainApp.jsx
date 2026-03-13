import { useEffect, useContext, useState, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { WebRTCContext, WebRTCProvider } from '../context/WebRTCContext';
import { io } from 'socket.io-client';
import VoicePanel from '../components/VoicePanel';

export default function MainApp() {
  const { user, token, logout } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('text');
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(import.meta.env.VITE_API_URL, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('user_status_change', (data) => {
      setOnlineUsers(prev => ({
        ...prev,
        [data.userId]: { ...prev[data.userId], ...data }
      }));
    });

    newSocket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('channel_created', (newChannel) => {
      setChannels(prev => {
        // Evitar duplicados si nosotros mismos lo creamos
        if (prev.find(c => c.id === newChannel.id)) return prev;
        return [...prev, newChannel];
      });
    });

    setSocket(newSocket);

    const fetchInitialData = async () => {
      try {
        // Fetch all channels
        const resChannels = await fetch(`${import.meta.env.VITE_API_URL}/api/channels`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!resChannels.ok) {
          console.error('Error fetching channels:', await resChannels.text());
          return;
        }
        
        const allChannels = await resChannels.json();
        const validChannels = Array.isArray(allChannels) ? allChannels : [];
        
        if (validChannels.length === 0) {
           await fetch(`${import.meta.env.VITE_API_URL}/api/channels/default`, {
             headers: { 'Authorization': `Bearer ${token}` }
           });
           const retryChannels = await fetch(`${import.meta.env.VITE_API_URL}/api/channels`, {
             headers: { 'Authorization': `Bearer ${token}` }
           });
           
           if (retryChannels.ok) {
              const retryData = await retryChannels.json();
              setChannels(Array.isArray(retryData) ? retryData : []);
              const firstText = retryData.find(c => c.type === 'text');
              if (firstText) selectTextChannel(firstText);
           }
        } else {
           setChannels(validChannels);
           const defaultText = validChannels.find(c => c.type === 'text');
           if (defaultText) selectTextChannel(defaultText);
        }
      } catch (err) {
        console.error('Error fetching channel data', err);
      }
    };

    fetchInitialData();

    return () => newSocket.close();
  }, [token, socket]);

  const selectTextChannel = async (channel) => {
    setCurrentChannel(channel);
    if (socket) {
      socket.emit('join_text_channel', channel.id);
    }
    try {
      const msgRes = await fetch(`${import.meta.env.VITE_API_URL}/api/channels/${channel.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!msgRes.ok) return;
      const msgs = await msgRes.json();
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error('Error fetching messages', err);
    }
  };

  const createChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newChannelName.toLowerCase().replace(/\s+/g, '-'), type: newChannelType })
      });

      if (res.ok) {
        const newChannel = await res.json();
        // El listener 'channel_created' se encarga de agregarlo al estado para todos, incluyendo nosotros
        setShowCreateChannel(false);
        setNewChannelName('');
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentChannel || !socket) return;

    socket.emit('send_message', {
      channelId: currentChannel.id,
      content: messageInput
    });

    setMessageInput('');
  };

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  return (
    <WebRTCProvider socket={socket} user={user}>
      <WebRTCContext.Consumer>
        {(webrtc) => (
          <div className="flex h-screen bg-[#313338] text-[#dbdee1] overflow-hidden relative">
            
            {/* Modal Crear Canal */}
            {showCreateChannel && (
              <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center">
                <div className="bg-[#313338] p-6 rounded-lg shadow-xl w-96">
                  <h2 className="text-xl font-bold text-white mb-4">Crear Canal</h2>
                  <form onSubmit={createChannel}>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Tipo de Canal</label>
                      <div className="flex gap-2">
                        <label className={`flex-1 p-3 rounded cursor-pointer border ${newChannelType === 'text' ? 'bg-[#404249] border-[#5865f2] text-white' : 'bg-[#2b2d31] border-transparent text-[#b5bac1]'}`}>
                          <input type="radio" value="text" checked={newChannelType === 'text'} onChange={(e)=>setNewChannelType(e.target.value)} className="hidden"/>
                          # Texto
                        </label>
                        <label className={`flex-1 p-3 rounded cursor-pointer border ${newChannelType === 'voice' ? 'bg-[#404249] border-[#5865f2] text-white' : 'bg-[#2b2d31] border-transparent text-[#b5bac1]'}`}>
                          <input type="radio" value="voice" checked={newChannelType === 'voice'} onChange={(e)=>setNewChannelType(e.target.value)} className="hidden"/>
                          🔊 Voz
                        </label>
                      </div>
                    </div>
                    <div className="mb-6">
                      <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Nombre del Canal</label>
                      <input 
                        type="text" 
                        className="w-full bg-[#1e1f22] p-2.5 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                        value={newChannelName}
                        onChange={e => setNewChannelName(e.target.value)}
                        placeholder="nuevo-canal"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setShowCreateChannel(false)} className="text-[#dbdee1] hover:underline px-4 py-2">Cancelar</button>
                      <button type="submit" className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-2 px-6 rounded transition">Crear</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Sidebar de canales y amigos */}
            <div className="w-64 bg-[#2b2d31] flex flex-col hidden sm:flex shrink-0">
              <div className="h-12 border-b border-[#1e1f22] flex items-center justify-between px-4 shadow-sm shrink-0 hover:bg-[#35373c] cursor-pointer transition">
                <span className="font-bold text-white truncate">Pajabrava (Single Server)</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1 group">
                    <h3 className="text-xs font-semibold text-[#80848e] group-hover:text-[#dbdee1] uppercase tracking-wider transition cursor-default">Canales de Texto</h3>
                    <button onClick={() => {setNewChannelType('text'); setShowCreateChannel(true);}} className="text-[#80848e] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition">
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                  </div>
                  {textChannels.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => selectTextChannel(c)}
                      className={`flex items-center rounded px-2 py-1.5 cursor-pointer transition mb-0.5 ${currentChannel?.id === c.id ? 'bg-[#404249] text-white font-medium' : 'text-[#80848e] hover:text-[#dbdee1] hover:bg-[#35373c]'}`}
                    >
                      <span className="text-[#80848e] mr-2 text-xl">#</span> {c.name}
                    </div>
                  ))}
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1 group">
                    <h3 className="text-xs font-semibold text-[#80848e] group-hover:text-[#dbdee1] uppercase tracking-wider transition cursor-default">Canales de Voz</h3>
                    <button onClick={() => {setNewChannelType('voice'); setShowCreateChannel(true);}} className="text-[#80848e] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition">
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                  </div>
                  {voiceChannels.map(c => (
                    <div 
                      key={c.id}
                      className={`flex items-center rounded px-2 py-1.5 cursor-pointer transition mb-0.5 ${webrtc?.inVoiceChannel === c.id ? 'bg-[#35373c] text-green-400 font-bold' : 'text-[#80848e] hover:text-[#dbdee1] hover:bg-[#35373c]'}`}
                      onClick={() => {
                        if (webrtc?.inVoiceChannel === c.id) {
                          webrtc.leaveVoiceChannel();
                        } else {
                          if (webrtc?.inVoiceChannel) webrtc.leaveVoiceChannel();
                          webrtc.joinVoiceChannel(c.id); 
                        }
                      }}
                    >
                      <span className="mr-2">🔊</span> {c.name}
                      {webrtc?.inVoiceChannel === c.id && <span className="ml-auto text-xs bg-green-500 text-white px-1.5 rounded-full">En llamada</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* User Panel */}
              <div className="bg-[#232428] h-14 flex items-center px-2 shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#5865f2] relative mr-2 cursor-pointer flex items-center justify-center text-white font-bold">
                  {user?.username?.[0]?.toUpperCase()}
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#232428]"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{user?.username}</div>
                  <div className="text-xs text-[#b5bac1] truncate flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>Online
                  </div>
                </div>
                
                {webrtc?.inVoiceChannel && (
                  <div className="flex mr-2">
                    <button onClick={webrtc.toggleMute} className={`p-1.5 mr-1 rounded hover:bg-[#35373c] ${webrtc.isMuted ? 'text-red-500' : 'text-[#b5bac1]'}`}>
                      {webrtc.isMuted ? '🔇' : '🎙️'}
                    </button>
                    <button onClick={webrtc.toggleDeafen} className={`p-1.5 rounded hover:bg-[#35373c] ${webrtc.isDeafened ? 'text-red-500' : 'text-[#b5bac1]'}`}>
                      {webrtc.isDeafened ? '🔕' : '🎧'}
                    </button>
                  </div>
                )}

                <button onClick={logout} className="text-[#b5bac1] hover:text-[#dbdee1] p-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
              {webrtc?.inVoiceChannel ? (
                <VoicePanel webrtc={webrtc} onlineUsers={onlineUsers} user={user} channelName={channels.find(c => c.id === webrtc.inVoiceChannel)?.name} />
              ) : currentChannel ? (
                <>
                  <div className="h-12 border-b border-[#2b2d31] flex items-center px-4 font-semibold text-white shadow-sm shrink-0">
                    <span className="text-[#80848e] text-2xl mr-2">#</span> {currentChannel.name}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    <div className="flex mt-4 items-start mb-6">
                      <div className="w-12 h-12 rounded-full bg-[#5865f2] mr-4 flex-shrink-0 flex items-center justify-center text-white font-bold text-xl">#</div>
                      <div>
                        <h2 className="text-white font-bold text-3xl">¡Te damos la bienvenida a #{currentChannel.name}!</h2>
                        <p className="text-[#80848e] mt-1">Este es el comienzo del canal {currentChannel.name}.</p>
                      </div>
                    </div>

                    {messages.map((msg, index) => (
                      <div key={msg.id || index} className="flex items-start hover:bg-[#2e3035] -mx-4 px-4 py-1.5 transition">
                        <div className="w-10 h-10 rounded-full bg-[#5865f2] mr-4 flex-shrink-0 flex items-center justify-center text-white font-bold">
                          {msg.user?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-baseline">
                            <span className="text-white font-medium mr-2 hover:underline cursor-pointer">{msg.user?.username || 'Usuario'}</span>
                            <span className="text-xs text-[#80848e]">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[#dbdee1] break-words">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 shrink-0">
                    <form onSubmit={sendMessage} className="bg-[#383a40] rounded-lg p-3 flex items-center">
                      <input 
                        type="text" 
                        placeholder={`Enviar mensaje a #${currentChannel.name}`}
                        className="bg-transparent text-[#dbdee1] flex-1 focus:outline-none"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                      />
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#80848e]">
                  Selecciona un canal para conversar
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            {!webrtc?.inVoiceChannel && (
              <div className="w-60 bg-[#2b2d31] hidden lg:block overflow-y-auto shrink-0 border-l border-[#1e1f22]">
                <h3 className="text-xs font-semibold text-[#80848e] uppercase tracking-wider p-4 pb-2">
                  Conectados — {Object.values(onlineUsers).filter(u => u.online).length}
                </h3>
                <div className="px-2 space-y-1">
                  {Object.values(onlineUsers).filter(u => u.online).map((u) => (
                    <div key={u.userId} className="flex items-center px-2 py-1.5 hover:bg-[#35373c] rounded cursor-pointer transition">
                      <div className="w-8 h-8 rounded-full bg-[#5865f2] relative mr-3 flex items-center justify-center text-white font-bold">
                        {u.username?.[0]?.toUpperCase()}
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#2b2d31]"></div>
                      </div>
                      <span className="text-[#dbdee1] text-base truncate">{u.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </WebRTCContext.Consumer>
    </WebRTCProvider>
  );
}
