'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, User, Search, MapPin, Package, DollarSign } from 'lucide-react'
import Image from 'next/image'
import { adminApiService } from '@/lib/adminApiService'
import { useRouter } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { logger } from '@/utils/logger'
import { getPhoneValidationError } from '@/utils/phoneValidation'
import { APPROXIMATE_PICKUP_ZONE_OPTIONS, APPROXIMATE_PICKUP_CITIES } from '@/lib/approximatePickupZones'
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

interface NewShippingModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function NewShippingModal({
  isOpen,
  onClose,
}: NewShippingModalProps) {
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
  const [isPhoneOrder, setIsPhoneOrder] = useState(false)
  const [approximatePickupZone, setApproximatePickupZone] = useState('')
  const [driverNotes, setDriverNotes] = useState('')

  // Rattachement optionnel à un partenaire B2B (commande passée en son nom)
  const [partners, setPartners] = useState<import('@/types').Partner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')

  // Création d'un client qui n'existe pas encore dans la base
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientFirstName, setNewClientFirstName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientLoading, setNewClientLoading] = useState(false)
  const [newClientError, setNewClientError] = useState('')

  // Calculated values
  const [distance, setDistance] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await adminApiService.getUsers()
      if (result.success && result.data) {
        const allUsers = result.data as UserData[]
        
        // Filtrer strictement pour ne garder QUE les clients
        // Exclure explicitement: drivers, admins, super_admins, et utilisateurs sans rôle
        const clients = allUsers.filter((user) => {
          const role = user.role?.toLowerCase().trim()
          // Ne garder que les utilisateurs avec role === 'client' exactement
          return role === 'client'
        })
        
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
    if (!isOpen || step !== 'details' || partners.length > 0 || partnersLoading) return
    setPartnersLoading(true)
    adminApiService
      .getPartners({ status: 'active' })
      .then((result) => {
        if (result.success && result.data) setPartners(result.data)
      })
      .catch((error) => logger.error('Error loading partners:', error))
      .finally(() => setPartnersLoading(false))
  }, [isOpen, step, partners.length, partnersLoading])

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim()
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
          logger.error('Error calculating estimate:', error)
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

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientPhone.trim()) {
      setNewClientError(t('newShipping.alerts.phoneRequired'))
      return
    }
    const phoneErr = getPhoneValidationError(newClientPhone.trim())
    if (phoneErr) {
      setNewClientError(phoneErr)
      return
    }
    setNewClientLoading(true)
    setNewClientError('')
    try {
      const result = await adminApiService.createMinimalClient({
        phone: newClientPhone.trim(),
        firstName: newClientFirstName.trim() || undefined,
        lastName: newClientLastName.trim() || undefined,
      })
      if (!result.success || !result.data) {
        setNewClientError(result.message || t('newShipping.alerts.createClientFailed'))
        return
      }
      setSelectedClient({
        id: result.data.id,
        email: result.data.email,
        phone: result.data.phone,
        first_name: result.data.first_name,
        last_name: result.data.last_name,
        role: 'client',
      })
      // Un client créé à la volée pendant l'appel est par défaut une commande téléphonique.
      setIsPhoneOrder(true)
      setStep('pickup')
      setShowCreateClient(false)
      setSearchQuery('')
    } catch (error) {
      logger.error('Error creating new client:', error)
      setNewClientError(t('newShipping.alerts.createClientError'))
    } finally {
      setNewClientLoading(false)
    }
  }

  const handlePickupNext = () => {
    if (pickupAddress) {
      setStep('dropoff')
    }
  }

  const handleDropoffNext = () => {
    if (dropoffAddress) {
      setStep('details')
    }
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
    setIsPhoneOrder(false)
    setApproximatePickupZone('')
    setDriverNotes('')
    setDistance(null)
    setPrice(null)
    setStep('client')
    setSearchQuery('')
    setShowCreateClient(false)
    setNewClientPhone('')
    setNewClientFirstName('')
    setNewClientLastName('')
    setNewClientError('')
    setSelectedPartnerId('')
  }, [])

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

    const destPhone = recipientPhone.trim()
    if (!destPhone) {
      alert(t('newShipping.alerts.recipientPhoneRequired'))
      return
    }
    const phoneErr = getPhoneValidationError(destPhone)
    if (phoneErr) {
      alert(phoneErr)
      return
    }

    const hasPickupGps =
      !!pickupCoordinates &&
      typeof pickupCoordinates.latitude === 'number' &&
      typeof pickupCoordinates.longitude === 'number'
    if (isPhoneOrder && !hasPickupGps && !approximatePickupZone.trim()) {
      alert(t('newShipping.alerts.zoneRequired'))
      return
    }

    setIsCreating(true)
    try {
      const result = await adminApiService.createOrder({
        userId: selectedClient.id,
        pickup: {
          address: pickupAddress,
          coordinates: pickupCoordinates, // Coordonnées depuis l'autocomplétion
        },
        dropoff: {
          address: dropoffAddress,
          coordinates: dropoffCoordinates, // Coordonnées depuis l'autocomplétion
          details: { phone: destPhone },
        },
        deliveryMethod,
        paymentMethodType: paymentMethod,
        distance: distance ?? undefined,
        price: price ?? undefined,
        notes: notes || undefined,
        isPhoneOrder: isPhoneOrder || undefined,
        isB2BOrder: false, // isB2BOrderEffective côté serveur devient true dès que partnerId est fourni
        partnerId: selectedPartnerId || undefined,
        driverNotes: driverNotes || undefined,
        approximatePickupZone:
          isPhoneOrder && !hasPickupGps ? approximatePickupZone.trim() || undefined : undefined,
      })

        if (result.success && result.data) {
          const orderId = result.data.id
          const deliveryCode = result.data.recipientDeliveryCode || result.data.deliveryVerificationCode
          const smsStatus = result.data.deliveryCodeSms?.status
          // Jouer le son de succès
          const { soundService } = await import('@/utils/soundService')
          if (process.env.NODE_ENV === 'development') {
            logger.debug('[NewShippingModal] Tentative de jouer le son de succès')
          }
          soundService.playSuccess().catch((err) => {
            logger.warn('[NewShippingModal] Erreur lecture son succès:', err)
          })
          if (deliveryCode) {
            const smsLabel =
              smsStatus === 'sent'
                ? t('newShipping.alerts.smsSent')
                : smsStatus === 'failed'
                  ? t('newShipping.alerts.smsFailed')
                  : t('newShipping.alerts.smsUnknown')
            alert(t('newShipping.alerts.orderCreated', { code: deliveryCode, smsLabel }))
          }
          resetForm()
          onClose()
          // Navigate to orders page with the new order
          router.push(`/orders?status=onProgress&orderId=${orderId}`)
      } else {
        alert(result.message || t('newShipping.alerts.createOrderFailed'))
      }
    } catch (error) {
      logger.error('Error creating order:', error)
      alert(t('newShipping.alerts.createOrderError'))
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

  // Geocoding function (simplified - in production, use Google Geocoding API)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _geocodeAddress = async (_address: string): Promise<{ lat: number; lng: number } | null> => {
    // For now, return null - admin will need to manually enter coordinates
    // In production, integrate with Google Geocoding API
    return null
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
    backgroundColor: '#FFFFFF',
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
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    color: '#111827',
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
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
    marginTop: '8px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
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
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
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
    borderTop: '1px solid #E5E7EB',
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
    borderBottom: '1px solid #E5E7EB',
  }

  const stepItemStyle: (isActive: boolean, isCompleted: boolean) => React.CSSProperties = (isActive, isCompleted) => ({
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: isActive ? '#8B5CF6' : isCompleted ? '#D1FAE5' : '#F3F4F6',
    color: isActive ? '#FFFFFF' : isCompleted ? '#059669' : '#6B7280',
  })

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('newShipping.title')}</h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div style={contentStyle}>
          <div style={stepIndicatorStyle}>
            <span style={stepItemStyle(step === 'client', false)}>1. {t('newShipping.steps.client')}</span>
            <span style={{ color: '#D1D5DB' }}>→</span>
            <span style={stepItemStyle(step === 'pickup', step === 'dropoff' || step === 'details')}>2. {t('newShipping.steps.pickup')}</span>
            <span style={{ color: '#D1D5DB' }}>→</span>
            <span style={stepItemStyle(step === 'dropoff', step === 'details')}>3. {t('newShipping.steps.dropoff')}</span>
            <span style={{ color: '#D1D5DB' }}>→</span>
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
                    color: '#6B7280',
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
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                    {t('newShipping.loading')}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                    {t('newShipping.noClientFound')}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      style={userItemStyle}
                      onClick={() => handleClientSelect(user)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F9FAFB'
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
                            backgroundColor: '#E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6B7280',
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
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                          {getUserDisplayName(user)}
                        </div>
                        {user.phone && (
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{user.phone}</div>
                        )}
                      </div>
                      <User size={20} style={{ color: '#2563EB' }} />
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                {!showCreateClient ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateClient(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8B5CF6',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {t('newShipping.createClientLink')}
                  </button>
                ) : (
                  <form onSubmit={handleCreateNewClient} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={labelStyle}>{t('newShipping.newClientLabel')}</div>
                    <input
                      type="tel"
                      placeholder={t('newShipping.newClientPhonePlaceholder')}
                      style={inputStyle}
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="text"
                        placeholder={t('newShipping.firstNamePlaceholder')}
                        style={{ ...inputStyle, flex: 1 }}
                        value={newClientFirstName}
                        onChange={(e) => setNewClientFirstName(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder={t('newShipping.lastNamePlaceholder')}
                        style={{ ...inputStyle, flex: 1 }}
                        value={newClientLastName}
                        onChange={(e) => setNewClientLastName(e.target.value)}
                      />
                    </div>
                    {newClientError && (
                      <div style={{ fontSize: '12px', color: '#DC2626' }}>{newClientError}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="submit"
                        disabled={newClientLoading}
                        style={{
                          ...buttonStyle,
                          backgroundColor: '#8B5CF6',
                          color: '#FFFFFF',
                          opacity: newClientLoading ? 0.6 : 1,
                          cursor: newClientLoading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {newClientLoading ? t('newShipping.creating') : t('newShipping.createAndContinue')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateClient(false)
                          setNewClientError('')
                        }}
                        style={{
                          ...buttonStyle,
                          backgroundColor: '#FFFFFF',
                          color: '#374151',
                          border: '1px solid #E5E7EB',
                        }}
                      >
                        {t('newShipping.cancel')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

          {step === 'pickup' && (
            <>
              {selectedClient && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{t('newShipping.selectedClient')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
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
                      <MapPin size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280', verticalAlign: 'middle' }} />
                      {t('newShipping.pickupLabel')}
                    </span>
                  }
                />
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
                      <MapPin size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280', verticalAlign: 'middle' }} />
                      {t('newShipping.dropoffLabel')}
                    </span>
                  }
                />
              </div>

              {isEstimating && (
                <div style={{ padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>{t('newShipping.calculatingPrice')}</div>
                </div>
              )}

              {!isEstimating && distance !== null && price !== null && (
                <div style={{ padding: '12px', backgroundColor: '#F3E8FF', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{t('newShipping.estimate')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {t('newShipping.distance')}: {distance} km • {t('newShipping.price')}: {price.toLocaleString(locale)} FCFA
                  </div>
                </div>
              )}
              {!isEstimating && (distance === null || price === null) && pickupAddress && dropoffAddress && (
                <div style={{ padding: '12px', backgroundColor: '#FEF3C7', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#92400E' }}>
                    {t('newShipping.quoteUnavailableHint')}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'details' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  <Package size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280' }} />
                  {t('newShipping.serviceLabel')}
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('moto')}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '8px',
                      border: '1px solid #8B5CF6',
                      backgroundColor: '#F3E8FF',
                      color: '#8B5CF6',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'default',
                    }}
                  >
                    Moto
                  </button>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    {t('newShipping.vehicleCargoDisabled')}
                  </span>
                </div>
              </div>

              {isEstimating && (
                <div style={{ padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>{t('newShipping.calculatingPrice')}</div>
                </div>
              )}

              {!isEstimating && distance !== null && price !== null && (
                <div style={{ padding: '12px', backgroundColor: '#F3E8FF', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{t('newShipping.estimate')}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {t('newShipping.distance')}: {distance} km • {t('newShipping.price')}: {price.toLocaleString(locale)} FCFA
                  </div>
                </div>
              )}
              {!isEstimating && (distance === null || price === null) && pickupAddress && dropoffAddress && (
                <div style={{ padding: '12px', backgroundColor: '#FEF3C7', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#92400E' }}>
                    {t('newShipping.quoteUnavailableHintDetails')}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('newShipping.partnerLabel')}</label>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                  {t('newShipping.partnerHint')}
                </div>
                <select
                  style={inputStyle}
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                >
                  <option value="">{t('newShipping.partnerNone')}</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
                {partnersLoading && (
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{t('newShipping.partnersLoading')}</div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  <DollarSign size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280' }} />
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
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                  {t('newShipping.recipientPhoneHint')}
                </div>
                <input
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  style={inputStyle}
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('newShipping.notesLabel')}</label>
                <textarea
                  placeholder={t('newShipping.notesPlaceholder')}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Toggle Commande téléphonique / Hors ligne */}
              <div style={{ 
                marginBottom: '16px', 
                padding: '16px', 
                backgroundColor: isPhoneOrder ? '#FEF3C7' : '#F3F4F6', 
                borderRadius: '8px',
                border: `1px solid ${isPhoneOrder ? '#F59E0B' : '#E5E7EB'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPhoneOrder ? '12px' : '0' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px', cursor: 'pointer' }}>
                      {t('newShipping.phoneOrderLabel')}
                    </label>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      {t('newShipping.phoneOrderHint')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPhoneOrder}
                    onChange={(e) => setIsPhoneOrder(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      marginLeft: '12px',
                    }}
                  />
                </div>
                {isPhoneOrder && (
                  <>
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#FFFFFF', 
                      borderRadius: '6px', 
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B' }}>⚠️</span>
                      <span style={{ fontSize: '12px', color: '#92400E' }}>
                        {t('newShipping.noGpsWarning')}
                      </span>
                    </div>
                    {(!pickupCoordinates ||
                      typeof pickupCoordinates.latitude !== 'number' ||
                      typeof pickupCoordinates.longitude !== 'number') && (
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>
                          {t('newShipping.zoneLabel')}
                        </label>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                          {t('newShipping.zoneHint')}
                        </div>
                        <select
                          style={inputStyle}
                          value={approximatePickupZone}
                          onChange={(e) => setApproximatePickupZone(e.target.value)}
                          required
                        >
                          <option value="">{t('newShipping.zonePlaceholder')}</option>
                          {APPROXIMATE_PICKUP_CITIES.map((city) => (
                            <optgroup key={city} label={city}>
                              {APPROXIMATE_PICKUP_ZONE_OPTIONS.filter((z) => z.city === city).map((z) => (
                                <option key={z.value} value={z.value}>
                                  {z.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ ...labelStyle, marginBottom: '4px' }}>
                        {t('newShipping.driverNotesLabel')}
                      </label>
                      <textarea
                        placeholder={t('newShipping.driverNotesPlaceholder')}
                        style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                        value={driverNotes}
                        onChange={(e) => setDriverNotes(e.target.value)}
                      />
                    </div>
                  </>
                )}
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
                backgroundColor: '#FFFFFF',
                color: '#374151',
                border: '1px solid #E5E7EB',
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
                backgroundColor: '#FFFFFF',
                color: '#374151',
                border: '1px solid #E5E7EB',
              }}
            >
              {t('newShipping.cancel')}
            </button>
          )}
          {step === 'pickup' && (
            <button
              type="button"
              onClick={handlePickupNext}
              disabled={!pickupAddress}
              style={{
                ...buttonStyle,
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                opacity: !pickupAddress ? 0.5 : 1,
                cursor: !pickupAddress ? 'not-allowed' : 'pointer',
              }}
            >
              {t('newShipping.next')}
            </button>
          )}
          {step === 'dropoff' && (
            <button
              type="button"
              onClick={handleDropoffNext}
              disabled={!dropoffAddress}
              style={{
                ...buttonStyle,
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                opacity: !dropoffAddress ? 0.5 : 1,
                cursor: !dropoffAddress ? 'not-allowed' : 'pointer',
              }}
            >
              {t('newShipping.next')}
            </button>
          )}
          {step === 'details' && (
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={isCreating || !selectedClient || !pickupAddress || !dropoffAddress}
              style={{
                ...buttonStyle,
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                opacity: isCreating || !selectedClient || !pickupAddress || !dropoffAddress ? 0.5 : 1,
                cursor: isCreating || !selectedClient || !pickupAddress || !dropoffAddress ? 'not-allowed' : 'pointer',
              }}
            >
              {isCreating ? t('newShipping.creating') : t('newShipping.createOrder')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
