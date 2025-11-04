import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import deliverySocket from './sockets/deliverySocket.js';
import { setupOrderSocket } from './sockets/orderSocket.js';

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);


const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://localhost:8081'
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ Socket.io CORS bloqué pour origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});


io.on('connection', (socket) => {
  console.log('🟢 Client connecté :', socket.id);

  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté :', socket.id);
  });
});


setupOrderSocket(io);

app.set('io', io);

server.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));
