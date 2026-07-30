import * as Sentry from '@sentry/nextjs'

// Better Stack Error Tracking est compatible avec le SDK Sentry : on lui
// envoie les erreurs en pointant simplement le DSN vers Better Stack.
if (process.env.NEXT_PUBLIC_BETTERSTACK_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_BETTERSTACK_DSN,
    environment: process.env.NODE_ENV || 'development',
  })
}
