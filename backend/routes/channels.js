import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './auth.js';

const router = express.Router();
const prisma = new PrismaClient();
import { voiceParticipants } from '../sockets/index.js';
import multer from 'multer';
import path from 'path';

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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
        user: { select: { id: true, username: true, displayName: true } }
      },
      select: {
        id: true,
        content: true,
        fileUrl: true,
        fileType: true,
        userId: true,
        channelId: true,
        createdAt: true,
        updatedAt: true,
        user: true
      },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Editar nombre de canal
router.put('/:channelId', verifyToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) return res.status(400).json({ error: 'ID inválido' });

    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const updatedChannel = await prisma.channel.update({
      where: { id: channelId },
      data: { name: name.trim() }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('channel_updated', updatedChannel);
    }

    res.json(updatedChannel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Borrar un canal
router.delete('/:channelId', verifyToken, async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) return res.status(400).json({ error: 'ID inválido' });

    // Verificar si hay usuarios en el canal de voz
    if (voiceParticipants[channelId] && voiceParticipants[channelId].length > 0) {
      return res.status(400).json({ error: 'No podés borrar un canal de voz mientas hay usuarios conectados' });
    }

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

// Ruta para cargar archivos
router.post('/upload', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se cargó ningún archivo' });
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    fileUrl, 
    fileType: req.file.mimetype,
    fileName: req.file.originalname
  });
});

export default router;
