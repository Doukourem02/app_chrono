'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, Coins } from 'lucide-react'

type TabType = 'transactions' | 'commissions'

export default function FinancesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('transactions')

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (tab === 'transactions') {
      router.push('/finance')
    } else {
      router.push('/commissions')
    }
  }

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType | null
    if (tab === 'transactions' || tab === 'commissions') {
      requestAnimationFrame(() => {
        setActiveTab(tab)
        if (tab === 'transactions') {
          router.replace('/finance')
        } else {
          router.replace('/commissions')
        }
      })
    } else {
      router.replace('/finance')
    }
  }, [searchParams, router])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F9FAFB' }}>
      {/* Header avec onglets */}
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '16px 24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
          Finances
        </h1>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleTabChange('transactions')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === 'transactions' ? '#8B5CF6' : 'transparent',
              color: activeTab === 'transactions' ? '#FFFFFF' : '#6B7280',
              fontWeight: activeTab === 'transactions' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '14px',
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'transactions' ? '2px solid #8B5CF6' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <CreditCard size={16} />
            Transactions Clients
          </button>
          <button
            onClick={() => handleTabChange('commissions')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === 'commissions' ? '#8B5CF6' : 'transparent',
              color: activeTab === 'commissions' ? '#FFFFFF' : '#6B7280',
              fontWeight: activeTab === 'commissions' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '14px',
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'commissions' ? '2px solid #8B5CF6' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Coins size={16} />
            Commissions Livreurs
          </button>
        </div>
      </div>

      {/* Contenu - redirection automatique */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', textAlign: 'center', color: '#6B7280' }}>
        Redirection en cours...
      </div>
    </div>
  )
}
