# Checklist refactoring — fichiers > 1900 lignes

Règle : ne pas toucher les fichiers en dessous de 1500 lignes.
Attendre le feu vert avant chaque tâche. Ne pas modifier la logique, uniquement déplacer.

---

## ✅ Terminé

- [x] `driver_chrono/app/(tabs)/index.tsx` — 1910 lignes
  - Extrait en : `ClassicDeliveryFlow.tsx` + `BatchDeliveryFlow.tsx` + orchestrateur `index.tsx`
  - Bug corrigé au passage : `!activeBatch` dans `shouldEnableGeofencing` (bouton "colis récupéré" disparu)

---

## 🔴 À faire — Backend (`chrono_backend`)

- [ ] `src/controllers/adminController.ts` — **5 017 lignes**
  - Mélange : dashboard admin + filtrage commandes + requêtes SQL + envoi SMS + tarification dynamique + reporting
  - Plan : extraire `AdminOrderService` / `AdminAnalyticsService` / `AdminReportingService` / `SmsService`

- [ ] `src/controllers/orderSocket.ts` — **2 933 lignes**
  - Mélange : événements WebSocket + cycle de vie commandes + création paiements + tracking position + preuves de livraison + notifications
  - Plan : extraire `OrderEventHandler` / `DeliveryProofHandler` / `PaymentSocketService` / `DriverNotificationService`

- [ ] `src/services/adminApiService.ts` — **2 715 lignes**
  - Mélange : client HTTP + pagination + filtrage + cache + gestion erreurs — tout dans un seul service générique
  - Plan : extraire `OrderApiClient` / `FleetApiClient` / `UserApiClient` / `AnalyticsApiClient`

- [ ] `src/controllers/partnerController.ts` — **1 995 lignes**
  - Mélange : gestion partenaires B2B + traitement paiements + demandes livreurs + création commandes
  - Plan : extraire `PartnerOrderService` / `PartnerPaymentService`
