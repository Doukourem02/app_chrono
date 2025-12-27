import React, { useState, useEffect, useCallback } from 'react';
import {View,Text,Animated,PanResponderInstance,TouchableOpacity,StyleSheet,TextInput,ActivityIndicator,Alert} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userApiService } from '../services/userApiService';

interface RatingBottomSheetProps {
  orderId: string | null;
  driverName?: string | null;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
  onRatingSubmitted?: () => void;
  onClose: () => void;
}

const RatingBottomSheet: React.FC<RatingBottomSheetProps> = ({
  orderId,
  driverName,
  panResponder,
  animatedHeight,
  isExpanded,
  onToggle,
  onRatingSubmitted,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  const loadExistingRating = useCallback(async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    try {
      const result = await userApiService.getOrderRating(orderId);
      if (result.success && result.data) {
        setExistingRating(result.data.rating);
        setRating(result.data.rating);
        setComment(result.data.comment || '');
      } else {
        // Si l'évaluation n'existe pas, c'est normal - on commence avec un formulaire vide
        setExistingRating(null);
        setRating(0);
        setComment('');
      }
    } catch (error) {
      // En cas d'erreur (token expiré, etc.), continuer avec un formulaire vide
      // L'utilisateur pourra quand même soumettre une évaluation
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
    if (orderId) {
      loadExistingRating();
    } else {
      // Reset form si pas d'orderId
      setRating(0);
      setComment('');
      setExistingRating(null);
    }
  }, [orderId, loadExistingRating]);

  const handleStarPress = (starValue: number) => {
    if (isSubmitting) return;
    setRating(starValue);
  };

  const handleSubmit = async () => {
    if (!orderId) return;
    
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
                handleClose();
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
              size={36}
              color={starValue <= rating ? '#FBBF24' : '#D1D5DB'}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (!orderId) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.sheetContainer,
        {
          height: animatedHeight,
          bottom: insets.bottom + 25,
          zIndex: 1001, // zIndex le plus élevé pour être au-dessus de tous les autres bottom sheets
        },
      ]}
    >
      {/* Handle */}
      <TouchableOpacity onPress={onToggle} style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {/* État collapsé */}
      {!isExpanded && (
        <View style={styles.collapsedWrapper}>
          <View style={styles.collapsedContainer}>
            <Ionicons name="star" size={24} color="#fff" />
            <Text style={styles.collapsedText}>
              {existingRating ? 'Évaluation modifiée' : 'Évaluer votre livreur'}
            </Text>
          </View>
        </View>
      )}

      {/* État expandé */}
      {isExpanded && (
        <View style={styles.expandedCard}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {existingRating ? 'Modifier votre évaluation' : 'Évaluer votre livreur'}
                </Text>
                <TouchableOpacity 
                  onPress={handleClose} 
                  disabled={isSubmitting} 
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

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
                  style={[
                    styles.button,
                    styles.submitButton,
                    rating === 0 && styles.submitButtonDisabled,
                  ]}
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
      )}
    </Animated.View>
  );
};

export default RatingBottomSheet;

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dragIndicator: {
    alignItems: 'center',
    marginTop: 6,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  collapsedWrapper: {
    alignSelf: 'center',
    width: '92%',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  collapsedContainer: {
    backgroundColor: '#FBBF24',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  collapsedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  expandedCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
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
    marginBottom: 16,
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
    marginHorizontal: 6,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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

