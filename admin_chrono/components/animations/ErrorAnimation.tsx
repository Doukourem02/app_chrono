'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ErrorAnimationProps {
  size?: number
  color?: string
  onAnimationComplete?: () => void
}

export const ErrorAnimation: React.FC<ErrorAnimationProps> = ({
  size = 80,
  color = '#EF4444',
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
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{
            delay: 0.2,
            type: 'spring',
            stiffness: 150,
            damping: 8,
            rotate: {
              duration: 0.4,
              times: [0, 0.25, 0.5, 1],
            },
          }}
        >
          <X size={size * 0.6} color="#FFFFFF" strokeWidth={3} />
        </motion.div>
      </motion.div>
    </div>
  )
}

