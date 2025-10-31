import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { io } from 'socket.io-client';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import { config } from '../config';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export const useDriverSearch = (onSearchComplete?: () => void) => {
  // use a stable error handler instance to avoid recreating this effect
  // on every render (which caused repeated socket creations).
  
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [driverCoords, setDriverCoords] = useState<Coordinates | null>(null);
  
  const searchIntervalRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Animation de pulsation
  useEffect(() => {
    let loop: any;
    if (isSearchingDriver) {
      pulseAnim.setValue(0);
      loop = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        })
      );
      loop.start();
    } else {
      pulseAnim.stopAnimation(() => pulseAnim.setValue(0));
      if (loop && loop.stop) loop.stop();
    }

    return () => {
      if (loop && loop.stop) loop.stop();
    };
  }, [isSearchingDriver, pulseAnim]);

  // Connexion Socket.IO
  useEffect(() => {
    let socket: any;
    try {
      socket = io(config.socketUrl);
      socket.on('connect', () => logger.info('Socket connected'));
      socket.on('driver_position', (payload: any) => {
        const coords = payload.coords || payload;
        if (coords && coords.latitude && coords.longitude) {
          setDriverCoords({ latitude: coords.latitude, longitude: coords.longitude });
          logger.debug('Driver position updated');
        }
      });
    } catch (err) {
      // use stable instance to report the error without changing the effect deps
      errorHandler.handle(errorHandler.createAPIError('Erreur de connexion au serveur', err, 'useDriverSearch'));
    }

    return () => {
      try {
        socket && socket.disconnect();
      } catch {
        // Ignorer les erreurs de déconnexion
      }
    };
    // Intentionally empty dependency array: we want this effect to run once.
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
    }, 20000) as unknown) as number;
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
    
    // Appeler la fonction de callback pour réinitialiser l'état
    if (onSearchComplete) {
      onSearchComplete();
    }
  };

  return {
    isSearchingDriver,
    searchSeconds,
    driverCoords,
    pulseAnim,
    startDriverSearch,
    stopDriverSearch,
  };
};