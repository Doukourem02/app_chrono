'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { Clock, Search, Percent, DollarSign } from 'lucide-react'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

interface PromoCode {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  current_uses?: number
  max_uses?: number | null
  valid_from?: string
  valid_until?: string | null
  is_active?: boolean
}

export default function PromoCodesPage() {
  const t = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: promoCodesData, isLoading } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: () => adminApiService.getPromoCodes(),
    refetchInterval: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  const promoCodes: PromoCode[] = (promoCodesData?.data as PromoCode[]) || []

  const filteredCodes = promoCodes.filter((code: PromoCode) =>
    code.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: themeColors.textPrimary,
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: themeColors.textSecondary,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    fontSize: '14px',
    color: themeColors.textPrimary,
    borderBottom: `1px solid ${themeColors.cardBorder}`,
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>{t('promoCodes.title')}</h1>
        <span
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: themeColors.background,
            color: themeColors.textSecondary,
            border: `1px solid ${themeColors.cardBorder}`,
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={14} />
          {t('promoCodes.newCode')}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: themeColors.textSecondary, margin: 0 }}>
        {t('promoCodes.comingSoon')}
      </p>

      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
        <input
          type="text"
          placeholder={t('promoCodes.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px',
            paddingLeft: '40px',
            borderRadius: '8px',
            border: `1px solid ${themeColors.cardBorder}`,
            fontSize: '14px',
            outline: 'none',
            backgroundColor: themeColors.background,
            color: themeColors.textPrimary,
          }}
        />
      </div>

      <div style={cardStyle}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>{t('common.loading')}</div>
        ) : filteredCodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: themeColors.textSecondary }}>
            {t('promoCodes.empty')}
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>{t('promoCodes.table.type')}</th>
                <th style={thStyle}>{t('promoCodes.table.value')}</th>
                <th style={thStyle}>{t('promoCodes.table.uses')}</th>
                <th style={thStyle}>{t('promoCodes.table.validFrom')}</th>
                <th style={thStyle}>{t('promoCodes.table.validUntil')}</th>
                <th style={thStyle}>{t('promoCodes.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map((code: PromoCode) => (
                <tr key={code.id}>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '14px' }}>
                      {code.code}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {code.discount_type === 'percentage' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Percent size={14} style={{ color: '#6B7280' }} />
                        {t('promoCodes.discount.percentage')}
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={14} style={{ color: themeColors.textSecondary }} />
                        {t('promoCodes.discount.fixed')}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {code.discount_type === 'percentage'
                      ? `${code.discount_value}%`
                      : `${code.discount_value} FCFA`}
                  </td>
                  <td style={tdStyle}>
                    {code.current_uses || 0} / {code.max_uses || '∞'}
                  </td>
                  <td style={tdStyle}>{formatDate(code.valid_from)}</td>
                  <td style={tdStyle}>{formatDate(code.valid_until)}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: code.is_active ? '#D1FAE5' : '#FEE2E2',
                        color: code.is_active ? '#065F46' : '#991B1B',
                      }}
                    >
                      {code.is_active ? t('promoCodes.status.active') : t('promoCodes.status.inactive')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
