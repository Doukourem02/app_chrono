'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshIndicatorProps {
  progress: number
  refreshing: boolean
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  progress,
  refreshing,
}) => {
  const rotation = refreshing ? 360 : progress * 180
  const scale = refreshing ? 1 : Math.max(0.5, progress)
  const opacity = refreshing ? 1 : Math.max(0, progress)

  return (
    <motion.div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
      }}
      animate={{
        rotate: refreshing ? 360 : rotation,
        scale,
        opacity,
      }}
      transition={
        refreshing
          ? {
              rotate: {
                duration: 1,
                repeat: Infinity,
                ease: 'linear',
              },
              scale: {
                type: 'spring',
                damping: 10,
                stiffness: 100,
              },
              opacity: {
                duration: 0.2,
              },
            }
          : {
              duration: 0.2,
            }
      }
    >
      <RefreshCw size={24} color="#8B5CF6" />
    </motion.div>
  )
}

