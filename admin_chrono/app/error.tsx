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

    if (process.env.NODE_ENV === "production") {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.captureException(error, { tags: { type: "page_error" } });
        })
        .catch(() => {});
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
