'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Phone, User } from 'lucide-react'
import { partnerApiService, type PartnerDriver, type PartnerDriverRequestType } from '@/lib/partnerApiService'
import { themeColors } from '@/utils/theme'
import AddressAutocomplete from '@/components/AddressAutocomplete'

interface FormState {
  pickup_address: string
  dropoff_address: string
  recipient_name: string
  recipient_phone: string
  notes: string
  delivery_method: 'moto'
  course_type: 'express' | 'standard' | 'scheduled'
}

const COURSE_TYPES = [
  { value: 'express', label: 'Express', description: 'Course prioritaire en moto' },
  { value: 'standard', label: 'Standard', description: 'Même service moto, rythme normal' },
  { value: 'scheduled', label: 'Programmée', description: 'À planifier avec l’équipe Krono' },
]

const B2B_INSTRUCTION_PRESETS = [
  'Appeler le client avant d’arriver',
  'Voir le responsable sur place',
  'Déposer à l’accueil',
  'Demander le code de livraison',
  'Colis fragile, manipuler doucement',
  'Compter les colis avec le client',
]

const FIELDS: Array<{ key: keyof FormState; label: string; type: string; placeholder: string; required?: boolean }> = [
  { key: 'recipient_name',   label: 'Nom du destinataire *',    type: 'text', placeholder: 'Ibrahima Diallo',               required: true },
  { key: 'recipient_phone',  label: 'Téléphone du destinataire *', type: 'tel', placeholder: '+221 77 000 00 00',          required: true },
  { key: 'notes',            label: 'Instruction personnalisée',     type: 'text', placeholder: 'Carton fragile, code portail…' },
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
    delivery_method: 'moto',
    course_type: 'express',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [preferredDriversEnabled, setPreferredDriversEnabled] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [partnerDrivers, setPartnerDrivers] = useState<PartnerDriver[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [priceCfa, setPriceCfa] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [selectedInstructionPresets, setSelectedInstructionPresets] = useState<string[]>([])
  const [showDriverRequest, setShowDriverRequest] = useState(false)
  const [driverRequest, setDriverRequest] = useState({
    request_type: 'general_request' as PartnerDriverRequestType,
    driver_name: '',
    driver_phone: '',
    comment: '',
  })
  const [driverRequestLoading, setDriverRequestLoading] = useState(false)
  const [driverRequestDone, setDriverRequestDone] = useState(false)

  const canEstimate = !!pickupCoordinates && !!dropoffCoordinates
  const canCreateOrder =
    !!pickupCoordinates &&
    !!dropoffCoordinates &&
    form.pickup_address.trim().length > 0 &&
    form.dropoff_address.trim().length > 0 &&
    form.recipient_name.trim().length > 0 &&
    form.recipient_phone.trim().length > 0

  const toggleInstructionPreset = (instruction: string) => {
    setSelectedInstructionPresets((current) =>
      current.includes(instruction)
        ? current.filter((item) => item !== instruction)
        : [...current, instruction]
    )
  }

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => {
      if (createdOrderId) {
        router.push(`/partner/${partnerId}/orders/${createdOrderId}/tracking`)
      } else {
        router.push(`/partner/${partnerId}/orders`)
      }
    }, 1600)
    return () => clearTimeout(timer)
  }, [createdOrderId, partnerId, router, success])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setDriversLoading(true)
      const [details, drivers] = await Promise.all([
        partnerApiService.getDetails(partnerId),
        partnerApiService.getDrivers(partnerId),
      ])
      if (!mounted) return
      setPreferredDriversEnabled(details.data?.use_preferred_drivers === true)
      setPartnerDrivers(drivers.data ?? [])
      const defaultDriver = (drivers.data ?? []).find((d) => d.is_default && d.profile.accepts_b2b_orders)
      setSelectedDriverId(defaultDriver?.driver_user_id ?? null)
      setDriversLoading(false)
    }
    void load()
    return () => {
      mounted = false
    }
  }, [partnerId])

  const estimatePrice = async (
    pickup?: { latitude: number; longitude: number },
    dropoff?: { latitude: number; longitude: number },
    courseType = form.course_type,
  ) => {
    if (!pickup || !dropoff) return
    setIsEstimating(true)
    const estimation = await partnerApiService.calculateOrderEstimate({
      pickupCoordinates: pickup,
      dropoffCoordinates: dropoff,
      deliveryMethod: 'moto',
      speedOptionId: courseType,
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

  const handlePreferredDriversToggle = async (enabled: boolean) => {
    setPreferredDriversEnabled(enabled)
    if (!enabled) setSelectedDriverId(null)
    const result = await partnerApiService.updatePreferences(partnerId, {
      use_preferred_drivers: enabled,
    })
    if (!result.success) {
      setPreferredDriversEnabled(!enabled)
      setError("Impossible de mettre à jour la préférence de livreur dédié.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const required: (keyof FormState)[] = ['pickup_address', 'dropoff_address', 'recipient_name', 'recipient_phone']
    for (const f of required) {
      if (!form[f].trim()) { setError(`Le champ "${FIELDS.find(x => x.key === f)?.label.replace(' *','')}" est requis`); return }
    }
    if (!pickupCoordinates || !dropoffCoordinates) {
      setError('Sélectionnez le point de collecte et l’adresse du client dans les suggestions autocomplete pour fixer le quartier, la rue et le point GPS.')
      return
    }
    setLoading(true)
    setError('')

    const combinedNotes = [...selectedInstructionPresets, form.notes.trim()].filter(Boolean).join('\n') || undefined

    const result = await partnerApiService.createOrder(partnerId, {
      pickup_address:  form.pickup_address.trim(),
      dropoff_address: form.dropoff_address.trim(),
      recipient:       { name: form.recipient_name.trim(), phone: form.recipient_phone.trim() },
      notes:           combinedNotes,
      delivery_method: form.delivery_method,
      course_type: form.course_type,
      preferred_driver_id: preferredDriversEnabled ? selectedDriverId ?? undefined : undefined,
      pickup_coordinates: pickupCoordinates,
      dropoff_coordinates: dropoffCoordinates,
      distance_km: distanceKm ?? undefined,
      price_cfa: priceCfa ?? undefined,
    })

    setLoading(false)
    if (result.success) {
      const resultData = result.data as { orderId?: string } | undefined
      setCreatedOrderId(resultData?.orderId ?? null)
      setSuccess(true)
    } else {
      setError((result as { message?: string }).message ?? 'Erreur lors de la création de la commande.')
    }
  }

  const submitDriverRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setDriverRequestLoading(true)
    setError('')
    const result = await partnerApiService.createDriverRequest(partnerId, {
      request_type: driverRequest.request_type,
      driver_name: driverRequest.driver_name.trim() || undefined,
      driver_phone: driverRequest.driver_phone.trim() || undefined,
      comment: driverRequest.comment.trim() || undefined,
    })
    setDriverRequestLoading(false)
    if (result.success) {
      setDriverRequestDone(true)
      setShowDriverRequest(false)
      setDriverRequest({ request_type: 'general_request', driver_name: '', driver_phone: '', comment: '' })
    } else {
      setError((result as { message?: string }).message ?? 'Impossible d’envoyer la demande de livreur dédié.')
    }
  }

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <CheckCircle size={48} color={themeColors.greenPrimary} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: themeColors.textPrimary }}>Commande créée !</h2>
        <p style={{ fontSize: 14, color: themeColors.textSecondary }}>
          {createdOrderId ? 'Ouverture du suivi de livraison…' : 'Redirection vers vos commandes…'}
        </p>
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
                  void estimatePrice(coordinates, dropoffCoordinates)
                }
              }}
              placeholder="Ex: Rue L12, Cocody, Abidjan"
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
                  void estimatePrice(pickupCoordinates, coordinates)
                }
              }}
              placeholder="Ex: Riviera 2, Cocody, Abidjan"
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

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>
              Consignes pour le livreur
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {B2B_INSTRUCTION_PRESETS.map((instruction) => {
                const selected = selectedInstructionPresets.includes(instruction)
                return (
                  <button
                    key={instruction}
                    type="button"
                    onClick={() => toggleInstructionPreset(instruction)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${selected ? themeColors.purplePrimary : themeColors.cardBorder}`,
                      backgroundColor: selected ? themeColors.purpleLight : themeColors.background,
                      color: selected ? themeColors.purplePrimary : themeColors.textSecondary,
                      fontSize: 12,
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

          {/* Service / véhicule */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Service disponible</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{ padding: '8px 16px', borderRadius: 8, border: `2px solid ${themeColors.purplePrimary}`, backgroundColor: themeColors.purpleLight, color: themeColors.purplePrimary, fontSize: 13, fontWeight: 600, cursor: 'default' }}
              >
                Moto
              </button>
              <span style={{ fontSize: 12, color: themeColors.textSecondary }}>Voiture et cargo ne sont pas actifs côté client.</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: themeColors.textSecondary, display: 'block', marginBottom: 8 }}>Type de course</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {COURSE_TYPES.map(({ value, label, description }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const nextCourseType = value as FormState['course_type']
                    setForm(f => ({ ...f, course_type: nextCourseType }))
                    if (pickupCoordinates && dropoffCoordinates) {
                      void estimatePrice(pickupCoordinates, dropoffCoordinates, nextCourseType)
                    }
                  }}
                  style={{ padding: '10px 12px', textAlign: 'left', borderRadius: 8, border: `2px solid ${form.course_type === value ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: form.course_type === value ? themeColors.purpleLight : 'transparent', color: form.course_type === value ? themeColors.purplePrimary : themeColors.textPrimary, fontSize: 13, fontWeight: form.course_type === value ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <span style={{ display: 'block' }}>{label}</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: themeColors.textSecondary, fontWeight: 400 }}>{description}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: themeColors.textPrimary }}>Prioriser un livreur dédié</div>
                <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 3 }}>
                  Krono propose d’abord la commande au livreur sélectionné. Sans livreur dédié disponible, l’assignation automatique prend le relais.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handlePreferredDriversToggle(!preferredDriversEnabled)}
                aria-label="Activer la priorisation d’un livreur dédié"
                aria-pressed={preferredDriversEnabled}
                style={{ width: 48, height: 28, borderRadius: 999, border: 'none', padding: 3, backgroundColor: preferredDriversEnabled ? themeColors.purplePrimary : '#D1D5DB', cursor: 'pointer' }}
              >
                <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', backgroundColor: '#fff', transform: preferredDriversEnabled ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.15s' }} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {driversLoading ? (
                <div style={{ fontSize: 13, color: themeColors.textSecondary }}>Chargement des livreurs…</div>
              ) : partnerDrivers.length === 0 ? (
                <div style={{ border: `1px dashed ${themeColors.cardBorder}`, borderRadius: 8, padding: 14, color: themeColors.textSecondary, fontSize: 13 }}>
                  <p style={{ margin: 0 }}>Aucun livreur dédié n’est encore lié à ce partenaire. L’assignation automatique reste active pour les livreurs entreprise disponibles.</p>
                  <button
                    type="button"
                    onClick={() => setShowDriverRequest(true)}
                    style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeColors.purplePrimary}`, backgroundColor: 'transparent', color: themeColors.purplePrimary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Demander un livreur dédié
                  </button>
                </div>
              ) : preferredDriversEnabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedDriverId(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, border: `2px solid ${selectedDriverId === null ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: selectedDriverId === null ? themeColors.purpleLight : '#fff', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#F3F4F6', color: themeColors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: themeColors.textPrimary }}>Assignation automatique</div>
                      <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                        Tous les livreurs entreprise disponibles restent éligibles.
                      </div>
                    </div>
                  </button>

                  {partnerDrivers.map((driver) => {
                    const firstName = driver.driver.first_name ?? ''
                    const lastName = driver.driver.last_name ?? ''
                    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Livreur Krono'
                    const canSelect = driver.profile.accepts_b2b_orders
                    const selected = selectedDriverId === driver.driver_user_id
                    return (
                      <button
                        key={driver.id}
                        type="button"
                        disabled={!canSelect}
                        onClick={() => setSelectedDriverId(driver.driver_user_id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, border: `2px solid ${selected ? themeColors.purplePrimary : themeColors.cardBorder}`, backgroundColor: selected ? themeColors.purpleLight : '#fff', cursor: canSelect ? 'pointer' : 'not-allowed', opacity: canSelect ? 1 : 0.55, textAlign: 'left' }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: themeColors.purpleLight, color: themeColors.purplePrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {driver.driver.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={driver.driver.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <User size={18} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: themeColors.textPrimary }}>{name}</div>
                          <div style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                            {driver.profile.is_online && driver.profile.is_available ? 'Disponible' : 'Indisponible'}
                            {!canSelect ? ' • ne reçoit pas les commandes entreprise' : ''}
                          </div>
                        </div>
                        {driver.driver.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: themeColors.textSecondary }}>
                            <Phone size={13} /> {driver.driver.phone}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </>
              ) : null}
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
                Sélectionnez le point de collecte et l’adresse du client dans les suggestions pour enregistrer les quartiers, rues et points GPS.
              </p>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.redLight, border: `1px solid ${themeColors.redPrimary}` }}>
              <p style={{ fontSize: 13, color: themeColors.redPrimary }}>{error}</p>
            </div>
          )}

          {driverRequestDone && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: themeColors.greenLight, border: `1px solid ${themeColors.greenPrimary}` }}>
              <p style={{ fontSize: 13, color: themeColors.greenPrimary }}>Demande envoyée à Krono.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canCreateOrder}
            style={{ padding: '12px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !canCreateOrder ? 'not-allowed' : 'pointer', opacity: loading || !canCreateOrder ? 0.55 : 1, marginTop: 4 }}
          >
            {loading ? 'Création en cours…' : 'Créer la commande'}
          </button>
        </form>
      </div>

      {showDriverRequest && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 460, backgroundColor: themeColors.cardBg, borderRadius: 12, padding: 22, border: `1px solid ${themeColors.cardBorder}` }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: themeColors.textPrimary }}>Demander un livreur dédié</h2>
            <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 6 }}>
              Vous souhaitez un livreur dédié ? Envoyez une demande à Krono. Notre équipe vérifie le livreur et l’ajoute à votre compte si tout est conforme.
            </p>
            <form onSubmit={submitDriverRequest} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select
                value={driverRequest.request_type}
                onChange={(e) => setDriverRequest((f) => ({ ...f, request_type: e.target.value as PartnerDriverRequestType }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14 }}
              >
                <option value="general_request">Je veux un livreur dédié</option>
                <option value="known_driver">Je connais déjà le livreur</option>
                <option value="previous_krono_driver">J’ai rencontré ce livreur via Krono</option>
              </select>
              <input
                value={driverRequest.driver_name}
                onChange={(e) => setDriverRequest((f) => ({ ...f, driver_name: e.target.value }))}
                placeholder="Nom du livreur si connu"
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14 }}
              />
              <input
                value={driverRequest.driver_phone}
                onChange={(e) => setDriverRequest((f) => ({ ...f, driver_phone: e.target.value }))}
                placeholder="Téléphone du livreur si connu"
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14 }}
              />
              <textarea
                value={driverRequest.comment}
                onChange={(e) => setDriverRequest((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Zone, horaires, volume, habitudes…"
                rows={4}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowDriverRequest(false)} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: 'transparent', color: themeColors.textPrimary, fontSize: 13, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" disabled={driverRequestLoading} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: driverRequestLoading ? 'not-allowed' : 'pointer', opacity: driverRequestLoading ? 0.6 : 1 }}>
                  {driverRequestLoading ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
