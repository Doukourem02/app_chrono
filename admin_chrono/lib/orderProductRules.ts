export type PublicTrackStep = {
  status: string;
  title: string;
  body: string;
};

export const PUBLIC_TRACK_FLOW_STEPS: PublicTrackStep[] = [
  { status: 'pending', title: 'Recherche livreur', body: 'Recherche d’un livreur pour cette livraison.' },
  { status: 'accepted', title: 'Prise en charge', body: 'Le livreur se dirige vers le point de collecte.' },
  { status: 'enroute', title: 'Prise en charge', body: 'Le livreur se dirige vers le point de collecte.' },
  { status: 'in_progress', title: 'Livreur arrivé', body: 'Le livreur est au point de collecte.' },
  { status: 'picked_up', title: 'Colis récupéré', body: 'Votre colis a été récupéré.' },
  { status: 'delivering', title: 'Livraison en cours', body: 'Le livreur se dirige vers la destination.' },
  { status: 'completed', title: 'Livraison terminée', body: 'Votre commande est livrée.' },
];

export function publicTrackStatusTitle(status: string): string {
  const step = PUBLIC_TRACK_FLOW_STEPS.find((item) => item.status === status);
  if (step) return step.title;
  if (status === 'cancelled') return 'Commande annulée';
  if (status === 'declined') return 'Commande refusée';
  return 'Suivi Krono';
}
