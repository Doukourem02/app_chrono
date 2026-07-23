# Évaluation KRONO — 2026-07-23

> Document d'audit et de suivi de notation. Différent de `docs/taches.md` (réservé aux tâches
> destinées à l'utilisateur) : ce fichier suit le travail fait par Claude sur le code pour faire
> progresser la note, et la feuille de route pour la suite.

## Méthodologie et limite honnête

Audit basé sur le code source (4 apps : `app_chrono`, `driver_chrono`, `admin_chrono`,
`chrono_backend`), les tests, la CI, les policies Supabase, l'historique git. **L'app n'a pas été
lancée sur simulateur/device** — les critères purement sensoriels (UI visuelle, fluidité
ressentie, animations, HIG/Material) sont estimés par proxy de code, pas observés. Signalé à
chaque fois que c'est le cas.

## Notation initiale (avant travail correctif)

| # | Critère | Note | Preuve concrète |
|---|---|---|---|
| 1 | Design UI | 6/10 | Composants structurés (bottom sheets, headers, banners dédiés) mais évaluation visuelle impossible sans run réel |
| 2 | UX | 6/10 | `OfflineBanner`, `RealtimeDegradedBanner`, `ErrorBoundary` présents = souci de dégradation gracieuse, mais flux non testés en live |
| 3 | Performance/fluidité | 6/10 | `react-native-reanimated` utilisé (46 fichiers, thread UI) plutôt que `Animated` JS — bon signal, non mesuré en réel |
| 4 | Navigation/architecture | 7/10 | Expo Router cohérent sur les 3 apps mobiles (33/24/50 écrans) |
| 5 | Fonctionnalités | 8/10 | Très riche : pricing dynamique/surge/météo, gamification, prévision de demande, multi-livraison, commissions B2B, mobile money, Live Activities iOS, QR codes |
| 6 | Stabilité/fiabilité | 4/10 | Couverture tests backend 14% des lignes ; quasi aucun test frontend hors utils |
| 7 | Sécurité | 6/10 | Rate-limit anti-contournement OTP, brute-force protection, RLS + security advisor fixes, TruffleHog en CI — mais posture réactive (IDOR, mobile money patchés après coup) |
| 8 | Accessibilité | 3/10 | Seulement 16 fichiers utilisaient `accessibilityLabel/Role` sur ~200 écrans/composants cumulés |
| 9 | Qualité code/archi technique | 5/10 | Bonne séparation controllers/services/routes/sockets, TS `strict: true` partout — mais 1294 `any`/`as any` dans le seul backend |
| 10 | Maintenabilité/évolutivité | 3/10 | 506 des 617 commits (82%) sont "message de mise à jour" ; versions Expo/RN divergentes entre apps sœurs |
| 11 | Optimisation ressources | 5/10 | Non mesuré (pas de profiling) ; Reanimated et Redis sont de bons signaux structurels |
| 12 | Compatibilité appareils/OS | 5/10 | `app_chrono` Expo ~55/RN 0.83.4 vs `driver_chrono` Expo ~54/RN 0.81.5 |
| 13 | Hors ligne/synchronisation | 5/10 | `OfflineBanner` + `syncController` existent, mais logique NetInfo/queue trouvée seulement dans `driver_chrono` |
| 14 | Notifications/interactions système | 7/10 | Push client + push chauffeur + notif admin persistée + rappels intelligents + Live Activities APNs |
| 15 | Animations/micro-interactions | 6/10 | Bon choix technique (Reanimated) ; qualité perçue non vérifiable sans run |
| 16 | Temps de chargement/réactivité | 5/10 | Aucune mesure de perf disponible |
| 17 | Standards iOS/Android (HIG/Material) | 5/10 | Non vérifiable visuellement |
| 18 | Valeur métier/utilité | 8/10 | Plateforme logistique hyper-localisée Côte d'Ivoire, modèle B2B, 4 acteurs |
| 19 | Scalabilité | 6/10 | Redis, Postgres, Socket.io, jobs planifiés — bases saines, non éprouvées en charge |
| 20 | Qualité globale/niveau professionnel | 5/10 | Ambition et profondeur métier réelles, discipline d'ingénierie immature |

**Moyenne initiale : 5,6/10**

## Objectif fixé par l'utilisateur

Se rapprocher au maximum de **8/10** de moyenne.

## Limite honnête sur l'objectif 8/10

Sur les 20 critères, **7 sont structurellement plafonnés par du code seul** : Design UI, UX,
Performance/fluidité ressentie, Optimisation ressources, Animations perçues, Temps de
chargement, Standards HIG/Material. Aucune quantité de lecture de code ne remplace un test réel
sur simulateur/device — c'est vrai en général, pas propre à ce projet. Ces 7 critères ne
bougeront pas tant que l'app n'aura pas été réellement lancée et manipulée (via la skill `run`,
sur simulateur — à faire dans une prochaine session si tu veux les débloquer).

Sur les 13 restants, une moyenne de 8/10 est un objectif réaliste **sur plusieurs sessions**,
pas en une fois : certains (git history, alignement de versions Expo/RN) sont volontairement
exclus du travail autonome (destructeur / risque de casse native), d'autres (866 `any` restants,
~28 contrôleurs sans test, 78 fichiers sans accessibilité) demandent un travail fichier par
fichier qu'il serait irresponsable de bâcler en masse.

