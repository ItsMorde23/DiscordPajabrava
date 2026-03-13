import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
    });

    // --- TEXT CHANNELS ---
    socket.on('join_text_channel', (channelId) => {
      // Salir de salas de texto anteriores (opcional pero limpio)
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
      socket.join(`voice_${channelId}`);
      // Notificar a los otros en el canal que alguien entró para que inicien la llamada P2P
      socket.to(`voice_${channelId}`).emit('user_joined_voice', {
        userId: socket.user.id,
        username: socket.user.username,
        socketId: socket.id
      });
    });

    // Salir de un canal de voz
    socket.on('leave_voice', (channelId) => {
      socket.leave(`voice_${channelId}`);
      socket.to(`voice_${channelId}`).emit('user_left_voice', {
        userId: socket.user.id,
        socketId: socket.id
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
