/**
 * Numéros de téléphone récemment utilisés pour les livraisons.
 * Permet au client de sélectionner rapidement un numéro complice sans chercher dans le répertoire.
 */
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPhoneValidationError } from '../utils/phoneValidation';

const STORAGE_KEY = '@chrono_recent_phone_numbers';
const MAX_RECENT = 8;

function normalizeForStorage(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 12 && digits.startsWith('225')) return `0${digits.slice(3)}`;
  if (digits.length === 9 && /^[157]\d{8}$/.test(digits)) return `0${digits}`;
  return phone;
}

export function useRecentPhoneNumbers() {
  const [recentPhones, setRecentPhones] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          setRecentPhones(parsed.slice(0, MAX_RECENT));
        }
      }
    } catch {
      setRecentPhones([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addPhone = useCallback(
    async (phone: string) => {
      const trimmed = phone.trim();
      if (!trimmed) return;
      const err = getPhoneValidationError(trimmed);
      if (err) return;

      const normalized = normalizeForStorage(trimmed);
      setRecentPhones((prev) => {
        const filtered = prev.filter((p) => normalizeForStorage(p) !== normalized);
        const next = [normalized, ...filtered].slice(0, MAX_RECENT);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const formatForDisplay = (phone: string): string => {
    const normalized = normalizeForStorage(phone);
    if (normalized.length === 10 && normalized.startsWith('0')) {
      return `${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 6)} ${normalized.slice(6, 8)} ${normalized.slice(8)}`;
    }
    return phone;
  };

  return { recentPhones, addPhone, formatForDisplay };
}
