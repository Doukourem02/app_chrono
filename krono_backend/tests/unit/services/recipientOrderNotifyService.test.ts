/**
 * Tests unitaires pour recipientOrderNotifyService — anti-doublon des notifications de
 * statut de commande (voir docs/krono-reference-unique.md section 6 : "ne pas répéter une
 * notification de statut déjà envoyée pour la même commande"). L'INSERT ... ON CONFLICT
 * DO NOTHING sur order_status_push_sent (migration 026) est la seule barrière anti-doublon
 * quand deux chemins métier appellent notify pour le même (order_id, status).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockLookupClientUserIdByPhone = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/utils/resolveRecipientUserIdByPhone.js', () => ({
  __esModule: true,
  lookupClientUserIdByPhone: mockLookupClientUserIdByPhone,
}));

const mockNotifyOrderStatusPushes = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/services/expoPushService.js', () => ({
  __esModule: true,
  notifyOrderStatusPushes: mockNotifyOrderStatusPushes,
}));

const mockNotifyLiveActivitiesForOrderStatus = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/services/liveActivityApnsService.js', () => ({
  __esModule: true,
  notifyLiveActivitiesForOrderStatus: mockNotifyLiveActivitiesForOrderStatus,
}));

const mockIsTwilioSmsConfigured = jest.fn<(...args: any[]) => boolean>();
const mockSendTransactionalSMSTwilio = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/services/twilioSmsService.js', () => ({
  __esModule: true,
  isTwilioSmsConfigured: mockIsTwilioSmsConfigured,
  sendTransactionalSMSTwilio: mockSendTransactionalSMSTwilio,
}));

const mockIsTrackWebPushConfigured = jest.fn<(...args: any[]) => boolean>();
const mockSendTrackWebPushForSubscriptions = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/services/trackWebPushService.js', () => ({
  __esModule: true,
  isTrackWebPushConfigured: mockIsTrackWebPushConfigured,
  sendTrackWebPushForSubscriptions: mockSendTrackWebPushForSubscriptions,
}));

const { notifyAllForOrderStatus } = await import(
  '../../../src/services/recipientOrderNotifyService.js'
);

describe('recipientOrderNotifyService.notifyAllForOrderStatus — anti-doublon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockIsTwilioSmsConfigured.mockReturnValue(false);
    mockIsTrackWebPushConfigured.mockReturnValue(false);
    mockLookupClientUserIdByPhone.mockResolvedValue(null);
    mockNotifyLiveActivitiesForOrderStatus.mockResolvedValue(undefined);
    mockNotifyOrderStatusPushes.mockResolvedValue(undefined);
  });

  it('notifie normalement la première fois qu’un (order_id, status) est vu', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ order_id: 'order-1' }] } as any) // claim réussi
      .mockResolvedValueOnce({
        rows: [{ tracking_token: null, recipient_user_id: null, recipient: null, dropoff_address: null }],
      } as any); // loadOrderNotifyRow

    await notifyAllForOrderStatus({ orderId: 'order-1', status: 'accepted', payerUserId: 'user-1' });

    expect(mockNotifyLiveActivitiesForOrderStatus).toHaveBeenCalledTimes(1);
    expect(mockNotifyOrderStatusPushes).toHaveBeenCalledTimes(1);
  });

  it("n'envoie plus rien pour le même (order_id, status) une fois déjà notifié (ON CONFLICT DO NOTHING)", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] } as any); // conflit : déjà claim précédemment

    await notifyAllForOrderStatus({ orderId: 'order-1', status: 'accepted', payerUserId: 'user-1' });

    // Une seule requête (la tentative de claim) : pas de lecture de commande, pas de notification.
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(mockNotifyLiveActivitiesForOrderStatus).not.toHaveBeenCalled();
    expect(mockNotifyOrderStatusPushes).not.toHaveBeenCalled();
  });

  it('traite un nouveau statut pour la même commande comme un événement distinct (pas de faux-positif anti-doublon)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ order_id: 'order-1' }] } as any) // claim "accepted" réussi
      .mockResolvedValueOnce({
        rows: [{ tracking_token: null, recipient_user_id: null, recipient: null, dropoff_address: null }],
      } as any)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ order_id: 'order-1' }] } as any) // claim "picked_up" réussi
      .mockResolvedValueOnce({
        rows: [{ tracking_token: null, recipient_user_id: null, recipient: null, dropoff_address: null }],
      } as any);

    await notifyAllForOrderStatus({ orderId: 'order-1', status: 'accepted', payerUserId: 'user-1' });
    await notifyAllForOrderStatus({ orderId: 'order-1', status: 'picked_up', payerUserId: 'user-1' });

    expect(mockNotifyOrderStatusPushes).toHaveBeenCalledTimes(2);
  });
});
