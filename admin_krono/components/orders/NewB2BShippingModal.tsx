'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, User, Search, MapPin, Package, DollarSign, Calendar, AlertTriangle, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { adminApiService } from '@/lib/adminApiService'
import { useRouter } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'
import { getPhoneValidationError } from '@/utils/phoneValidation'
import { useLanguageStore } from '@/stores/languageStore'
import { useTranslation } from '@/hooks/useTranslation'

interface UserData {
  id: string
  email: string
  phone?: string
  first_name?: string | null
  last_name?: string | null
  role?: string
  avatar_url?: string | null
}

interface NewB2BShippingModalProps {
  isOpen: boolean
  onClose: () => void
  scheduledDate?: Date // Date planifiée depuis le calendrier
  scheduledTime?: string // Heure planifiée (HH:mm) depuis le calendrier
}

const B2B_INSTRUCTION_PRESETS: Record<'fr' | 'en', string[]> = {
  fr: [`Demander le code de livraison`, `Appeler le client avant d'arriver`],
  en: ['Ask for the delivery code', 'Call the client before arriving'],
}

export default function NewB2BShippingModal({
  isOpen,
  onClose,
  scheduledDate,
  scheduledTime,
}: NewB2BShippingModalProps) {
  const router = useRouter()
  const language = useLanguageStore((state) => state.language)
  const locale = language === 'fr' ? 'fr-FR' : 'en-US'
  const t = useTranslation()
  const [step, setStep] = useState<'client' | 'pickup' | 'dropoff' | 'details'>('client')
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Form data
  const [selectedClient, setSelectedClient] = useState<UserData | null>(null)
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [deliveryMethod, setDeliveryMethod] = useState<'moto' | 'vehicule' | 'cargo'>('moto')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'orange_money' | 'wave' | 'cash' | 'deferred'>('cash')
  const [driverNotes, setDriverNotes] = useState('')
  const [b2bNotes, setB2bNotes] = useState('') // Notes spécifiques B2B (détails de l'appel)
  const [selectedB2BInstructions, setSelectedB2BInstructions] = useState<string[]>([])
  
  // Date/heure planifiée
  const [scheduledDateValue, setScheduledDateValue] = useState<string>('')
  const [scheduledTimeValue, setScheduledTimeValue] = useState<string>('')

  // Calculated values
  const [distance, setDistance] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  // Initialiser la date/heure depuis les props
  useEffect(() => {
    if (scheduledDate) {
      const dateStr = scheduledDate.toISOString().split('T')[0]
      setScheduledDateValue(dateStr)
    } else {
      // Par défaut, aujourd'hui
      setScheduledDateValue(new Date().toISOString().split('T')[0])
    }
    
    if (scheduledTime) {
      setScheduledTimeValue(scheduledTime)
    } else {
      // Par défaut, 10:00
      setScheduledTimeValue('10:00')
    }
  }, [scheduledDate, scheduledTime])

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await adminApiService.getUsers()
      if (result.success && result.data) {
        const allUsers = result.data as UserData[]
        const clients = allUsers.filter((user) => user.role === 'client')
        setUsers(clients)
        setFilteredUsers(clients)
      }
    } catch (error) {
      logger.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && step === 'client') {
      loadUsers()
    }
  }, [isOpen, step, loadUsers])

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      setFilteredUsers(
        users.filter(
          (user) =>
            (user.phone && user.phone.toLowerCase().includes(query)) ||
            (user.first_name && user.first_name.toLowerCase().includes(query)) ||
            (user.last_name && user.last_name.toLowerCase().includes(query)) ||
            ((user.first_name && user.last_name) &&
              `${user.first_name} ${user.last_name}`.toLowerCase().includes(query))
        )
      )
    } else {
      setFilteredUsers(users)
    }
  }, [searchQuery, users])

  // Devis réel: calculé seulement quand départ + arrivée ont des coordonnées.
  useEffect(() => {
    if (!isOpen) return

    if (!pickupCoordinates || !dropoffCoordinates) {
      setDistance(null)
      setPrice(null)
      setIsEstimating(false)
      return
    }

    let cancelled = false
    setIsEstimating(true)
    adminApiService
      .calculateOrderEstimate({
        pickupCoordinates,
        dropoffCoordinates,
        deliveryMethod,
        isB2BPriority: true,
      })
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setDistance(Math.round(result.data.distance * 100) / 100)
          setPrice(result.data.price)
        } else {
          setDistance(null)
          setPrice(null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          logger.error('Error calculating B2B estimate:', error)
          setDistance(null)
          setPrice(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsEstimating(false)
      })

    return () => {
      cancelled = true
    }
  }, [deliveryMethod, dropoffCoordinates, isOpen, pickupCoordinates])

  const handleClientSelect = (user: UserData) => {
    setSelectedClient(user)
    setStep('pickup')
    setSearchQuery('')
  }

  const handlePickupNext = () => {
    if (!pickupAddress) return
    if (!pickupCoordinates) {
      alert(t('newB2BShipping.alerts.pickupGpsRequired'))
      return
    }
    setStep('dropoff')
  }

  const handleDropoffNext = () => {
    if (!dropoffAddress) return
    if (!dropoffCoordinates) {
      alert(t('newB2BShipping.alerts.dropoffGpsRequired'))
      return
    }
    setStep('details')
  }

  const toggleB2BInstruction = (instruction: string) => {
    setSelectedB2BInstructions((current) =>
      current.includes(instruction)
        ? current.filter((item) => item !== instruction)
        : [...current, instruction]
    )
  }

  const resetForm = useCallback(() => {
    setSelectedClient(null)
    setPickupAddress('')
    setPickupCoordinates(undefined)
    setDropoffAddress('')
    setDropoffCoordinates(undefined)
    setRecipientPhone('')
    setNotes('')
    setDeliveryMethod('moto')
    setPaymentMethod('cash')
    setDriverNotes('')
    setB2bNotes('')
    setSelectedB2BInstructions([])
    setDistance(null)
    setPrice(null)
    setStep('client')
    setSearchQuery('')
    // Réinitialiser la date/heure avec les valeurs par défaut
    if (scheduledDate) {
      setScheduledDateValue(scheduledDate.toISOString().split('T')[0])
    } else {
      setScheduledDateValue(new Date().toISOString().split('T')[0])
    }
    setScheduledTimeValue(scheduledTime || '10:00')
  }, [scheduledDate, scheduledTime])

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen, resetForm])

  const handleCreateOrder = async () => {
    // Validation
    if (!selectedClient || !pickupAddress || !dropoffAddress) {
      alert(t('newShipping.alerts.fillRequired'))
      return
    }
    if (!pickupCoordinates || !dropoffCoordinates) {
      alert(t('newB2BShipping.alerts.gpsCoordsRequired'))
      return
    }

    if (!scheduledDateValue || !scheduledTimeValue) {
      alert(t('newB2BShipping.alerts.dateTimeRequired'))
      return
    }

    const destPhone = recipientPhone.trim()
    if (!destPhone) {
      alert(t('newShipping.alerts.recipientPhoneRequired'))
      return
    }
    const phoneError = getPhoneValidationError(destPhone)
    if (phoneError) {
      alert(phoneError)
      return
    }

    setIsCreating(true)
    try {
      // Combiner les instructions B2B, les détails d'appel et les notes générales.
      const combinedNotes = [...selectedB2BInstructions, b2bNotes, notes].filter(Boolean).join('\n\n') || undefined

      const result = await adminApiService.createOrder({
        userId: selectedClient.id,
        pickup: {
          address: pickupAddress,
          coordinates: pickupCoordinates, // Optionnel pour B2B
        },
        dropoff: {
          address: dropoffAddress,
          coordinates: dropoffCoordinates, // Optionnel pour B2B
          details: { phone: destPhone },
        },
        deliveryMethod,
        paymentMethodType: paymentMethod,
        distance: distance ?? undefined,
        price: price ?? undefined,
        notes: combinedNotes,
        isPhoneOrder: true, // Toujours true pour B2B
        isB2BOrder: true, // Toujours true pour les commandes créées depuis le planning
        driverNotes: driverNotes || undefined,
      })

      if (result.success && result.data) {
        const deliveryCode = result.data.recipientDeliveryCode || result.data.deliveryVerificationCode
        const smsStatus = result.data.deliveryCodeSms?.status
        // Jouer le son de succès
        const { soundService } = await import('@/utils/soundService')
        soundService.playSuccess().catch((err) => {
          logger.warn('[NewB2BShippingModal] Erreur lecture son succès:', err)
        })
        if (deliveryCode) {
          const smsLabel =
            smsStatus === 'sent'
              ? t('newShipping.alerts.smsSent')
              : smsStatus === 'failed'
                ? t('newShipping.alerts.smsFailed')
                : t('newShipping.alerts.smsUnknown')
          alert(t('newB2BShipping.alerts.orderCreated', { code: deliveryCode, smsLabel }))
        }
        resetForm()
        onClose()
        // Navigate to planning page to see the new B2B order
        router.push(`/planning`)
      } else {
        alert(result.message || t('newB2BShipping.alerts.createOrderFailed'))
      }
    } catch (error) {
      logger.error('Error creating B2B order:', error)
      alert(t('newB2BShipping.alerts.createOrderError'))
    } finally {
      setIsCreating(false)
    }
  }

  const getUserDisplayName = (user: UserData): string => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.phone || t('newShipping.clientFallback')
  }

  if (!isOpen) return null

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    color: themeColors.textPrimary,
  }

  const closeButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '8px',
    border: `1px solid ${themeColors.cardBorder}`,
    fontSize: '14px',
    outline: 'none',
    marginTop: '8px',
    backgroundColor: themeColors.cardBg,
    color: themeColors.textPrimary,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: themeColors.textPrimary,
    marginBottom: '8px',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  }

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    marginBottom: '16px',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    paddingLeft: '40px',
    borderRadius: '8px',
    border: `1px solid ${themeColors.cardBorder}`,
    fontSize: '14px',
    outline: 'none',
    backgroundColor: themeColors.cardBg,
    color: themeColors.textPrimary,
  }

  const userListStyle: React.CSSProperties = {
    maxHeight: '300px',
    overflowY: 'auto',
  }

  const userItemStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px',
  }

  const footerStyle: React.CSSProperties = {
    padding: '20px',
    borderTop: `1px solid ${themeColors.cardBorder}`,
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  }

  const stepIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
  }

  const stepItemStyle: (isActive: boolean, isCompleted: boolean) => React.CSSProperties = (isActive, isCompleted) => ({
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: isActive ? themeColors.purplePrimary : isCompleted ? themeColors.greenLight : themeColors.grayLight,
    color: isActive ? themeColors.textPrimary : isCompleted ? themeColors.greenPrimary : themeColors.textSecondary,
  })

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={titleStyle}>{t('newB2BShipping.title')}</h2>
            <span style={{
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: themeColors.yellowLight,
              color: themeColors.yellowDark,
              fontSize: '11px',
              fontWeight: 600,
            }}>
              {t('newB2BShipping.badge')}
            </span>
          </div>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.grayLight
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={20} style={{ color: themeColors.textSecondary }} />
          </button>
        </div>

        <div style={contentStyle}>
          <div style={stepIndicatorStyle}>
            <span style={stepItemStyle(step === 'client', false)}>1. {t('newShipping.steps.client')}</span>
            <span style={{ color: themeColors.textTertiary }}>→</span>
            <span style={stepItemStyle(step === 'pickup', step === 'dropoff' || step === 'details')}>2. {t('newShipping.steps.pickup')}</span>
            <span style={{ color: themeColors.textTertiary }}>→</span>
            <span style={stepItemStyle(step === 'dropoff', step === 'details')}>3. {t('newShipping.steps.dropoff')}</span>
            <span style={{ color: themeColors.textTertiary }}>→</span>
            <span style={stepItemStyle(step === 'details', false)}>4. {t('newShipping.steps.details')}</span>
          </div>

          {step === 'client' && (
            <>
              <div style={searchContainerStyle}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: themeColors.textSecondary,
                  }}
                />
                <input
                  type="text"
                  placeholder={t('newShipping.searchPlaceholder')}
                  style={searchInputStyle}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={userListStyle}>
                {isLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: themeColors.textSecondary }}>
                    {t('newShipping.loading')}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: themeColors.textSecondary }}>
                    {t('newShipping.noClientFound')}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      style={userItemStyle}
                      onClick={() => handleClientSelect(user)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = themeColors.grayLight
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={getUserDisplayName(user)}
                          width={40}
                          height={40}
                          style={{
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: themeColors.cardBorder,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: themeColors.textSecondary,
                            fontSize: '14px',
                            fontWeight: 600,
                          }}
                        >
                          {getUserDisplayName(user)
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary }}>
                          {getUserDisplayName(user)}
                        </div>
                        {user.phone && (
                          <div style={{ fontSize: '12px', color: themeColors.textSecondary }}>{user.phone}</div>
                        )}
                      </div>
                      <User size={20} style={{ color: themeColors.bluePrimary }} />
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {step === 'pickup' && (
            <>
              {selectedClient && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: themeColors.grayLight, borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '4px' }}>{t('newShipping.selectedClient')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary }}>
                    {getUserDisplayName(selectedClient)}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <AddressAutocomplete
                  value={pickupAddress}
                  onChange={(address, coordinates) => {
                    setPickupAddress(address)
                    setPickupCoordinates(coordinates)
                  }}
                  placeholder={t('newShipping.pickupPlaceholder')}
                  label={
                    <span>
                      <MapPin size={16} style={{ display: 'inline', marginRight: '8px', color: themeColors.textSecondary, verticalAlign: 'middle' }} />
                      {t('newShipping.pickupLabel')}
                    </span>
                  }
                />
              </div>

              {/* Warning pour coordonnées GPS */}
              <div style={{
                padding: '12px',
                backgroundColor: themeColors.yellowLight,
                borderRadius: '8px',
                border: `1px solid ${themeColors.yellowDark}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginTop: '12px',
              }}>
                <AlertTriangle size={16} style={{ color: themeColors.yellowDark, marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: themeColors.yellowDark, marginBottom: '4px' }}>
                    {t('newB2BShipping.pickupGpsRequiredTitle')}
                  </div>
                  <div style={{ fontSize: '12px', color: themeColors.yellowDark }}>
                    {t('newB2BShipping.pickupGpsRequiredHint')}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 'dropoff' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <AddressAutocomplete
                  value={dropoffAddress}
                  onChange={(address, coordinates) => {
                    setDropoffAddress(address)
                    setDropoffCoordinates(coordinates)
                  }}
                  placeholder={t('newShipping.dropoffPlaceholder')}
                  label={
                    <span>
                      <MapPin size={16} style={{ display: 'inline', marginRight: '8px', color: themeColors.textSecondary, verticalAlign: 'middle' }} />
                      {t('newShipping.dropoffLabel')}
                    </span>
                  }
                />
              </div>

              {isEstimating && (
                <div style={{ padding: '12px', backgroundColor: themeColors.cardBg, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.textSecondary }}>{t('newShipping.calculatingPrice')}</div>
                </div>
              )}

              {!isEstimating && distance !== null && price !== null && (
                <div style={{ padding: '12px', backgroundColor: themeColors.purpleLight, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '4px' }}>{t('newShipping.estimate')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary }}>
                    {t('newShipping.distance')}: {distance} km • {t('newShipping.price')}: {price.toLocaleString(locale)} FCFA
                  </div>
                </div>
              )}
              {!isEstimating && (distance === null || price === null) && pickupAddress && dropoffAddress && (
                <div style={{ padding: '12px', backgroundColor: themeColors.yellowLight, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.yellowDark }}>
                    {t('newB2BShipping.dropoffQuoteGpsHint')}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'details' && (
            <>
              {/* Date et heure planifiée */}
              <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: themeColors.purpleLight, borderRadius: '8px', border: `1px solid ${themeColors.purplePrimary}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Calendar size={16} style={{ color: themeColors.purplePrimary }} />
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    {t('newB2BShipping.scheduledDateTimeLabel')}
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="date"
                      style={inputStyle}
                      value={scheduledDateValue}
                      onChange={(e) => setScheduledDateValue(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="time"
                      style={inputStyle}
                      value={scheduledTimeValue}
                      onChange={(e) => setScheduledTimeValue(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  <Package size={16} style={{ display: 'inline', marginRight: '8px', color: themeColors.textSecondary }} />
                  {t('newShipping.serviceLabel')}
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('moto')}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '8px',
                      border: `1px solid ${themeColors.purplePrimary}`,
                      backgroundColor: themeColors.purpleLight,
                      color: themeColors.purplePrimary,
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'default',
                    }}
                  >
                    Moto
                  </button>
                  <span style={{ fontSize: 12, color: themeColors.textSecondary }}>
                    {t('newShipping.vehicleCargoDisabled')}
                  </span>
                </div>
              </div>

              {isEstimating && (
                <div style={{ padding: '12px', backgroundColor: themeColors.cardBg, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.textSecondary }}>{t('newShipping.calculatingPrice')}</div>
                </div>
              )}

              {!isEstimating && distance !== null && price !== null && (
                <div style={{ padding: '12px', backgroundColor: themeColors.purpleLight, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '4px' }}>{t('newShipping.estimate')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary }}>
                    {t('newShipping.distance')}: {distance} km • {t('newShipping.price')}: {price.toLocaleString(locale)} FCFA
                  </div>
                </div>
              )}
              {!isEstimating && (distance === null || price === null) && pickupAddress && dropoffAddress && (
                <div style={{ padding: '12px', backgroundColor: themeColors.yellowLight, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: themeColors.yellowDark }}>
                    {t('newB2BShipping.detailsGpsHint')}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  <DollarSign size={16} style={{ display: 'inline', marginRight: '8px', color: themeColors.textSecondary }} />
                  {t('newShipping.paymentMethodLabel')}
                </label>
                <select
                  style={inputStyle}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                >
                  <option value="cash">{t('newShipping.cash')}</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="wave">Wave</option>
                  <option value="deferred">{t('newShipping.deferred')}</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('newShipping.recipientPhoneLabel')}</label>
                <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '8px' }}>
                  {t('newB2BShipping.recipientPhoneHint')}
                </div>
                <input
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  style={inputStyle}
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>

              {/* Détails de l'appel */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  {t('newB2BShipping.callDetailsLabel')}
                </label>
                <textarea
                  placeholder={t('newB2BShipping.callDetailsPlaceholder')}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  value={b2bNotes}
                  onChange={(e) => setB2bNotes(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('newB2BShipping.driverInstructionsLabel')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {B2B_INSTRUCTION_PRESETS[language].map((instruction) => {
                    const selected = selectedB2BInstructions.includes(instruction)
                    return (
                      <button
                        key={instruction}
                        type="button"
                        onClick={() => toggleB2BInstruction(instruction)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${selected ? themeColors.purplePrimary : themeColors.cardBorder}`,
                          backgroundColor: selected ? themeColors.purpleLight : themeColors.cardBg,
                          color: selected ? themeColors.purplePrimary : themeColors.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selected && <CheckCircle size={13} />}
                        {instruction}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('newB2BShipping.generalNotesLabel')}</label>
                <textarea
                  placeholder={t('newB2BShipping.generalNotesPlaceholder')}
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Notes pour le livreur */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  {t('newB2BShipping.driverNotesLabel')}
                </label>
                <textarea
                    placeholder={t('newB2BShipping.driverNotesPlaceholder')}
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                  value={driverNotes}
                  onChange={(e) => setDriverNotes(e.target.value)}
                />
              </div>

              {/* Badge entreprise toujours visible */}
              <div style={{
                padding: '12px',
                backgroundColor: themeColors.yellowLight,
                borderRadius: '8px',
                border: `1px solid ${themeColors.yellowDark}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: themeColors.yellowDark }}>📞</span>
                <span style={{ fontSize: '12px', color: themeColors.yellowDark }}>
                  {t('newB2BShipping.phoneOrderNotice')}
                </span>
              </div>
            </>
          )}
        </div>

        <div style={footerStyle}>
          {step !== 'client' && (
            <button
              type="button"
              onClick={() => {
                if (step === 'pickup') {
                  setStep('client')
                } else if (step === 'dropoff') {
                  setStep('pickup')
                } else if (step === 'details') {
                  setStep('dropoff')
                }
              }}
              style={{
                ...buttonStyle,
                backgroundColor: themeColors.cardBg,
                color: themeColors.textPrimary,
                border: `1px solid ${themeColors.cardBorder}`,
              }}
            >
              {t('newShipping.back')}
            </button>
          )}
          {step === 'client' && (
            <button
              type="button"
              onClick={onClose}
              style={{
                ...buttonStyle,
                backgroundColor: themeColors.cardBg,
                color: themeColors.textPrimary,
                border: `1px solid ${themeColors.cardBorder}`,
              }}
            >
              {t('newShipping.cancel')}
            </button>
          )}
          {step === 'pickup' && (
            <button
              type="button"
              onClick={handlePickupNext}
              disabled={!pickupAddress || !pickupCoordinates}
              style={{
                ...buttonStyle,
                backgroundColor: themeColors.purplePrimary,
                color: themeColors.textPrimary,
                opacity: !pickupAddress || !pickupCoordinates ? 0.5 : 1,
                cursor: !pickupAddress || !pickupCoordinates ? 'not-allowed' : 'pointer',
              }}
            >
              {t('newShipping.next')}
            </button>
          )}
          {step === 'dropoff' && (
            <button
              type="button"
              onClick={handleDropoffNext}
              disabled={!dropoffAddress || !dropoffCoordinates}
              style={{
                ...buttonStyle,
                backgroundColor: themeColors.purplePrimary,
                color: themeColors.textPrimary,
                opacity: !dropoffAddress || !dropoffCoordinates ? 0.5 : 1,
                cursor: !dropoffAddress || !dropoffCoordinates ? 'not-allowed' : 'pointer',
              }}
            >
              {t('newShipping.next')}
            </button>
          )}
          {step === 'details' && (
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={isCreating || !selectedClient || !pickupAddress || !pickupCoordinates || !dropoffAddress || !dropoffCoordinates || !scheduledDateValue || !scheduledTimeValue}
              style={{
                ...buttonStyle,
                backgroundColor: themeColors.purplePrimary,
                color: themeColors.textPrimary,
                opacity: isCreating || !selectedClient || !pickupAddress || !pickupCoordinates || !dropoffAddress || !dropoffCoordinates || !scheduledDateValue || !scheduledTimeValue ? 0.5 : 1,
                cursor: isCreating || !selectedClient || !pickupAddress || !pickupCoordinates || !dropoffAddress || !dropoffCoordinates || !scheduledDateValue || !scheduledTimeValue ? 'not-allowed' : 'pointer',
              }}
            >
              {isCreating ? t('newShipping.creating') : t('newB2BShipping.createOrder')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
