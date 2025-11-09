/**
 * Store Zustand pour la gestion des paiements
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { paymentApi, PaymentMethod, Transaction, PaymentMethodType, PaymentStatus } from '../services/paymentApi';

interface PaymentStore {
  // État
  paymentMethods: PaymentMethod[];
  selectedPaymentMethod: PaymentMethod | null;
  currentTransaction: Transaction | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPaymentMethods: () => Promise<void>;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  selectPaymentMethod: (method: PaymentMethod | null) => void;
  setCurrentTransaction: (transaction: Transaction | null) => void;
  loadTransactions: (params?: { page?: number; limit?: number; status?: PaymentStatus }) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const usePaymentStore = create<PaymentStore>()(
  persist(
    (set, get) => ({
      // État initial
      paymentMethods: [],
      selectedPaymentMethod: null,
      currentTransaction: null,
      transactions: [],
      isLoading: false,
      error: null,

      // Charger les méthodes de paiement
      loadPaymentMethods: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await paymentApi.getPaymentMethods();
          if (result.success && result.data) {
            set({ paymentMethods: result.data });
            // Sélectionner la méthode par défaut si disponible
            const defaultMethod = result.data.find((m) => m.is_default);
            if (defaultMethod) {
              set({ selectedPaymentMethod: defaultMethod });
            }
          } else {
            set({ error: result.message || 'Erreur lors du chargement des méthodes de paiement' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Erreur inconnue' });
        } finally {
          set({ isLoading: false });
        }
      },

      // Ajouter une méthode de paiement
      addPaymentMethod: async (methodData) => {
        set({ isLoading: true, error: null });
        try {
          const result = await paymentApi.createPaymentMethod({
            methodType: methodData.method_type,
            providerAccount: methodData.provider_account,
            providerName: methodData.provider_name,
            isDefault: methodData.is_default,
            metadata: methodData.metadata,
          });

          if (result.success && result.data) {
            const newMethods = [...get().paymentMethods, result.data];
            set({ paymentMethods: newMethods });
            if (result.data.is_default) {
              set({ selectedPaymentMethod: result.data });
            }
            return true;
          } else {
            set({ error: result.message || 'Erreur lors de l\'ajout de la méthode de paiement' });
            return false;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Erreur inconnue' });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      // Sélectionner une méthode de paiement
      selectPaymentMethod: (method) => {
        set({ selectedPaymentMethod: method });
      },

      // Définir la transaction courante
      setCurrentTransaction: (transaction) => {
        set({ currentTransaction: transaction });
      },

      // Charger les transactions
      loadTransactions: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const result = await paymentApi.getTransactions(params);
          if (result.success && result.data) {
            set({ transactions: result.data });
          } else {
            set({ error: result.message || 'Erreur lors du chargement des transactions' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Erreur inconnue' });
        } finally {
          set({ isLoading: false });
        }
      },

      // Effacer l'erreur
      clearError: () => {
        set({ error: null });
      },

      // Réinitialiser le store
      reset: () => {
        set({
          paymentMethods: [],
          selectedPaymentMethod: null,
          currentTransaction: null,
          transactions: [],
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'payment-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        paymentMethods: state.paymentMethods,
        selectedPaymentMethod: state.selectedPaymentMethod,
      }),
    }
  )
);

