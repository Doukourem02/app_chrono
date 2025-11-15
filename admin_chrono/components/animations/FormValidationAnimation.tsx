'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'

interface FormValidationAnimationProps {
  isValid: boolean
  message?: string
  show?: boolean
}

export const FormValidationAnimation: React.FC<FormValidationAnimationProps> = ({
  isValid,
  message,
  show = true,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 10,
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '8px',
          }}
        >
          <motion.div
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 10,
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '12px',
              backgroundColor: isValid ? '#D1FAE5' : '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px',
            }}
          >
            {isValid ? (
              <CheckCircle2 size={20} color="#10B981" />
            ) : (
              <XCircle size={20} color="#EF4444" />
            )}
          </motion.div>
          {message && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: isValid ? '#10B981' : '#EF4444',
              }}
            >
              {message}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

