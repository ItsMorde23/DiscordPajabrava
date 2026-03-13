import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://192.168.1.34:5173', // Vite default port
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

import authRoutes from './routes/auth.js';
import channelsRoutes from './routes/channels.js';

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelsRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Pajabrava API Running');
});

import { setupSockets } from './sockets/index.js';

setupSockets(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
