/**
 * Autocomplete d'adresses - aligné sur admin_chrono
 * Combine Search Box + Geocoding + Nominatim pour rues, adresses, POI visibles sur la carte
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { config } from '../config';
import { logger } from '../utils/logger';
import { searchOverpassPoi, type OverpassPoiResult } from '../utils/overpassPoiSearch';

const MAPBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest';
const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve';
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const PROXIMITY = '-4.0083,5.36';
const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'ChronoLivraison/1.0 (app-mobile-address-search)',
};

interface MapboxSuggestion {
  name: string;
  mapbox_id: string;
  feature_type: string;
  address?: string;
  full_address?: string;
  place_formatted: string;
  coordinates?: { lat: number; lng: number };
  source?: 'searchbox' | 'geocode' | 'nominatim' | 'overpass';
}

interface MapboxRetrieveFeature {
  geometry?: { coordinates: [number, number]; type: string };
  properties?: { coordinates?: { latitude: number; longitude: number } };
}

interface GeocodeFeature {
  id?: string;
  geometry?: { coordinates: [number, number] | [number, number][] };
  properties?: {
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    mapbox_id?: string;
    feature_type?: string;
    context?: {
      street?: { name?: string } | string;
      address?: { street_name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      district?: { name?: string };
      neighborhood?: { name?: string };
    };
  };
}

interface NominatimResult {
  place_id: string;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
}

function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isNumericQuery(q: string): boolean {
  return /^\d[\d\s]*$/.test(q.trim());
}

/** Affiche "à proximité" au lieu de "Category" pour les POI (comme admin_chrono) */
function formatPlaceFormatted(s: MapboxSuggestion): string {
  if (s.feature_type === 'category' || s.place_formatted?.toLowerCase() === 'category') {
    return `${s.name} à proximité`;
  }
  return s.place_formatted || '';
}

type Props = {
  placeholder?: string;
  initialValue?: string;
  country?: string;
  proximity?: string;
  onPlaceSelected: (data: {
    description: string;
    coords?: { latitude: number; longitude: number };
  }) => void;
};

