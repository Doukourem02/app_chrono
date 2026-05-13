import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocation } from "../hooks/useLocation";
import { userMessageService, type Conversation } from "../services/userMessageService";
import { useAuthStore } from "../store/useAuthStore";
import { useLocationStore } from "../store/useLocationStore";
import { useMessageStore } from "../store/useMessageStore";
import { logger } from "../utils/logger";

const FALLBACK_REGION = "Abidjan, Côte d'Ivoire";

function getNotificationTitle(conversation: Conversation): string {
  if (conversation.type === "support") return "Message du support";
  if (conversation.type === "admin") return "Information Krono";
  return "Notification";
}

function getNotificationSubtitle(conversation: Conversation): string {
  const content = conversation.last_message?.content?.trim();
  if (content) return content;
  if (conversation.type === "support") return "Le support vous a envoyé un message.";
  return "Vous avez une nouvelle information à consulter.";
}

export default function Header() {
  const { address: hookAddress } = useLocation();
  const userId = useAuthStore((s) => s.user?.id);
  const storeAddress = useLocationStore((s) => s.currentLocation?.address);
  const setCurrentConversation = useMessageStore((s) => s.setCurrentConversation);
  const [notifications, setNotifications] = useState<Conversation[]>([]);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const locationLine = useMemo(() => {
    const fromStore = storeAddress?.trim();
    if (fromStore) return fromStore;
    const fromHook = hookAddress?.trim();
    if (fromHook) return fromHook;
    return null;
  }, [storeAddress, hookAddress]);

  const unreadNotificationCount = useMemo(
    () => notifications.reduce((total, conversation) => total + (conversation.unread_count || 0), 0),
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);
    try {
      const conversations = await userMessageService.getConversations();
      setNotifications(
        conversations
          .filter((conversation) => conversation.type !== "order")
          .filter((conversation) => (conversation.unread_count || 0) > 0)
          .sort((a, b) => {
            const dateA = a.last_message_at || a.updated_at || a.created_at || "";
            const dateB = b.last_message_at || b.updated_at || b.created_at || "";
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          })
      );
    } catch (error) {
      logger.warn("Impossible de charger les notifications client", "Header", error);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  const openNotifications = useCallback(() => {
    setNotificationsVisible(true);
    void loadNotifications();
  }, [loadNotifications]);

  const openConversation = useCallback(
    (conversation: Conversation) => {
      setCurrentConversation(conversation);
      setNotificationsVisible(false);
      router.push(`/messages/${conversation.id}`);
    },
    [setCurrentConversation]
  );

  return (
    <View style={styles.header}>
      <View style={styles.headerMain}>
        <Text style={styles.headerTitle}>Localisation</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={18} color="#5B21B6" />
          <Text style={styles.locationText} numberOfLines={2} ellipsizeMode="tail">
            {locationLine ?? FALLBACK_REGION}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.notification}
        accessibilityLabel="Notifications"
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={openNotifications}
      >
        <Ionicons name="notifications-outline" size={22} color="#1F2937" />
        {unreadNotificationCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={notificationsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationPanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setNotificationsVisible(false)}
                accessibilityLabel="Fermer les notifications"
              >
                <Ionicons name="close" size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {notificationsLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color="#7C3AED" />
              </View>
            ) : notifications.length > 0 ? (
              <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
                {notifications.map((conversation) => (
                  <TouchableOpacity
                    key={conversation.id}
                    style={styles.notificationItem}
                    activeOpacity={0.85}
                    onPress={() => openConversation(conversation)}
                  >
                    <View style={styles.notificationIcon}>
                      <Ionicons
                        name={conversation.type === "support" ? "chatbubble-ellipses-outline" : "megaphone-outline"}
                        size={20}
                        color="#7C3AED"
                      />
                    </View>
                    <View style={styles.notificationCopy}>
                      <Text style={styles.notificationTitle}>{getNotificationTitle(conversation)}</Text>
                      <Text style={styles.notificationSubtitle} numberOfLines={2}>
                        {getNotificationSubtitle(conversation)}
                      </Text>
                    </View>
                    <View style={styles.itemBadge} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={34} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Aucune notification</Text>
                <Text style={styles.emptySubtitle}>
                  Les messages importants hors suivi apparaîtront ici.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerMain: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    gap: 6,
  },
  locationText: {
    flex: 1,
    color: "#111827",
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 22,
  },
  notification: {
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#F3F4F6",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 86,
    paddingHorizontal: 20,
  },
  notificationPanel: {
    width: "100%",
    maxWidth: 420,
    maxHeight: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  panelTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  loadingState: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationsList: {
    maxHeight: 350,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3E8FF",
  },
  notificationCopy: {
    flex: 1,
    gap: 3,
  },
  notificationTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  notificationSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  itemBadge: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
