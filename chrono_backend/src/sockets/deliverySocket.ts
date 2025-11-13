import { Server, Socket } from 'socket.io'; 


export default function deliverySocket(io: Server, socket: Socket): void { socket.on('new_delivery', (data: any) => 
  { console.log('[socket] new_delivery', data); io.emit('broadcast_new_delivery', data); });
socket.on('delivery_accepted', (data: any) => 
  { console.log('[socket] delivery_accepted', data); io.emit('delivery_accepted', data); }); 
socket.on('driver_position', (payload: any) => { io.emit('driver_position', payload);
  });
}

