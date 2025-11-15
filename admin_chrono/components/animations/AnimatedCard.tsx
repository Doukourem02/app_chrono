'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'onClick'> {
  children: React.ReactNode
  index?: number
  delay?: number
  onClick?: () => void
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  index = 0,
  delay = 0,
  onClick,
  style,
  ...props
}) => {
  const animationDelay = (delay + index * 100) / 1000 // Convert to seconds for Framer Motion

  return (
    <motion.div
      initial={{ opacity: 1, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: animationDelay,
        type: 'spring',
        stiffness: 100,
        damping: 15,
      }}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...(style as React.CSSProperties),
      }}
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      {...props}
    >
      {children}
    </motion.div>
  )
}

