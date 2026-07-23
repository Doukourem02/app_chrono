"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";
import { logger } from "@/utils/logger";

interface MapboxContextType {
  accessToken: string;
  isLoaded: boolean;
  loadError: Error | undefined;
}

const MapboxContext = createContext<MapboxContextType | undefined>(undefined);

const TOKEN_ERROR = new Error(
  "Mapbox access token not configured. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env.local"
);

export function MapboxProvider({ children }: { children: ReactNode }) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

  const isLoaded = useMemo(() => {
    if (!accessToken || accessToken.startsWith("<")) return false;
    return true;
  }, [accessToken]);

  const loadError = useMemo(() => {
    if (!accessToken || accessToken.startsWith("<")) {
      logger.warn("[Mapbox] Access token not configured");
      return TOKEN_ERROR;
    }
    return undefined;
  }, [accessToken]);

  const contextValue = useMemo(
    () => ({
      accessToken,
      isLoaded,
      loadError,
    }),
    [accessToken, isLoaded, loadError]
  );

  return (
    <MapboxContext.Provider value={contextValue}>
      {children}
    </MapboxContext.Provider>
  );
}

export function useMapbox() {
  const context = useContext(MapboxContext);
  if (context === undefined) {
    throw new Error("useMapbox must be used within a MapboxProvider");
  }
  return context;
}
