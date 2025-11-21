import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';
import { captureError } from '../../utils/sentry';
import ErrorScreen from './ErrorScreen';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Logger l'erreur (visible uniquement dans les logs, pas à l'utilisateur)
    logger.error('ErrorBoundary caught an error:', 'ErrorBoundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });

    // En production, envoyer à Sentry
    if (!__DEV__) {
      captureError(error, {
        componentStack: errorInfo.componentStack,
        type: 'error_boundary',
      });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // En production, ne jamais afficher les détails techniques à l'utilisateur
      return (
        <ErrorScreen
          title="Une erreur est survenue"
          message="Désolé, une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support si le problème persiste."
          showRetry={true}
          showHome={true}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

