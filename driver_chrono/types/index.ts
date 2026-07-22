/** Statuts de commande alignés sur l'enum Postgres `order_status` (backend chrono_delivery).
 * `draft` et `searching_driver` existent dans l'enum DB mais ne sont jamais produits par le
 * flux applicatif actuel (vérifié 2026-07-22) — volontairement omis ici. */
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'enroute'
  | 'picked_up'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export interface OrderRequest {
  id: string;
  user: {
    id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar?: string;
    rating: number;
    phone?: string;
  };
  pickup: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    /** Saisie admin : zone commune pour matching sans GPS précis */
    approximate_pickup_zone?: string;
    approximate_pickup_zone_label?: string;
    pickup_coordinates_are_approximate?: boolean;
    details?: {
      entrance?: string;
      apartment?: string;
      floor?: string;
      intercom?: string;
      photos?: string[];
    };
  };
  dropoff: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    details?: {
      phone?: string;
      entrance?: string;
      apartment?: string;
      floor?: string;
      intercom?: string;
      photos?: string[];
      /** Options client (ex. livraison programmée) — même schéma que la commande en base */
      thermal_bag?: boolean;
      courier_note?: string;
      /** Saisie admin — notes pour le livreur (persistées dans le JSON dropoff). */
      driver_notes?: string;
      /** Saisie admin — champ « Notes (optionnel) » sur la course. */
      operator_course_notes?: string;
      /** Créneau livraison programmée (texte libre client). */
      scheduled_window_note?: string;
      recipient_message?: string;
    };
  };
  recipient?: {
    phone?: string;
    contactId?: string;
  };
  packageImages?: string[];
  price: number;
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  distance: number;
  estimatedDuration: string;
  status: OrderStatus;
  driverId?: string;
  /** Cible de l’offre en cours (socket) avant acceptation — resync / popup */
  offeredDriverId?: string;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  notes?: string;
  /** Option tarifaire client (express | standard | scheduled | …). */
  speedOptionId?: string;
  /** Notes générales saisies par l’opérateur (formulaire « Notes (optionnel) ») — affichées au livreur. */
  operatorCourseNotes?: string;
  /** Case admin « téléphone / hors-ligne » (coords souvent approximatives) — pas toutes les commandes admin */
  isPhoneOrder?: boolean;
  /** Toute commande créée via l’admin — badge informatif ; navigation = identique au client si GPS OK */
  placedByAdmin?: boolean;
  isB2BOrder?: boolean;
  partner_id?: string;
  partner_name?: string;
  batch_id?: string;
  batch_position?: number;
  batch_total?: number;
  driverNotes?: string;
  payment_method_type?: 'orange_money' | 'wave' | 'cash' | 'deferred';
}
