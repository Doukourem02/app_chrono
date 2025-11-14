'use client'

import React from 'react'
import { Phone, MessageSquare, Truck } from 'lucide-react'

interface DeliveryCardProps {
  delivery: {
    id: string
    shipmentNumber: string
    type: string
    status: string
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
  }
  isSelected?: boolean
  onSelect?: () => void
}

export default function DeliveryCard({ delivery, isSelected = false, onSelect }: DeliveryCardProps) {
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
    <div
      style={cardStyle}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#D1D5DB'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#E5E7EB'
        }
      }}
    >
      <div style={headerStyle}>
        <div style={shipmentInfoStyle}>
          <div style={vehicleIconStyle}>
            <Truck size={20} style={{ color: '#6B7280' }} />
          </div>
          <div>
            <div style={shipmentNumberStyle}>Shipment number {delivery.shipmentNumber}</div>
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
          <div style={avatarStyle}>C</div>
          <div style={partnerTextStyle}>
            <div style={partnerNameStyle}>Client</div>
            <div style={partnerAddressStyle}>Adresse de Livraison</div>
          </div>
        </div>
        <div style={contactButtonsStyle}>
          <button
            style={contactButtonStyle}
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
    </div>
  )
}

