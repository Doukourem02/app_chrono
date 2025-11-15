'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'

interface TrackingMarkerProps {
  latitude?: number
  longitude?: number
  color?: string
  size?: number
}

export const TrackingMarker: React.FC<TrackingMarkerProps> = ({
  color = '#8B5CF6',
  size = 40,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      {/* Cercle pulsant */}
      <motion.div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.3,
        }}
        animate={{
          scale: [1, 2, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Marqueur principal */}
      <motion.div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          zIndex: 1,
        }}
        animate={{
          y: [0, -5, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <MapPin size={size * 0.6} color="#FFFFFF" fill="#FFFFFF" />
      </motion.div>
    </div>
  )
}

