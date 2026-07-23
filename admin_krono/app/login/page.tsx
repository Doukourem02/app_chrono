import { Suspense } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
}

type SearchParams = Record<string, string | string[] | undefined>

function queryStringFromSearchParams(searchParams: SearchParams): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else if (typeof value === 'string') {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function LoginFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
      }}
    >
      <p style={{ color: '#6B7280', fontSize: '14px' }}>Chargement…</p>
    </div>
  )
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const requestHeaders = await headers()
  const resolvedSearchParams = await searchParams
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').toLowerCase()

  if (host.startsWith('partner.')) {
    redirect(`/partner/login${queryStringFromSearchParams(resolvedSearchParams ?? {})}`)
  }

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
