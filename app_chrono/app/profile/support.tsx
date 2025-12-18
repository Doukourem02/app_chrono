import React, { useState } from 'react';
import {View,Text,StyleSheet,ScrollView,TouchableOpacity,Linking,Alert,ActivityIndicator} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { userMessageService } from '../../services/userMessageService';
import { useMessageStore } from '../../store/useMessageStore';

export default function SupportPage() {
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const { setCurrentConversation } = useMessageStore();

  const handleContact = (method: string) => {
    switch (method) {
      case 'email':
        Linking.openURL('mailto:support@chrono.com').catch(() => {
          Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email');
        });
        break;
      case 'phone':
        Linking.openURL('tel:+2250000000000').catch(() => {
          Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
        });
        break;
      case 'whatsapp':
        Linking.openURL('https://wa.me/2250000000000').catch(() => {
          Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp');
        });
        break;
    }
  };

  const handleContactSupport = async () => {
    setIsCreatingConversation(true);
    try {
      const conversation = await userMessageService.createSupportConversation();
      if (conversation) {
        setCurrentConversation(conversation);
        // Rediriger directement vers la page de messagerie
        router.push(`/messages/${conversation.id}`);
      } else {
        Alert.alert('Erreur', 'Impossible de créer la conversation de support. Veuillez réessayer.');
      }
    } catch {
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aide & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contactez-nous</Text>
          
          <TouchableOpacity
            style={[styles.contactItem, styles.supportChatItem]}
            onPress={handleContactSupport}
            disabled={isCreatingConversation}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#8B5CF6" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Contacter le support</Text>
              <Text style={styles.contactSubtitle}>Envoyer un message à l&apos;équipe</Text>
            </View>
            {isCreatingConversation ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleContact('email')}
          >
            <Ionicons name="mail" size={24} color="#8B5CF6" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email</Text>
              <Text style={styles.contactSubtitle}>support@chrono.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleContact('phone')}
          >
            <Ionicons name="call" size={24} color="#10B981" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Téléphone</Text>
              <Text style={styles.contactSubtitle}>+225 00 00 00 00 00</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleContact('whatsapp')}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactSubtitle}>Chat avec nous</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FAQ</Text>
          
          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Comment créer une commande ?</Text>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Comment suivre ma livraison ?</Text>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Comment payer ma commande ?</Text>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  faqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  supportChatItem: {
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
});

