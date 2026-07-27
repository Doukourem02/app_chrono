import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

// Fusion de deux fiches partenaire — règles validées docs/taches.md (2026-07-27).
// La fiche perdante est toujours archivée (status = 'merged' + merged_into_partner_id),
// jamais supprimée : commandes, factures, tournées et accès équipe sont réattribués
// à la fiche survivante en une seule transaction.

const PLAN_RANK: Record<string, number> = { none: 0, starter: 1, pro: 2, business: 3 };

export const mergePartners = async (req: Request, res: Response): Promise<void> => {
  const survivorId = req.params.id;
  const { mergeFromPartnerId } = req.body as { mergeFromPartnerId?: string };
  const adminId = (req as any).user?.id;

  if (!mergeFromPartnerId) {
    res.status(400).json({ success: false, message: 'mergeFromPartnerId est requis' });
    return;
  }
  if (mergeFromPartnerId === survivorId) {
    res.status(400).json({ success: false, message: 'Impossible de fusionner une fiche avec elle-même' });
    return;
  }

  const client = await pool.connect();
  const warnings: string[] = [];

  try {
    await client.query('BEGIN');

    const partnersRes = await client.query(
      `SELECT id, name, email, status FROM partners WHERE id IN ($1, $2) FOR UPDATE`,
      [survivorId, mergeFromPartnerId]
    );
    const survivor = partnersRes.rows.find((r) => r.id === survivorId);
    const loser = partnersRes.rows.find((r) => r.id === mergeFromPartnerId);

    if (!survivor || !loser) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Une des deux fiches partenaire est introuvable' });
      return;
    }
    if (survivor.status === 'merged' || loser.status === 'merged') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Une des deux fiches est déjà fusionnée' });
      return;
    }

    // 1. Abonnement en double : garder celui qui avantage le plus le partenaire
    // (palier le plus élevé, sinon le plus de temps restant), pas le plus ancien.
    const activeSubsRes = await client.query(
      `SELECT id, partner_id, plan, ends_at FROM partner_subscriptions
       WHERE partner_id IN ($1, $2) AND is_active = true`,
      [survivorId, mergeFromPartnerId]
    );
    const survivorActiveSub = activeSubsRes.rows.find((r) => r.partner_id === survivorId);
    const loserActiveSub = activeSubsRes.rows.find((r) => r.partner_id === mergeFromPartnerId);

    if (survivorActiveSub && loserActiveSub) {
      const survivorRank = PLAN_RANK[survivorActiveSub.plan] ?? 0;
      const loserRank = PLAN_RANK[loserActiveSub.plan] ?? 0;
      let keepLoserSub = loserRank > survivorRank;
      if (loserRank === survivorRank) {
        const survivorEnds = survivorActiveSub.ends_at ? new Date(survivorActiveSub.ends_at).getTime() : Infinity;
        const loserEnds = loserActiveSub.ends_at ? new Date(loserActiveSub.ends_at).getTime() : Infinity;
        keepLoserSub = loserEnds > survivorEnds;
      }
      if (keepLoserSub) {
        await client.query('UPDATE partner_subscriptions SET is_active = false WHERE id = $1', [survivorActiveSub.id]);
        warnings.push(`Abonnement conservé : ${loserActiveSub.plan} (celui de la fiche fusionnée, plus avantageux)`);
      } else {
        await client.query('UPDATE partner_subscriptions SET is_active = false WHERE id = $1', [loserActiveSub.id]);
        warnings.push(`Abonnement conservé : ${survivorActiveSub.plan} (celui de la fiche survivante, plus avantageux)`);
      }
    }
    // Réattribuer tous les abonnements (actifs ou non) pour préserver l'historique.
    await client.query('UPDATE partner_subscriptions SET partner_id = $1 WHERE partner_id = $2', [survivorId, mergeFromPartnerId]);

    // 2. Quota mensuel : fusionner (sommer) les mois en commun pour éviter le conflit
    // UNIQUE(partner_id, month), sinon simple réattribution.
    const usageRes = await client.query(
      `SELECT id, month, deliveries_count FROM partner_usage WHERE partner_id = $1`,
      [mergeFromPartnerId]
    );
    for (const row of usageRes.rows) {
      const existing = await client.query(
        `SELECT id, deliveries_count FROM partner_usage WHERE partner_id = $1 AND month = $2`,
        [survivorId, row.month]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        await client.query(
          `UPDATE partner_usage SET deliveries_count = deliveries_count + $1 WHERE id = $2`,
          [row.deliveries_count, existing.rows[0].id]
        );
        await client.query(`DELETE FROM partner_usage WHERE id = $1`, [row.id]);
      } else {
        await client.query(`UPDATE partner_usage SET partner_id = $1 WHERE id = $2`, [survivorId, row.id]);
      }
    }

    // 3. Historique commandes/factures/tournées : toujours réattribué, jamais supprimé.
    await client.query('UPDATE partner_invoices SET partner_id = $1 WHERE partner_id = $2', [survivorId, mergeFromPartnerId]);
    await client.query('UPDATE orders SET partner_id = $1 WHERE partner_id = $2', [survivorId, mergeFromPartnerId]);
    await client.query('UPDATE delivery_batches SET partner_id = $1 WHERE partner_id = $2', [survivorId, mergeFromPartnerId]);
    await client.query('UPDATE partner_driver_requests SET partner_id = $1 WHERE partner_id = $2', [survivorId, mergeFromPartnerId]);

    // 4. Livreurs dédiés : éviter le doublon (partner_id, driver_user_id) et le double
    // livreur par défaut (un seul is_default = true par partenaire).
    const driversRes = await client.query(
      `SELECT id, driver_user_id, is_default FROM partner_drivers WHERE partner_id = $1`,
      [mergeFromPartnerId]
    );
    const survivorHasDefaultDriver = (
      await client.query(`SELECT id FROM partner_drivers WHERE partner_id = $1 AND is_default = true LIMIT 1`, [survivorId])
    ).rowCount! > 0;
    for (const row of driversRes.rows) {
      const dup = await client.query(
        `SELECT id FROM partner_drivers WHERE partner_id = $1 AND driver_user_id = $2`,
        [survivorId, row.driver_user_id]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        await client.query(`DELETE FROM partner_drivers WHERE id = $1`, [row.id]);
      } else {
        const keepDefault = row.is_default && !survivorHasDefaultDriver;
        await client.query(
          `UPDATE partner_drivers SET partner_id = $1, is_default = $2 WHERE id = $3`,
          [survivorId, keepDefault, row.id]
        );
      }
    }

    // 5. Accès équipe (partner_users) : transfert automatique, pas de réinvitation.
    // Rôle toujours 'owner' (migration 044) — pas de conflit de rôle possible.
    const partnerUsersRes = await client.query(
      `SELECT id, user_id FROM partner_users WHERE partner_id = $1`,
      [mergeFromPartnerId]
    );
    for (const row of partnerUsersRes.rows) {
      const dup = await client.query(
        `SELECT id FROM partner_users WHERE partner_id = $1 AND user_id = $2`,
        [survivorId, row.user_id]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        await client.query(`DELETE FROM partner_users WHERE id = $1`, [row.id]);
      } else {
        await client.query(`UPDATE partner_users SET partner_id = $1 WHERE id = $2`, [survivorId, row.id]);
      }
    }

    // 6. Archiver la fiche perdante (jamais supprimée). L'e-mail est vidé pour
    // libérer l'index unique partners_email_unique_idx (l'identité canonique
    // devient la fiche survivante).
    await client.query(
      `UPDATE partners SET status = 'merged', merged_into_partner_id = $1, email = NULL, updated_at = now() WHERE id = $2`,
      [survivorId, mergeFromPartnerId]
    );

    // 7. Log d'audit (append-only, ne bloque pas la fusion si l'insert échoue).
    // SAVEPOINT nécessaire : une erreur SQL non rattrapée par un savepoint invalide
    // toute la transaction en cours (le COMMIT suivant échouerait sinon).
    try {
      await client.query('SAVEPOINT before_audit_log');
      await client.query(
        `INSERT INTO partner_audit_logs (partner_id, admin_id, action, old_status, new_status, reason)
         VALUES ($1, $2, 'merge', $3, 'merged', $4)`,
        [mergeFromPartnerId, adminId ?? null, loser.status, `Fusionnée dans le partenaire ${survivorId} (${survivor.name})`]
      );
      await client.query('RELEASE SAVEPOINT before_audit_log');
    } catch (auditError) {
      await client.query('ROLLBACK TO SAVEPOINT before_audit_log').catch(() => {});
      logger.warn('[partnerMergeController] log audit fusion échoué:', auditError);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: { survivor_id: survivorId, merged_partner_id: mergeFromPartnerId },
      warnings,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('[partnerMergeController] mergePartners error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la fusion des fiches partenaire' });
  } finally {
    client.release();
  }
};
