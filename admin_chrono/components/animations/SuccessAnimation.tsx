'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface SuccessAnimationProps {
  size?: number
  color?: string
  onAnimationComplete?: () => void
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  size = 80,
  color = '#10B981',
  onAnimationComplete,
}) => {
  useEffect(() => {
    if (onAnimationComplete) {
      const timer = setTimeout(() => {
        onAnimationComplete()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [onAnimationComplete])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 10,
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: 'spring',
            stiffness: 150,
            damping: 8,
          }}
        >
          <Check size={size * 0.6} color="#FFFFFF" strokeWidth={3} />
        </motion.div>
      </motion.div>
    </div>
  )
}

