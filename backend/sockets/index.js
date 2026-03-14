import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Mapa en memoria: { channelId: [ { userId, username, socketId, isMuted, isDeafened, isScreenSharing } ] }
export const voiceParticipants = {};

export function setupSockets(io) {
  // Middleware de autenticación para socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return next(new Error("Authentication error"));
      try {
        const dbUser = await prisma.user.update({
          where: { id: decoded.id },
          data: { online: true },
          select: { id: true, username: true, displayName: true }
        });
        socket.user = { ...decoded, displayName: dbUser.displayName };
        next();
      } catch (dbErr) {
        console.error("Error en auth del socket (posible schema desactualizado):", dbErr.message);
        next(new Error("Database error"));
      }
    });
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Emitir a todos que alguien se conectó
    io.emit('user_status_change', {
      userId: socket.user.id,
      username: socket.user.username,
      displayName: socket.user.displayName || null,
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
        const { channelId, content, fileUrl, fileType } = data;
        const newMessage = await prisma.message.create({
          data: { 
            content, 
            userId: socket.user.id, 
            channelId: parseInt(channelId), 
            fileUrl, 
            fileType 
          },
          include: { user: { select: { id: true, username: true, displayName: true } } }
        });
        io.to(`text_${channelId}`).emit('receive_message', newMessage);
      } catch (err) {
        console.error('Error saving message to database:', err);
      }
    });

    // Editar mensaje
    socket.on('edit_message', async ({ id, channelId, content }) => {
      try {
        const existingMessage = await prisma.message.findUnique({ where: { id } });
        if (!existingMessage || existingMessage.userId !== socket.user.id) return;

        const updatedMessage = await prisma.message.update({
          where: { id: parseInt(id) },
          data: { content },
          include: { user: { select: { id: true, username: true, displayName: true } } }
        });
        io.to(`text_${channelId}`).emit('message_edited', updatedMessage);
      } catch (err) {
        console.error('Error editing message:', err);
      }
    });

    // --- WEBRTC SIGNALING ---
    // Unirse a un canal de voz
    socket.on('join_voice', (data) => {
      const channelId = typeof data === 'object' ? data.channelId : data;
      const initialMuted = typeof data === 'object' ? !!data.isMuted : false;
      const initialDeafened = typeof data === 'object' ? !!data.isDeafened : false;

      if (!voiceParticipants[channelId]) voiceParticipants[channelId] = [];

      // Evitar duplicado si ya está
      const alreadyIn = voiceParticipants[channelId].some(p => p.userId === socket.user.id);
      if (!alreadyIn) {
        voiceParticipants[channelId].push({
          userId: socket.user.id,
          username: socket.user.username,
          displayName: socket.user.displayName || null,
          socketId: socket.id,
          isMuted: initialMuted,
          isDeafened: initialDeafened,
          isScreenSharing: false
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

    // Actualizar estado de mute/deafen/screen de un participante
    socket.on('voice_state_update', ({ channelId, isMuted, isDeafened, isScreenSharing }) => {
      if (voiceParticipants[channelId]) {
        const participant = voiceParticipants[channelId].find(p => p.userId === socket.user.id);
        if (participant) {
          if (isMuted !== undefined) participant.isMuted = isMuted;
          if (isDeafened !== undefined) participant.isDeafened = isDeafened;
          if (isScreenSharing !== undefined) participant.isScreenSharing = isScreenSharing;
        }
      }

      // Emitir lista actualizada a todos
      io.emit('voice_participants_update', {
        channelId: parseInt(channelId),
        participants: voiceParticipants[channelId] || []
      });
    });

    // Actualizar información de usuario (p.ej. nombre visual)
    socket.on('user_info_updated', ({ userId, displayName }) => {
      // Actualizar en el mapa de voz si está conectado
      Object.keys(voiceParticipants).forEach(chId => {
        const p = voiceParticipants[chId].find(u => u.userId === userId);
        if (p) {
          p.displayName = displayName;
          // Notificar actualización de participantes para ese canal
          io.emit('voice_participants_update', {
            channelId: parseInt(chId),
            participants: voiceParticipants[chId]
          });
        }
      });

      // Notificar a todos el cambio de status/info
      io.emit('user_status_change', {
        userId,
        displayName,
        online: true
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
