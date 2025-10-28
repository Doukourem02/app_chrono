import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Suggestion = {
  place_id: string;
  description: string;
};

type Props = {
  placeholder?: string;
  onPlaceSelected: (data: { description: string; coords?: { latitude: number; longitude: number } }) => void;
  initialValue?: string;
  country?: string; // ISO country code e.g. 'ci' for Côte d'Ivoire
};

export default function PlacesAutocomplete({ placeholder, onPlaceSelected, initialValue = '', country }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const timer = useRef<number | null>(null);

  // TODO: Replace with your own Google Places API key and restrict it via HTTP referrers or server proxy
  const GOOGLE_API_KEY = "AIzaSyCAN9p_0DsBFRl6Yaw3SCRel90kh1vJ3Tk";

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Keep internal query in sync when parent updates initialValue
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
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.append('input', input);
      url.searchParams.append('key', GOOGLE_API_KEY);
      url.searchParams.append('language', 'fr');
      if (country) url.searchParams.append('components', `country:${country}`);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.status === 'OK') {
        setSuggestions(json.predictions.map((p: any) => ({ place_id: p.place_id, description: p.description })));
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.warn('Places autocomplete error', err);
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
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.append('place_id', placeId);
      url.searchParams.append('key', GOOGLE_API_KEY);
      url.searchParams.append('language', 'fr');

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.status === 'OK' && json.result && json.result.geometry) {
        const loc = json.result.geometry.location;
        return { latitude: loc.lat, longitude: loc.lng };
      }
    } catch (err) {
      console.warn('Place details error', err);
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
