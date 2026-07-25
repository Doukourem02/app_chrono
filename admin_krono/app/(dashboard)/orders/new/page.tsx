'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Search } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { themeColors } from '@/utils/theme'
import AddressAutocomplete from '@/components/AddressAutocomplete'

type DeliveryMethod = 'moto' | 'vehicule' | 'cargo'
type PaymentMethodType = 'orange_money' | 'wave' | 'cash' | 'deferred'

interface ClientInfo {
  id: string
  phone: string
  first_name: string | null
  last_name: string | null
}

const DELIVERY_METHODS: { value: DeliveryMethod; label: string }[] = [
  { value: 'moto', label: 'Moto' },
  { value: 'vehicule', label: 'Véhicule' },
  { value: 'cargo', label: 'Cargo' },
]

const PAYMENT_METHODS: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'wave', label: 'Wave' },
  { value: 'deferred', label: 'Différé' },
]

export default function NewAdminOrderPage() {
  const router = useRouter()

  // Étape 1 : client (recherche/création par téléphone)
  const [clientPhone, setClientPhone] = useState('')
  const [clientFirstName, setClientFirstName] = useState('')
  const [clientLastName, setClientLastName] = useState('')
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [clientLoading, setClientLoading] = useState(false)
  const [clientError, setClientError] = useState('')
  const [clientAlreadyExisted, setClientAlreadyExisted] = useState<boolean | null>(null)

  // Étape 2 : commande
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [recipientPhone, setRecipientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('moto')
  const [paymentMethodType, setPaymentMethodType] = useState<PaymentMethodType>('cash')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [priceCfa, setPriceCfa] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleFindOrCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientPhone.trim()) {
      setClientError('Numéro de téléphone requis')
      return
    }
    setClientLoading(true)
    setClientError('')
    const result = await adminApiService.createMinimalClient({
      phone: clientPhone.trim(),
      firstName: clientFirstName.trim() || undefined,
      lastName: clientLastName.trim() || undefined,
    })
    setClientLoading(false)
    if (!result.success || !result.data) {
      setClientError(result.message || 'Impossible de trouver ou créer ce client')
      return
    }
    setClient(result.data)
    setClientAlreadyExisted(result.alreadyExisted ?? null)
  }

  const estimatePrice = async (
    pickup?: { latitude: number; longitude: number },
    dropoff?: { latitude: number; longitude: number },
  ) => {
    if (!pickup || !dropoff) return
    setIsEstimating(true)
    const estimation = await adminApiService.calculateOrderEstimate({
      pickupCoordinates: pickup,
      dropoffCoordinates: dropoff,
      deliveryMethod,
    })
    setIsEstimating(false)
    if (estimation.success && estimation.data) {
      setDistanceKm(estimation.data.distance)
      setPriceCfa(estimation.data.price)
    } else {
      setDistanceKm(null)
      setPriceCfa(null)
    }
  }

  const canCreateOrder =
    !!client &&
    !!pickupCoordinates &&
    !!dropoffCoordinates &&
    pickupAddress.trim().length > 0 &&
    dropoffAddress.trim().length > 0 &&
    recipientPhone.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) {
      setSubmitError('Recherchez ou créez d’abord le client par téléphone')
      return
    }
    if (!pickupCoordinates || !dropoffCoordinates) {
      setSubmitError('Sélectionnez les adresses de collecte et de livraison dans les suggestions')
      return
    }
    if (!recipientPhone.trim()) {
      setSubmitError('Le téléphone du destinataire est obligatoire')
      return
    }
    setSubmitting(true)
    setSubmitError('')

    const result = await adminApiService.createOrder({
      userId: client.id,
      pickup: { address: pickupAddress.trim(), coordinates: pickupCoordinates },
      dropoff: {
        address: dropoffAddress.trim(),
        coordinates: dropoffCoordinates,
        details: { phone: recipientPhone.trim() },
      },
      deliveryMethod,
      paymentMethodType,
      distance: distanceKm ?? undefined,
      price: priceCfa ?? undefined,
      notes: notes.trim() || undefined,
      isPhoneOrder: true,
    })

    setSubmitting(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => router.push('/orders'), 1600)
    } else {
      setSubmitError(result.message || 'Erreur lors de la création de la commande')
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: themeColors.textSecondary,
    display: 'block',
    marginBottom: 6,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${themeColors.cardBorder}`,
    backgroundColor: themeColors.background,
    color: themeColors.textPrimary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    border: `1px solid ${themeColors.cardBorder}`,
    borderRadius: 12,
    padding: '24px 28px',
  }

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <CheckCircle size={48} color={themeColors.greenPrimary} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: themeColors.textPrimary }}>Commande créée !</h2>
        <p style={{ fontSize: 14, color: themeColors.textSecondary }}>Redirection vers les commandes…</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: 13, cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> Retour
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Nouvelle commande (téléphone)</h1>
      </div>

      {/* Étape 1 : client */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 12 }}>1. Client</h2>
        {client ? (
          <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.greenLight, border: `1px solid ${themeColors.greenPrimary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: themeColors.textPrimary, margin: 0 }}>
                {[client.first_name, client.last_name].filter(Boolean).join(' ') || client.phone}
              </p>
              <p style={{ fontSize: 12, color: themeColors.textSecondary, margin: '2px 0 0' }}>
                {client.phone} — {clientAlreadyExisted ? 'compte existant' : 'compte créé à l’instant'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setClient(null); setClientAlreadyExisted(null) }}
              style={{ background: 'none', border: 'none', color: themeColors.textSecondary, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Changer
            </button>
          </div>
        ) : (
          <form onSubmit={handleFindOrCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Téléphone du client *</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+225 0504243434"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Prénom (optionnel)</label>
                <input value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nom (optionnel)</label>
                <input value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {clientError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.redLight, border: `1px solid ${themeColors.redPrimary}` }}>
                <p style={{ fontSize: 13, color: themeColors.redPrimary, margin: 0 }}>{clientError}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={clientLoading}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: clientLoading ? 'not-allowed' : 'pointer', opacity: clientLoading ? 0.6 : 1 }}
            >
              <Search size={14} /> {clientLoading ? 'Recherche…' : 'Trouver / créer le client'}
            </button>
          </form>
        )}
      </div>

      {/* Étape 2 : commande, seulement une fois le client résolu */}
      {client && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 12 }}>2. Détails de la commande</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Adresse de collecte *</label>
              <AddressAutocomplete
                value={pickupAddress}
                onChange={(address, coordinates) => {
                  setPickupAddress(address)
                  setPickupCoordinates(coordinates)
                  setDistanceKm(null)
                  setPriceCfa(null)
                  if (coordinates && dropoffCoordinates) void estimatePrice(coordinates, dropoffCoordinates)
                }}
                placeholder="Ex: Rue L12, Cocody, Abidjan"
              />
            </div>

            <div>
              <label style={labelStyle}>Adresse de livraison *</label>
              <AddressAutocomplete
                value={dropoffAddress}
                onChange={(address, coordinates) => {
                  setDropoffAddress(address)
                  setDropoffCoordinates(coordinates)
                  setDistanceKm(null)
                  setPriceCfa(null)
                  if (coordinates && pickupCoordinates) void estimatePrice(pickupCoordinates, coordinates)
                }}
                placeholder="Ex: Riviera 2, Cocody, Abidjan"
              />
            </div>

            <div>
              <label style={labelStyle}>Téléphone du destinataire *</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+225 0504243434"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Précisions pour le livreur</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: colis fragile, code portail…" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Type de véhicule</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DELIVERY_METHODS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDeliveryMethod(value)
                      if (pickupCoordinates && dropoffCoordinates) void estimatePrice(pickupCoordinates, dropoffCoordinates)
                    }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `2px solid ${deliveryMethod === value ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: deliveryMethod === value ? themeColors.purpleLight : 'transparent', color: deliveryMethod === value ? themeColors.purplePrimary : themeColors.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Méthode de paiement</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethodType(value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: `2px solid ${paymentMethodType === value ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: paymentMethodType === value ? themeColors.purpleLight : 'transparent', color: paymentMethodType === value ? themeColors.purplePrimary : themeColors.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(isEstimating || (distanceKm !== null && priceCfa !== null)) && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.purpleLight, border: `1px solid ${themeColors.purplePrimary}` }}>
                <p style={{ fontSize: 13, color: themeColors.purplePrimary, margin: 0 }}>
                  {isEstimating ? 'Calcul du prix en cours…' : `Estimation: ${distanceKm?.toFixed(1)} km • ${priceCfa?.toLocaleString('fr-FR')} FCFA`}
                </p>
              </div>
            )}

            {submitError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.redLight, border: `1px solid ${themeColors.redPrimary}` }}>
                <p style={{ fontSize: 13, color: themeColors.redPrimary, margin: 0 }}>{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !canCreateOrder}
              style={{ padding: '12px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: submitting || !canCreateOrder ? 'not-allowed' : 'pointer', opacity: submitting || !canCreateOrder ? 0.55 : 1 }}
            >
              {submitting ? 'Création en cours…' : 'Créer la commande'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
