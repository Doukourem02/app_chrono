import React from 'react';
import { ErrorModal } from './ErrorModal';
import { DeferredPaymentErrorModal } from './DeferredPaymentErrorModal';
import { useErrorModalStore } from '../../store/useErrorModalStore';
import { useDeferredPaymentErrorStore } from '../../store/useDeferredPaymentErrorStore';

/**
 * Provider pour afficher les modals d'erreur globalement
 * À placer à la racine de l'application
 */
export const ErrorModalsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visible, error } = useErrorModalStore();
  const {
    visible: deferredPaymentVisible,
    error: deferredPaymentError,
  } = useDeferredPaymentErrorStore();

  // Toujours rendre les composants de manière stable
  // Les composants gèrent eux-mêmes le onClose via le store
  return (
    <>
      {children}
      <ErrorModal
        visible={visible}
        error={error}
      />
      <DeferredPaymentErrorModal
        visible={deferredPaymentVisible}
        error={deferredPaymentError}
      />
    </>
  );
};

