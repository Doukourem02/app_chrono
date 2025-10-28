import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logger } from '../utils/logger';
import { useErrorHandler } from '../utils/errorHandler';
import { config } from '../config';

type Suggestion = {
  place_id: string;
  description: string;
};

type Props = {
  placeholder?: string;
  onPlaceSelected: (data: { description: string; coords?: { latitude: number; longitude: number } }) => void;
  initialValue?: string;
  country?: string; 
};

export default function PlacesAutocomplete({ placeholder, onPlaceSelected, initialValue = '', country }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const timer = useRef<number | null>(null);
  const { handleError } = useErrorHandler();

  // Utilisation de la configuration centralisée
  const GOOGLE_API_KEY = config.googleApiKey;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    setQuery(initialValue || '');
  }, [initialValue]);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      logger.debug('Fetching places suggestions', 'PlacesAutocomplete', { input, country });
      
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.append('input', input);
      url.searchParams.append('key', GOOGLE_API_KEY);
      url.searchParams.append('language', 'fr');
      if (country) url.searchParams.append('components', `country:${country}`);

      const res = await fetch(url.toString());
      const json = await res.json();
      
      if (json.status === 'OK') {
        const mappedSuggestions = json.predictions.map((p: any) => ({ 
          place_id: p.place_id, 
          description: p.description 
        }));
        setSuggestions(mappedSuggestions);
        logger.debug('Places suggestions fetched', 'PlacesAutocomplete', { count: mappedSuggestions.length });
      } else {
        setSuggestions([]);
        logger.warn('Places API returned non-OK status', 'PlacesAutocomplete', { status: json.status });
      }
    } catch (err) {
      handleError(err, 'PlacesAutocomplete', 'Erreur lors de la recherche d\'adresses');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = (setTimeout(() => fetchSuggestions(text), 300) as unknown) as number;
  };

  const fetchPlaceDetails = async (placeId: string) => {
    try {
      logger.debug('Fetching place details', 'PlacesAutocomplete', { placeId });
      
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.append('place_id', placeId);
      url.searchParams.append('key', GOOGLE_API_KEY);
      url.searchParams.append('language', 'fr');

      const res = await fetch(url.toString());
      const json = await res.json();
      
      if (json.status === 'OK' && json.result && json.result.geometry) {
        const loc = json.result.geometry.location;
        const coords = { latitude: loc.lat, longitude: loc.lng };
        logger.debug('Place details fetched', 'PlacesAutocomplete', { coords });
        return coords;
      } else {
        logger.warn('Place details API returned invalid response', 'PlacesAutocomplete', { status: json.status });
      }
    } catch (err) {
      handleError(err, 'PlacesAutocomplete', 'Erreur lors de la récupération des détails de l\'adresse');
    }
    return undefined;
  };

  const onSelect = async (place: Suggestion) => {
    setQuery(place.description);
    setSuggestions([]);
    const coords = await fetchPlaceDetails(place.place_id);
    onPlaceSelected({ description: place.description, coords });
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputBox}>
        <TextInput
          placeholder={placeholder || 'Rechercher une adresse'}
          value={query}
          onChangeText={onChange}
          style={styles.input}
          placeholderTextColor="#999"
        />
        {loading && <ActivityIndicator size="small" color="#8B5CF6" />}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {suggestions.map((item) => (
            <TouchableOpacity key={item.place_id} style={styles.suggestionItem} onPress={() => onSelect(item)}>
              <Text style={styles.suggestionText}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  suggestionList: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    color: '#333',
  },
});
