import { Suspense } from 'react'
import LoginForm from './LoginForm'

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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
