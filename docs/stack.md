# Sentry + Better Stack Error Tracking (en parallèle)

## Décision

On garde Sentry (plus complet, notamment pour les crashs natifs mobile) ET on
active Better Stack Error Tracking (interface préférée par l'utilisateur,
déjà utilisé pour les logs). Les deux tournent en même temps, pas de
remplacement.

## Comment ça marche

Chaque erreur capturée dans le code est envoyée à deux DSN au lieu d'un
(comme un mail en copie à deux personnes) :
- DSN Sentry (existant)
- DSN Better Stack (à créer)

**Exception** : les crashs natifs mobile (iOS/Android, app qui plante
complètement) restent gérés uniquement par Sentry sur `driver_krono` et
`app_krono` — dupliquer ce mécanisme serait fragile. Better Stack recevra
toutes les erreurs JS classiques (la grande majorité des bugs réels).

## Tâches

- [ ] **(Toi)** Créer une application "Error Tracking" dans Better Stack pour
      chacun des 4 services : backend, admin, driver, client
- [ ] **(Toi)** Me transmettre les 4 DSN générés
- [ ] **(Moi)** krono_backend : ajouter le DSN Better Stack en plus du DSN
      Sentry, envoyer les erreurs aux deux
- [ ] **(Moi)** admin_krono : activer Sentry pour de vrai (il n'était pas
      initialisé) + ajouter Better Stack en parallèle
- [ ] **(Moi)** driver_krono / app_krono : ajouter le DSN Better Stack pour
      les erreurs JS, garder Sentry seul pour les crashs natifs
- [ ] **(Toi + moi)** Vérifier qu'une erreur de test apparaît bien des deux
      côtés (Sentry ET Better Stack) sur chaque app

## Plus tard (phase 2, pas maintenant)

- Real User Monitoring (RUM) de Better Stack : session replay, analytics,
  performance web, funnels — pertinent surtout pour `admin_krono` (dashboard
  web). Pas dans le périmètre de cette checklist, à reprendre séparément.

## Sources

- [10 Best Sentry Alternatives in 2026 (OneUptime)](https://oneuptime.com/blog/post/2026-03-12-10-best-sentry-alternatives-2026/view)
- [Best Error Tracking Tools: Sentry Alternatives Compared (2026)](https://inventivehq.com/blog/best-error-tracking-tools-sentry-alternatives)
- [Better Stack Documentation — Welcome to Errors](https://betterstack.com/docs/errors/start/)
