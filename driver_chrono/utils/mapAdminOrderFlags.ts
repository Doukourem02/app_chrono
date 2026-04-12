import type { OrderRequest } from '../store/useOrderStore';

/**
 * Lit les métadonnées persistées dans pickup/dropoff (_chrono_admin) et normalise les flags livreur.
 * Toute commande créée via POST /api/admin/orders a placed_by_admin — le livreur doit la distinguer.
 */
export function mapAdminOrderFlags(order: Record<string, unknown> | null | undefined): Pick<
  OrderRequest,
  'isPhoneOrder' | 'isB2BOrder' | 'placedByAdmin'
> {
  if (!order || typeof order !== 'object') {
    return { isPhoneOrder: false, isB2BOrder: false, placedByAdmin: false };
  }

  const pickup = order.pickup as Record<string, unknown> | undefined;
  const dropoff = order.dropoff as Record<string, unknown> | undefined;
  const chrono = (pickup?._chrono_admin ?? dropoff?._chrono_admin) as
    | { placed_by_admin?: boolean; is_phone_order?: boolean; is_b2b_order?: boolean }
    | undefined;

  const placedByAdmin = chrono?.placed_by_admin === true;
  const isPhoneStrict =
    chrono?.is_phone_order === true || (order as { is_phone_order?: boolean }).is_phone_order === true;
  const isB2B =
    chrono?.is_b2b_order === true ||
    (order as { is_b2b_order?: boolean }).is_b2b_order === true ||
    (order as { isB2BOrder?: boolean }).isB2BOrder === true;

  return {
    placedByAdmin,
    isB2BOrder: !!isB2B,
    /**
     * Uniquement si la case « commande téléphonique / hors-ligne » a été cochée côté admin
     * (coords optionnelles, flux appel client). Ne pas confondre avec placedByAdmin : sinon
     * toute commande admin ressemblerait à un parcours « téléphone » et pas au tracking normal.
     */
    isPhoneOrder: !!isPhoneStrict,
  };
}
