'use client'

import React from 'react'
import Image from 'next/image'
import { Phone, MessageSquare, Truck } from 'lucide-react'
import { AnimatedCard } from '@/components/animations'
import { formatDeliveryId } from '@/utils/formatDeliveryId'
import { logger } from '@/utils/logger'

interface DeliveryCardProps {
  delivery: {
    id: string
    shipmentNumber: string
    type: string
    status: string
    createdAt?: string
    pickup: {
      name: string
      address: string
      coordinates?: { lat: number; lng: number } | null
    }
    dropoff: {
      name: string
      address: string
      coordinates?: { lat: number; lng: number } | null
    }
    driverId?: string
    userId?: string
    client?: {
      id: string
      email: string
      full_name?: string
      phone?: string
      avatar_url?: string
      role?: string
    } | null
    driver?: {
      id: string
      email: string
      full_name?: string
      phone?: string
      avatar_url?: string
    } | null
  }
  isSelected?: boolean
  onSelect?: () => void
  index?: number
}

export default function DeliveryCard({ delivery, isSelected = false, onSelect, index = 0 }: DeliveryCardProps) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    border: isSelected ? '2px solid #8B5CF6' : '1px solid #E5E7EB',
    marginBottom: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  }

  const shipmentInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const vehicleIconStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    backgroundColor: '#F3F4F6',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const shipmentNumberStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '4px',
  }

  const typeStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  const routeStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  }

  const routePointStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  }

  const pointIndicatorStyle = (isPickup: boolean): React.CSSProperties => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: isPickup ? '#10B981' : '#8B5CF6',
    marginTop: '4px',
    flexShrink: 0,
  })

  const pointInfoStyle: React.CSSProperties = {
    flex: 1,
  }

  const pointNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '2px',
  }

  const pointAddressStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  const routeLineStyle: React.CSSProperties = {
    width: '2px',
    height: '20px',
    backgroundColor: '#E5E7EB',
    marginLeft: '5px',
  }

  const partnerSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid #E5E7EB',
  }

  const partnerInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const avatarStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#9333EA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '14px',
  }

  const partnerTextStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
  }

  const partnerNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '2px',
  }

  const partnerAddressStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  const contactButtonsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const contactButtonStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  }

  const notificationDotStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#EF4444',
  }

  return (
    <AnimatedCard
      index={index}
      delay={0}
      onClick={onSelect}
      style={cardStyle}
    >
      <div style={headerStyle}>
        <div style={shipmentInfoStyle}>
          <div style={vehicleIconStyle}>
            <Truck size={20} style={{ color: '#6B7280' }} />
          </div>
          <div>
            <div style={shipmentNumberStyle}>
              {formatDeliveryId(delivery.id, delivery.createdAt)}
            </div>
            <div style={typeStyle}>Type {delivery.type}</div>
          </div>
        </div>
      </div>

      <div style={routeStyle}>
        <div style={routePointStyle}>
          <div style={pointIndicatorStyle(true)}></div>
          <div style={pointInfoStyle}>
            <div style={pointNameStyle}>{delivery.pickup.name}</div>
            <div style={pointAddressStyle}>{delivery.pickup.address}</div>
          </div>
        </div>
        <div style={routeLineStyle}></div>
        <div style={routePointStyle}>
          <div style={pointIndicatorStyle(false)}></div>
          <div style={pointInfoStyle}>
            <div style={pointNameStyle}>{delivery.dropoff.name}</div>
            <div style={pointAddressStyle}>{delivery.dropoff.address}</div>
          </div>
        </div>
      </div>

      <div style={partnerSectionStyle}>
        <div style={partnerInfoStyle}>
          {(() => {
            // Priorité au client pour l'affichage
            const person = delivery.client || delivery.driver
            const isDriver = !!delivery.driver && !delivery.client
            
            // Debug: logger les données pour comprendre le problème
            if (process.env.NODE_ENV === 'development') {
              logger.debug('[DeliveryCard] Delivery data:', {
                deliveryId: delivery.id,
                hasClient: !!delivery.client,
                hasDriver: !!delivery.driver,
                clientData: delivery.client,
                driverData: delivery.driver,
                person: person,
                personFullName: person?.full_name,
                personEmail: person?.email,
                personAvatarUrl: person?.avatar_url,
                displayName: (person?.full_name && person.full_name.trim()) 
                  ? person.full_name.trim() 
                  : (person?.email || (isDriver ? 'Livreur' : 'Client')),
              })
            }
            
            // Pour le client : utiliser full_name, sinon email, sinon "Client"
            // Pour le driver : utiliser full_name, sinon email, sinon "Livreur"
            // Si full_name existe mais est vide, utiliser email
            const displayName = (person?.full_name && person.full_name.trim()) 
              ? person.full_name.trim() 
              : (person?.email || (isDriver ? 'Livreur' : 'Client'))
            
            const displayLabel = isDriver 
              ? 'Drive' 
              : (delivery.client?.role === 'partner' || delivery.client?.role === 'Partner' ? 'Partners' : 'Client')
            
            const displayAddress = delivery.dropoff.address || 'Adresse de Livraison'
            const avatarUrl = person?.avatar_url
            
            // Générer les initiales à partir du nom complet ou de l'email
            const getInitials = (name: string | undefined, email: string | undefined): string => {
              if (name && name.trim()) {
                // Si c'est un nom complet, prendre les premières lettres de chaque mot
                const parts = name.trim().split(/\s+/)
                if (parts.length >= 2) {
                  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                }
                return name.charAt(0).toUpperCase()
              }
              if (email) {
                return email.charAt(0).toUpperCase()
              }
              return isDriver ? 'L' : 'C'
            }
            
            const initial = getInitials(person?.full_name, person?.email)

            return (
              <>
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={40}
                    height={40}
                    style={{
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div style={avatarStyle}>{initial}</div>
                )}
                <div style={partnerTextStyle}>
                  <div style={{ ...partnerNameStyle, fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#6B7280' }}>
                    {displayLabel}
                  </div>
                  <div style={{ ...partnerNameStyle, fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                    {displayName}
                  </div>
                  <div style={partnerAddressStyle}>{displayAddress}</div>
                </div>
              </>
            )
          })()}
        </div>
        <div style={contactButtonsStyle}>
          <button
            style={contactButtonStyle}
            onClick={(e) => {
              e.stopPropagation()
              const person = delivery.driver || delivery.client
              if (person?.phone) {
                window.location.href = `tel:${person.phone}`
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Phone size={20} style={{ color: '#4B5563' }} />
          </button>
          <button
            style={contactButtonStyle}
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Ouvrir le chat
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <MessageSquare size={20} style={{ color: '#4B5563' }} />
            <span style={notificationDotStyle}></span>
          </button>
        </div>
      </div>
    </AnimatedCard>
  )
}

