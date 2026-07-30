import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_BETTERSTACK_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_BETTERSTACK_DSN,
    environment: process.env.NODE_ENV || 'development',
  })
}
