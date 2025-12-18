'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, User, Search, MapPin, Package, DollarSign } from 'lucide-react'
import Image from 'next/image'
import { adminApiService } from '@/lib/adminApiService'
import { useRouter } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'

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
  const [driverNotes, setDriverNotes] = useState('')

  // Calculated values
  const [distance, setDistance] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)

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
      console.error('Error loading users:', error)
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
            user.email.toLowerCase().includes(query) ||
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

  // Calculate distance and price - utilise une distance estimée par défaut
  // Le backend pourra géocoder les adresses et calculer la distance exacte
  useEffect(() => {
    // Distance estimée par défaut (le backend calculera la distance exacte via géocodage)
    const estimatedDistance = 5 // 5 km par défaut
    setDistance(estimatedDistance)
    const calculatedPrice = calculatePrice(estimatedDistance, deliveryMethod)
    setPrice(calculatedPrice)
  }, [deliveryMethod])

  const calculatePrice = (distance: number, method: string): number => {
    const basePrices: { [key: string]: { base: number; perKm: number } } = {
      moto: { base: 500, perKm: 200 },
      vehicule: { base: 800, perKm: 300 },
      cargo: { base: 1200, perKm: 450 },
    }

    const pricing = basePrices[method] || basePrices.vehicule
    return Math.round(pricing.base + distance * pricing.perKm)
  }

  const handleClientSelect = (user: UserData) => {
    setSelectedClient(user)
    setStep('pickup')
    setSearchQuery('')
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
    setDriverNotes('')
    setDistance(null)
    setPrice(null)
    setStep('client')
    setSearchQuery('')
  }, [])

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen, resetForm])

  const handleCreateOrder = async () => {
    // Validation
    if (!selectedClient || !pickupAddress || !dropoffAddress || !distance || !price) {
      alert('Veuillez remplir tous les champs obligatoires')
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
          details: recipientPhone ? { phone: recipientPhone } : undefined,
        },
        deliveryMethod,
        paymentMethodType: paymentMethod,
        distance,
        price,
        notes: notes || undefined,
        isPhoneOrder: isPhoneOrder || undefined,
        driverNotes: driverNotes || undefined,
      })

      if (result.success && result.data) {
        const orderId = (result.data as { id: string }).id
        resetForm()
        onClose()
        // Navigate to orders page with the new order
        router.push(`/orders?status=onProgress&orderId=${orderId}`)
      } else {
        alert(result.message || 'Impossible de créer la commande')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Une erreur est survenue lors de la création de la commande')
    } finally {
      setIsCreating(false)
    }
  }

  const getUserDisplayName = (user: UserData): string => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email
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
          <h2 style={titleStyle}>Nouvelle livraison</h2>
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
            <span style={stepItemStyle(step === 'client', false)}>1. Client</span>
            <span style={{ color: '#D1D5DB' }}>→</span>
            <span style={stepItemStyle(step === 'pickup', step === 'dropoff' || step === 'details')}>2. Pickup</span>
            <span style={{ color: '#D1D5DB' }}>→</span>
            <span style={stepItemStyle(step === 'dropoff', step === 'details')}>3. Dropoff</span>
            <span style={{ color: '#D1D5DB' }}>→</span>
            <span style={stepItemStyle(step === 'details', false)}>4. Détails</span>
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
                  placeholder="Rechercher un client..."
                  style={searchInputStyle}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={userListStyle}>
                {isLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                    Chargement...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                    Aucun client trouvé
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
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>{user.email}</div>
                        {user.phone && (
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{user.phone}</div>
                        )}
                      </div>
                      <User size={20} style={{ color: '#2563EB' }} />
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {step === 'pickup' && (
            <>
              {selectedClient && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Client sélectionné</div>
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
                  placeholder="Ex: Cocody, Abidjan"
                  label={
                    <span>
                      <MapPin size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280', verticalAlign: 'middle' }} />
                      Adresse de pickup
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
                  placeholder="Ex: Yopougon, Abidjan"
                  label={
                    <span>
                      <MapPin size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280', verticalAlign: 'middle' }} />
                      Adresse de livraison
                    </span>
                  }
                />
              </div>

              {distance !== null && price !== null && (
                <div style={{ padding: '12px', backgroundColor: '#F3E8FF', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Estimation</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    Distance: {distance} km • Prix: {price.toLocaleString('fr-FR')} FCFA
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
                  Méthode de livraison
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {(['moto', 'vehicule', 'cargo'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setDeliveryMethod(method)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${deliveryMethod === method ? '#8B5CF6' : '#E5E7EB'}`,
                        backgroundColor: deliveryMethod === method ? '#F3E8FF' : '#FFFFFF',
                        color: deliveryMethod === method ? '#8B5CF6' : '#6B7280',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {method === 'moto' ? 'Moto' : method === 'vehicule' ? 'Véhicule' : 'Cargo'}
                    </button>
                  ))}
                </div>
              </div>

              {distance !== null && price !== null && (
                <div style={{ padding: '12px', backgroundColor: '#F3E8FF', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Estimation</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    Distance: {distance} km • Prix: {price.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  <DollarSign size={16} style={{ display: 'inline', marginRight: '8px', color: '#6B7280' }} />
                  Méthode de paiement
                </label>
                <select
                  style={inputStyle}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                >
                  <option value="cash">Espèces</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="wave">Wave</option>
                  <option value="deferred">Différé</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Téléphone destinataire (optionnel)</label>
                <input
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  style={inputStyle}
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notes (optionnel)</label>
                <textarea
                  placeholder="Instructions spéciales..."
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
                      Commande téléphonique / Hors ligne
                    </label>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Cochez si le client a appelé pour créer cette commande
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
                        Commande hors ligne - Les coordonnées GPS ne sont pas nécessaires. Le livreur appellera le client pour obtenir la position exacte.
                      </span>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ ...labelStyle, marginBottom: '4px' }}>
                        Notes pour le livreur (optionnel)
                      </label>
                      <textarea
                        placeholder="Instructions spéciales pour le livreur (ex: Appeler le client pour position exacte)..."
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
              Retour
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
              Annuler
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
              Suivant
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
              Suivant
            </button>
          )}
          {step === 'details' && (
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={isCreating || !distance || !price}
              style={{
                ...buttonStyle,
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                opacity: isCreating || !distance || !price ? 0.5 : 1,
                cursor: isCreating || !distance || !price ? 'not-allowed' : 'pointer',
              }}
            >
              {isCreating ? 'Création...' : 'Créer la commande'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

