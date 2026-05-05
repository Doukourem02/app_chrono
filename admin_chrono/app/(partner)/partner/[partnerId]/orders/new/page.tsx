'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { partnerApiService } from '@/lib/partnerApiService'
import { themeColors } from '@/utils/theme'
import AddressAutocomplete from '@/components/AddressAutocomplete'

interface FormState {
  pickup_address: string
  dropoff_address: string
  recipient_name: string
  recipient_phone: string
  notes: string
  vehicle_type: string
}

const VEHICLE_TYPES = [
  { value: 'moto',   label: 'Moto' },
  { value: 'velo',   label: 'Vélo' },
  { value: 'voiture', label: 'Voiture' },
]

const FIELDS: Array<{ key: keyof FormState; label: string; type: string; placeholder: string; required?: boolean }> = [
  { key: 'recipient_name',   label: 'Nom du destinataire *',    type: 'text', placeholder: 'Ibrahima Diallo',               required: true },
  { key: 'recipient_phone',  label: 'Téléphone du destinataire *', type: 'tel', placeholder: '+221 77 000 00 00',          required: true },
  { key: 'notes',            label: 'Instructions livreur',     type: 'text', placeholder: 'Carton fragile, code portail…' },
]

export default function NewPartnerOrderPage() {
  const { partnerId } = useParams<{ partnerId: string }>()
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    pickup_address: '',
    dropoff_address: '',
    recipient_name: '',
    recipient_phone: '',
    notes: '',
    vehicle_type: 'moto',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [priceCfa, setPriceCfa] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  const canEstimate = !!pickupCoordinates && !!dropoffCoordinates

  const estimatePrice = async (vehicleType: string, pickup?: { latitude: number; longitude: number }, dropoff?: { latitude: number; longitude: number }) => {
    if (!pickup || !dropoff) return
    setIsEstimating(true)
    const method = vehicleType === 'moto' ? 'moto' : vehicleType === 'velo' ? 'vehicule' : 'vehicule'
    const estimation = await partnerApiService.calculateOrderEstimate({
      pickupCoordinates: pickup,
      dropoffCoordinates: dropoff,
      deliveryMethod: method,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const required: (keyof FormState)[] = ['pickup_address', 'dropoff_address', 'recipient_name', 'recipient_phone']
    for (const f of required) {
      if (!form[f].trim()) { setError(`Le champ "${FIELDS.find(x => x.key === f)?.label.replace(' *','')}" est requis`); return }
    }
    setLoading(true)
    setError('')

    const result = await partnerApiService.createOrder(partnerId, {
      pickup_address:  form.pickup_address.trim(),
      dropoff_address: form.dropoff_address.trim(),
      recipient:       { name: form.recipient_name.trim(), phone: form.recipient_phone.trim() },
      notes:           form.notes.trim() || undefined,
      vehicle_type:    form.vehicle_type,
      pickup_coordinates: pickupCoordinates,
      dropoff_coordinates: dropoffCoordinates,
      distance_km: distanceKm ?? undefined,
      price_cfa: priceCfa ?? undefined,
    })

    setLoading(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => router.push(`/partner/${partnerId}/orders`), 2000)
    } else {
      setError((result as { message?: string }).message ?? 'Erreur lors de la création de la commande.')
    }
  }

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <CheckCircle size={48} color={themeColors.greenPrimary} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: themeColors.textPrimary }}>Commande créée !</h2>
        <p style={{ fontSize: 14, color: themeColors.textSecondary }}>Redirection vers vos commandes…</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: 13, cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> Retour
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Nouvelle commande</h1>
      </div>

      {/* Formulaire */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '24px 28px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>
              Adresse de collecte *
            </label>
            <AddressAutocomplete
              value={form.pickup_address}
              onChange={(address, coordinates) => {
                setForm((f) => ({ ...f, pickup_address: address }))
                setPickupCoordinates(coordinates)
                setDistanceKm(null)
                setPriceCfa(null)
                if (coordinates && dropoffCoordinates) {
                  void estimatePrice(form.vehicle_type, coordinates, dropoffCoordinates)
                }
              }}
              placeholder="Ex: 12 rue des Almadies, Dakar"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>
              Adresse de livraison *
            </label>
            <AddressAutocomplete
              value={form.dropoff_address}
              onChange={(address, coordinates) => {
                setForm((f) => ({ ...f, dropoff_address: address }))
                setDropoffCoordinates(coordinates)
                setDistanceKm(null)
                setPriceCfa(null)
                if (coordinates && pickupCoordinates) {
                  void estimatePrice(form.vehicle_type, pickupCoordinates, coordinates)
                }
              }}
              placeholder="Ex: Marché Sandaga, Dakar"
            />
          </div>

          {FIELDS.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.background, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          {/* Type de véhicule */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Type de véhicule</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {VEHICLE_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, vehicle_type: value }))
                    if (pickupCoordinates && dropoffCoordinates) {
                      void estimatePrice(value, pickupCoordinates, dropoffCoordinates)
                    }
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: `2px solid ${form.vehicle_type === value ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: form.vehicle_type === value ? themeColors.purpleLight : 'transparent', color: form.vehicle_type === value ? themeColors.purplePrimary : themeColors.textPrimary, fontSize: 13, fontWeight: form.vehicle_type === value ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(isEstimating || (distanceKm !== null && priceCfa !== null)) && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.purpleLight, border: `1px solid ${themeColors.purplePrimary}` }}>
              <p style={{ fontSize: 13, color: themeColors.purplePrimary }}>
                {isEstimating
                  ? 'Calcul du prix en cours…'
                  : `Estimation: ${distanceKm?.toFixed(1)} km • ${priceCfa?.toLocaleString('fr-FR')} FCFA`}
              </p>
            </div>
          )}

          {form.pickup_address && form.dropoff_address && !canEstimate && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.redLight, border: `1px solid ${themeColors.redPrimary}` }}>
              <p style={{ fontSize: 13, color: themeColors.redPrimary }}>
                Sélectionnez une adresse dans les suggestions pour calculer le prix correctement.
              </p>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.redLight, border: `1px solid ${themeColors.redPrimary}` }}>
              <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? 'Création en cours…' : 'Créer la commande'}
          </button>
        </form>
      </div>
    </div>
  )
}
