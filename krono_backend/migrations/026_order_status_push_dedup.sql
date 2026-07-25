-- Évite les doublons de notifications (push / web / SMS) pour la même commande + même statut.
-- Cas typique : scan QR → notify, puis le socket livreur envoie encore "completed" (mémoire pas à jour).

CREATE TABLE IF NOT EXISTS order_status_push_sent (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, status)
);

CREATE INDEX IF NOT EXISTS idx_order_status_push_sent_sent_at
  ON order_status_push_sent (sent_at DESC);
