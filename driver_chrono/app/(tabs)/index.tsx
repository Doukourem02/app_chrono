import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet, Alert, Linking } from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useDriverStore } from "../../store/useDriverStore";
import { useDriverLocation } from "../../hooks/useDriverLocation";
import { apiService } from "../../services/apiService";
import { orderSocketService } from "../../services/orderSocketService";
import { requestBackgroundLocationPermissionForDuty } from "../../services/driverBackgroundLocation";
import { driverMessageSocketService } from "../../services/driverMessageSocketService";
import { logger } from '../../utils/logger';
import { StatusToggle } from "../../components/StatusToggle";
import { StatsCards } from "../../components/StatsCards";
import ClassicDeliveryFlow from "../../components/ClassicDeliveryFlow";
import BatchDeliveryFlow from "../../components/BatchDeliveryFlow";

export default function Index() {
  const {
    isOnline: storeIsOnline,
    setOnlineStatus,
    setLocation,
    todayStats,
    updateTodayStats,
    user,
    profile,
    isAuthenticated,
  } = useDriverStore();

  const [driverStats, setDriverStats] = useState<{
    todayDeliveries: number;
    totalRevenue: number;
  }>({ todayDeliveries: 0, totalRevenue: 0 });

  const isOnline = storeIsOnline;
  const { location: rawGpsLocation, error, loading, permissionDenied } = useDriverLocation(isOnline);
  const storeLocation = useDriverStore((s) => s.currentLocation);
  const location = isOnline ? (rawGpsLocation ?? storeLocation ?? null) : null;

  const hasLocationBanner =
    permissionDenied || (isOnline && !loading && !location && !!error);

  const openAppLocationSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const isTogglingRef = useRef(false);
  const sessionExpiredRef = useRef(false);

  const handleToggleOnline = async (value: boolean) => {
    if (isTogglingRef.current) return;
    if (value === isOnline) return;

    if (value && permissionDenied) {
      Alert.alert(
        "Erreur de localisation",
        "Autorisez la localisation dans les réglages du téléphone pour recevoir des courses.",
        [{ text: "Fermer" }]
      );
      return;
    }

    isTogglingRef.current = true;
    let coordsForApi: { latitude: number; longitude: number } | null =
      rawGpsLocation ?? useDriverStore.getState().currentLocation ?? null;

    if (value && user?.id) {
      if (!coordsForApi) {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status !== Location.PermissionStatus.GRANTED) {
            isTogglingRef.current = false;
            Alert.alert('Localisation', 'Autorisez la localisation pour que les clients puissent vous trouver.', [{ text: 'Fermer' }]);
            return;
          }
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coordsForApi = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocation(coordsForApi);
        } catch {
          isTogglingRef.current = false;
          Alert.alert('Localisation', "Impossible d'obtenir votre position. Réessayez.", [{ text: 'Fermer' }]);
          return;
        }
      }
    }

    if (value && user?.id) {
      const prof = useDriverStore.getState().profile;
      const hasEngin =
        prof?.vehicle_type && String(prof.vehicle_type).trim() !== "" &&
        prof?.vehicle_plate && String(prof.vehicle_plate).trim() !== "";
      if (!hasEngin) {
        isTogglingRef.current = false;
        Alert.alert(
          "Mon véhicule",
          "Renseignez le type d'engin (moto, véhicule ou cargo) et la plaque dans Profil → Mon véhicule. Sans cela, le serveur n'associe pas les bonnes courses.",
          [
            { text: "Plus tard", style: "cancel" },
            { text: "Ouvrir", onPress: () => router.push("/profile/vehicle" as const) },
          ]
        );
        return;
      }
    }

    setOnlineStatus(value);

    if (user?.id) {
      const statusData: any = { is_online: value, is_available: value };
      if (value && coordsForApi) {
        statusData.current_latitude = coordsForApi.latitude;
        statusData.current_longitude = coordsForApi.longitude;
      }

      apiService.updateDriverStatus(user.id, statusData).then((result) => {
        isTogglingRef.current = false;
        if (!result.success) {
          if (result.message?.includes('Session expirée')) {
            sessionExpiredRef.current = true;
            return;
          }
          if (result.message && !result.message.includes('réseau') && !result.message.includes('connexion')) {
            setOnlineStatus(!value);
            Alert.alert("Erreur de synchronisation", result.message || "Impossible de synchroniser votre statut avec le serveur.", [{ text: "Fermer" }]);
          }
        } else {
          sessionExpiredRef.current = false;
          if (value) void requestBackgroundLocationPermissionForDuty();
        }
      }).catch((error) => {
        isTogglingRef.current = false;
        setOnlineStatus(!value);
        const errorMessage = error instanceof Error ? error.message : '';
        if (!errorMessage.includes('Session expirée')) {
          Alert.alert("Erreur", "Impossible de synchroniser votre statut avec le serveur.", [{ text: "Fermer" }]);
        }
      });
    } else {
      isTogglingRef.current = false;
    }
  };

  // Socket commandes
  useEffect(() => {
    if (isOnline && user?.id) {
      orderSocketService.connect(user.id);
    } else {
      orderSocketService.disconnect();
    }
    return () => { orderSocketService.disconnect(); };
  }, [isOnline, user?.id]);

  // Socket messagerie (léger décalage pour éviter deux handshakes simultanés)
  useEffect(() => {
    if (!user?.id || !isOnline) {
      driverMessageSocketService.disconnect();
      return;
    }
    const t = setTimeout(() => { driverMessageSocketService.connect(user.id); }, 450);
    return () => { clearTimeout(t); driverMessageSocketService.disconnect(); };
  }, [user?.id, isOnline]);

  // Heartbeat position serveur
  useEffect(() => {
    if (sessionExpiredRef.current || !isAuthenticated || !user?.id) return;

    const syncLocation = async () => {
      if (!isOnline || !location || !user?.id || !isAuthenticated || sessionExpiredRef.current) return;
      try {
        const result = await apiService.updateDriverStatus(user.id, {
          is_online: true,
          is_available: true,
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          ...(rawGpsLocation?.heading != null ? { heading_degrees: rawGpsLocation.heading } : {}),
        });
        if (!result.success && result.message?.includes('Session expirée')) {
          sessionExpiredRef.current = true;
          return;
        }
        if (result.success) sessionExpiredRef.current = false;
      } catch (error) {
        if (__DEV__) logger.debug('Erreur sync position:', undefined, error);
      }
    };

    const timeoutId = setTimeout(syncLocation, 1500);
    const heartbeatInterval = setInterval(syncLocation, 10 * 1000);
    return () => { clearTimeout(timeoutId); clearInterval(heartbeatInterval); };
  }, [location, rawGpsLocation?.heading, isOnline, user?.id, isAuthenticated]);

  // Stats
  useEffect(() => {
    const loadStats = async () => {
      if (!isAuthenticated || !user?.id) return;
      try {
        const todayResult = await apiService.getTodayStats(user.id);
        if (todayResult.success && todayResult.data) {
          updateTodayStats(todayResult.data);
          setDriverStats(prev => ({ ...prev, todayDeliveries: todayResult.data?.deliveries || 0 }));
        }
        const statsResult = await apiService.getDriverStatistics(user.id);
        if (statsResult.success && statsResult.data) {
          setDriverStats(prev => ({ ...prev, totalRevenue: statsResult.data?.totalEarnings || 0 }));
        }
      } catch (err) {
        if (__DEV__) logger.error('[Index] Erreur chargement stats:', undefined, err);
      }
    };

    if (isAuthenticated && user?.id) {
      loadStats();
      const interval = setInterval(loadStats, isOnline ? 30000 : 60000);
      return () => { if (interval) clearInterval(interval); };
    }
  }, [user?.id, isAuthenticated, isOnline, updateTodayStats]);

  return (
    <View style={styles.container}>
      <ClassicDeliveryFlow
        location={location}
        rawGpsLocation={rawGpsLocation}
        isOnline={isOnline}
      />
      <BatchDeliveryFlow
        location={location}
        isOnline={isOnline}
      />
      <StatusToggle
        isOnline={isOnline}
        onToggle={handleToggleOnline}
        hasLocationError={hasLocationBanner}
        disableSwitch={false}
        onOpenLocationSettings={hasLocationBanner ? openAppLocationSettings : undefined}
      />
      <StatsCards
        todayDeliveries={driverStats.todayDeliveries || todayStats.deliveries}
        totalRevenue={driverStats.totalRevenue || profile?.total_earnings || 0}
        isOnline={isOnline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
