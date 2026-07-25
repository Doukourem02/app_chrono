/**
 * Test end-to-end du vrai parcours client : REST (POST /api/orders/record,
 * validation + application du code promo) PUIS Socket.IO (`create-order`,
 * réutilisation des valeurs déjà persistées).
 *
 * Découvert le 2026-07-25 : la logique promo avait été construite et testée
 * uniquement côté REST — l'app cliente réelle enchaîne REST puis Socket.IO
 * pour la même commande (userOrderSocketService.ts), et le handler socket ne
 * connaissait pas du tout le code promo. Ce test reproduit ce vrai
 * enchaînement pour empêcher une régression silencieuse de ce type.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
// @ts-ignore
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { generateTokens } from '../../src/utils/jwt.js';
import { verifyAccessToken } from '../../src/utils/jwt.js';
import { setupOrderSocket } from '../../src/sockets/orderSocket.js';

describe('E2E — Commande avec code promo (REST puis Socket.IO, comme app_krono)', () => {
  let httpServer: http.Server;
  let ioServer: Server;
  let socketUrl: string;
  let clientSocket: ClientSocket;
  let authToken: string;
  let userId: string;
  const promoCode = `E2ETEST${Date.now()}`.slice(0, 20);

  beforeAll(async () => {
    // Serveur Socket.IO de test : on ne réutilise pas server.ts (effets de bord
    // réels — Redis, Sentry, cron jobs, server.listen sur le vrai PORT), on
    // rebranche uniquement l'auth JWT + setupOrderSocket, exactement ce que
    // ce test a besoin d'exercer.
    httpServer = http.createServer();
    ioServer = new Server(httpServer, { cors: { origin: '*' } });

    ioServer.use((socket, next) => {
      const token = (socket.handshake.auth as any)?.token;
      if (!token) return next(new Error('Unauthorized'));
      try {
        const decoded = verifyAccessToken(token);
        (socket as any).userId = decoded.id;
        (socket as any).userRole = decoded.role;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });

    setupOrderSocket(ioServer);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    socketUrl = `http://127.0.0.1:${port}`;

    // Utilisateur client de test, créé directement en base (plus rapide et
    // fiable qu'un aller-retour OTP réel pour ce qui est testé ici).
    userId = 'e2e-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await pool.query(
      `INSERT INTO users (id, email, phone, role, created_at)
       VALUES ($1, $2, $3, 'client', NOW())`,
      [userId, `${userId}@e2e-test.local`, `+2250100${String(Date.now()).slice(-6)}`]
    );
    const tokens = await generateTokens({ id: userId, role: 'client' });
    authToken = tokens.accessToken;

    // Code promo réel en base, valide.
    await pool.query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, current_uses, is_active)
       VALUES ($1, 'fixed', 500, 10, 0, true)`,
      [promoCode]
    );
  });

  afterAll(async () => {
    if (clientSocket?.connected) clientSocket.disconnect();
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await pool.query(`DELETE FROM promo_codes WHERE code = $1`, [promoCode]);
    await pool.query(`DELETE FROM orders WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  it('applique le code promo côté REST puis conserve le prix plein/réduit correctement via Socket.IO', async () => {
    const pickup = { coordinates: { latitude: 5.3165, longitude: -4.0266 } };
    const dropoff = { coordinates: { latitude: 5.3532, longitude: -3.9851 } };

    // Étape 1 (REST) : exactement ce que fait userOrderSocketService.ts avant d'émettre le socket.
    const recordResponse = await request(app)
      .post('/api/orders/record')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId,
        pickup,
        dropoff,
        method: 'moto',
        distanceKm: 5,
        promoCode,
      });

    expect(recordResponse.status).toBe(200);
    expect(recordResponse.body.success).toBe(true);
    const { orderId, priceCfa, discountAmountCfa, fullPriceCfa } = recordResponse.body.data;
    expect(orderId).toBeTruthy();
    expect(discountAmountCfa).toBe(500);
    expect(fullPriceCfa).toBe(priceCfa + 500);

    // Étape 2 (Socket.IO) : le vrai chemin utilisé en prod pour finaliser/dispatcher la commande.
    clientSocket = ioClient(socketUrl, { auth: { token: authToken }, transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => resolve());
      clientSocket.on('connect_error', reject);
    });

    const ack: any = await new Promise((resolve) => {
      clientSocket.emit(
        'create-order',
        {
          pickup,
          dropoff,
          deliveryMethod: 'moto',
          orderId,
          promoCode,
        },
        (response: any) => resolve(response)
      );
    });

    expect(ack?.success).not.toBe(false);

    // Vérification en base : le prix plein et la réduction doivent être ceux
    // posés par la route REST, pas revalidés/recalculés par le handler socket
    // (sinon double incrémentation de current_uses — la vraie cause du bug).
    const orderRow = await pool.query(
      `SELECT price_cfa, full_price_cfa, discount_amount_cfa, promo_code_id FROM orders WHERE id = $1`,
      [orderId]
    );
    expect(orderRow.rows).toHaveLength(1);
    const row = orderRow.rows[0];
    expect(Number(row.full_price_cfa)).toBe(fullPriceCfa);
    expect(Number(row.discount_amount_cfa)).toBe(500);
    expect(row.promo_code_id).toBeTruthy();

    // La commission livreur doit se calculer sur le prix PLEIN, jamais le prix réduit.
    const commissionBase = row.full_price_cfa ?? row.price_cfa;
    expect(Number(commissionBase)).toBe(fullPriceCfa);

    // Pas de double comptage de l'usage du code promo (REST l'a déjà incrémenté une fois).
    const promoRow = await pool.query(`SELECT current_uses FROM promo_codes WHERE code = $1`, [promoCode]);
    expect(promoRow.rows[0].current_uses).toBe(1);
  }, 15000);
});
