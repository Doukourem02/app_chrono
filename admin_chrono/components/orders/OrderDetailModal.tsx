'use client'

import React, { useEffect, useState } from 'react'
import { X, MapPin, User, Package, QrCode, History, CheckCircle } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { themeColors } from '@/utils/theme'

interface OrderDetailData {
  id: string
  deliveryId: string
  status: string
  createdAt: string
  completedAt?: string
  departure: string
  destination: string
  price?: number
  deliveryMethod?: string
  distance?: number
  delivery_qr_scanned_at?: string | null
  delivery_qr_scanned_by?: { id: string; name: string } | null
  driver?: { id: string; name: string; phone?: string; email?: string } | null
  client?: { id: string; name: string; phone?: string; email?: string } | null
}

interface QRScanRecord {
  id: string
  orderId: string
  qrCodeType: string
  scannedBy: { id: string; name: string }
  scannedAt: string
  isValid: boolean
  validationError?: string
}

interface OrderDetailModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string | null
  orderDate?: string
  onOrderCancelled?: () => void
}

const statusConfig: Record<string, { label: string; backgroundColor: string; color: string }> = {
  pending: { label: 'Recherche livreur', backgroundColor: '#FFEDD5', color: '#EA580C' },
  accepted: { label: 'Prise en charge', backgroundColor: '#DBEAFE', color: '#2563EB' },
  enroute: { label: 'Prise en charge', backgroundColor: '#DBEAFE', color: '#2563EB' },
  picked_up: { label: 'Colis récupéré', backgroundColor: '#F3E8FF', color: '#9333EA' },
  delivering: { label: 'Livraison', backgroundColor: '#E9D5FF', color: '#7C3AED' },
  completed: { label: 'Livraison terminée', backgroundColor: '#D1FAE5', color: '#16A34A' },
  cancelled: { label: 'Annulé', backgroundColor: '#FEE2E2', color: '#DC2626' },
  declined: { label: 'Refusé', backgroundColor: '#FEE2E2', color: '#DC2626' },
}

