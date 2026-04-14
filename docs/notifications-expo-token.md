# Notifications push — État actuel et prochaines étapes (PROJET_CHRONO)

Ce document résume l’état réel des notifications push après les derniers travaux, puis liste les prochaines priorités.

## État actuel (avril 2026)

### Ce qui est déjà en place

- Enregistrement des tokens Expo côté backend via `POST /api/push/register`.
- Apps `app_chrono` et `driver_chrono` configurées avec `expo-notifications` + canal Android.
- Envoi push backend via Expo (`chrono_backend/src/services/expoPushService.ts`).
- Notifications reçues même app fermée (si token valide + permission utilisateur + config APNs/FCM OK).

### Avancées récentes livrées

- **Résolution automatique du destinataire par téléphone** au moment de `saveOrder` :
  - si le numéro correspond à un compte client unique, `recipient_user_id` est rempli.
  - fichiers : `chrono_backend/src/utils/phoneE164CI.ts`, `chrono_backend/src/utils/resolveRecipientUserIdByPhone.ts`, appel dans `chrono_backend/src/config/orderStorage.ts`.
- **Lien public de suivi ajouté au push** (`trackUrl`) :
  - injecté dans le body (quand dispo) + dans `data`.
  - aligne l’expérience push avec SMS / partage lien.
- **Statuts push destinataire étendus** :
  - destinataire inscrit reçoit maintenant : `accepted`, `enroute`, `picked_up`, `delivering`, `completed`, `cancelled`.
- **Fiabilité Android validée** :
  - présence confirmée de lignes `platform = android` dans `push_tokens`.

## Flux de décision actuel (destinataire)

1. La commande contient un numéro destinataire.
2. Le backend tente de mapper ce numéro vers un compte client (`recipient_user_id`).
3. Si compte trouvé :
   - push app au destinataire (et au payeur selon statut),
   - pas de dépendance SMS pour notifier ce destinataire inscrit.
4. Si aucun compte trouvé :
   - fallback SMS / lien `/track` selon configuration.

## Vérifications terrain à finaliser

Référence : `docs/checklists/recipient-track-notifications.md`.

- Destinataire avec compte : push bien reçus sur appareil réel.
- Payeur : push inchangés.
- Pas de doublon SMS quand `recipient_user_id` est présent.

## Prochaines étapes (ordre recommandé)

1. **Clore la validation terrain** (si tous les cas ne sont pas encore testés en réel).
2. **Ajouter une observabilité légère** :
   - log structuré quand un `recipient_user_id` est auto-résolu,
   - compteur/trace de fallback SMS (absence de compte).
3. **Durcir l’hygiène token push** :
   - invalider les tokens `DeviceNotRegistered` (si pas encore fait partout),
   - endpoint de désenregistrement explicite à la déconnexion.
4. **Navigation au tap notification** :
   - utiliser `data.trackUrl`/`data.orderId` pour ouvrir directement l’écran cible.
5. **Documentation opérationnelle courte** :
   - conserver `docs/checklists/recipient-track-notifications.md` comme checklist de run QA.

## Notes produit

- Le push ne part pas “au numéro” ; il part aux tokens d’un `user_id`.
- Le numéro sert à **résoudre** ce `user_id` dans votre base.
- Si plusieurs comptes matchent le même numéro, l’attribution auto est volontairement bloquée pour éviter une notification au mauvais utilisateur.

## Références code

- Orchestration destinataire/payer : `chrono_backend/src/services/recipientOrderNotifyService.ts`
- Envoi Expo + copy statuts : `chrono_backend/src/services/expoPushService.ts`
- Résolution destinataire par téléphone : `chrono_backend/src/utils/resolveRecipientUserIdByPhone.ts`
- Normalisation téléphone CI : `chrono_backend/src/utils/phoneE164CI.ts`
- Persistance commande (`saveOrder`) : `chrono_backend/src/config/orderStorage.ts`

---

Document maintenu pour l’état réel de prod ; à mettre à jour après chaque lot de tests terrain.
