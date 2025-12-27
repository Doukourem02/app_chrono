import { create } from 'zustand';
import { apiService } from '../services/apiService';
import { useDriverStore } from './useDriverStore';

export interface CommissionTransaction {
  id: string;
  type: 'recharge' | 'deduction' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  order_id?: string;
  payment_method?: 'mobile_money' | 'admin_manual' | 'orange_money' | 'wave';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface CommissionAccount {
  balance: number;
  minimum_balance: number; // 10 000 FCFA
  commission_rate: number; // 10% ou 20%
  is_suspended: boolean;
  last_updated: string;
}

interface CommissionStore {
  // État
  account: CommissionAccount | null;
  transactions: CommissionTransaction[];
  isLoading: boolean;
  error: string | null;
  
  // Alertes
  alerts: {
    lowBalance: boolean; // < 3000 FCFA
    veryLowBalance: boolean; // < 1000 FCFA
    suspended: boolean; // = 0 FCFA
  };

  // Actions
  fetchBalance: () => Promise<void>;
  fetchTransactions: (limit?: number) => Promise<void>;
  recharge: (amount: number, method: 'orange_money' | 'wave') => Promise<{ success: boolean; message?: string; transactionId?: string }>;
  checkAlerts: () => void;
  reset: () => void;
}

const INITIAL_ALERTS = {
  lowBalance: false,
  veryLowBalance: false,
  suspended: false,
};

export const useCommissionStore = create<CommissionStore>((set, get) => ({
  // État initial
  account: null,
  transactions: [],
  isLoading: false,
  error: null,
  alerts: INITIAL_ALERTS,

  // Récupérer le solde commission
  fetchBalance: async () => {
    const { user } = useDriverStore.getState();
    if (!user?.id) {
      set({ error: 'Utilisateur non connecté' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await apiService.getCommissionBalance(user.id);
      
      if (result.success && result.data) {
        set({ 
          account: result.data,
          isLoading: false 
        });
        
        // Vérifier les alertes après récupération du solde
        get().checkAlerts();
      } else {
        set({ 
          error: result.message || 'Erreur lors de la récupération du solde',
          isLoading: false 
        });
      }
    } catch (error: any) {
      console.error('Erreur fetchBalance:', error);
      set({ 
        error: error.message || 'Erreur de connexion',
        isLoading: false 
      });
    }
  },

  // Récupérer l'historique des transactions
  fetchTransactions: async (limit = 50) => {
    const { user } = useDriverStore.getState();
    if (!user?.id) {
      set({ error: 'Utilisateur non connecté' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await apiService.getCommissionTransactions(user.id, limit);
      
      if (result.success && result.data) {
        // Mapper les données pour correspondre au type CommissionTransaction
        const mappedTransactions: CommissionTransaction[] = result.data.map((tx: any) => ({
          ...tx,
          payment_method: tx.payment_method as CommissionTransaction['payment_method'] | undefined,
        }));
        
        set({ 
          transactions: mappedTransactions,
          isLoading: false 
        });
      } else {
        set({ 
          error: result.message || 'Erreur lors de la récupération des transactions',
          isLoading: false 
        });
      }
    } catch (error: any) {
      console.error('Erreur fetchTransactions:', error);
      set({ 
        error: error.message || 'Erreur de connexion',
        isLoading: false 
      });
    }
  },

  // Recharger le compte commission
  recharge: async (amount: number, method: 'orange_money' | 'wave') => {
    const { user } = useDriverStore.getState();
    if (!user?.id) {
      return { success: false, message: 'Utilisateur non connecté' };
    }

    if (amount < 10000) {
      return { success: false, message: 'Le montant minimum est de 10 000 FCFA' };
    }

    set({ isLoading: true, error: null });

    try {
      const result = await apiService.rechargeCommission(user.id, amount, method);
      
      if (result.success) {
        // Recharger le solde après recharge
        await get().fetchBalance();
        await get().fetchTransactions();
        
        set({ isLoading: false });
        return { 
          success: true, 
          message: result.message,
          transactionId: result.data?.transactionId 
        };
      } else {
        set({ 
          error: result.message || 'Erreur lors de la recharge',
          isLoading: false 
        });
        return { success: false, message: result.message || 'Erreur lors de la recharge' };
      }
    } catch (error: any) {
      console.error('Erreur recharge:', error);
      set({ 
        error: error.message || 'Erreur de connexion',
        isLoading: false 
      });
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  },

  // Vérifier et mettre à jour les alertes
  checkAlerts: () => {
    const { account } = get();
    
    if (!account) {
      set({ alerts: INITIAL_ALERTS });
      return;
    }

    const balance = account.balance;
    const alerts = {
      suspended: balance <= 0 || account.is_suspended,
      veryLowBalance: balance > 0 && balance <= 1000,
      lowBalance: balance > 1000 && balance <= 3000,
    };

    set({ alerts });
  },

  // Réinitialiser le store
  reset: () => {
    set({
      account: null,
      transactions: [],
      isLoading: false,
      error: null,
      alerts: INITIAL_ALERTS,
    });
  },
}));