const formatDateTime = (isoString?: string | null) => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function OrderDetailModal({
  isOpen,
  onClose,
  orderId,
  onOrderCancelled,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetailData | null>(null)
  const [qrScans, setQrScans] = useState<QRScanRecord[]>([])
  const [showScanHistory, setShowScanHistory] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingScans, setIsLoadingScans] = useState(false)

  useEffect(() => {
    if (!isOpen || !orderId) return
    const tid = setTimeout(() => {
      setIsLoading(true)
      setOrder(null)
      setQrScans([])
      setShowScanHistory(false)
    }, 0)
    adminApiService
      .getOrderById(orderId)
      .then((res) => {
        if (res.success && res.data) setOrder(res.data)
      })
      .finally(() => setIsLoading(false))
    return () => clearTimeout(tid)
  }, [isOpen, orderId])

  const loadScanHistory = () => {
    if (!orderId) return
    setShowScanHistory(true)
    setIsLoadingScans(true)
    adminApiService
      .getOrderQRScans(orderId)
      .then((res) => {
        if (res.success && res.data) setQrScans(res.data)
      })
      .finally(() => setIsLoadingScans(false))
  }

  const handleCancelOrder = () => {
    if (!orderId || !confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) return
    adminApiService.cancelOrder(orderId, 'admin_cancelled').then((res) => {
      if (res.success) {
        onOrderCancelled?.()
        onClose()
        alert('Commande annulée avec succès')
      } else {
        alert(res.message || 'Erreur lors de l\'annulation')
      }
    })
  }

  if (!isOpen) return null

  const status = order ? statusConfig[order.status] || { label: order.status, backgroundColor: themeColors.grayLight, color: themeColors.textSecondary } : null
  const canCancel = order && ['pending', 'accepted', 'enroute', 'picked_up', 'delivering'].includes(order.status)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${themeColors.cardBorder}`,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: themeColors.textPrimary, margin: 0 }}>
            Détail de la commande
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: themeColors.textSecondary,
            }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: themeColors.textSecondary }}>
              Chargement...
            </div>
          ) : !order ? (
            <div style={{ textAlign: 'center', padding: 48, color: themeColors.textSecondary }}>
              Commande introuvable
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 14, color: themeColors.textSecondary }}>
                  {order.deliveryId}
                </span>
                <span
                  style={{
                    marginLeft: 12,
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: status?.backgroundColor || themeColors.grayLight,
                    color: status?.color || themeColors.textSecondary,
                  }}
                >
                  {status?.label || order.status}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <MapPin size={18} color={themeColors.purplePrimary} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, color: themeColors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Prise en charge</div>
                    <div style={{ fontSize: 14, color: themeColors.textPrimary }}>{order.departure}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Package size={18} color={themeColors.purplePrimary} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, color: themeColors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Livraison</div>
                    <div style={{ fontSize: 14, color: themeColors.textPrimary }}>{order.destination}</div>
                  </div>
                </div>
              </div>

              {order.driver && (
                <div style={{ marginTop: 20, padding: 16, backgroundColor: themeColors.grayLight, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 8 }}>Livreur</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color={themeColors.purplePrimary} />
                    <span style={{ fontWeight: 600, color: themeColors.textPrimary }}>{order.driver.name}</span>
                    {order.driver.phone && (
                      <span style={{ fontSize: 13, color: themeColors.textSecondary }}>{order.driver.phone}</span>
                    )}
                  </div>
                </div>
              )}

              {order.client && (
                <div style={{ marginTop: 12, padding: 16, backgroundColor: themeColors.grayLight, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 8 }}>Client</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color={themeColors.purplePrimary} />
                    <span style={{ fontWeight: 600, color: themeColors.textPrimary }}>{order.client.name}</span>
                    {order.client.phone && (
                      <span style={{ fontSize: 13, color: themeColors.textSecondary }}>{order.client.phone}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Section Preuve QR livraison */}
              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  border: `1px solid ${themeColors.cardBorder}`,
                  borderRadius: 12,
                  backgroundColor: order.delivery_qr_scanned_at ? '#F0FDF4' : '#FEFCE8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <QrCode size={20} color={order.delivery_qr_scanned_at ? '#16A34A' : '#CA8A04'} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: themeColors.textPrimary }}>
                    Preuve de livraison (QR code)
                  </span>
                </div>
                {order.delivery_qr_scanned_at ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <CheckCircle size={16} color="#16A34A" />
                      <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 500 }}>QR code scanné</span>
                    </div>
                    <div style={{ fontSize: 13, color: themeColors.textSecondary }}>
                      Le {formatDateTime(order.delivery_qr_scanned_at)}
                      {order.delivery_qr_scanned_by && (
                        <> par <strong>{order.delivery_qr_scanned_by.name}</strong></>
                      )}
                    </div>
                    <button
                      onClick={loadScanHistory}
                      style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${themeColors.purplePrimary}`,
                        borderRadius: 8,
                        color: themeColors.purplePrimary,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <History size={14} />
                      Voir l&apos;historique des scans
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#92400E' }}>
                    QR code non scanné — pas de preuve de remise physique enregistrée
                  </div>
                )}
              </div>

              {showScanHistory && (
                <div style={{ marginTop: 16, padding: 16, backgroundColor: themeColors.grayLight, borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Historique des scans</div>
                  {isLoadingScans ? (
                    <div style={{ fontSize: 13, color: themeColors.textSecondary }}>Chargement...</div>
                  ) : qrScans.length === 0 ? (
                    <div style={{ fontSize: 13, color: themeColors.textSecondary }}>Aucun scan enregistré</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {qrScans.map((scan) => (
                        <div
                          key={scan.id}
                          style={{
                            padding: 12,
                            backgroundColor: scan.isValid ? '#F0FDF4' : '#FEF2F2',
                            borderRadius: 8,
                            fontSize: 13,
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>
                            {scan.isValid ? '✓ Valide' : '✗ Invalide'} — {scan.scannedBy.name}
                          </div>
                          <div style={{ color: themeColors.textSecondary, marginTop: 4 }}>
                            {formatDateTime(scan.scannedAt)}
                            {scan.validationError && (
                              <span style={{ color: '#DC2626', marginLeft: 8 }}>{scan.validationError}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {order.price != null && (
                <div style={{ marginTop: 16, fontSize: 14, color: themeColors.textSecondary }}>
                  Prix : <strong style={{ color: themeColors.textPrimary }}>{order.price} FCFA</strong>
                </div>
              )}

              {canCancel && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${themeColors.cardBorder}` }}>
                  <button
                    onClick={handleCancelOrder}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#EF4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Annuler la commande
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
