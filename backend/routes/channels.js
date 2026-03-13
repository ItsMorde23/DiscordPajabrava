import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todos los canales
router.get('/', verifyToken, async (req, res) => {
  try {
    const channels = await prisma.channel.findMany();
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo canal
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Nombre y tipo son requeridos' });

    // validate type
    if (type !== 'text' && type !== 'voice') {
       return res.status(400).json({ error: 'Tipo inválido (text o voice)' });
    }

    const newChannel = await prisma.channel.create({
      data: { name, type }
    });

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('channel_created', newChannel);
    }

    res.status(201).json(newChannel);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'El canal ya existe' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener o crear canal "general" por defecto
router.get('/default', verifyToken, async (req, res) => {
  try {
    let generalChannel = await prisma.channel.findFirst({
      where: { name: 'general', type: 'text' }
    });

    if (!generalChannel) {
      generalChannel = await prisma.channel.create({
        data: { name: 'general', type: 'text' }
      });
    }

    res.json(generalChannel);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener historial de mensajes
router.get('/:channelId/messages', verifyToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) return res.status(400).json({ error: 'ID inválido' });

    const messages = await prisma.message.findMany({
      where: { channelId },
      include: {
        user: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 50 // Last 50 messages
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Borrar un canal
router.delete('/:channelId', verifyToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) return res.status(400).json({ error: 'ID inválido' });

    // Primero borrar mensajes del canal
    await prisma.message.deleteMany({ where: { channelId } });
    await prisma.channel.delete({ where: { id: channelId } });

    // Notificar a todos via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('channel_deleted', { channelId });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
