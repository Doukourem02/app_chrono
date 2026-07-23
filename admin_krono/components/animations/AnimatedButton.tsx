'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'onClick'> {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  style,
  ...props
}) => {
  const getVariantStyle = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: '#8B5CF6', color: '#FFFFFF' }
      case 'secondary':
        return { backgroundColor: '#F3F0FF', color: '#8B5CF6' }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          border: '2px solid #8B5CF6',
          color: '#8B5CF6',
        }
      default:
        return { backgroundColor: '#8B5CF6', color: '#FFFFFF' }
    }
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 15,
      }}
      style={{
        padding: '14px 24px',
        borderRadius: '12px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 600,
        ...getVariantStyle(),
        ...(style as React.CSSProperties),
      }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

