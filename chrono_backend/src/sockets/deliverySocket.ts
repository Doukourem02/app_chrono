import { Server, Socket } from 'socket.io';
import logger from '../utils/logger.js';
import type {
  NewDeliveryData,
  DeliveryAcceptedData,
  DriverPositionPayload,
} from '../types/socketEvents.js';

export default function deliverySocket(io: Server, socket: Socket): void {
  socket.on('new_delivery', (data: NewDeliveryData) => {
    logger.info('[socket] new_delivery', { data });
    io.emit('broadcast_new_delivery', data);
  });

  socket.on('delivery_accepted', (data: DeliveryAcceptedData) => {
    logger.info('[socket] delivery_accepted', { data });
    io.emit('delivery_accepted', data);
  });

  socket.on('driver_position', (payload: DriverPositionPayload) => {
    logger.debug('[socket] driver_position', { driverId: payload.driverId });
    io.emit('driver_position', payload);
  });
}

