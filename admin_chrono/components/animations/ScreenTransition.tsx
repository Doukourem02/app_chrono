'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface ScreenTransitionProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
  direction?: 'left' | 'right' | 'up' | 'down' | 'fade'
  duration?: number
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  children,
  direction = 'fade',
  duration = 0.3,
  style,
  ...props
}) => {
  const getInitial = () => {
    switch (direction) {
      case 'left':
        return { opacity: 0, x: -50 }
      case 'right':
        return { opacity: 0, x: 50 }
      case 'up':
        return { opacity: 0, y: -50 }
      case 'down':
        return { opacity: 0, y: 50 }
      default:
        return { opacity: 0 }
    }
  }

  const getAnimate = () => {
    switch (direction) {
      case 'left':
      case 'right':
        return { opacity: 1, x: 0 }
      case 'up':
      case 'down':
        return { opacity: 1, y: 0 }
      default:
        return { opacity: 1 }
    }
  }

  return (
    <motion.div
      initial={getInitial()}
      animate={getAnimate()}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 15,
        duration,
      }}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  )
}

