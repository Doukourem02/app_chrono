import { Suspense } from 'react'
import type { Metadata } from 'next'
import PartnerLoginForm from './PartnerLoginForm'

export const metadata: Metadata = {
  title: 'Portail Partenaire — Connexion',
}

export default function PartnerLoginPage() {
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
