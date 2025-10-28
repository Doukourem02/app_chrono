// src/server.js (ES Module)
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import dotenv from 'dotenv';
import deliverySocket from './sockets/deliverySocket.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

// Création du serveur HTTP
const server = http.createServer(app);

// Initialisation de Socket.io
const io = new Server(server, {
  cors: { origin: '*' },
});

// Gestion simple d’une connexion socket
io.on('connection', (socket) => {
  console.log('🟢 Client connecté :', socket.id);

  // déléguer les handlers
  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté :', socket.id);
  });
});

// Attacher io à req (utile pour les notifications backend)
app.set('io', io);

server.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));
