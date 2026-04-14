/**
 * Autocomplete d'adresses - aligné sur admin_chrono
 * Combine Search Box + Geocoding + Nominatim pour rues, adresses, POI visibles sur la carte
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { config } from '../config';
import type { SavedClientAddress } from '../store/useSavedAddressesStore';
import { logger } from '../utils/logger';
import { searchOverpassPoi, type OverpassPoiResult } from '../utils/overpassPoiSearch';
import { searchCuratedPoi } from '../utils/poiAbidjan';
import {
  addressesVisuallyEqual,
  compactAddressForLocalDisplay,
  formatAutocompleteSelectedAddress,
  sanitizeGeocodeDisplayString,
  singleLineAddressInput,
} from '../utils/sanitizeGeocodeDisplay';

const MAPBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest';
const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve';
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const PROXIMITY = '-4.0083,5.36';
const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'Krono/1.0 (app-mobile-address-search)',
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

/**
 * Filtre les suggestions « proches » mais sans mot-clé (ex. « zoo » ne doit pas lister une route sans « zoo »).
 * Désactivé pour requêtes numériques / type rue : le géocodeur gère déjà la forme.
 */
function suggestionMatchesQueryTokens(s: MapboxSuggestion, query: string): boolean {
  const raw = query.trim().toLowerCase();
  if (raw.length < 2) return true;
  if (isNumericQuery(query)) return true;
  if (isStreetLikeQuery(query)) return true;

  const haystack = `${s.name || ''} ${s.full_address || ''} ${s.place_formatted || ''}`.toLowerCase();
  const tokens = raw.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return true;
  return tokens.every((t) => haystack.includes(t));
}

/** Détecte si la requête ressemble à une recherche de rue/adresse (Rue L29, Avenue X, etc.) */
function isStreetLikeQuery(q: string): boolean {
  const t = q.trim().toLowerCase();
  return (
    /^(rue|avenue|av\.?|boulevard|bd|bd\.?|route|impasse|allée)\s+/i.test(t) ||
    /^r\d+|^l\d+|^rue\s*l?\d+/i.test(t) ||
    t.length >= 2 && /^[a-z]?\d+/.test(t)
  );
}

/** Exclut les lignes de bus (gbaka), woro woro, routes de transport, résultats non pertinents */
function shouldExcludeSuggestion(s: MapboxSuggestion, query: string): boolean {
  const name = (s.name || '').toLowerCase();
  const desc = (s.place_formatted || s.full_address || '').toLowerCase();
  const combined = `${name} ${desc}`;

  // Exclure woro woro (lignes de taxi partagé) — "woro woro : Zoo → Opera"
  if (/woro\s*woro\s*[:\s→]|woro\s*woro\s*$/i.test(combined)) return true;
  if (/^woro\s*woro\s/i.test(name)) return true;

  // Exclure lignes de bus / gbaka / abaka (pas des adresses livrables)
  if (/(gbaka|abaka)\s*[:\s→]/i.test(combined)) return true;
  if (/^gbaka\s|^abaka\s/i.test(name)) return true;
  if (/[→↔].*[→↔]|liberté\s*→|azur\s*→|dokui\s*azur/i.test(combined)) return true;
  if (/^\s*\w+\s*:\s*\w+\s*→\s*\w+/i.test(name)) return true; // "X : Y → Z" = ligne bus
  if (/:\s*[^:]+(→|->)\s*\w+/i.test(combined)) return true; // "woro woro : Zoo → Opera" etc.

  // Exclure résultats "Zoo" non pertinents : pharmacie, station, etc. qui contiennent "zoo" dans le nom
  const q = query.trim().toLowerCase();
  if (q.includes('zoo')) {
    const isNonZooWithZooInName =
      (name.includes('pharmac') || name.includes('pharmacy') || name.includes('station') ||
        name.includes('oil') || name.includes('gas') || name.includes('veterinary')) &&
      name.includes('zoo');
    if (isNonZooWithZooInName) return true;
    // Exclure "ZOO, Avenue... Williamsville" (mauvais zoo)
    if (name.includes('zoo') && desc.includes('williamsville')) return true;
  }

  return false;
}

