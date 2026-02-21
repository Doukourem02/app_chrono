import React, { useState, useEffect } from 'react';
import {View,Text,StyleSheet,TextInput,TouchableOpacity,ScrollView,Alert,ActivityIndicator,Image} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';
import { logger } from '../../utils/logger';
import { showUserFriendlyError } from '../../utils/errorFormatter';

interface DocumentData {
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  document_url?: string | null;
  is_uploading?: boolean;
}

export default function VehiclePage() {
  const { profile, user } = useDriverStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicleType: '',
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    licenseNumber: '',
  });

  // État pour les documents légaux
  const [, setLoadingDocuments] = useState(false);
  const [documents, setDocuments] = useState<{
    carte_grise: DocumentData;
    assurance: DocumentData;
    controle_technique: DocumentData;
    permis_conduire: DocumentData;
  }>({
    carte_grise: {},
    assurance: {},
    controle_technique: {},
    permis_conduire: {},
  });


  useEffect(() => {
    if (profile) {
      setFormData({
        vehicleType: profile.vehicle_type || '',
        vehiclePlate: profile.vehicle_plate || '',
        vehicleBrand: (profile as any).vehicle_brand || '',
        vehicleModel: profile.vehicle_model || '',
        vehicleColor: (profile as any).vehicle_color || '',
        licenseNumber: profile.license_number || '',
      });
    }
  }, [profile]);

  // Charger les documents existants
  useEffect(() => {
    const loadDocuments = async () => {
      if (!profile?.vehicle_plate) return;

      setLoadingDocuments(true);
      try {
        const result = await apiService.getVehicleDocuments(profile.vehicle_plate);
        if (result.success && result.data) {
          const docsMap: any = {
            carte_grise: {},
            assurance: {},
            controle_technique: {},
            permis_conduire: {},
          };

          result.data.forEach((doc: any) => {
            docsMap[doc.document_type] = {
              document_number: doc.document_number || '',
              issue_date: doc.issue_date || '',
              expiry_date: doc.expiry_date || '',
              document_url: doc.document_url,
            };
          });

          setDocuments(docsMap);
        }
      } catch (error) {
        logger.error('Erreur chargement documents:', undefined, error);
      } finally {
        setLoadingDocuments(false);
      }
    };

    loadDocuments();
  }, [profile?.vehicle_plate]);

  const handleSave = async () => {
    if (!formData.vehicleType.trim() || !formData.vehiclePlate.trim()) {
      Alert.alert('Erreur', 'Le type de véhicule et la plaque sont requis');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Utilisateur non identifié');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiService.updateDriverVehicle(user.id, {
        vehicle_type: formData.vehicleType as 'moto' | 'vehicule' | 'cargo',
        vehicle_plate: formData.vehiclePlate.trim(),
        vehicle_brand: formData.vehicleBrand.trim() || undefined,
        vehicle_model: formData.vehicleModel.trim() || undefined,
        vehicle_color: formData.vehicleColor.trim() || undefined,
        license_number: formData.licenseNumber.trim() || undefined,
      });

      if (result.success && result.data) {
        // Mettre à jour le store avec les nouvelles données
        const currentState = useDriverStore.getState();
        if (currentState.profile) {
          useDriverStore.getState().updateProfile({
            vehicle_type: result.data.vehicle_type,
            vehicle_plate: result.data.vehicle_plate ?? undefined,
            vehicle_brand: result.data.vehicle_brand ?? undefined,
            vehicle_model: result.data.vehicle_model ?? undefined,
            vehicle_color: result.data.vehicle_color ?? undefined,
            license_number: result.data.license_number ?? undefined,
          });
        }

        Alert.alert('Succès', 'Les informations du véhicule ont été mises à jour', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        // Afficher un message user-friendly (jamais les détails techniques)
        showUserFriendlyError(new Error(result.message || 'Impossible de mettre à jour les informations'), 'mise à jour des informations du véhicule');
      }
    } catch (error) {
      // Logger l'erreur technique (pour les développeurs, pas visible à l'utilisateur)
      logger.error('Erreur mise à jour véhicule:', undefined, error);
      // Afficher un message user-friendly (jamais les détails techniques)
      showUserFriendlyError(error, 'mise à jour des informations du véhicule');
    } finally {
      setIsLoading(false);
    }
  };

  // Sélectionner une image pour un document
  const handlePickDocumentImage = async (documentType: 'carte_grise' | 'assurance' | 'controle_technique' | 'permis_conduire') => {
    if (!profile?.vehicle_plate) {
      Alert.alert('Erreur', 'Veuillez d\'abord renseigner la plaque d\'immatriculation');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erreur', 'Permission d\'accès aux photos refusée');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocumentImage(documentType, result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (error) {
      logger.error('Erreur sélection image document:', undefined, error);
      showUserFriendlyError(error, 'sélection image document');
    }
  };

  // Uploader l'image d'un document
  const uploadDocumentImage = async (
    documentType: 'carte_grise' | 'assurance' | 'controle_technique' | 'permis_conduire',
    imageUri: string,
    mimeType: string
  ) => {
    if (!profile?.vehicle_plate) return;

    try {
      setDocuments((prev) => ({
        ...prev,
        [documentType]: { ...prev[documentType], is_uploading: true },
      }));

      // Lire l'image en base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const base64DataUri = `data:${mimeType};base64,${base64}`;

      // Uploader le document
      const result = await apiService.uploadVehicleDocument(
        profile.vehicle_plate,
        documentType,
        {
          document_number: documents[documentType].document_number,
          issue_date: documents[documentType].issue_date,
          expiry_date: documents[documentType].expiry_date,
          imageBase64: base64DataUri,
          mimeType,
        }
      );

      if (result.success && result.data) {
        setDocuments((prev) => ({
          ...prev,
          [documentType]: {
            ...prev[documentType],
            document_url: result.data?.document_url || null,
            is_uploading: false,
          },
        }));
        Alert.alert('Succès', 'Document enregistré avec succès');
      } else {
        showUserFriendlyError(new Error(result.message || 'Erreur lors de l\'enregistrement'), 'enregistrement document');
      }
    } catch (error) {
      logger.error('Erreur upload document:', undefined, error);
      showUserFriendlyError(error, 'upload document');
    } finally {
      setDocuments((prev) => ({
        ...prev,
        [documentType]: { ...prev[documentType], is_uploading: false },
      }));
    }
  };

  // Sauvegarder les informations d'un document (sans image)
  const handleSaveDocument = async (documentType: 'carte_grise' | 'assurance' | 'controle_technique' | 'permis_conduire') => {
    if (!profile?.vehicle_plate) {
      Alert.alert('Erreur', 'Veuillez d\'abord renseigner la plaque d\'immatriculation');
      return;
    }

    try {
      const result = await apiService.uploadVehicleDocument(profile.vehicle_plate, documentType, {
        document_number: documents[documentType].document_number,
        issue_date: documents[documentType].issue_date,
        expiry_date: documents[documentType].expiry_date,
      });

      if (result.success) {
        Alert.alert('Succès', 'Document enregistré avec succès');
      } else {
        showUserFriendlyError(new Error(result.message || 'Erreur lors de l\'enregistrement'), 'enregistrement document');
      }
    } catch (error) {
      logger.error('Erreur sauvegarde document:', undefined, error);
      showUserFriendlyError(error, 'sauvegarde document');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon véhicule</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type de véhicule</Text>
            <View style={styles.vehicleTypeContainer}>
              {['moto', 'vehicule', 'cargo'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicleType === type && styles.vehicleTypeButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, vehicleType: type })}
                >
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      formData.vehicleType === type && styles.vehicleTypeTextActive,
                    ]}
                  >
                    {type === 'moto' ? 'Moto' : type === 'vehicule' ? 'Véhicule' : 'Cargo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Plaque d&apos;immatriculation</Text>
            <TextInput
              style={styles.input}
              value={formData.vehiclePlate}
              onChangeText={(text) => setFormData({ ...formData, vehiclePlate: text.toUpperCase() })}
              placeholder="Ex: AB-123-CD"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Marque</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleBrand}
              onChangeText={(text) => setFormData({ ...formData, vehicleBrand: text })}
              placeholder="Ex: Yamaha, Toyota"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Modèle</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleModel}
              onChangeText={(text) => setFormData({ ...formData, vehicleModel: text })}
              placeholder="Ex: MT-07, Corolla"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Couleur</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleColor}
              onChangeText={(text) => setFormData({ ...formData, vehicleColor: text })}
              placeholder="Ex: Rouge, Bleu"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro de permis</Text>
            <TextInput
              style={styles.input}
              value={formData.licenseNumber}
              onChangeText={(text) => setFormData({ ...formData, licenseNumber: text })}
              placeholder="Votre numéro de permis de conduire"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Section Documents légaux */}
        {formData.vehiclePlate && (
          <View style={styles.documentsSection}>
            <Text style={styles.sectionTitle}>Documents légaux</Text>
            <Text style={styles.sectionSubtitle}>
              Renseignez les documents de votre véhicule
            </Text>

            {/* Carte grise */}
            <View style={styles.documentCard}>
              <Text style={styles.documentTitle}>Carte grise</Text>
              <TextInput
                style={styles.input}
                value={documents.carte_grise.document_number || ''}
                onChangeText={(text) =>
                  setDocuments((prev) => ({
                    ...prev,
                    carte_grise: { ...prev.carte_grise, document_number: text },
                  }))
                }
                placeholder="Numéro de carte grise"
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.dateRow}>
                <View style={styles.dateInput}>
                  <Text style={styles.dateLabel}>Date d&apos;émission</Text>
                  <TextInput
                    style={styles.input}
                    value={documents.carte_grise.issue_date || ''}
                    onChangeText={(text) =>
                      setDocuments((prev) => ({
                        ...prev,
                        carte_grise: { ...prev.carte_grise, issue_date: text },
                      }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.dateInput}>
                  <Text style={styles.dateLabel}>Date d&apos;expiration</Text>
                  <TextInput
                    style={styles.input}
                    value={documents.carte_grise.expiry_date || ''}
                    onChangeText={(text) =>
                      setDocuments((prev) => ({
                        ...prev,
                        carte_grise: { ...prev.carte_grise, expiry_date: text },
                      }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handlePickDocumentImage('carte_grise')}
                disabled={documents.carte_grise.is_uploading}
              >
                {documents.carte_grise.is_uploading ? (
                  <ActivityIndicator color="#8B5CF6" />
                ) : (
                  <>
                    <Ionicons
                      name={documents.carte_grise.document_url ? 'checkmark-circle' : 'camera-outline'}
                      size={20}
                      color={documents.carte_grise.document_url ? '#10B981' : '#8B5CF6'}
                    />
                    <Text style={styles.uploadButtonText}>
                      {documents.carte_grise.document_url ? 'Photo enregistrée' : 'Prendre/Choisir une photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {documents.carte_grise.document_url && (
                <Image
                  source={{ uri: documents.carte_grise.document_url }}
                  style={styles.documentPreview}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                style={styles.saveDocumentButton}
                onPress={() => handleSaveDocument('carte_grise')}
              >
                <Text style={styles.saveDocumentButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            {/* Assurance */}
            <View style={styles.documentCard}>
              <Text style={styles.documentTitle}>Assurance</Text>
              <TextInput
                style={styles.input}
                value={documents.assurance.document_number || ''}
                onChangeText={(text) =>
                  setDocuments((prev) => ({
                    ...prev,
                    assurance: { ...prev.assurance, document_number: text },
                  }))
                }
                placeholder="Numéro d'assurance"
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.dateRow}>
                <View style={styles.dateInput}>
                  <Text style={styles.dateLabel}>Date d&apos;émission</Text>
                  <TextInput
                    style={styles.input}
                    value={documents.assurance.issue_date || ''}
                    onChangeText={(text) =>
                      setDocuments((prev) => ({
                        ...prev,
                        assurance: { ...prev.assurance, issue_date: text },
                      }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.dateInput}>
                  <Text style={styles.dateLabel}>Date d&apos;expiration</Text>
                  <TextInput
                    style={styles.input}
                    value={documents.assurance.expiry_date || ''}
                    onChangeText={(text) =>
                      setDocuments((prev) => ({
                        ...prev,
                        assurance: { ...prev.assurance, expiry_date: text },
                      }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handlePickDocumentImage('assurance')}
                disabled={documents.assurance.is_uploading}
              >
                {documents.assurance.is_uploading ? (
                  <ActivityIndicator color="#8B5CF6" />
                ) : (
                  <>
                    <Ionicons
                      name={documents.assurance.document_url ? 'checkmark-circle' : 'camera-outline'}
                      size={20}
                      color={documents.assurance.document_url ? '#10B981' : '#8B5CF6'}
                    />
                    <Text style={styles.uploadButtonText}>
                      {documents.assurance.document_url ? 'Photo enregistrée' : 'Prendre/Choisir une photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {documents.assurance.document_url && (
                <Image
                  source={{ uri: documents.assurance.document_url }}
                  style={styles.documentPreview}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                style={styles.saveDocumentButton}
                onPress={() => handleSaveDocument('assurance')}
              >
                <Text style={styles.saveDocumentButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            {/* Contrôle technique */}
            <View style={styles.documentCard}>
              <Text style={styles.documentTitle}>Contrôle technique</Text>
              <View style={styles.dateInput}>
                <Text style={styles.dateLabel}>Date d&apos;expiration</Text>
                <TextInput
                  style={styles.input}
                  value={documents.controle_technique.expiry_date || ''}
                  onChangeText={(text) =>
                    setDocuments((prev) => ({
                      ...prev,
                      controle_technique: { ...prev.controle_technique, expiry_date: text },
                    }))
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handlePickDocumentImage('controle_technique')}
                disabled={documents.controle_technique.is_uploading}
              >
                {documents.controle_technique.is_uploading ? (
                  <ActivityIndicator color="#8B5CF6" />
                ) : (
                  <>
                    <Ionicons
                      name={documents.controle_technique.document_url ? 'checkmark-circle' : 'camera-outline'}
                      size={20}
                      color={documents.controle_technique.document_url ? '#10B981' : '#8B5CF6'}
                    />
                    <Text style={styles.uploadButtonText}>
                      {documents.controle_technique.document_url ? 'Photo enregistrée' : 'Prendre/Choisir une photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {documents.controle_technique.document_url && (
                <Image
                  source={{ uri: documents.controle_technique.document_url }}
                  style={styles.documentPreview}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                style={styles.saveDocumentButton}
                onPress={() => handleSaveDocument('controle_technique')}
              >
                <Text style={styles.saveDocumentButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            {/* Permis de conduire */}
            <View style={styles.documentCard}>
              <Text style={styles.documentTitle}>Permis de conduire</Text>
              <View style={styles.dateInput}>
                <Text style={styles.dateLabel}>Date d&apos;expiration</Text>
                <TextInput
                  style={styles.input}
                  value={documents.permis_conduire.expiry_date || ''}
                  onChangeText={(text) =>
                    setDocuments((prev) => ({
                      ...prev,
                      permis_conduire: { ...prev.permis_conduire, expiry_date: text },
                    }))
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handlePickDocumentImage('permis_conduire')}
                disabled={documents.permis_conduire.is_uploading}
              >
                {documents.permis_conduire.is_uploading ? (
                  <ActivityIndicator color="#8B5CF6" />
                ) : (
                  <>
                    <Ionicons
                      name={documents.permis_conduire.document_url ? 'checkmark-circle' : 'camera-outline'}
                      size={20}
                      color={documents.permis_conduire.document_url ? '#10B981' : '#8B5CF6'}
                    />
                    <Text style={styles.uploadButtonText}>
                      {documents.permis_conduire.document_url ? 'Photo enregistrée' : 'Prendre/Choisir une photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {documents.permis_conduire.document_url && (
                <Image
                  source={{ uri: documents.permis_conduire.document_url }}
                  style={styles.documentPreview}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                style={styles.saveDocumentButton}
                onPress={() => handleSaveDocument('permis_conduire')}
              >
                <Text style={styles.saveDocumentButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </>
          )}
        </TouchableOpacity>
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
  form: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  vehicleTypeButtonActive: {
    backgroundColor: '#F3F0FF',
    borderColor: '#8B5CF6',
  },
  vehicleTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  vehicleTypeTextActive: {
    color: '#8B5CF6',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  documentsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  documentCard: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F0FF',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    gap: 8,
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  documentPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  saveDocumentButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveDocumentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

