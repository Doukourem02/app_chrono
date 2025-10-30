
export default function deliverySocket(io, socket) {

  socket.on('new_delivery', (data) => {
    console.log('[socket] new_delivery', data);

    io.emit('broadcast_new_delivery', data);
  });

  socket.on('delivery_accepted', (data) => {
    console.log('[socket] delivery_accepted', data);
    io.emit('delivery_accepted', data);
  });


  socket.on('driver_position', (payload) => {

    io.emit('driver_position', payload);
  });
}
