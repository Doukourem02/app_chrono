/**
 * Service API pour la gestion des paiements
 * Gère les méthodes de paiement, transactions, factures et litiges
 */

import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:4000' : 'https://votre-api.com');

export type PaymentMethodType = 'orange_money' | 'wave' | 'cash' | 'deferred';
export type PaymentStatus = 'pending' | 'paid' | 'refused' | 'delayed' | 'refunded' | 'cancelled';
export type DisputeType = 'refund_request' | 'payment_issue' | 'service_issue' | 'other';

export interface PaymentMethod {
  id: string;
  user_id: string;
  method_type: PaymentMethodType;
  provider_account?: string;
  provider_name?: string;
  is_default: boolean;
  is_active: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  order_id: string;
  user_id: string;
  payment_method_id?: string;
  payment_method_type: PaymentMethodType;
  amount: number;
  currency: string;
  fee: number;
  status: PaymentStatus;
  provider_transaction_id?: string;
  provider_response?: any;
  initiated_at: string;
  completed_at?: string;
  refunded_at?: string;
  failure_reason?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  transaction_id?: string;
  user_id: string;
  driver_id?: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  tax: number;
  fee: number;
  total: number;
  distance?: number;
  price_per_km?: number;
  urgency_fee: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface PriceCalculation {
  basePrice: number;
  urgencyFee: number;
  totalPrice: number;
  pricePerKm: number;
  breakdown: {
    distance: number;
    pricePerKm: number;
    urgencyFee: number;
    total: number;
  };
}

export interface DeferredPaymentInfo {
  annualLimit: number;
  annualUsed: number;
  annualRemaining: number;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  monthlyUsages: number;
  maxUsagesPerMonth: number;
  usagesRemaining: number;
  canUse: boolean;
  reason?: string;
  cooldownDaysRemaining?: number;
  nextAvailableDate?: string;
  latePaymentsCount: number;
  creditReduced: boolean;
  blocked: boolean;
  blockEndDate?: string;
}

class PaymentApiService {
  /**
   * Obtenir le token d'authentification
   */
  private getAuthHeaders(): HeadersInit {
    const { accessToken } = useAuthStore.getState();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    return headers;
  }

  /**
   * Calculer le prix d'une livraison
   */
  async calculatePrice(params: {
    distance: number;
    deliveryMethod: 'moto' | 'vehicule' | 'cargo';
    isUrgent?: boolean;
    customPricePerKm?: number;
  }): Promise<{
    success: boolean;
    data?: PriceCalculation;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors du calcul du prix',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('❌ Erreur calculatePrice:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Obtenir les méthodes de paiement de l'utilisateur
   */
  async getPaymentMethods(): Promise<{
    success: boolean;
    data?: PaymentMethod[];
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/methods`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la récupération des méthodes de paiement',
        };
      }

      return {
        success: true,
        data: data.data || [],
      };
    } catch (error) {
      console.error('❌ Erreur getPaymentMethods:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Créer une méthode de paiement
   */
  async createPaymentMethod(params: {
    methodType: PaymentMethodType;
    providerAccount?: string;
    providerName?: string;
    isDefault?: boolean;
    metadata?: any;
  }): Promise<{
    success: boolean;
    data?: PaymentMethod;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/methods`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la création de la méthode de paiement',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('❌ Erreur createPaymentMethod:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Initier un paiement
   */
  async initiatePayment(params: {
    orderId: string;
    paymentMethodId?: string;
    paymentMethodType: PaymentMethodType;
    phoneNumber?: string;
    // Paiement partiel
    isPartial?: boolean;
    partialAmount?: number;
    // Paiement par destinataire
    payerType?: 'client' | 'recipient';
    recipientUserId?: string;
    recipientPhone?: string;
  }): Promise<{
    success: boolean;
    data?: {
      transaction: Transaction;
      invoice: Invoice;
    };
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/initiate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de l\'initiation du paiement',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('❌ Erreur initiatePayment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Vérifier le statut d'un paiement
   */
  async checkPaymentStatus(transactionId: string): Promise<{
    success: boolean;
    data?: Transaction;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/transactions/${transactionId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la vérification du statut',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('❌ Erreur checkPaymentStatus:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Obtenir les transactions de l'utilisateur
   */
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
  }): Promise<{
    success: boolean;
    data?: Transaction[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    message?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);

      const url = `${API_BASE_URL}/api/payments/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la récupération des transactions',
        };
      }

      return {
        success: true,
        data: data.data || [],
        pagination: data.pagination,
      };
    } catch (error) {
      console.error('❌ Erreur getTransactions:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Créer un litige de paiement
   */
  async createDispute(params: {
    transactionId: string;
    disputeType: DisputeType;
    reason: string;
    description?: string;
    attachments?: any;
  }): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/disputes`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la création du litige',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('❌ Erreur createDispute:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Récupérer les limites et informations de paiement différé
   */
  async getDeferredPaymentLimits(): Promise<{
    success: boolean;
    data?: DeferredPaymentInfo;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/deferred/limits`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la récupération des limites',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('❌ Erreur getDeferredPaymentLimits:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }

  /**
   * Récupérer toutes les dettes différées de l'utilisateur
   */
  async getDeferredDebts(): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      orderId: string;
      amount: number;
      status: string;
      createdAt: string;
      updatedAt: string;
      orderStatus: string;
      pickupAddress?: string;
      dropoffAddress?: string;
      deadline: string;
      isOverdue: boolean;
      daysUntilDeadline: number;
    }>;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/deferred/debts`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Erreur lors de la récupération des dettes',
        };
      }

      return {
        success: true,
        data: data.data || [],
      };
    } catch (error) {
      console.error('❌ Erreur getDeferredDebts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      };
    }
  }
}

export const paymentApi = new PaymentApiService();
export default paymentApi;

