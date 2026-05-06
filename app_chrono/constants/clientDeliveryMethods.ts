import type { ImageSourcePropType } from 'react-native';

export type ClientDeliveryMethodId = 'moto' | 'vehicule' | 'cargo';
export type ClientDeliveryOptionId =
  | 'express'
  | 'standard'
  | 'scheduled'
  | 'pickup_service'
  | 'full_service';

export type ClientDeliveryOption = {
  id: ClientDeliveryOptionId;
  name: string;
  icon: string;
  price: number;
  description: string;
  time: string;
};

export type ClientDeliveryMethod = {
  id: ClientDeliveryMethodId;
  shortName: string;
  name: string;
  icon: ImageSourcePropType;
  largeImage: ImageSourcePropType;
  price: number;
  avgTime: string;
  badge?: string;
  popular?: boolean;
  enabledForClient: boolean;
  unavailableMessage?: string;
  options: ClientDeliveryOption[];
};

const CLIENT_UNAVAILABLE_MESSAGE =
  'Pour l’instant, Krono propose uniquement la livraison à moto dans l’app client.';

export const CLIENT_DELIVERY_METHODS: ClientDeliveryMethod[] = [
  {
    id: 'moto',
    shortName: 'Moto',
    name: 'Livraison à moto',
    icon: require('../assets/images/motoo.png'),
    largeImage: require('../assets/images/motoo.png'),
    price: 400,
    popular: true,
    avgTime: '15-20 min',
    badge: 'Populaire',
    enabledForClient: true,
    options: [
      {
        id: 'express',
        name: 'Express',
        icon: 'rocket',
        price: 400,
        description: 'Livraison rapide en ville',
        time: '15-20 min',
      },
      {
        id: 'standard',
        name: 'Standard',
        icon: 'bicycle',
        price: 350,
        description: 'Livraison optimisée au meilleur tarif',
        time: '25-30 min',
      },
      {
        id: 'scheduled',
        name: 'Programmée',
        icon: 'calendar',
        price: 380,
        description: 'Planifiez votre livraison à l’avance',
        time: 'Selon planning',
      },
    ],
  },
  {
    id: 'cargo',
    shortName: 'Cargo',
    name: 'Livraison cargo',
    icon: require('../assets/images/ccargo.png'),
    largeImage: require('../assets/images/ccargo.png'),
    price: 3400,
    avgTime: '30-45 min',
    badge: 'Grand volume',
    enabledForClient: false,
    unavailableMessage: CLIENT_UNAVAILABLE_MESSAGE,
    options: [],
  },
  {
    id: 'vehicule',
    shortName: 'Voiture',
    name: 'Livraison en voiture',
    icon: require('../assets/images/carrss.png'),
    largeImage: require('../assets/images/carrss.png'),
    price: 700,
    avgTime: '20-25 min',
    badge: 'Confort',
    enabledForClient: false,
    unavailableMessage: CLIENT_UNAVAILABLE_MESSAGE,
    options: [
      {
        id: 'pickup_service',
        name: 'Service de récupération',
        icon: 'location',
        price: 700,
        description: 'Récupération de votre colis à l’adresse indiquée',
        time: '15-20 min',
      },
      {
        id: 'full_service',
        name: 'Service complet',
        icon: 'cube',
        price: 1000,
        description: 'Récupération et livraison complètes avec suivi en temps réel',
        time: '20-25 min',
      },
    ],
  },
];

export const CLIENT_ENABLED_DELIVERY_METHODS = CLIENT_DELIVERY_METHODS.filter(
  (method) => method.enabledForClient
);

export function isDeliveryMethodEnabledForClient(id: string): boolean {
  return CLIENT_DELIVERY_METHODS.some(
    (method) => method.id === id && method.enabledForClient
  );
}

export function getClientDeliveryMethod(id: string | null | undefined): ClientDeliveryMethod {
  return (
    CLIENT_DELIVERY_METHODS.find((method) => method.id === id) ??
    CLIENT_DELIVERY_METHODS[0]
  );
}

export function getEffectiveClientDeliveryMethod(
  id: string | null | undefined
): ClientDeliveryMethod {
  const method = getClientDeliveryMethod(id);
  return method.enabledForClient ? method : CLIENT_DELIVERY_METHODS[0];
}

export function getClientDeliveryOptions(
  id: string | null | undefined
): ClientDeliveryOption[] {
  return getEffectiveClientDeliveryMethod(id).options;
}
