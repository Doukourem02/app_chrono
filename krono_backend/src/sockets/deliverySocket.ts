import { Server, Socket } from 'socket.io';
import logger from '../utils/logger.js';
import type {
  NewDeliveryData,
  DeliveryAcceptedData,
  DriverPositionPayload,
} from '../types/socketEvents.js';

export default function deliverySocket(io: Server, socket: Socket): void {
  socket.on('new_delivery', (data: NewDeliveryData) => {
    const role = (socket as any).userRole as string | undefined;
    if (role !== 'client' && role !== 'admin' && role !== 'super_admin') {
      logger.warn('[socket] new_delivery blocked (unauthorized role)', { socketId: socket.id, role });
      return;
    }
    logger.info('[socket] new_delivery', { socketId: socket.id });
    // SÉCURITÉ: ne pas broadcaster à tous les clients
    io.to('drivers').emit('broadcast_new_delivery', data);
    io.to('admins').emit('broadcast_new_delivery', data);
  });

  socket.on('delivery_accepted', (data: DeliveryAcceptedData) => {
    const role = (socket as any).userRole as string | undefined;
    if (role !== 'driver') {
      logger.warn('[socket] delivery_accepted blocked (unauthorized role)', { socketId: socket.id, role });
      return;
    }
    logger.info('[socket] delivery_accepted', { socketId: socket.id });
    io.to('admins').emit('delivery_accepted', data);
  });

  socket.on('driver_position', (payload: DriverPositionPayload) => {
    const role = (socket as any).userRole as string | undefined;
    if (role !== 'driver') {
      logger.warn('[socket] driver_position blocked (unauthorized role)', { socketId: socket.id, role });
      return;
    }
    logger.debug('[socket] driver_position', { socketId: socket.id, driverId: payload.driverId });
    // SÉCURITÉ: la position driver ne doit pas être publique
    io.to('admins').emit('driver_position', payload);
  });
}

