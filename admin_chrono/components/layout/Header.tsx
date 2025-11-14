'use client'

import { Search, Bell, Calendar, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [query, setQuery] = useState('')

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '28px',
    boxShadow: '0 15px 35px rgba(15,23,42,0.08)',
    border: '1px solid #F3F4F6',
    paddingLeft: '16px',
    paddingRight: '24px',
    paddingTop: '12px',
    paddingBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  }

  const searchContainerStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
  }

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '20px',
    height: '20px',
    color: '#9CA3AF',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '16px',
    paddingTop: '10px',
    paddingBottom: '10px',
    backgroundColor: '#F5F6FA',
    borderRadius: '16px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
  }

  const buttonsContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    backgroundColor: 'transparent',
    color: '#6B7280',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  }

  const monthButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    gap: '8px',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '10px',
    paddingBottom: '10px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  }

  const notificationButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    position: 'relative',
    color: '#4B5563',
  }

  const notificationDotStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '10px',
    height: '10px',
    backgroundColor: '#EF4444',
    borderRadius: '50%',
  }

  return (
    <div style={headerStyle}>
      <div style={searchContainerStyle}>
        <Search style={searchIconStyle} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search orders, drivers, customers..."
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)'
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = 'none'
          }}
        />
      </div>

      <div style={buttonsContainerStyle}>
        <button
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <SlidersHorizontal size={20} />
        </button>
        <button
          style={monthButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <span style={{ color: '#6B7280' }}>Ce mois</span>
          <Calendar size={16} style={{ color: '#6B7280' }} />
        </button>
        <button
          style={notificationButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Bell size={20} />
          <span style={notificationDotStyle}></span>
        </button>
      </div>
    </div>
  )
}