## Travail effectué cette session (vérifié, pas juste déclaré)

| Critère touché | Avant | Action | Vérification |
|---|---|---|---|
| Accessibilité (8) | 16 fichiers équipés | `AnimatedButton` (composant bouton partagé, 2 apps) + écran `verification.tsx` (2 apps, flux OTP = premier contact utilisateur) équipés en `accessibilityRole`/`Label`/`State` | `tsc --noEmit` propre sur les 2 apps |
| Qualité code (9) | 1294 `any` backend | Suppression des 426 `(pool as any)` — `pool` était déjà typé `Pool` correctement, ces casts étaient du bruit pur | `tsc --noEmit` : 0 erreur ; a fait remonter et corriger 3 bugs latents (accès null non géré, propriétés non déclarées) dans `adminController.ts`, `adminDriverController.ts`, `orderRecordController.ts` |
| Stabilité/fiabilité (6), Sécurité (7) | `partnerController.ts` (portail B2B, facturation, équipe) à 0% de test | 9 tests unitaires ajoutés : auto-suppression interdite, scope IDOR sur suppression de membre et paiement de facture, validation statut/moyen de paiement | Suite complète relancée avant/après : 248/250 tests passent (2 échecs préexistants confirmés indépendants, environnement d'intégration sans DB de test locale) |

**Résultat mesurable** : `any` backend 1294 → 866 (-33%). `partnerController.ts` 0 → 9 tests.
Accessibilité : 2 composants/écrans à fort trafic corrigés, 78 fichiers restants identifiés
précisément (liste ci-dessous).

## Feuille de route par critère

| # | Critère | Note actuelle | Actionnable par Claude maintenant | Bloqué par |
|---|---|---|---|---|
| 1 | Design UI | 6/10 | Non | Test live (simulateur) |
| 2 | UX | 6/10 | Marginal (cohérence messages d'erreur) | Test live |
| 3 | Performance/fluidité | 6/10 | Non | Profiling device |
| 4 | Navigation/architecture | 7/10 | Oui, effort faible (vérifier cohérence conventions de routes entre les 3 apps) | — |
| 5 | Fonctionnalités | 8/10 | Déjà au plafond réaliste | — |
| 6 | Stabilité/fiabilité | 4/10 → en hausse | Oui : ~27 contrôleurs encore sans aucun test (liste : `adminController`, `authController`, `commissionController`, `batchController`, etc.) | — |
| 7 | Sécurité | 6/10 | Oui : revue ciblée des endpoints à paramètres d'ID (pattern IDOR) restants + tests | — |
| 8 | Accessibilité | 3/10 → en hausse | Oui : 78 fichiers identifiés (liste exacte dans le repo, voir commande ci-dessous), à traiter écran par écran | — |
| 9 | Qualité code/archi | 5/10 → en hausse | Oui : 866 `any` restants, prioriser `adminController.ts` (5017 lignes, plus gros contributeur) | — |
| 10 | Maintenabilité | 3/10 | Partiel : convention de commit à partir de maintenant | Historique déjà écrit (non réécrit, décision assumée) ; alignement versions Expo/RN (ton feu vert requis) |
| 11 | Optimisation ressources | 5/10 | Non | Profiling device |
| 12 | Compatibilité appareils/OS | 5/10 | Non | Ton feu vert pour migration native |
| 13 | Hors ligne/synchronisation | 5/10 | Oui : étendre le pattern NetInfo/queue de `driver_chrono` à `app_chrono` | — |
| 14 | Notifications | 7/10 | Déjà solide | — |
| 15 | Animations | 6/10 | Non | Test live |
| 16 | Temps de chargement | 5/10 | Non | Profiling device |
| 17 | HIG/Material | 5/10 | Non | Test live / revue design |
| 18 | Valeur métier | 8/10 | Déjà au plafond réaliste | — |
| 19 | Scalabilité | 6/10 | Oui, effort modéré (revue index/requêtes) | — |
| 20 | Qualité globale | 5/10 | Dérive des 19 autres | — |

Pour retrouver la liste exacte des 78 fichiers sans accessibilité :
```
for dir in app_chrono/components driver_chrono/components app_chrono/app driver_chrono/app; do
  for f in $(grep -rl 'TouchableOpacity\|Pressable' "$dir" --include='*.tsx'); do
    grep -q 'accessibilityRole\|accessibilityLabel' "$f" || echo "$f"
  done
done
```

## Priorisation recommandée pour la suite

1. **Accessibilité** — meilleur ratio effort/score, aucun risque de régression fonctionnelle.
2. **Tests sur contrôleurs critiques restants** (argent, admin) — même logique que `partnerController`.
3. **Nettoyage `any` ciblé** sur `adminController.ts` en priorité (240 occurrences à lui seul).
4. **Décision à prendre par toi** : lancer l'app via la skill `run` pour débloquer les 7 critères
   figés (design, UX, perf ressentie, animations, HIG/Material, temps de charge, ressources).
