/**
 * Surge basé sur tension locale : commandes en attente vs livreurs connectés (socket).
 * Enregistrer le getter depuis setupOrderSocket.
 */

type Snapshot = { pendingOrders: number; onlineDrivers: number };

let snapshotGetter: () => Snapshot = () => ({ pendingOrders: 0, onlineDrivers: 4 });

export function setSurgeSnapshotGetter(fn: () => Snapshot): void {
  snapshotGetter = fn;
}

/** Multiplicateur ≥ 1, plafonné (niveau C — doc krono-reference-unique). */
export function getSurgeMultiplierSync(): number {
  const { pendingOrders, onlineDrivers } = snapshotGetter();
  const drivers = Math.max(1, onlineDrivers);
  const ratio = pendingOrders / drivers;
  const bump = Math.min(0.55, ratio * 0.14);
  return Math.min(1.55, 1 + bump);
}
