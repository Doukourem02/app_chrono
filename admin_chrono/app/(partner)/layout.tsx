import type { Metadata } from 'next'

const partnerAppName = 'Partner Portal Krono'

export const metadata: Metadata = {
  title: {
    default: partnerAppName,
    template: `%s | ${partnerAppName}`,
  },
  appleWebApp: {
    title: partnerAppName,
  },
  openGraph: {
    title: partnerAppName,
  },
  twitter: {
    title: partnerAppName,
  },
}

export default function PartnerRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
