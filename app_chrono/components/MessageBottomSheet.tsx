import React, { useEffect, useRef, useState, useCallback } from 'react';
import {View,Text,StyleSheet,TouchableOpacity,TextInput,FlatList,Image,ActivityIndicator,KeyboardAvoidingView,Platform,Animated,PanResponderInstance} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userMessageService, Message } from '../services/userMessageService';
import { userMessageSocketService } from '../services/userMessageSocketService';
import { useMessageStore } from '../store/useMessageStore';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger';
import { formatUserName } from '../utils/formatName';

interface MessageBottomSheetProps {
  orderId: string;
  driverId: string;
  driverName?: string;
  driverAvatar?: string;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const MessageBottomSheet: React.FC<MessageBottomSheetProps> = ({
  orderId,
  driverId,
  driverName: initialDriverName,
  driverAvatar: initialDriverAvatar,
  panResponder,
  animatedHeight,
  isExpanded,
  onToggle,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    currentConversation,
    messages,
    setCurrentConversation,
    setMessages,
    addMessage,
    markAsRead,
    setLoading,
    setError,
  } = useMessageStore();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [driverInfo, setDriverInfo] = useState<{
    name: string;
    avatar?: string;
  }>({
    name: initialDriverName || 'Livreur',
    avatar: initialDriverAvatar,
  });

  const [isLoadingDriver, setIsLoadingDriver] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Priorité 1: Charger depuis la conversation si disponible
  useEffect(() => {
    if (!currentConversation || !user?.id) return;

    const driverParticipant = 
      currentConversation.participant_1_id === user.id
        ? currentConversation.participant_2
        : currentConversation.participant_1;

    if (driverParticipant) {
      const name = formatUserName(driverParticipant, 'Livreur');
      
      // Ne mettre à jour que si on a un nom valide (pas un email)
      if (name && name !== 'Livreur' && !name.includes('@')) {
        setDriverInfo({
          name,
          avatar: driverParticipant.avatar_url,
        });
        setIsLoadingDriver(false);
        return;
      }
      
      // Si le nom est un email ou fallback, charger depuis l'API
      if (driverId) {
        const loadDriverInfo = async () => {
          setIsLoadingDriver(true);
          try {
            const { userApiService } = await import('../services/userApiService');
            const result = await userApiService.getDriverDetails(driverId);
            if (result.success && result.data) {
              const apiName = formatUserName(result.data, 'Livreur');
              setDriverInfo({
                name: apiName,
                avatar: result.data.avatar_url || result.data.profile_image_url,
              });
            }
          } catch {
            // Fallback sur les données de la conversation même si c'est un email
            setDriverInfo({
              name: formatUserName(driverParticipant, 'Livreur'),
              avatar: driverParticipant.avatar_url,
            });
          } finally {
            setIsLoadingDriver(false);
          }
        };
        loadDriverInfo();
      }
    }
  }, [currentConversation, user?.id, driverId]);

  // Priorité 2: Charger depuis l'API si pas de conversation et pas de nom valide
  useEffect(() => {
    if (currentConversation) return; // Déjà géré par l'effet précédent
    
    const hasValidName = driverInfo.name && 
                        driverInfo.name !== 'Livreur' && 
                        !driverInfo.name.includes('@');
    
    if (!driverId || hasValidName) return;

    const loadDriverInfo = async () => {
      setIsLoadingDriver(true);
      try {
        const { userApiService } = await import('../services/userApiService');
        const result = await userApiService.getDriverDetails(driverId);
        if (result.success && result.data) {
          const name = formatUserName(result.data, 'Livreur');
          setDriverInfo({
            name,
            avatar: result.data.avatar_url || result.data.profile_image_url,
          });
        }
      } catch {
        logger.warn('Impossible de charger les détails du livreur depuis l\'API', 'MessageBottomSheet');
      } finally {
        setIsLoadingDriver(false);
      }
    };

    loadDriverInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, currentConversation]);

  // Priorité 3: Utiliser initialDriverName seulement s'il est valide et pas encore chargé
  useEffect(() => {
    // Ne pas utiliser initialDriverName s'il ressemble à un email ou si on a déjà un nom valide
    const hasValidName = driverInfo.name && 
                        driverInfo.name !== 'Livreur' && 
                        !driverInfo.name.includes('@');
    
    if (hasValidName) return;
    
    if (initialDriverName && 
        initialDriverName !== driverInfo.name && 
        !initialDriverName.includes('@') &&
        initialDriverName !== 'Livreur') {
      setDriverInfo((prev) => ({
        ...prev,
        name: initialDriverName,
        avatar: initialDriverAvatar || prev.avatar,
      }));
    }
  }, [initialDriverName, initialDriverAvatar, driverInfo.name]);

  useEffect(() => {
    if (!orderId || !isExpanded) return;

    const loadConversation = async () => {
      setLoading(true);
      setError(null);

      try {
        const conversation = await userMessageService.getOrCreateOrderConversation(orderId);
        setCurrentConversation(conversation);

        userMessageSocketService.joinConversation(conversation.id);

        const loadedMessages = await userMessageService.getMessages(conversation.id);
        setMessages(conversation.id, loadedMessages);

        await userMessageService.markAsRead(conversation.id);
        markAsRead(conversation.id);
      } catch (error: any) {
        logger.error('Erreur chargement conversation', 'MessageBottomSheet', error);
        setError(error.message || 'Impossible de charger la conversation');
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [orderId, isExpanded, setCurrentConversation, setMessages, setLoading, setError, markAsRead]);

  useEffect(() => {
    if (!currentConversation) return;

    const unsubscribe = userMessageSocketService.onNewMessage((message, conversation) => {
      if (conversation.id === currentConversation.id) {
        addMessage(conversation.id, message);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentConversation, addMessage]);

  useEffect(() => {
    if (currentConversation && messages[currentConversation.id]) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, currentConversation]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !currentConversation || isSending) return;

    const content = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      userMessageSocketService.sendMessage(currentConversation.id, content);

      await userMessageService.sendMessage(currentConversation.id, content);
    } catch (error: any) {
      logger.error('Erreur envoi message', 'MessageBottomSheet', error);
      setError(error.message || 'Impossible d\'envoyer le message');
      setMessageText(content);
    } finally {
      setIsSending(false);
    }
  }, [messageText, currentConversation, isSending, setError]);

  useEffect(() => {
    if (isExpanded) {
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isExpanded, overlayOpacity]);

  useEffect(() => {
    if (!isExpanded && currentConversation) {
      userMessageSocketService.leaveConversation(currentConversation.id);
    }
  }, [isExpanded, currentConversation]);

  const conversationMessages = currentConversation
    ? messages[currentConversation.id] || []
    : [];

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {new Date(item.created_at || '').toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>Aucun message</Text>
      <Text style={styles.emptyStateSubtitle}>Envoyez le premier message</Text>
    </View>
  );

  if (!isExpanded) {
    return null;
  }

  return (
    <>
      {/* Overlay sombre avec flou */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.container,
          {
            height: animatedHeight, 
            bottom: 0,
          },
        ]}
      >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            {isLoadingDriver ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <>
                {driverInfo.avatar ? (
                  <Image source={{ uri: driverInfo.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {driverInfo.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  </View>
                )}
                <View style={styles.headerText}>
                  <Text style={styles.driverName}>{driverInfo.name}</Text>
                  <Text style={styles.headerSubtitle}>Messages</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={conversationMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            conversationMessages.length === 0 ? styles.emptyList : styles.messagesList
          }
          ListEmptyComponent={renderEmptyState}
          inverted={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
        />

        {/* Input Area */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <TextInput
            style={styles.input}
            placeholder="Tapez un message..."
            placeholderTextColor="#9CA3AF"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            editable={!isSending && !!currentConversation}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || isSending || !currentConversation}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20, 
    zIndex: 1000, 
    overflow: 'hidden',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    fontSize: 14,
    color: '#111827',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});

export default MessageBottomSheet;

