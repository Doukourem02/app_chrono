'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface SkeletonLoaderProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: React.CSSProperties
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  return (
    <motion.div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#E5E7EB',
        ...style,
      }}
      animate={{
        opacity: [0.3, 0.7, 0.3],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