/** Score de pertinence pour réordonner (Zoo d'Abidjan en premier, etc.) */
function getRelevanceScore(s: MapboxSuggestion, query: string): number {
  const name = (s.name || '').toLowerCase();
  const desc = (s.place_formatted || s.full_address || '').toLowerCase();
  const q = query.trim().toLowerCase();

  if (q.includes('zoo')) {
    if (name.includes('zoo d\'abidjan') && !name.includes('pharmacy')) return 100;
    if (name.includes('zoo national')) return 95;
    if (name.includes('zoo') && (desc.includes('route du zoo') || desc.includes('cocody'))) return 80;
    if (name.includes('zoo') && desc.includes('williamsville')) return -50;
    if (name.includes('pharmacy') || name.includes('station') || name.includes('oil')) return -100;
  }

  return 0;
}

/** Sous-titre suggestion : sans commune/Abidjan/pays ; même logique que le champ après choix. */
function formatSuggestionSecondaryLine(s: MapboxSuggestion): string {
  if (s.feature_type === 'category' || s.place_formatted?.toLowerCase() === 'category') {
    return `${s.name} à proximité`;
  }
  const raw = s.place_formatted || s.full_address || '';
  return compactAddressForLocalDisplay(raw);
}

function formatSuggestionTitle(s: MapboxSuggestion): string {
  const raw = (s.name || '').trim();
  if (!raw) return compactAddressForLocalDisplay(s.full_address || s.place_formatted || '');
  return compactAddressForLocalDisplay(raw) || raw;
}