export default function MapboxAddressAutocomplete({
  placeholder = 'Rechercher une adresse',
  initialValue = '',
  country = 'ci',
  proximity = PROXIMITY,
  onPlaceSelected,
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionToken] = useState(() => generateSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessToken = config.mapboxAccessToken;

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const fetchSuggestions = useCallback(
    async (searchText: string) => {
      const trimmed = searchText.trim();
      if (!trimmed || !accessToken) {
        setSuggestions([]);
        return;
      }
      const minLen = isNumericQuery(trimmed) ? 1 : 2;
      if (trimmed.length < minLen) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const baseParams = { country, language: 'fr', proximity };
        const extraTypes = isNumericQuery(trimmed) ? 'postcode,address' : undefined;

        // Appels parallèles : Search Box + Geocoding général + Geocoding rues/adresses
        const fetches: Promise<Response>[] = [
          fetch(
            `${MAPBOX_SUGGEST_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              session_token: sessionToken,
              ...baseParams,
              limit: '8',
            })}`
          ),
          fetch(
            `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              ...baseParams,
              limit: '10',
              autocomplete: 'true',
              ...(extraTypes ? { types: extraTypes } : {}),
            })}`
          ),
          fetch(
            `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              ...baseParams,
              limit: '8',
              autocomplete: 'true',
              types: extraTypes || 'street,address',
            })}`
          ),
        ];

        // Overpass : POI OSM (pharmacies, restaurants, écoles, KFC, etc.) - Côte d'Ivoire
        const [proxLng, proxLat] = proximity.split(',').map((x) => parseFloat(x.trim()));
        const overpassPromise = searchOverpassPoi(
          trimmed,
          Number.isFinite(proxLat) && Number.isFinite(proxLng) ? { lat: proxLat, lng: proxLng } : undefined
        ).catch((err) => {
          logger.warn('[MapboxAddressAutocomplete] Overpass non disponible:', err);
          return [] as OverpassPoiResult[];
        });

        // Nominatim : rues, quartiers, POI visibles sur la carte (comme admin)
        const nominatimQ = trimmed.toLowerCase().includes('abidjan') ? trimmed : `${trimmed}, Abidjan`;
        const nominatimPromise = fetch(
          `${NOMINATIM_URL}?${new URLSearchParams({
            q: nominatimQ,
            format: 'json',
            limit: '10',
            countrycodes: 'ci',
            bounded: '0',
            viewbox: '-4.15,5.2,-3.85,5.45',
          })}`,
          { headers: NOMINATIM_HEADERS }
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch((err) => {
            logger.warn('[MapboxAddressAutocomplete] Nominatim non disponible:', err);
            return [];
          });

        const results = await Promise.all([...fetches, overpassPromise, nominatimPromise]);
        const suggestRes = results[0];
        const geocodeRes = results[1];
        const geocodeStreetRes = results[2];
        const overpassData = results[3] as OverpassPoiResult[];
        const nominatimData = results[4] as NominatimResult[];

        const suggestData = await suggestRes.json();
        const geocodeData = await geocodeRes.json();
        const geocodeStreetData = await geocodeStreetRes.json();

        const fromSearchBox: MapboxSuggestion[] = (suggestData?.suggestions || []).map((s: Record<string, unknown>) => ({
          ...s,
          source: 'searchbox' as const,
        })) as MapboxSuggestion[];

        const parseGeocodeFeature = (f: GeocodeFeature): MapboxSuggestion | null => {
          const coords = f.geometry?.coordinates;
          let lng: number | null = null;
          let lat: number | null = null;
          if (Array.isArray(coords) && coords.length > 0) {
            const first = coords[0];
            if (typeof first === 'number') {
              [lng, lat] = coords as [number, number];
            } else if (Array.isArray(first)) {
              [lng, lat] = first as [number, number];
            }
          }
          if (lat == null || lng == null) return null;
          const props = f.properties || {};
          const ctx = props.context || {};
          const streetVal = ctx.street;
          const streetName =
            (typeof streetVal === 'string' ? streetVal : (streetVal as { name?: string })?.name) ??
            ctx.address?.street_name ??
            null;
          const name =
            props.name ||
            props.name_preferred ||
            props.full_address ||
            streetName ||
            (props.place_formatted ? String(props.place_formatted).split(',')[0]?.trim() : '') ||
            '';
          if (!name) return null;
          const placeParts = [
            ctx.place?.name,
            ctx.locality?.name,
            ctx.district?.name,
            ctx.neighborhood?.name,
          ].filter(Boolean);
          const place_formatted = props.place_formatted || placeParts.join(', ') || '';
          return {
            name,
            mapbox_id: props.mapbox_id || f.id || '',
            feature_type: props.feature_type || 'address',
            full_address: props.full_address,
            place_formatted,
            coordinates: { lat, lng },
            source: 'geocode' as const,
          };
        };

        const fromGeocode = (geocodeData?.features || []).map(parseGeocodeFeature).filter(Boolean) as MapboxSuggestion[];
        const fromGeocodeStreet = (geocodeStreetData?.features || [])
          .map(parseGeocodeFeature)
          .filter(Boolean) as MapboxSuggestion[];

        const fromNominatim: MapboxSuggestion[] = (nominatimData || [])
          .filter((r: NominatimResult) => r.lat && r.lon && r.display_name)
          .map((r: NominatimResult) => ({
            name: r.display_name.split(',')[0]?.trim() || r.display_name,
            mapbox_id: `nominatim-${r.place_id}`,
            feature_type: r.type || r.class || 'place',
            full_address: r.display_name,
            place_formatted: r.display_name,
            coordinates: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
            source: 'nominatim' as const,
          }));

        const fromOverpass: MapboxSuggestion[] = (overpassData || []).map((o) => ({
          name: o.name,
          mapbox_id: o.mapbox_id,
          feature_type: o.feature_type,
          full_address: o.full_address,
          place_formatted: o.place_formatted,
          coordinates: o.coordinates,
          source: 'overpass' as const,
        }));

        // Ordre de merge : POI (Search Box + Overpass) en premier, puis Geocode, rues, Nominatim
        const seen = new Set<string>();
        const merged: MapboxSuggestion[] = [];
        for (const s of [...fromSearchBox, ...fromOverpass, ...fromGeocode, ...fromGeocodeStreet, ...fromNominatim]) {
          const key = `${(s.name || '').toLowerCase()}|${(s.place_formatted || '').toLowerCase()}`;
          if (key && !seen.has(key) && s.name) {
            seen.add(key);
            merged.push(s);
          }
        }
        setSuggestions(merged.slice(0, 15));
      } catch (err) {
        logger.error('Mapbox suggest error', 'MapboxAddressAutocomplete', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, sessionToken, country, proximity]
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setQuery(text);
      setSuggestions([]);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      const minLen = isNumericQuery(text) ? 1 : 2;
      if (text.trim().length >= minLen) {
        debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
      }
    },
    [fetchSuggestions]
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      const address = suggestion.full_address || suggestion.address || suggestion.name;
      setQuery(address);
      setSuggestions([]);

      // Coordonnées directes (geocode/nominatim) : pas d'appel retrieve
      if (suggestion.coordinates) {
        onPlaceSelected({
          description: address,
          coords: {
            latitude: suggestion.coordinates.lat,
            longitude: suggestion.coordinates.lng,
          },
        });
        return;
      }

      if (!accessToken) {
        onPlaceSelected({ description: address });
        return;
      }

      try {
        const params = new URLSearchParams({
          access_token: accessToken,
          session_token: sessionToken,
        });
        const res = await fetch(
          `${MAPBOX_RETRIEVE_URL}/${encodeURIComponent(suggestion.mapbox_id)}?${params}`
        );
        const data = await res.json();

        const feature = data?.features?.[0] as MapboxRetrieveFeature | undefined;
        let coords: { latitude: number; longitude: number } | undefined;

        if (feature?.geometry?.coordinates) {
          const [lng, lat] = feature.geometry.coordinates;
          coords = { latitude: lat, longitude: lng };
        } else if (feature?.properties?.coordinates) {
          coords = feature.properties.coordinates;
        }

        onPlaceSelected({ description: address, coords });
      } catch (err) {
        logger.error('Mapbox retrieve error', 'MapboxAddressAutocomplete', err);
        onPlaceSelected({ description: address });
      }
    },
    [accessToken, sessionToken, onPlaceSelected]
  );

  const showSuggestions = suggestions.length > 0;

  if (!accessToken) {
    return (
      <View style={styles.container}>
        <View style={styles.inputBox}>
          <TextInput
            placeholder={placeholder}
            value={query}
            onChangeText={handleInputChange}
            style={styles.input}
            placeholderTextColor="#999"
            editable={false}
          />
          <Text style={styles.hint}>Mapbox non configuré</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputBox}>
        <TextInput
          placeholder={placeholder}
          value={query}
          onChangeText={handleInputChange}
          style={styles.input}
          placeholderTextColor="#999"
        />
        {loading && <ActivityIndicator size="small" color="#8B5CF6" />}
      </View>

      {showSuggestions && (
        <View style={styles.suggestionList}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.suggestionScroll}
          >
            {suggestions.map((s, i) => {
              const subtext = formatPlaceFormatted(s);
              return (
                <TouchableOpacity
                  key={`${s.mapbox_id}-${i}`}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  {subtext ? (
                    <Text style={styles.suggestionSubtext}>{subtext}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
  },
  inputBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
  },
  suggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 4,
    elevation: 8,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  suggestionScroll: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
