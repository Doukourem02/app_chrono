'use client'

import React, { useMemo, useCallback } from 'react'
import { ErrorModal } from './ErrorModal'
import { useErrorModalStore } from '@/store/useErrorModalStore'

/**
 * Provider pour afficher les modals d'erreur globalement
 * À placer dans le Providers principal
 */
export const ErrorModalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visible, error, hideError } = useErrorModalStore()

  const handleClose = useCallback(() => {
    if (error?.onClose) {
      error.onClose()
    }
    hideError()
  }, [error, hideError])

  const errorWithClose = useMemo(() => {
    if (!error) return null
    return {
      ...error,
      onClose: handleClose,
    }
  }, [error, handleClose])

  return (
    <>
      {children}
      <ErrorModal
        visible={visible}
        error={errorWithClose}
      />
    </>
  )
}

