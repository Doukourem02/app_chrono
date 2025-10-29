import React from 'react';
import { View, Text, StyleSheet, Switch, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface StatusToggleProps {
  isOnline: boolean;
  onToggle: (value: boolean) => void;
  hasLocationError?: boolean;
}

export const StatusToggle: React.FC<StatusToggleProps> = ({ 
  isOnline, 
  onToggle, 
  hasLocationError = false 
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
          <Ionicons name="warning" size={16} color="#FF6B6B" style={{ marginLeft: 5 }} />
        )}
      </View>
      
      <Switch
        value={isOnline && !hasLocationError}
        onValueChange={onToggle}
        disabled={hasLocationError}
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