'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface AnimatedBottomSheetProps {
  children: React.ReactNode
  visible: boolean
  onClose?: () => void
  height?: number
  style?: React.CSSProperties
}

export const AnimatedBottomSheet: React.FC<AnimatedBottomSheetProps> = ({
  children,
  visible,
  onClose,
  height = 400,
  style,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
            }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: height }}
            animate={{ y: 0 }}
            exit={{ y: height }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > height / 3 && onClose) {
                onClose()
              }
            }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${height}px`,
              maxHeight: '90%',
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '20px',
              boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.25)',
              zIndex: 9999,
              overflow: 'auto',
              ...style,
            }}
          >
            {/* Handle */}
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#D1D5DB',
                borderRadius: '2px',
                margin: '0 auto 16px',
              }}
            />
            {children}
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} color="#6B7280" />
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

