import React from 'react';
import { View, Text, StyleSheet, Switch, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface StatusToggleProps {
  isOnline: boolean;
  onToggle: (value: boolean) => void;
  /** Vrai si GPS / permission réellement bloquants (pas une erreur transitoire alors qu’une position existe). */
  hasLocationError?: boolean;
  /** Désactive le switch (ex. permission refusée côté OS) — laisser false pour permettre au moins de repasser hors ligne. */
  disableSwitch?: boolean;
  /** Ouvre les réglages app (localisation) — affiché si hasLocationError */
  onOpenLocationSettings?: () => void;
}

export const StatusToggle: React.FC<StatusToggleProps> = ({
  isOnline,
  onToggle,
  hasLocationError = false,
  disableSwitch = false,
  onOpenLocationSettings,
}) => {
  const getStatusText = () => {
    if (hasLocationError) return 'Localisation indisponible';
    return isOnline ? 'En ligne' : 'Hors ligne';
  };

  const getStatusColor = () => {
    if (hasLocationError) return '#FF6B6B';
    return isOnline ? '#10B981' : '#6B7280';
  };

  return (
    <View style={styles.statusBar}>
      <View style={styles.statusInfo}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {hasLocationError && (
          onOpenLocationSettings ? (
            <TouchableOpacity
              onPress={onOpenLocationSettings}
              accessibilityRole="button"
              accessibilityLabel={
                Platform.OS === 'ios'
                  ? 'Ouvrir les réglages de localisation'
                  : 'Ouvrir les paramètres de l’application'
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="warning" size={16} color="#FF6B6B" style={{ marginLeft: 5 }} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="warning" size={16} color="#FF6B6B" style={{ marginLeft: 5 }} />
          )
        )}
      </View>
      
      <Switch
        value={isOnline}
        onValueChange={onToggle}
        disabled={disableSwitch}
        thumbColor={isOnline ? '#8B5CF6' : '#f4f3f4'}
        trackColor={{ false: '#d1d1d1', true: '#C4B5FD' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  statusBar: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    width: width * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#444',
  },
});