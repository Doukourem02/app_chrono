import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userMessageService, Message } from '../../services/userMessageService';
import { userMessageSocketService } from '../../services/userMessageSocketService';
import { useMessageStore } from '../../store/useMessageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { logger } from '../../utils/logger';
import { formatUserName } from '../../utils/formatName';

export default function MessagePage() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
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
  const flatListRef = useRef<FlatList>(null);

  // Connecter le socket au montage
  useEffect(() => {
    if (user?.id) {
      userMessageSocketService.connect(user.id);
    }
    return () => {
      userMessageSocketService.disconnect();
    };
  }, [user?.id]);

  // Charger la conversation et les messages
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const loadConversation = async () => {
      setLoading(true);
      setError(null);

      try {
        const conversation = await userMessageService.getConversationById(conversationId);
        if (conversation) {
          setCurrentConversation(conversation);
          
          // Attendre un peu pour s'assurer que le socket est connecté avant de rejoindre
          setTimeout(() => {
            userMessageSocketService.joinConversation(conversationId);
          }, 500);

          const loadedMessages = await userMessageService.getMessages(conversationId);
          setMessages(conversationId, loadedMessages);

          await userMessageService.markAsRead(conversationId);
          markAsRead(conversationId);
        } else {
          setError('Conversation introuvable');
        }
      } catch (error: any) {
        logger.error('Erreur chargement conversation', 'MessagePage', error);
        setError(error.message || 'Impossible de charger la conversation');
      } finally {
        setLoading(false);
      }
    };

    loadConversation();

    return () => {
      if (conversationId) {
        userMessageSocketService.leaveConversation(conversationId);
      }
    };
  }, [conversationId, user?.id, setCurrentConversation, setMessages, setLoading, setError, markAsRead]);

  // Écouter les nouveaux messages
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = userMessageSocketService.onNewMessage((message, conversation) => {
      if (conversation.id === conversationId) {
        const existingMessages = messages[conversationId] || [];
        const messageExists = existingMessages.some((m) => m.id === message.id);
        
        if (!messageExists) {
          // Si c'est notre propre message, vérifier s'il y a un message optimiste à remplacer
          if (message.sender_id === user?.id) {
            const tempMessageIndex = existingMessages.findIndex((m) => 
              m.id.startsWith('temp-') && 
              m.content === message.content &&
              m.sender_id === message.sender_id
            );
            
            if (tempMessageIndex !== -1) {
              // Remplacer le message optimiste par le vrai message
              const updatedMessages = [...existingMessages];
              updatedMessages[tempMessageIndex] = message;
              setMessages(conversationId, updatedMessages);
            } else {
              // Ajouter normalement si pas de message optimiste correspondant
              addMessage(conversationId, message);
            }
          } else {
            // Message d'un autre utilisateur, ajouter normalement
            addMessage(conversationId, message);
          }
        }
        
        if (message.sender_id !== user?.id) {
          userMessageService.markAsRead(conversationId);
          markAsRead(conversationId);
        }
      }
    });

    return unsubscribe;
  }, [conversationId, user?.id, addMessage, markAsRead, messages, setMessages]);

  // Scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (messages[conversationId || '']?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, conversationId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId || isSending || !user?.id) return;

    const content = messageText.trim();
    setMessageText('');
    setIsSending(true);

    // Créer un message optimiste pour affichage immédiat
    const tempMessageId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempMessageId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        email: user.email || '',
        role: 'client',
        first_name: user.first_name || undefined,
        last_name: user.last_name || undefined,
        avatar_url: undefined,
      },
    };

    // Ajouter le message optimiste immédiatement
    addMessage(conversationId, optimisticMessage);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Envoyer via l'API REST (le socket recevra automatiquement le vrai message)
      const realMessage = await userMessageService.sendMessage(conversationId, content);
      
      // Remplacer le message optimiste par le vrai message
      // Utiliser getState() pour obtenir les messages à jour depuis le store
      const currentState = useMessageStore.getState();
      const existingMessages = currentState.messages[conversationId] || [];
      const updatedMessages = existingMessages.map((msg) =>
        msg.id === tempMessageId ? realMessage : msg
      );
      setMessages(conversationId, updatedMessages);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      logger.error('Erreur envoi message', 'MessagePage', error);
      // Retirer le message optimiste en cas d'erreur
      // Utiliser getState() pour obtenir les messages à jour depuis le store
      const currentState = useMessageStore.getState();
      const existingMessages = currentState.messages[conversationId] || [];
      const updatedMessages = existingMessages.filter((msg) => msg.id !== tempMessageId);
      setMessages(conversationId, updatedMessages);
      setMessageText(content);
      setError(error.message || 'Impossible d\'envoyer le message');
    } finally {
      setIsSending(false);
    }
  };

  if (!currentConversation) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  // Trouver l'autre participant
  const otherParticipant = 
    currentConversation.participant_1_id === user?.id
      ? currentConversation.participant_2
      : currentConversation.participant_1;

  const participantName = formatUserName(otherParticipant, 'Support');

  const conversationMessages = messages[conversationId] || [];

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{participantName}</Text>
          <Text style={styles.headerSubtitle}>Messages</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

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
        style={styles.messagesContainer}
      />

      <View style={[styles.inputContainer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          style={styles.input}
          placeholder="Tapez un message..."
          placeholderTextColor="#9CA3AF"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || isSending}
        >
          {isSending ? (
            <Ionicons name="hourglass-outline" size={20} color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#8B5CF6',
  },
  otherMessageBubble: {
    backgroundColor: '#F3F4F6',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1F2937',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: '#E9D5FF',
  },
  otherMessageTime: {
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});

