import pool from '../config/db.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

const db = () => supabaseAdmin ?? supabase;

// Génération des factures mensuelles B2B
// À appeler le 1er de chaque mois (ou quotidiennement avec la garde ci-dessous)
export async function runPartnerInvoiceJob(): Promise<void> {
  logger.info('[partner-invoice-job] Lancement');

  // Calculer la période précédente (mois dernier)
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // dernier jour du mois précédent
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  try {
    // Partenaires avec abonnement actif sur la période
    const { data: subs, error: subErr } = await db()
      .from('partner_subscriptions')
      .select('id, partner_id, plan, monthly_price, included_orders, excess_commission_rate')
      .eq('is_active', true)
      .eq('payment_status', 'active');

    if (subErr) {
      logger.error('[partner-invoice-job] Erreur récupération abonnements:', subErr);
      return;
    }
    if (!subs?.length) {
      logger.info('[partner-invoice-job] Aucun abonnement actif');
      return;
    }

    for (const sub of subs) {
      try {
        await generateInvoiceForPartner(
          sub.partner_id as string,
          sub as any,
          periodStartStr,
          periodEndStr
        );
      } catch (err) {
        logger.error(`[partner-invoice-job] Erreur partenaire ${sub.partner_id}:`, err);
      }
    }

    logger.info(`[partner-invoice-job] Terminé — ${subs.length} partenaires traités`);
  } catch (err) {
    logger.error('[partner-invoice-job] Erreur globale:', err);
  }
}

async function generateInvoiceForPartner(
  partnerId: string,
  sub: {
    plan: string;
    monthly_price: number;
    included_orders: number | null;
    excess_commission_rate: number;
  },
  periodStartStr: string,
  periodEndStr: string
): Promise<void> {
  // Vérifier qu'une facture n'existe pas déjà pour cette période (évite les doublons)
  const { data: existing } = await db()
    .from('partner_invoices')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('period_start', periodStartStr)
    .maybeSingle();

  if (existing) {
    logger.info(`[partner-invoice-job] Facture déjà existante pour ${partnerId} / ${periodStartStr}`);
    return;
  }

  // Usage du mois écoulé
  const { data: usage } = await db()
    .from('partner_usage')
    .select('deliveries_count')
    .eq('partner_id', partnerId)
    .eq('month', periodStartStr)
    .maybeSingle();

  const deliveries = usage?.deliveries_count ?? 0;
  const included = sub.included_orders;

  // Calcul dépassement
  // Ce qui est facturé ici = forfait mensuel + commission sur courses excédentaires
  // Les commissions dans le quota (Axe 1 / taux in_quota) sont prélevées à la course
  // → on ne les reprend PAS ici pour éviter le double comptage
  const excessCount = included !== null ? Math.max(0, deliveries - included) : 0;
  const excessAmount = Math.round(excessCount * sub.excess_commission_rate * 1000); // approximatif sans prix/course

  // Note: le montant exact des commissions en excès devrait idéalement venir de la table transactions.
  // En Phase 1, on facture le forfait + une estimation de dépassement.
  // En Phase 2, on rapprochera avec les transactions réelles.
  const totalAmount = sub.monthly_price + excessAmount;

  const { error } = await db().from('partner_invoices').insert({
    partner_id: partnerId,
    amount: totalAmount,
    status: 'pending',
    period_start: periodStartStr,
    period_end: periodEndStr,
  });

  if (error) {
    logger.error(`[partner-invoice-job] Erreur insertion facture ${partnerId}:`, error);
    return;
  }

  logger.info(
    `[partner-invoice-job] Facture créée — partenaire: ${partnerId}, montant: ${totalAmount} FCFA (forfait: ${sub.monthly_price} + excédent: ${excessAmount})`
  );
}
