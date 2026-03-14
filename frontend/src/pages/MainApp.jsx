import { useEffect, useContext, useState, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { WebRTCContext, WebRTCProvider } from '../context/WebRTCContext';
import { io } from 'socket.io-client';
import VoicePanel from '../components/VoicePanel';
import EmojiPicker from 'emoji-picker-react';
import { Paperclip, Smile, Send, X, Download, FileIcon, ImageIcon } from 'lucide-react';

export default function MainApp() {
  const { user, token, logout, setUser, setToken } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('text');
  const [voiceNotifications, setVoiceNotifications] = useState([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceChannelUsers, setVoiceChannelUsers] = useState({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileMembers, setShowMobileMembers] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [editChannelId, setEditChannelId] = useState(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [showChangeName, setShowChangeName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const chatEndRef = useRef(null);
  const notifTimerRef = useRef(null);

  const addVoiceNotification = (msg) => {
    const id = Date.now();
    setVoiceNotifications(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setVoiceNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

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

    newSocket.on('message_edited', (editedMsg) => {
      setMessages(prev => prev.map(msg => msg.id === editedMsg.id ? editedMsg : msg));
    });

    newSocket.on('channel_created', (newChannel) => {
      setChannels(prev => {
        if (prev.find(c => c.id === newChannel.id)) return prev;
        return [...prev, newChannel];
      });
    });

    // Evento de canal editado
    newSocket.on('channel_updated', (updatedChannel) => {
      setChannels(prev => prev.map(c => c.id === updatedChannel.id ? updatedChannel : c));
      setCurrentChannel(prev => prev?.id === updatedChannel.id ? { ...prev, name: updatedChannel.name } : prev);
    });

    // Evento de canal borrado
    newSocket.on('channel_deleted', ({ channelId }) => {
      setChannels(prev => prev.filter(c => c.id !== channelId));
      setCurrentChannel(prev => prev?.id === channelId ? null : prev);
    });

    // Notificaciones de voz join/leave
    newSocket.on('user_joined_voice', ({ username }) => {
      addVoiceNotification(`🔊 ${username} se unió al canal de voz`);
    });
    newSocket.on('user_left_voice', ({ username }) => {
      addVoiceNotification(`🔕 ${username} salió del canal de voz`);
    });

    // Lista de participantes en canales de voz
    newSocket.on('voice_participants_update', ({ channelId, participants }) => {
      setVoiceChannelUsers(prev => ({ ...prev, [channelId]: participants }));
    });

    // Estado inicial de todos los canales de voz al conectarse
    newSocket.on('voice_initial_state', (allParticipants) => {
      // allParticipants = { channelId: [ {...} ] }
      const parsed = {};
      Object.entries(allParticipants).forEach(([chId, parts]) => {
        parsed[parseInt(chId)] = parts;
      });
      setVoiceChannelUsers(parsed);
    });

    setSocket(newSocket);

    const fetchInitialData = async () => {
      try {
        // Fetch todos los usuarios (online y offline)
        const resUsers = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resUsers.ok) {
          const usersData = await resUsers.json();
          const usersMap = {};
          usersData.forEach(u => { 
            usersMap[u.id] = { 
              userId: u.id, 
              username: u.username, 
              displayName: u.displayName, 
              online: u.online 
            }; 
          });
          setOnlineUsers(usersMap);
        }

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
              if (firstText) selectTextChannel(firstText, newSocket);
           }
        } else {
           setChannels(validChannels);
           const lastChannelId = localStorage.getItem('lastChannelId');
           const defaultText = (lastChannelId && validChannels.find(c => String(c.id) === lastChannelId && c.type === 'text')) || validChannels.find(c => c.type === 'text');
           if (defaultText) selectTextChannel(defaultText, newSocket);
        }
      } catch (err) {
        console.error('Error fetching channel data', err);
      }
    };

    fetchInitialData();
    const lastChannelId = localStorage.getItem('lastChannelId');

    return () => newSocket.close();
  }, [token]);

  const selectTextChannel = async (channel, activeSocket = socket) => {
    setMessages([]); // Clear previous messages immediately
    setCurrentChannel(channel);
    localStorage.setItem('lastChannelId', channel.id);
    setShowVoicePanel(false);
    if (activeSocket) {
      activeSocket.emit('join_text_channel', channel.id);
    }
    try {
      const msgRes = await fetch(`${import.meta.env.VITE_API_URL}/api/channels/${channel.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!msgRes.ok) {
        console.error(`Error fetching messages: ${msgRes.status} ${msgRes.statusText}`);
        return;
      }
      const msgs = await msgRes.json();
      console.log(`Cargados ${msgs.length} mensajes para el canal ${channel.id}`);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error('Error fetching messages Exception:', err);
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
        body: JSON.stringify({ name: newChannelName, type: newChannelType })
      });

      if (res.ok) {
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

  const deleteChannel = async (e, channelId) => {
    e.stopPropagation();
    const ch = channels.find(c => c.id === channelId);
    if (ch?.type === 'voice' && voiceChannelUsers[channelId] && voiceChannelUsers[channelId].length > 0) {
      alert('No puedes borrar un canal de voz mientras hay usuarios conectados.');
      return;
    }

    if (!window.confirm('¿Estás seguro de que querés borrar este canal? Se borrarán todos sus mensajes.')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/channels/${channelId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const editChannelSubmit = async (e) => {
    e.preventDefault();
    if (!editChannelName.trim()) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/channels/${editChannelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editChannelName })
      });
      if (res.ok) {
        setShowEditChannel(false);
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitChangeName = async (e) => {
    e.preventDefault();
    if (!newNameInput.trim()) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/displayname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ displayName: newNameInput })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Notify socket about the name change
        if (socket) {
          socket.emit('user_info_updated', {
            userId: data.user.id,
            displayName: data.user.displayName
          });
        }
        
        setShowChangeName(false);
        setNewNameInput('');
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setIsUploading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/channels/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    } catch (err) {
      console.error(err);
      alert('Error al subir archivo');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    setMessageInput(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const sendMessage = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !currentChannel || !socket) return;

    let fileData = null;
    if (selectedFile) {
      fileData = await handleFileUpload(selectedFile);
      if (!fileData) return; // Stop if upload failed
    }

    socket.emit('send_message', {
      channelId: currentChannel.id,
      content: messageInput,
      fileUrl: fileData?.fileUrl,
      fileType: fileData?.fileType
    });

    setMessageInput('');
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitEdit = (e) => {
    e?.preventDefault();
    if (!editingMessage?.content?.trim() || !currentChannel || !socket) return;

    socket.emit('edit_message', {
      id: editingMessage.id,
      channelId: currentChannel.id,
      content: editingMessage.content
    });
    setEditingMessage(null);
  };

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  return (
    <WebRTCProvider socket={socket} user={user}>
      <WebRTCContext.Consumer>
        {(webrtc) => (
          <div className="flex h-screen bg-[#313338] text-[#dbdee1] overflow-hidden relative">
            
            {/* Notificaciones de voz flotantes */}
            <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
              {voiceNotifications.map(n => (
                <div key={n.id} className="bg-[#1e1f22] border border-[#3f4147] text-white text-sm px-4 py-2.5 rounded-lg shadow-xl animate-fade-in-down">
                  {n.msg}
                </div>
              ))}
            </div>

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

            {/* Modal Cambiar Nombre */}
            {showChangeName && (
              <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={e => { if(e.target === e.currentTarget) setShowChangeName(false); }}>
                <div className="bg-[#2b2d31] p-6 rounded-xl shadow-2xl w-80">
                  <h2 className="text-lg font-bold text-white mb-1">Cambiar nombre visual</h2>
                  <p className="text-xs text-[#80848e] mb-1">Tu nombre de usuario para iniciar sesión permanece: <span className="text-[#dbdee1] font-mono">{user?.username}</span></p>
                  <p className="text-xs text-[#80848e] mb-4">El nombre visual es lo que los demás verán en el chat.</p>
                  <form onSubmit={submitChangeName}>
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-[#1e1f22] p-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2] mb-4 text-sm"
                      value={newNameInput}
                      onChange={e => setNewNameInput(e.target.value)}
                      placeholder="Nombre que verán los demás"
                      maxLength={32}
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowChangeName(false)} className="text-[#b5bac1] hover:text-white px-4 py-2 text-sm transition">Cancelar</button>
                      <button type="submit" className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-2 px-5 rounded-lg transition text-sm">Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Editar Canal */}
            {showEditChannel && (
              <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={e => { if(e.target === e.currentTarget) setShowEditChannel(false); }}>
                <div className="bg-[#2b2d31] p-6 rounded-xl shadow-2xl w-80">
                  <h2 className="text-lg font-bold text-white mb-4">Editar canal</h2>
                  <form onSubmit={editChannelSubmit}>
                    <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Nombre del canal</label>
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-[#1e1f22] p-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2] mb-4 text-sm"
                      value={editChannelName}
                      onChange={e => setEditChannelName(e.target.value)}
                      required
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowEditChannel(false)} className="text-[#b5bac1] hover:text-white px-4 py-2 text-sm transition">Cancelar</button>
                      <button type="submit" className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold py-2 px-5 rounded-lg transition text-sm">Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Sidebar de canales */}
            <div className={`w-64 bg-[#2b2d31] flex flex-col shrink-0 absolute sm:relative z-40 h-full transition-transform ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}>
              <div className="h-12 border-b border-[#1e1f22] flex items-center justify-between px-4 shadow-sm shrink-0 hover:bg-[#35373c] cursor-pointer transition">
                <span className="font-bold text-white truncate">Pajabrava (Single Server)</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-5">
                {/* Canales de Texto */}
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
                      className={`flex items-center rounded px-2 py-1.5 cursor-pointer transition mb-0.5 group/ch ${currentChannel?.id === c.id && !showVoicePanel ? 'bg-[#404249] text-white font-medium' : 'text-[#80848e] hover:text-[#dbdee1] hover:bg-[#35373c]'}`}
                    >
                      <span className="text-[#80848e] mr-2 text-xl">#</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setEditChannelId(c.id); setEditChannelName(c.name); setShowEditChannel(true); }}
                        className="opacity-0 group-hover/ch:opacity-100 text-[#80848e] hover:text-[#dbdee1] transition ml-1 p-0.5 rounded"
                        title="Editar canal"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                      </button>
                      <button
                        onClick={(e) => deleteChannel(e, c.id)}
                        className="opacity-0 group-hover/ch:opacity-100 text-[#80848e] hover:text-red-400 transition ml-0.5 p-0.5 rounded"
                        title="Borrar canal"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Canales de Voz */}
                <div>
                  <div className="flex items-center justify-between mb-1 group">
                    <h3 className="text-xs font-semibold text-[#80848e] group-hover:text-[#dbdee1] uppercase tracking-wider transition cursor-default">Canales de Voz</h3>
                    <button onClick={() => {setNewChannelType('voice'); setShowCreateChannel(true);}} className="text-[#80848e] hover:text-[#dbdee1] opacity-0 group-hover:opacity-100 transition">
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                  </div>
                  {voiceChannels.map(c => {
                    const participants = voiceChannelUsers[c.id] || [];
                    const isInThisChannel = webrtc?.inVoiceChannel === c.id;

                    return (
                      <div key={c.id} className="mb-1">
                        {/* Fila del canal */}
                        <div
                          className={`flex items-center rounded px-2 py-1.5 cursor-pointer transition group/ch ${isInThisChannel ? 'bg-[#35373c] text-green-400 font-bold' : 'text-[#80848e] hover:text-[#dbdee1] hover:bg-[#35373c]'}`}
                          onClick={() => {
                            if (isInThisChannel) {
                              setShowVoicePanel(true);
                            } else {
                              if (webrtc?.inVoiceChannel) webrtc.leaveVoiceChannel();
                              webrtc.joinVoiceChannel(c.id);
                              setShowVoicePanel(true);
                            }
                          }}
                        >
                          <span className="mr-2 text-base">🔊</span>
                          <span className="flex-1 truncate text-sm">{c.name}</span>
                          {participants.length > 0 && (
                            <span className="text-xs text-[#80848e] mr-1">{participants.length}</span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setEditChannelId(c.id); setEditChannelName(c.name); setShowEditChannel(true); }}
                            className="opacity-0 group-hover/ch:opacity-100 text-[#80848e] hover:text-[#dbdee1] transition p-0.5 rounded shrink-0"
                            title="Editar canal"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                          </button>
                          <button
                            onClick={(e) => deleteChannel(e, c.id)}
                            className="opacity-0 group-hover/ch:opacity-100 text-[#80848e] hover:text-red-400 transition p-0.5 rounded shrink-0"
                            title="Borrar canal"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                          </button>
                        </div>

                        {/* Lista de participantes dentro del canal */}
                        {participants.length > 0 && (
                          <div className="ml-4 mt-0.5 space-y-0.5">
                            {participants.map(p => (
                              <div
                                key={p.userId}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#35373c] transition cursor-default"
                              >
                                {/* Avatar */}
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${p.userId === user?.id ? 'bg-[#5865f2]' : 'bg-[#4e5058]'}`}>
                                  {p.username?.[0]?.toUpperCase()}
                                </div>
                                {/* Nombre */}
                                <span className={`text-xs truncate flex-1 ${p.userId === user?.id ? 'text-green-400' : 'text-[#b5bac1]'}`}>
                                  {p.username}{p.userId === user?.id ? ' (Tú)' : ''}
                                </span>
                                {/* Iconos de estado - siempre mostrar los que aplican */}
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {p.isScreenSharing && (
                                    <span className="text-[9px] bg-red-500 text-white px-1 rounded font-bold uppercase tracking-wider mr-0.5">Transm.</span>
                                  )}
                                  {p.isMuted && (
                                    <svg className="text-red-400" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" title="Silenciado">
                                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                                    </svg>
                                  )}
                                  {p.isDeafened && (
                                    <svg className="text-red-400" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" title="Ensordecido">
                                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                                    </svg>
                                  )}
                                  {!p.isMuted && !p.isDeafened && !p.isScreenSharing && (
                                    <svg className="text-[#80848e]" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" title="Micrófono activo">
                                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                                    </svg>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Voice Connected & User Panel Container */}
              <div className="shrink-0 flex flex-col bg-[#232428]">
                {webrtc?.inVoiceChannel && (
                  <div className="border-b border-[#1e1f22] p-2 flex flex-col gap-2 bg-[#101010] bg-opacity-30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="text-green-500" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                        </svg>
                        <div className="flex flex-col">
                          <span className="text-green-500 text-sm font-bold leading-tight">Voz conectada</span>
                          <span className="text-[#80848e] text-xs leading-none mt-0.5 truncate max-w-[120px]">
                            {channels.find(c => c.id === webrtc.inVoiceChannel)?.name} / Pajabrava
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => webrtc.leaveVoiceChannel()}
                        className="text-[#80848e] hover:text-red-500 transition p-1"
                        title="Desconectar"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                      </button>
                    </div>
                    <div className="flex gap-1.5 h-8">
                       <button
                          onClick={webrtc.toggleMute}
                          className={`flex-1 rounded flex items-center justify-center transition ${webrtc.isMuted ? 'bg-[#35373c] text-red-400' : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'}`}
                          title={webrtc.isMuted ? "Activar micrófono" : "Silenciar micrófono"}
                       >
                          {webrtc.isMuted ? (
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>
                          ) : (
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                          )}
                       </button>
                       <button
                          onClick={webrtc.toggleDeafen}
                          className={`flex-1 rounded flex items-center justify-center transition ${webrtc.isDeafened ? 'bg-[#35373c] text-red-400' : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'}`}
                          title={webrtc.isDeafened ? "Dejar de ensordecer" : "Ensordecer"}
                       >
                          {webrtc.isDeafened ? (
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                          ) : (
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                          )}
                       </button>
                       <button
                          onClick={webrtc.shareScreen}
                          className={`flex-1 rounded flex items-center justify-center transition ${webrtc.screenStream ? 'bg-[#35373c] text-green-400' : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'}`}
                          title={webrtc.screenStream ? "Dejar de compartir pantalla" : "Compartir pantalla"}
                       >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-7v2h-3v3h-2v-3H8v-2h3V7h2v3h3z"/></svg>
                       </button>
                    </div>
                  </div>
                )}
                
                <div className="h-14 flex items-center px-2 shrink-0 relative">
                  <div 
                    className="flex flex-1 items-center hover:bg-[#35373c] p-1.5 rounded cursor-pointer transition select-none"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#5865f2] relative mr-2 flex items-center justify-center text-white font-bold shrink-0">
                      {user?.username?.[0]?.toUpperCase()}
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#232428]"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate leading-tight">{user?.username}</div>
                      <div className="text-xs text-[#b5bac1] truncate leading-tight">Online</div>
                    </div>
                  </div>

                    {showUserMenu && (
                     <div className="absolute bottom-full left-2 mb-2 w-56 bg-[#111214] rounded-lg shadow-xl border border-[#1e1f22] p-1.5 z-50">
                       <div className="px-2 pt-1 pb-2 border-b border-[#2b2d31] mb-1">
                         <div className="text-xs text-[#80848e] font-semibold uppercase tracking-wider">{user?.displayName || user?.username}</div>
                         <div className="text-[10px] text-[#4e5058] mt-0.5">@{user?.username}</div>
                       </div>
                       <div
                         onClick={() => { setNewNameInput(user?.displayName || ''); setShowChangeName(true); setShowUserMenu(false); }}
                         className="px-2 py-1.5 mb-0.5 flex items-center gap-2 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white rounded cursor-pointer transition"
                       >
                         <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                         <span className="text-sm">Cambiar nombre</span>
                       </div>
                       <div className="h-px bg-[#2b2d31] my-1 mx-1"></div>
                       <div
                         onClick={logout}
                         className="px-2 py-1.5 flex items-center gap-2 text-[#da373c] hover:bg-[#da373c] hover:text-white rounded cursor-pointer transition"
                       >
                         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                         <span className="text-sm">Cerrar sesión</span>
                       </div>
                     </div>
                    )}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            {showMobileSidebar && (
              <div className="absolute inset-0 bg-black/50 z-30 sm:hidden" onClick={() => setShowMobileSidebar(false)}></div>
            )}
            
            <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
              {webrtc?.inVoiceChannel && showVoicePanel ? (
                // Voice Panel con botón para volver al texto
                <div className="flex-1 flex flex-col min-h-0">
                  <VoicePanel
                    webrtc={webrtc}
                    participants={voiceChannelUsers[webrtc.inVoiceChannel] || []}
                    user={user}
                    channelName={channels.find(c => c.id === webrtc.inVoiceChannel)?.name}
                  />
                  {/* Barra inferior para volver al texto */}
                  {currentChannel && (
                    <div className="shrink-0 bg-[#232428] border-t border-[#1e1f22] px-4 py-2 flex items-center gap-3">
                      <span className="text-[#80848e] text-sm">También estás en</span>
                      <button
                        onClick={() => setShowVoicePanel(false)}
                        className="flex items-center gap-2 text-sm text-[#00a8fc] hover:underline"
                      >
                        <span className="text-[#80848e]">#</span>{currentChannel.name}
                      </button>
                    </div>
                  )}
                </div>
              ) : currentChannel ? (
                <>
                  {/* Header del canal de texto - con indicador de voz activa */}
                  <div className="h-12 border-b border-[#2b2d31] flex items-center px-4 font-semibold text-white shadow-sm shrink-0">
                    <button className="mr-3 sm:hidden text-[#80848e] hover:text-[#dbdee1]" onClick={() => setShowMobileSidebar(true)}>
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
                    </button>
                    <span className="text-[#80848e] text-2xl mr-2">#</span> {currentChannel.name}
                    
                    <button className="ml-auto lg:hidden text-[#80848e] hover:text-[#dbdee1]" onClick={() => setShowMobileMembers(true)}>
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    </button>
                    
                    {webrtc?.inVoiceChannel && (
                      <button
                        onClick={() => setShowVoicePanel(true)}
                        className="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 transition"
                      >
                        <span>🔊</span> Volver a Voz
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    <div className="flex mt-4 items-start mb-6">
                      <div className="w-12 h-12 rounded-full bg-[#5865f2] mr-4 flex-shrink-0 flex items-center justify-center text-white font-bold text-xl">#</div>
                      <div>
                        <h2 className="text-white font-bold text-3xl">¡Te damos la bienvenida a #{currentChannel.name}!</h2>
                        <p className="text-[#80848e] mt-1">Este es el comienzo del canal {currentChannel.name}.</p>
                      </div>
                    </div>

                    {messages.map((msg, index) => {
                      // Check if current user is mentioned
                      const isMentioned = msg.content.includes(`@${user?.username}`);
                      
                      // Parse @mentions in message content
                      const renderContent = (text) => {
                        const parts = text.split(/(@\w[\w\s]*\w|@\w+)/g);
                        return parts.map((part, i) => {
                          if (part.startsWith('@')) {
                            const mentioned = part.slice(1);
                            const isMentioningMe = mentioned === user?.username;
                            return <span key={i} className={`font-semibold px-0.5 rounded ${isMentioningMe ? 'text-yellow-300' : 'text-[#5865f2] hover:underline cursor-pointer'}`}>{part}</span>;
                          }
                          return part;
                        });
                      };
                      return (
                        <div key={msg.id || index} className={`flex items-start -mx-4 px-4 py-1.5 transition group/msg relative ${isMentioned ? 'bg-yellow-400/10 border-l-2 border-yellow-400' : 'hover:bg-[#2e3035]'}`}>
                          <div className="w-10 h-10 rounded-full bg-[#5865f2] mr-4 flex-shrink-0 flex items-center justify-center text-white font-bold mt-1">
                            {(msg.user?.displayName || msg.user?.username)?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0 pr-10">
                            <div className="flex items-baseline gap-2">
                              <span className="text-white font-semibold hover:underline cursor-pointer">{msg.user?.username || 'Usuario'}</span>
                              <span className="text-[11px] text-[#80848e]">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {editingMessage?.id === msg.id ? (
                              <form onSubmit={submitEdit} className="w-full mt-1">
                                <input
                                  autoFocus
                                  className="w-full bg-[#383a40] text-[#dbdee1] px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5865f2] text-sm"
                                  value={editingMessage.content}
                                  onChange={e => setEditingMessage({ ...editingMessage, content: e.target.value })}
                                  onKeyDown={e => { if (e.key === 'Escape') setEditingMessage(null); }}
                                />
                                <div className="text-xs text-[#80848e] mt-1">
                                  escape para <span className="text-[#00a8fc] cursor-pointer hover:underline" onClick={() => setEditingMessage(null)}>cancelar</span> • enter para <span className="text-[#00a8fc] cursor-pointer hover:underline" onClick={submitEdit}>guardar</span>
                                </div>
                              </form>
                            ) : (
                              <p className="text-[#dbdee1] break-words text-sm leading-relaxed mt-0.5">
                                {renderContent(msg.content)}
                              </p>
                            )}
                            {/* File Attachments */}
                            {msg.fileUrl && (
                              <div className="mt-2 max-w-sm">
                                {msg.fileType?.startsWith('image/') ? (
                                  <div className="rounded-lg overflow-hidden border border-[#1e1f22] bg-[#2b2d31]">
                                    <img 
                                      src={`${import.meta.env.VITE_API_URL}${msg.fileUrl}`} 
                                      alt="Adjunto" 
                                      className="max-h-80 w-auto object-contain cursor-pointer hover:opacity-90 transition"
                                      onClick={() => window.open(`${import.meta.env.VITE_API_URL}${msg.fileUrl}`, '_blank')}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 p-3 bg-[#2b2d31] rounded-lg border border-[#1e1f22] group/file">
                                    <FileIcon size={24} className="text-[#80848e]" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-[#dbdee1] truncate">{msg.fileUrl.split('/').pop()}</div>
                                      <div className="text-xs text-[#80848e] uppercase font-bold">{msg.fileType?.split('/')[1] || 'Archivo'}</div>
                                    </div>
                                    <a 
                                      href={`${import.meta.env.VITE_API_URL}${msg.fileUrl}`} 
                                      download 
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 bg-[#1e1f22] rounded text-[#b5bac1] hover:text-white transition"
                                    >
                                      <Download size={18} />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Botones de accion hovear */}
                          {msg.user?.id === user?.id && editingMessage?.id !== msg.id && (
                            <div className="absolute right-4 top-1.5 opacity-0 group-hover/msg:opacity-100 transition bg-[#2b2d31] shadow-lg border border-[#1e1f22] rounded-lg flex overflow-hidden">
                              <button
                                onClick={() => setEditingMessage({ id: msg.id, content: msg.content })}
                                className="px-3 py-1.5 hover:bg-[#35373c] text-[#b5bac1] hover:text-[#dbdee1] text-xs font-semibold transition flex items-center gap-1"
                                title="Editar mensaje"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                Editar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input with @mention */}
                  <div className="px-4 pb-5 pt-2 shrink-0">
                    {/* File Preview before sending */}
                    {selectedFile && (
                      <div className="mb-2 p-2 bg-[#2b2d31] rounded-lg border border-[#1e1f22] flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3 min-w-0">
                          {filePreview ? (
                            <img src={filePreview} alt="Preview" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-[#313338] rounded flex items-center justify-center">
                              <FileIcon size={20} className="text-[#80848e]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#dbdee1] truncate">{selectedFile.name}</div>
                            <div className="text-[10px] text-[#80848e] uppercase">{Math.round(selectedFile.size / 1024)} KB</div>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { setSelectedFile(null); setFilePreview(null); if(fileInputRef.current) fileInputRef.current.value=''; }}
                          className="p-1 text-[#80848e] hover:text-red-400 transition"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}

                    {/* Emoji Picker Overlay */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-20 right-4 z-50">
                        <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)}></div>
                        <div className="relative">
                          <EmojiPicker 
                            onEmojiClick={onEmojiClick} 
                            theme="dark" 
                            width={350} 
                            height={400}
                            skinTonesDisabled
                            searchPlaceHolder="Buscar emoji..."
                          />
                        </div>
                      </div>
                    )}

                    {showMentionList && mentionQuery && (() => {
                      const mentionUsers = Object.values(onlineUsers).filter(u => u.online && u.username && u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()) && u.userId !== user?.id);
                      if (mentionUsers.length === 0) return null;
                      return (
                        <div className="mb-2 bg-[#2b2d31] rounded-xl border border-[#1e1f22] shadow-xl overflow-hidden">
                          <div className="px-3 py-1.5 text-[10px] text-[#80848e] uppercase font-bold tracking-wider border-b border-[#1e1f22]">Mencionar usuario</div>
                          {mentionUsers.slice(0, 6).map((u, i) => (
                            <div
                              key={u.userId}
                              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition ${i === mentionIndex ? 'bg-[#404249]' : 'hover:bg-[#35373c]'}`}
                              onMouseDown={e => {
                                e.preventDefault();
                                const beforeAt = messageInput.lastIndexOf('@');
                                const newVal = messageInput.substring(0, beforeAt) + '@' + u.username + ' ';
                                setMessageInput(newVal);
                                setShowMentionList(false);
                                inputRef.current?.focus();
                              }}
                            >
                              <div className="w-6 h-6 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-xs font-bold shrink-0">{u.username[0].toUpperCase()}</div>
                              <span className="text-[#dbdee1] text-sm font-medium">{u.username}</span>
                              {i === mentionIndex && <span className="ml-auto text-[10px] text-[#80848e]">Tab para seleccionar</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="relative bg-[#383a40] rounded-xl flex items-center gap-1 pl-4 pr-2 shadow-sm">
                      {/* Plus button */}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                      />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#80848e] hover:text-[#dbdee1] transition p-1 shrink-0" 
                        title="Adjuntar archivo"
                        disabled={isUploading}
                      >
                        <Paperclip size={20} className={isUploading ? 'animate-pulse' : ''} />
                      </button>

                      <form onSubmit={(e) => { e.preventDefault(); sendMessage(e); setShowMentionList(false); }} className="flex-1 flex items-center">
                        <input
                          ref={inputRef}
                          type="text"
                          placeholder={`Mensaje en #${currentChannel.name}`}
                          className="bg-transparent text-[#dbdee1] w-full py-3.5 focus:outline-none placeholder-[#4e5058] text-sm"
                          value={messageInput}
                          onChange={e => {
                            const val = e.target.value;
                            setMessageInput(val);
                            const atIdx = val.lastIndexOf('@');
                            if (atIdx !== -1 && (atIdx === 0 || val[atIdx-1] === ' ')) {
                              const query = val.slice(atIdx + 1);
                              if (!query.includes(' ')) {
                                setMentionQuery(query);
                                setShowMentionList(true);
                                setMentionIndex(0);
                                return;
                              }
                            }
                            setShowMentionList(false);
                          }}
                          onKeyDown={e => {
                            if (showMentionList) {
                              const mentionUsers = Object.values(onlineUsers).filter(u => u.online && u.username && u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()) && u.userId !== user?.id);
                              if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i+1, mentionUsers.length-1)); }
                              if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i-1, 0)); }
                              if (e.key === 'Tab' || e.key === 'Enter') {
                                if (mentionUsers[mentionIndex]) {
                                  e.preventDefault();
                                  const beforeAt = messageInput.lastIndexOf('@');
                                  setMessageInput(messageInput.substring(0, beforeAt) + '@' + mentionUsers[mentionIndex].username + ' ');
                                  setShowMentionList(false);
                                }
                              }
                              if (e.key === 'Escape') { setShowMentionList(false); }
                            }
                          }}
                        />
                      </form>

                      {/* Emoji button */}
                      <button 
                        type="button" 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`transition p-1 shrink-0 ${showEmojiPicker ? 'text-yellow-400' : 'text-[#80848e] hover:text-yellow-400'}`} 
                        title="Emoji"
                      >
                        <Smile size={20} />
                      </button>

                      {/* Send button */}
                      {(messageInput.trim() || selectedFile) && (
                        <button
                          type="button"
                          onClick={sendMessage}
                          disabled={isUploading}
                          className="text-[#5865f2] hover:text-[#4752c4] transition p-1 shrink-0 disabled:opacity-50"
                          title="Enviar mensaje"
                        >
                          {isUploading ? (
                            <div className="w-5 h-5 border-2 border-[#5865f2] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Send size={20} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#80848e]">
                  Selecciona un canal para conversar
                </div>
              )}
            </div>

            {/* Right Sidebar - Usuarios conectados */}
            {!(webrtc?.inVoiceChannel && showVoicePanel) && (
              <>
                <div className={`w-60 bg-[#2b2d31] overflow-y-auto shrink-0 border-l border-[#1e1f22] absolute lg:relative right-0 z-40 h-full transition-transform ${showMobileMembers ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
                  <h3 className="text-xs font-semibold text-[#80848e] uppercase tracking-wider p-4 pb-2 flex justify-between items-center">
                    <span>Conectados — {Object.values(onlineUsers).filter(u => u.online).length}</span>
                    <button className="lg:hidden text-[#80848e] hover:text-white" onClick={() => setShowMobileMembers(false)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                  </h3>
                  <div className="px-2 space-y-1">
                    {/* Online Users */}
                    {Object.values(onlineUsers).filter(u => u.online && u.username).map((u) => (
                      <div key={u.userId} className="flex items-center px-2 py-1.5 hover:bg-[#35373c] rounded cursor-pointer transition">
                        <div className="w-8 h-8 rounded-full bg-[#5865f2] relative mr-3 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {u.displayName?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase()}
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#2b2d31]"></div>
                        </div>
                        <span className="text-[#dbdee1] text-sm truncate font-medium">{u.displayName || u.username}</span>
                      </div>
                    ))}

                    {/* Offline Users */}
                    <h3 className="text-xs font-semibold text-[#80848e] uppercase tracking-wider p-4 pb-1 mt-4">Desconectados — {Object.values(onlineUsers).filter(u => !u.online).length}</h3>
                    {Object.values(onlineUsers).filter(u => !u.online && u.username).map((u) => (
                      <div key={u.userId} className="flex items-center px-2 py-1.5 hover:bg-[#35373c] rounded cursor-pointer transition opacity-40 grayscale-[0.5]">
                        <div className="w-8 h-8 rounded-full bg-[#4e5058] relative mr-3 flex items-center justify-center text-[#b5bac1] font-bold text-sm shrink-0">
                          {u.displayName?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-[#949ba4] text-sm truncate">{u.displayName || u.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {showMobileMembers && (
                  <div className="absolute inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setShowMobileMembers(false)}></div>
                )}
              </>
            )}
          </div>
        )}
      </WebRTCContext.Consumer>
    </WebRTCProvider>
  );
}
