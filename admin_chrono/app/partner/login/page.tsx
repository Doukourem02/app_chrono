import { Suspense } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import PartnerLoginForm from './PartnerLoginForm'

export const metadata: Metadata = {
  title: 'Portail Partenaire — Connexion',
}

export default async function PartnerLoginPage() {
  const requestHeaders = await headers()
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').toLowerCase()

  if (host.startsWith('admin.')) {
    redirect('https://partner.kro-no-delivery.com/login')
  }

  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <p style={{ color: '#6B7280', fontSize: 14 }}>Chargement…</p>
      </div>
    }>
      <PartnerLoginForm />
    </Suspense>
  )
}
