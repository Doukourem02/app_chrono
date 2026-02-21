import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import { config } from '../config';
import { useAuthStore } from '../store/useAuthStore';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export const useDriverSearch = (onSearchComplete?: () => void) => {
  
  
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [driverCoords, setDriverCoords] = useState<Coordinates | null>(null);
  
  const searchIntervalRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let socket: any;
    try {
      const token = useAuthStore.getState().accessToken;
      socket = io(config.socketUrl, {
        auth: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
      });
      socket.on('connect', () => logger.info('Socket connected'));
      // SÉCURITÉ: la position ne doit pas être "broadcast" publiquement.
      // On écoute plutôt les mises à jour liées à la commande (envoyées au client concerné).
      socket.on('order:status:update', (payload: any) => {
        const coords = payload?.location || payload?.order?.location || null;
        if (coords && coords.latitude && coords.longitude) {
          setDriverCoords({ latitude: coords.latitude, longitude: coords.longitude });
          logger.debug('Driver position updated (order:status:update)');
        }
      });
    } catch (err) {
    errorHandler.handle(errorHandler.createAPIError('Erreur de connexion au serveur', err, 'useDriverSearch'));
    }

    return () => {
      try {
        socket && socket.disconnect();
      } catch {
      
      }
    };
}, []);

  const startDriverSearch = () => {
    setIsSearchingDriver(true);
    setSearchSeconds(0);

    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current as any);
      searchIntervalRef.current = null;
    }
    searchIntervalRef.current = (setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000) as unknown) as number;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current as any);
      searchTimeoutRef.current = null;
    }
    searchTimeoutRef.current = (setTimeout(() => {
      stopDriverSearch();
    }, 25000) as unknown) as number;
  };

  const stopDriverSearch = () => {
    setIsSearchingDriver(false);
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current as any);
      searchIntervalRef.current = null;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current as any);
      searchTimeoutRef.current = null;
    }
    setSearchSeconds(0);
 
    if (onSearchComplete) {
      onSearchComplete();
    }
  };

  return {
    isSearchingDriver,
    searchSeconds,
    driverCoords,
    startDriverSearch,
    stopDriverSearch,
  };
};