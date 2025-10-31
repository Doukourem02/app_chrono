import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import dotenv from 'dotenv';
import deliverySocket from './sockets/deliverySocket.js';
import { setupOrderSocket } from './sockets/orderSocket.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, {cors: { origin: '*' },});

// 🚚 Socket pour les livraisons existantes
io.on('connection', (socket) => {
  console.log('🟢 Client connecté :', socket.id);

  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté :', socket.id);
  });
});

// 📦 Socket pour les commandes (nouveau système)
setupOrderSocket(io);

app.set('io', io);

server.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));
