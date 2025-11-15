'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { Plus, Search, Percent, DollarSign } from 'lucide-react'

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

interface CreatePromoCodeData {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  maxUses?: number
  validFrom?: string
  validUntil?: string
  isActive?: boolean
}

export default function PromoCodesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    maxUses: '',
    validFrom: '',
    validUntil: '',
    isActive: true,
  })

  const { data: promoCodesData, isLoading } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: () => adminApiService.getPromoCodes(),
    refetchInterval: 30000,
  })

  const createMutation = useMutation({
    mutationFn: async (data: CreatePromoCodeData) => {
      return await adminApiService.createPromoCode(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] })
      setShowCreateModal(false)
      setFormData({
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        maxUses: '',
        validFrom: '',
        validUntil: '',
        isActive: true,
      })
    },
  })

  const promoCodes = promoCodesData?.data || []

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
    color: '#111827',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
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
    color: '#6B7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
  }

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '8px',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Codes Promo</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#8B5CF6',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Plus size={16} />
          Nouveau code
        </button>
      </div>

      {/* Recherche */}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
        <input
          type="text"
          placeholder="Rechercher un code promo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px',
            paddingLeft: '40px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      <div style={cardStyle}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
        ) : filteredCodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Aucun code promo trouvé
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Valeur</th>
                <th style={thStyle}>Utilisations</th>
                <th style={thStyle}>Valide du</th>
                <th style={thStyle}>Valide jusqu&apos;au</th>
                <th style={thStyle}>Statut</th>
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
                        Pourcentage
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={14} style={{ color: '#6B7280' }} />
                        Fixe
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
                      {code.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de création */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: '#111827' }}>
              Créer un code promo
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="PROMO2024"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Type de réduction</label>
                <select
                  value={formData.discountType}
                  onChange={(e) =>
                    setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })
                  }
                  style={inputStyle}
                >
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (FCFA)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Valeur ({formData.discountType === 'percentage' ? '%' : 'FCFA'})
                </label>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Utilisations maximales (optionnel)</label>
                <input
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                  placeholder="Illimité"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Valide du (optionnel)</label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Valide jusqu&apos;au (optionnel)</label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
                  Actif immédiatement
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#374151',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    createMutation.mutate({
                      code: formData.code,
                      discountType: formData.discountType,
                      discountValue: formData.discountValue,
                      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
                      validFrom: formData.validFrom || undefined,
                      validUntil: formData.validUntil || undefined,
                      isActive: formData.isActive,
                    })
                  }}
                  disabled={!formData.code || createMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#8B5CF6',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: !formData.code || createMutation.isPending ? 0.5 : 1,
                  }}
                >
                  {createMutation.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

