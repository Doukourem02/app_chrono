import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import ActionCards from "../../components/ActionCards";
import Header from "../../components/Header";
import { QRCodeDisplay } from "../../components/QRCodeDisplay";
import SearchBar from "../../components/SearchBar";
import SectionHeader from "../../components/SectionHeader";
import ShipmentList from "../../components/ShipmentList";
import { useOrderStatusPolling } from "../../hooks/useOrderStatusPolling";
import { qrCodeService, type QRCodeData } from "../../services/qrCodeService";
import { type OrderRequest, useOrderStore } from "../../store/useOrderStore";
import { formatDeliveryId } from "../../utils/formatDeliveryId";
import { logger } from "../../utils/logger";

type HomeQrData = {
  qrCodeImage: string;
  verificationCode?: string;
  qrCodeData?: QRCodeData["qrCodeData"];
};

function canShowQRCode(order: OrderRequest): boolean {
  const status = String(order.status || "");
  const qrNotScanned = !order.delivery_qr_scanned_at && !order.deliveryQrScannedAt;
  const isB2BBatchOrder = Boolean(order.isB2BOrder || order.batch_id);

  return (
    status === "enroute" ||
    status === "picked_up" ||
    status === "delivering" ||
    (isB2BBatchOrder && status === "accepted") ||
    (status === "completed" && qrNotScanned)
  );
}

function getOrderLabel(order: OrderRequest): string {
  const deliveryId = formatDeliveryId(order.id, order.createdAt);
  const destination = order.dropoff?.address?.split(",")[0]?.trim();
  return destination ? `${deliveryId} - ${destination}` : deliveryId;
}

export default function Index() {
  useOrderStatusPolling();
  const activeOrders = useOrderStore((state) => state.activeOrders);
  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);
  const setSelectedOrder = useOrderStore((state) => state.setSelectedOrder);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<HomeQrData | null>(null);

  const qrEligibleOrders = useMemo(
    () => activeOrders.filter(canShowQRCode),
    [activeOrders]
  );

  const openQRCodeForOrder = useCallback(
    async (order: OrderRequest) => {
      setSelectedOrder(order.id);
      setQrCodeData(null);
      setShowQRCode(true);

      try {
        let data = await qrCodeService.getOrderQRCode(order.id);
        if (!data) {
          data = await qrCodeService.generateOrderQRCode(order.id);
        }

        if (!data) {
          setShowQRCode(false);
          Alert.alert(
            "QR code indisponible",
            "Impossible de générer le QR code pour cette commande."
          );
          return;
        }

        setQrCodeData({
          qrCodeImage: data.qrCodeImage,
          verificationCode: data.verificationCode,
          qrCodeData: data.qrCodeData,
        });
      } catch (error) {
        logger.error("Erreur ouverture QR depuis accueil:", undefined, error);
        setShowQRCode(false);
        Alert.alert("Erreur", "Impossible d'ouvrir le QR code pour le moment.");
      }
    },
    [setSelectedOrder]
  );

  const handleQuickQRCodePress = useCallback(() => {
    if (qrEligibleOrders.length === 0) {
      Alert.alert(
        "Aucun QR code disponible",
        "Le QR code apparaîtra dès qu'une commande sera en livraison."
      );
      return;
    }

    if (qrEligibleOrders.length === 1) {
      openQRCodeForOrder(qrEligibleOrders[0]);
      return;
    }

    const selectedOrder = qrEligibleOrders.find((order) => order.id === selectedOrderId);
    const sortedOrders = selectedOrder
      ? [selectedOrder, ...qrEligibleOrders.filter((order) => order.id !== selectedOrder.id)]
      : qrEligibleOrders;

    Alert.alert(
      "Choisir une commande",
      "Sélectionnez la commande dont vous voulez afficher le QR code.",
      [
        ...sortedOrders.slice(0, 5).map((order) => ({
          text: getOrderLabel(order),
          onPress: () => openQRCodeForOrder(order),
        })),
        { text: "Annuler", style: "cancel" as const },
      ]
    );
  }, [openQRCodeForOrder, qrEligibleOrders, selectedOrderId]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Header />
        <SearchBar onScanPress={handleQuickQRCodePress} />
        
        <ActionCards />
        <SectionHeader 
          title="Expédition actuelle" 
          onSeeMorePress={() => logger.debug('Voir plus pressed')}
        />
        <ShipmentList />
      </ScrollView>

      <QRCodeDisplay
        visible={showQRCode}
        qrCodeImage={qrCodeData?.qrCodeImage || null}
        orderNumber={qrCodeData?.qrCodeData?.orderNumber}
        expiresAt={qrCodeData?.qrCodeData?.expiresAt}
        verificationCode={qrCodeData?.verificationCode}
        fullQrCodeData={qrCodeData?.qrCodeData}
        onClose={() => {
          setShowQRCode(false);
          setQrCodeData(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    marginTop: 30,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  scrollContent: {
    paddingBottom: 100,
  },
});
