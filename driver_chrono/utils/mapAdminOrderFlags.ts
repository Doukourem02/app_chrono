import type { OrderRequest } from '../store/useOrderStore';

/**
 * Lit les métadonnées persistées dans pickup/dropoff (_chrono_admin) et normalise les flags livreur.
 * Toute commande créée via POST /api/admin/orders a placed_by_admin — le livreur doit la distinguer.
 */
export function mapAdminOrderFlags(order: Record<string, unknown> | null | undefined): Pick<
  OrderRequest,
  'isPhoneOrder' | 'isB2BOrder' | 'placedByAdmin' | 'partner_id' | 'partner_name' | 'batch_id' | 'batch_position' | 'batch_total'
> {
  if (!order || typeof order !== 'object') {
    return { isPhoneOrder: false, isB2BOrder: false, placedByAdmin: false };
  }

  const pickup = order.pickup as Record<string, unknown> | undefined;
  const dropoff = order.dropoff as Record<string, unknown> | undefined;
  const chrono = (pickup?._chrono_admin ?? dropoff?._chrono_admin) as
    | { placed_by_admin?: boolean; is_phone_order?: boolean; is_b2b_order?: boolean; partner_id?: string }
    | undefined;

  const placedByAdmin = chrono?.placed_by_admin === true;
  const isPhoneStrict =
    chrono?.is_phone_order === true || (order as { is_phone_order?: boolean }).is_phone_order === true;

  const o = order as Record<string, unknown>;
  const partner_id =
    (typeof o.partner_id === 'string' ? o.partner_id : undefined) ??
    (typeof chrono?.partner_id === 'string' ? chrono.partner_id : undefined);

  // §3.5 : partner_id présent → commande rattachée à un partenaire = B2B, même sans flag is_b2b_order explicite
  const isB2B =
    chrono?.is_b2b_order === true ||
    (order as { is_b2b_order?: boolean }).is_b2b_order === true ||
    (order as { isB2BOrder?: boolean }).isB2BOrder === true ||
    partner_id !== undefined;
  const partner_name = typeof o.partner_name === 'string' ? o.partner_name : undefined;
  const batch_id = typeof o.batch_id === 'string' ? o.batch_id : undefined;
  const batch_position = typeof o.batch_position === 'number' ? o.batch_position : undefined;
  const batch_total = typeof o.batch_total === 'number' ? o.batch_total : undefined;

  return {
    placedByAdmin,
    isB2BOrder: !!isB2B,
    /**
     * Uniquement si la case « commande téléphonique / hors-ligne » a été cochée côté admin
     * (coords optionnelles, flux appel client). Ne pas confondre avec placedByAdmin : sinon
     * toute commande admin ressemblerait à un parcours « téléphone » et pas au tracking normal.
     */
    isPhoneOrder: !!isPhoneStrict,
    ...(partner_id !== undefined ? { partner_id } : {}),
    ...(partner_name !== undefined ? { partner_name } : {}),
    ...(batch_id !== undefined ? { batch_id } : {}),
    ...(batch_position !== undefined ? { batch_position } : {}),
    ...(batch_total !== undefined ? { batch_total } : {}),
  };
}
