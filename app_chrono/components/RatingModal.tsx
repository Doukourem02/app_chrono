import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userApiService } from '../services/userApiService';

interface RatingModalProps {
  visible: boolean;
  orderId: string;
  driverName?: string;
  onClose: () => void;
  onRatingSubmitted?: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  orderId,
  driverName,
  onClose,
  onRatingSubmitted,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  const loadExistingRating = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await userApiService.getOrderRating(orderId);
      if (result.success && result.data) {
        setExistingRating(result.data.rating);
        setRating(result.data.rating);
        setComment(result.data.comment || '');
      } else {
        setExistingRating(null);
        setRating(0);
        setComment('');
      }
    } catch (error) {
      console.error('Erreur chargement évaluation:', error);
      setExistingRating(null);
      setRating(0);
      setComment('');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // Charger l'évaluation existante si elle existe
  useEffect(() => {
    if (visible && orderId) {
      loadExistingRating();
    }
  }, [visible, orderId, loadExistingRating]);

  const handleStarPress = (starValue: number) => {
    setRating(starValue);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Évaluation requise', 'Veuillez sélectionner une note avant de soumettre.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await userApiService.submitRating(orderId, rating, comment.trim() || undefined);
      
      if (result.success) {
        Alert.alert(
          'Merci !',
          existingRating
            ? 'Votre évaluation a été mise à jour avec succès.'
            : 'Votre évaluation a été enregistrée avec succès.',
          [
            {
              text: 'OK',
              onPress: () => {
                onRatingSubmitted?.();
                onClose();
                // Reset form
                setRating(0);
                setComment('');
                setExistingRating(null);
              },
            },
          ]
        );
      } else {
        Alert.alert('Erreur', result.message || 'Impossible d\'enregistrer l\'évaluation. Veuillez réessayer.');
      }
    } catch (error) {
      console.error('Erreur soumission évaluation:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'évaluation. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
    // Reset form on close
    setRating(0);
    setComment('');
    setExistingRating(null);
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((starValue) => (
          <TouchableOpacity
            key={starValue}
            onPress={() => handleStarPress(starValue)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Ionicons
              name={starValue <= rating ? 'star' : 'star-outline'}
              size={40}
              color={starValue <= rating ? '#FBBF24' : '#D1D5DB'}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  {existingRating ? 'Modifier votre évaluation' : 'Évaluer votre livreur'}
                </Text>
                <TouchableOpacity onPress={handleClose} disabled={isSubmitting} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                {driverName && (
                  <Text style={styles.driverName}>Livreur : {driverName}</Text>
                )}

                <Text style={styles.label}>Note globale</Text>
                {renderStars()}
                {rating > 0 && (
                  <Text style={styles.ratingText}>{rating} / 5</Text>
                )}

                <Text style={styles.label}>Commentaire (optionnel)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Donnez votre avis sur le service..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  value={comment}
                  onChangeText={setComment}
                  editable={!isSubmitting}
                  maxLength={500}
                />
                <Text style={styles.charCount}>{comment.length} / 500</Text>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting || rating === 0}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {existingRating ? 'Modifier' : 'Soumettre'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  driverName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  star: {
    marginHorizontal: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
    textAlign: 'center',
    marginTop: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

