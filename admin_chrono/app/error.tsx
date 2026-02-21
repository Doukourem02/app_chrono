"use client";

import ErrorPage from "@/components/error/ErrorPage";
import { logger } from "@/utils/logger";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    
    logger.error("Page error caught:", {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });

    // En production, envoyer à un service de monitoring si nécessaire
    if (process.env.NODE_ENV === "production") {
      // TODO: Intégrer Sentry ou autre service de monitoring
      // Sentry.captureException(error, { tags: { type: 'page_error' } })
    }
  }, [error]);

  return (
    <ErrorPage
      title="Une erreur est survenue"
      message="Désolé, une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support si le problème persiste."
      showRetry={true}
      showHome={true}
      onRetry={reset}
    />
  );
}
