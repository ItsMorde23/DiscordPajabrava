import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Mapa en memoria: { channelId: [ { userId, username, socketId, isMuted, isDeafened } ] }
const voiceParticipants = {};

export function setupSockets(io) {
  // Middleware de autenticación para socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return next(new Error("Authentication error"));
      socket.user = decoded;
      
      // Marcar usuario como online en DB
      await prisma.user.update({
        where: { id: decoded.id },
        data: { online: true }
      });
      
      next();
    });
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Emitir a todos que alguien se conectó
    io.emit('user_status_change', {
      userId: socket.user.id,
      username: socket.user.username,
      online: true
    });

    // Enviar al nuevo cliente el estado actual de TODOS los canales de voz
    // para que vea quién está conectado antes de unirse a ninguno
    socket.emit('voice_initial_state', voiceParticipants);

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
      
      await prisma.user.update({
        where: { id: socket.user.id },
        data: { online: false }
      });

      io.emit('user_status_change', {
        userId: socket.user.id,
        online: false
      });

      // Limpiar de cualquier canal de voz si se desconecta abruptamente
      Object.keys(voiceParticipants).forEach(channelId => {
        const before = voiceParticipants[channelId]?.length || 0;
        voiceParticipants[channelId] = (voiceParticipants[channelId] || []).filter(
          p => p.socketId !== socket.id
        );
        if (voiceParticipants[channelId].length !== before) {
          io.emit('voice_participants_update', {
            channelId: parseInt(channelId),
            participants: voiceParticipants[channelId]
          });
          io.to(`voice_${channelId}`).emit('user_left_voice', {
            userId: socket.user.id,
            username: socket.user.username,
            socketId: socket.id
          });
          socket.leave(`voice_${channelId}`);
        }
      });
    });

    // --- TEXT CHANNELS ---
    socket.on('join_text_channel', (channelId) => {
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith('text_')) socket.leave(room);
      });
      
      socket.join(`text_${channelId}`);
      console.log(`User ${socket.user.username} joined text room: text_${channelId}`);
    });

    // Enviar y persistir mensaje
    socket.on('send_message', async (data) => {
      try {
        const { channelId, content } = data;
        const newMessage = await prisma.message.create({
          data: { content, userId: socket.user.id, channelId },
          include: { user: { select: { id: true, username: true } } }
        });
        io.to(`text_${channelId}`).emit('receive_message', newMessage);
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });

    // --- WEBRTC SIGNALING ---
    // Unirse a un canal de voz
    socket.on('join_voice', (channelId) => {
      if (!voiceParticipants[channelId]) voiceParticipants[channelId] = [];

      // Evitar duplicado si ya está
      const alreadyIn = voiceParticipants[channelId].some(p => p.userId === socket.user.id);
      if (!alreadyIn) {
        voiceParticipants[channelId].push({
          userId: socket.user.id,
          username: socket.user.username,
          socketId: socket.id,
          isMuted: false,
          isDeafened: false
        });
      }

      socket.join(`voice_${channelId}`);

      // Notificar a los otros en el canal que alguien entró (para WebRTC)
      socket.to(`voice_${channelId}`).emit('user_joined_voice', {
        userId: socket.user.id,
        username: socket.user.username,
        socketId: socket.id
      });

      // Enviar a todos la lista actualizada de participantes
      io.emit('voice_participants_update', {
        channelId: parseInt(channelId),
        participants: voiceParticipants[channelId]
      });
    });

    // Salir de un canal de voz
    socket.on('leave_voice', (channelId) => {
      socket.leave(`voice_${channelId}`);

      if (voiceParticipants[channelId]) {
        voiceParticipants[channelId] = voiceParticipants[channelId].filter(
          p => p.socketId !== socket.id
        );
      }

      socket.to(`voice_${channelId}`).emit('user_left_voice', {
        userId: socket.user.id,
        username: socket.user.username,
        socketId: socket.id
      });

      // Enviar a todos la lista actualizada de participantes
      io.emit('voice_participants_update', {
        channelId: parseInt(channelId),
        participants: voiceParticipants[channelId] || []
      });
    });

    // Actualizar estado de mute/deafen de un participante
    socket.on('voice_state_update', ({ channelId, isMuted, isDeafened }) => {
      if (voiceParticipants[channelId]) {
        const participant = voiceParticipants[channelId].find(p => p.userId === socket.user.id);
        if (participant) {
          participant.isMuted = isMuted;
          participant.isDeafened = isDeafened;
        }
      }

      // Emitir lista actualizada a todos
      io.emit('voice_participants_update', {
        channelId: parseInt(channelId),
        participants: voiceParticipants[channelId] || []
      });
    });

    // Intercambio de Ofertas, Respuestas y Candidatos ICE (Mesh P2P)
    socket.on('webrtc_offer', (data) => {
      io.to(data.targetSocketId).emit('webrtc_offer', {
        offer: data.offer,
        senderSocketId: socket.id,
        senderUserId: socket.user.id,
        senderUsername: socket.user.username
      });
    });

    socket.on('webrtc_answer', (data) => {
      io.to(data.targetSocketId).emit('webrtc_answer', {
        answer: data.answer,
        senderSocketId: socket.id
      });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      io.to(data.targetSocketId).emit('webrtc_ice_candidate', {
        candidate: data.candidate,
        senderSocketId: socket.id
      });
    });
  });
}
