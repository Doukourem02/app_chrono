// src/sockets/deliverySocket.js
export default function deliverySocket(io, socket) {
  // Quand un client crée une nouvelle livraison via socket
  socket.on('new_delivery', (data) => {
    console.log('[socket] new_delivery', data);
    // Broadcast to drivers
    io.emit('broadcast_new_delivery', data);
  });

  // Un livreur accepte une livraison
  socket.on('delivery_accepted', (data) => {
    console.log('[socket] delivery_accepted', data);
    io.emit('delivery_accepted', data);
  });

  // Mise à jour de position du livreur
  socket.on('driver_position', (payload) => {
    // payload: { deliveryId, driverId, coords }
    io.emit('driver_position', payload);
  });
}