/** Distance Haversine en km */
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Formate la distance style Yango : "878 m" ou "1.7 km" */
function formatDistance(km: number): string {
  if (km < 0.001) return '< 1 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

type Props = {
  placeholder?: string;
  initialValue?: string;
  country?: string;
  proximity?: string;
  /** Coords de référence pour calculer la distance (position user ou pickup) */
  proximityCoords?: { latitude: number; longitude: number } | null;
  /** Intégré dans un bloc groupé (ex: pickup + dropoff) — pas de fond ni bordure propres */
  embedded?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onPlaceSelected: (data: {
    description: string;
    coords?: { latitude: number; longitude: number };
    /** Adresse rue complète si `description` est un libellé enregistré (ex. Domicile). */
    routingAddress?: string | null;
  }) => void;
  /** Appelé à chaque frappe — pour invalider un libellé enregistré côté commande. */
  onQueryChange?: (text: string) => void;
  /**
   * Si le texte du champ est exactement le nom enregistré (validation clavier ou sortie du champ),
   * l’adresse est appliquée comme une sélection — sans ligne supplémentaire dans la liste Mapbox.
   */
  savedAddresses?: SavedClientAddress[];
};

export default function MapboxAddressAutocomplete({
  placeholder = 'Rechercher une adresse',
  initialValue = '',
  country = 'ci',
  proximity = PROXIMITY,
  proximityCoords = null,
  embedded = false,
  onFocus,
  onBlur,
  onPlaceSelected,
  onQueryChange,
  savedAddresses = [],
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  /** Ferme la liste après tap sur le fond — réouvre au prochain focus / frappe. */
  const [suppressSuggestionList, setSuppressSuggestionList] = useState(false);
  const [sessionToken] = useState(() => generateSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurResolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedSavedFingerprintRef = useRef<string>('');
  /** Invalide les réponses Mapbox arrivées après un changement de requête (courses au clavier). */
  const suggestFetchGenRef = useRef(0);
  const accessToken = config.mapboxAccessToken;

  const refCoords = useMemo(() => {
    if (proximityCoords?.latitude != null && proximityCoords?.longitude != null) {
      return proximityCoords;
    }
    const [lng, lat] = proximity.split(',').map(Number);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [proximityCoords, proximity]);

  useEffect(() => {
    setQuery(sanitizeGeocodeDisplayString(singleLineAddressInput(initialValue)));
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (blurResolveTimerRef.current) {
        clearTimeout(blurResolveTimerRef.current);
        blurResolveTimerRef.current = null;
      }
    };
  }, []);

  const resolveSavedLabelIfExact = useCallback(
    (rawQuery: string): boolean => {
      const q = rawQuery.trim();
      if (!q || !savedAddresses.length) return false;
      const qn = q.toLowerCase();
      const hit = savedAddresses.find((a) => a.label.trim().toLowerCase() === qn);
      if (!hit) return false;

      const fingerprint = `${hit.id}|${qn}`;
      if (lastAppliedSavedFingerprintRef.current === fingerprint) {
        return true;
      }
      lastAppliedSavedFingerprintRef.current = fingerprint;

      setSuppressSuggestionList(true);
      suggestFetchGenRef.current += 1;
      setQuery(hit.label.trim());
      setSuggestions([]);
      onPlaceSelected({
        description: hit.label.trim(),
        coords: { latitude: hit.latitude, longitude: hit.longitude },
        routingAddress: hit.addressLine,
      });
      return true;
    },
    [savedAddresses, onPlaceSelected]
  );

  const scheduleBlurResolveSaved = useCallback(
    (rawQueryAtBlur: string) => {
      if (blurResolveTimerRef.current) {
        clearTimeout(blurResolveTimerRef.current);
      }
      blurResolveTimerRef.current = setTimeout(() => {
        blurResolveTimerRef.current = null;
        resolveSavedLabelIfExact(rawQueryAtBlur);
      }, 180);
    },
    [resolveSavedLabelIfExact]
  );

  const fetchSuggestions = useCallback(
    async (searchText: string) => {
      const gen = ++suggestFetchGenRef.current;
      const trimmed = searchText.trim();
      if (!trimmed || !accessToken) {
        if (gen === suggestFetchGenRef.current) setSuggestions([]);
        return;
      }
      const minLen = isNumericQuery(trimmed) ? 1 : 2;
      if (trimmed.length < minLen) {
        if (gen === suggestFetchGenRef.current) setSuggestions([]);
        return;
      }

      try {
        const baseParams = { country, language: 'fr', proximity };
        const extraTypes = isNumericQuery(trimmed) ? 'postcode,address' : undefined;
        const streetLike = isStreetLikeQuery(trimmed);

        // Pour "Rue L29" etc. : prioriser Geocode (rues) + Nominatim, éviter Search Box (retourne districts/landmarks)
        const streetTypes = extraTypes || 'street,address';

        const fetches: Promise<Response>[] = [];
        let suggestRes: Response | null = null;
        let geocodeRes: Response | null = null;
        let geocodeStreetRes: Response | null = null;

        if (!streetLike) {
          fetches.push(
            fetch(
              `${MAPBOX_SUGGEST_URL}?${new URLSearchParams({
                q: trimmed,
                access_token: accessToken,
                session_token: sessionToken,
                ...baseParams,
                limit: '6',
                types: streetTypes,
              })}`
            ).then((r) => {
              suggestRes = r;
              return r;
            })
          );
        }

        // Pour "Rue L29" : 1 seul appel Geocode (plus rapide), sinon 2 pour diversité
        const geocodeQ = streetLike ? `${trimmed}, Abidjan` : trimmed;
        fetches.push(
          fetch(
            `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
              q: geocodeQ,
              access_token: accessToken,
              ...baseParams,
              limit: streetLike ? '15' : '6',
              autocomplete: 'true',
              types: streetTypes,
            })}`
          ).then((r) => {
            geocodeRes = r;
            return r;
          })
        );

        if (!streetLike) {
          fetches.push(
            fetch(
              `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
                q: `${trimmed}, Abidjan`,
                access_token: accessToken,
                ...baseParams,
                limit: '6',
                autocomplete: 'true',
                types: streetTypes,
              })}`
            ).then((r) => {
              geocodeStreetRes = r;
              return r;
            })
          );
        } else {
          geocodeStreetRes = null;
        }

        const [proxLng, proxLat] = proximity.split(',').map((x) => parseFloat(x.trim()));
        const overpassPromise = !streetLike
          ? searchOverpassPoi(
              trimmed,
              Number.isFinite(proxLat) && Number.isFinite(proxLng) ? { lat: proxLat, lng: proxLng } : undefined
            ).catch((err) => {
              logger.warn('[MapboxAddressAutocomplete] Overpass non disponible:', err);
              return [] as OverpassPoiResult[];
            })
          : Promise.resolve([] as OverpassPoiResult[]);

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
        const overpassData = results[results.length - 2] as OverpassPoiResult[];
        const nominatimData = results[results.length - 1] as NominatimResult[];

        const suggestData = suggestRes ? await (suggestRes as Response).json() : { suggestions: [] };
        const fromSearchBox: MapboxSuggestion[] = (suggestData?.suggestions || []).map((s: Record<string, unknown>) => ({
          ...s,
          source: 'searchbox' as const,
        })) as MapboxSuggestion[];

        const geocodeData = geocodeRes ? await (geocodeRes as Response).json() : { features: [] };
        const geocodeStreetData = geocodeStreetRes ? await (geocodeStreetRes as Response).json() : { features: [] };

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

        // Pour requêtes type "Rue L29" : prioriser Geocode + Nominatim (rues réelles)
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

        // POI curatés — toutes les succursales, style Yango
        const curatedData = searchCuratedPoi(trimmed);
        const fromCurated: MapboxSuggestion[] = curatedData.map((p, i) => ({
          name: p.name,
          mapbox_id: `curated-${p.name.toLowerCase().replace(/\s/g, '-')}-${i}`,
          feature_type: p.category,
          full_address: p.full_address,
          place_formatted: p.place_formatted + (p.hours ? ` · ${p.hours}` : '') + (p.phone ? ` · ${p.phone}` : ''),
          coordinates: p.coordinates,
          source: 'searchbox' as const,
        }));

        // Ordre de merge : pour "Rue L29" → Geocode rues + Nominatim en premier
        const seen = new Set<string>();
        const merged: MapboxSuggestion[] = [];
        const sourcesToMerge = streetLike
          ? [...fromGeocodeStreet, ...fromGeocode, ...fromNominatim, ...fromCurated, ...fromSearchBox, ...fromOverpass]
          : [...fromCurated, ...fromSearchBox, ...fromOverpass, ...fromGeocode, ...fromGeocodeStreet, ...fromNominatim];
        for (const s of sourcesToMerge) {
          if (shouldExcludeSuggestion(s, trimmed)) continue;
          if (!suggestionMatchesQueryTokens(s, trimmed)) continue;
          const key = `${(s.name || '').toLowerCase()}|${(s.place_formatted || '').toLowerCase()}`;
          if (key && !seen.has(key) && s.name) {
            seen.add(key);
            merged.push(s);
          }
        }
        // Réordonner : Zoo d'Abidjan en premier, etc. (style Yango)
        merged.sort((a, b) => getRelevanceScore(b, trimmed) - getRelevanceScore(a, trimmed));
        if (gen !== suggestFetchGenRef.current) return;
        setSuggestions(merged.slice(0, 15));
      } catch (err) {
        logger.error('Mapbox suggest error', 'MapboxAddressAutocomplete', err);
        if (gen !== suggestFetchGenRef.current) return;
        setSuggestions([]);
      }
    },
    [accessToken, sessionToken, country, proximity]
  );

  const handleInputChange = useCallback(
    (text: string) => {
      lastAppliedSavedFingerprintRef.current = '';
      setSuppressSuggestionList(false);
      const next = singleLineAddressInput(text);
      setQuery(next);
      onQueryChange?.(text);

      const trimmed = next.trim();
      const minLen = isNumericQuery(trimmed) ? 1 : 2;

      /**
       * Mode embedded (formulaire « Envoyer un colis ») : une Modal affiche les suggestions.
       * Vider la liste à chaque frappe ouvrait/fermait la Modal en boucle → conflit clavier + bottom sheet (tremblements).
       * On garde l’ancienne liste jusqu’à la réponse réseau ; on vide seulement si la requête est trop courte.
       */
      if (trimmed.length < minLen) {
        suggestFetchGenRef.current += 1;
        setSuggestions([]);
      } else if (!embedded) {
        setSuggestions([]);
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (trimmed.length >= minLen) {
        debounceRef.current = setTimeout(() => fetchSuggestions(next), 300);
      }
    },
    [fetchSuggestions, onQueryChange, embedded]
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      lastAppliedSavedFingerprintRef.current = '';
      suggestFetchGenRef.current += 1;
      setSuppressSuggestionList(true);
      const raw = suggestion.full_address || suggestion.address || suggestion.name;
      const address = formatAutocompleteSelectedAddress(raw, query);
      setQuery(address);
      setSuggestions([]);

      // Coordonnées directes (geocode/nominatim/curated) : pas d'appel retrieve
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
    [accessToken, sessionToken, onPlaceSelected, query]
  );

  const showSuggestions =
    !suppressSuggestionList && suggestions.length > 0;

  const dismissSuggestionUi = useCallback(() => {
    suggestFetchGenRef.current += 1;
    setSuggestions([]);
    setSuppressSuggestionList(true);
  }, []);

  const getDistanceForSuggestion = useCallback(
    (s: MapboxSuggestion): string | null => {
      if (!refCoords) return null;
      const coords = s.coordinates;
      if (!coords?.lat || !coords?.lng) return null;
      const km = haversineKm(
        refCoords.latitude,
        refCoords.longitude,
        coords.lat,
        coords.lng
      );
      return formatDistance(km);
    },
    [refCoords]
  );

  const renderSuggestion = useCallback(
    (s: MapboxSuggestion, i: number) => {
      const title = formatSuggestionTitle(s);
      const subtext = formatSuggestionSecondaryLine(s);
      const showSubtext = subtext.length > 0 && !addressesVisuallyEqual(title, subtext);
      const distance = getDistanceForSuggestion(s);
      return (
        <TouchableOpacity
          key={`${s.mapbox_id}-${i}`}
          style={styles.suggestionItem}
          onPress={() => handleSelectSuggestion(s)}
          activeOpacity={0.7}
        >
          <View style={styles.suggestionIcon}>
            <Ionicons name="location" size={20} color="#8B5CF6" />
          </View>
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionText} numberOfLines={1}>{title}</Text>
            {showSubtext ? (
              <Text style={styles.suggestionSubtext} numberOfLines={1}>{subtext}</Text>
            ) : null}
          </View>
          {distance ? (
            <Text style={styles.suggestionDistance}>{distance}</Text>
          ) : null}
        </TouchableOpacity>
      );
    },
    [handleSelectSuggestion, getDistanceForSuggestion]
  );

  const handleTextInputBlur = useCallback(() => {
    const q = query;
    scheduleBlurResolveSaved(q);
    onBlur?.();
  }, [query, scheduleBlurResolveSaved, onBlur]);

  const handleTextInputSubmit = useCallback(() => {
    resolveSavedLabelIfExact(query);
  }, [query, resolveSavedLabelIfExact]);

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
            multiline={false}
            onFocus={() => {
              setSuppressSuggestionList(false);
              onFocus?.();
            }}
            onBlur={onBlur}
          />
          <Text style={styles.hint}>Mapbox non configuré</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, showSuggestions && styles.containerSuggestionsOpen]}>
      <View style={[styles.inputBox, embedded && styles.inputBoxEmbedded]}>
        <TextInput
          placeholder={placeholder}
          value={query}
          onChangeText={handleInputChange}
          style={styles.input}
          placeholderTextColor="#999"
          multiline={false}
          blurOnSubmit={false}
          onFocus={() => {
            setSuppressSuggestionList(false);
            onFocus?.();
          }}
          onBlur={handleTextInputBlur}
          onSubmitEditing={handleTextInputSubmit}
          returnKeyType="done"
        />
      </View>

      {showSuggestions &&
        (embedded ? (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={dismissSuggestionUi}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={dismissSuggestionUi}
            >
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {suggestions.map((s, i) => renderSuggestion(s, i))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <View style={styles.suggestionList} collapsable={false}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.suggestionScroll}
              contentContainerStyle={styles.suggestionScrollContent}
              removeClippedSubviews={false}
            >
              {suggestions.map((s, i) => renderSuggestion(s, i))}
            </ScrollView>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
    overflow: 'visible',
  },
  containerSuggestionsOpen: {
    zIndex: 10000,
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
  inputBoxEmbedded: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    minHeight: 48,
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
    overflow: 'hidden',
  },
  suggestionScroll: {
    maxHeight: 200,
  },
  suggestionScrollContent: {
    paddingTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  suggestionIcon: {
    marginRight: 12,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionContent: {
    flex: 1,
    minWidth: 0,
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
  suggestionDistance: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalScrollContent: {
    paddingVertical: 4,
  },
});
