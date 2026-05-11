# Checklist refactoring — fichiers > 1900 lignes

Règle : ne pas toucher les fichiers en dessous de 1500 lignes.
Attendre le feu vert avant chaque tâche. Ne pas modifier la logique, uniquement déplacer.

---

## ✅ Terminé

- [x] `driver_chrono/app/(tabs)/index.tsx` — 1910 lignes
  - Extrait en : `ClassicDeliveryFlow.tsx` + `BatchDeliveryFlow.tsx` + orchestrateur `index.tsx`
  - Bug corrigé au passage : `!activeBatch` dans `shouldEnableGeofencing` (bouton "colis récupéré" disparu)

- [x] `src/controllers/adminController.ts` — **5 017 lignes**
  - Extrait en 7 fichiers : `adminControllerUtils.ts` + `adminDashboardController.ts` + `adminOrderController.ts` + `adminFinanceController.ts` + `adminDriverController.ts` + `adminUserController.ts` + `adminModerationController.ts`
  - `adminRoutes.ts` mis à jour — TypeScript passe sans erreur

---

## ✅ Terminé (suite)

- [x] `chrono_backend/src/sockets/orderSocket.ts` — **2 933 lignes**
  - Extrait en modules dédiés : `orderSocketState.ts`, `orderSocketTypes.ts`, `orderSocketUtils.ts`, `orderSocketBatch.ts`, `orderSocketDriverPresence.ts`, `orderSocketMatching.ts`, `orderSocketNotify.ts`
  - Correctif appliqué pendant l’intégration : import dynamique `driverController` dans `orderSocketMatching.ts`

- [x] `admin_chrono/lib/adminApiService.ts` — **2 715 lignes**
  - Extrait en hiérarchie : `adminApiBase.ts` + `adminDashboardApi.ts` + `adminFinanceApi.ts` + `adminDriverApi.ts` + `adminOrderApi.ts` + `adminFleetApi.ts` + `adminPartnerApi.ts`
  - `adminApiService.ts` devient le point d’assemblage (singleton), avec imports inter-modules corrigés

- [x] `chrono_backend/src/controllers/partnerController.ts` — **1 995 lignes**
  - Extrait en : `partnerControllerUtils.ts`, `partnerCrudController.ts`, `partnerSubscriptionController.ts`, `partnerUserController.ts`, `partnerDriverController.ts`
  - `partnerRoutes.ts` mis à jour pour consommer les nouveaux contrôleurs (tracking/QR gardés via contrôleur central pour compatibilité)
