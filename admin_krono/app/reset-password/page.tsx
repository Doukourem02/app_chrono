import type { Metadata } from 'next'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
