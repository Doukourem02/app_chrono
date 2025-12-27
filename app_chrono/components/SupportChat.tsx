/**
 * Composant de support client avec FAQ et tickets
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
// Icons will be displayed as emojis or using react-native-vector-icons
import { config } from '../config';
import { logger } from '../utils/logger';

interface FAQEntry {
  question: string;
  answer: string;
  category: string;
}

export function SupportChat({ userId }: { userId: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [faqResults, setFaqResults] = useState<FAQEntry[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  const searchFAQ = async (query: string) => {
    if (!query.trim()) {
      setFaqResults([]);
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/support/faq?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setFaqResults(data.results || []);
      }
    } catch (error) {
      logger.error('Error searching FAQ:', error);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    searchFAQ(text);
  };

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: ticketSubject,
          message: ticketMessage,
          category: 'general',
        }),
      });

      if (response.ok) {
        Alert.alert('Succès', 'Votre ticket a été créé avec succès');
        setTicketSubject('');
        setTicketMessage('');
        setShowTicketForm(false);
      } else {
        Alert.alert('Erreur', 'Impossible de créer le ticket');
      }
    } catch (error) {
      logger.error('Error creating ticket:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HelpCircle style={styles.headerIcon} />
        <Text style={styles.headerTitle}>Support Client</Text>
      </View>

      {/* Recherche FAQ */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher dans la FAQ..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Résultats FAQ */}
      {faqResults.length > 0 && (
        <ScrollView style={styles.faqContainer}>
          {faqResults.map((entry, index) => (
            <View key={index} style={styles.faqEntry}>
              <Text style={styles.faqQuestion}>{entry.question}</Text>
              <Text style={styles.faqAnswer}>{entry.answer}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Formulaire de ticket */}
      {showTicketForm ? (
        <View style={styles.ticketForm}>
          <Text style={styles.formTitle}>Créer un ticket de support</Text>
          <TextInput
            style={styles.input}
            placeholder="Sujet"
            value={ticketSubject}
            onChangeText={setTicketSubject}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Message"
            value={ticketMessage}
            onChangeText={setTicketMessage}
            multiline
            numberOfLines={4}
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowTicketForm(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleCreateTicket}
            >
              <Send style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.createTicketButton}
          onPress={() => setShowTicketForm(true)}
        >
          <MessageSquare style={styles.createTicketIcon} />
          <Text style={styles.createTicketText}>Créer un ticket de support</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 24,
    height: 24,
    color: '#3B82F6',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  faqContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  faqEntry: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  ticketForm: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111827',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  submitIcon: {
    width: 16,
    height: 16,
    color: '#FFFFFF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  createTicketButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createTicketIcon: {
    width: 20,
    height: 20,
    color: '#FFFFFF',
  },
  createTicketText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

