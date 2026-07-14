import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. If not provided, the default is used. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Optional name for this boundary (shown in the fallback UI for debugging). */
  name?: string;
  /** Called when an error is caught. Useful for logging. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React error boundary that catches rendering errors and displays a
 * graceful fallback UI instead of unmounting the whole tree.
 *
 * Usage:
 *   <ErrorBoundary name="Dashboard" onError={(e) => logError(e)}>
 *     <DashboardPage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return (this.props.fallback as (error: Error, reset: () => void) => ReactNode)(
            this.state.error,
            this.handleReset,
          );
        }
        return this.props.fallback;
      }

      return <DefaultErrorFallback error={this.state.error} name={this.props.name} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  name,
  onReset,
}: {
  error: Error;
  name?: string;
  onReset: () => void;
}) {
  return (
    <div className="error-boundary-fallback" role="alert">
      <div className="error-boundary-icon" aria-hidden="true">!</div>
      <h2>Something went wrong</h2>
      {name ? (
        <p className="error-boundary-location">
          Error in <strong>{name}</strong>
        </p>
      ) : null}
      <p className="error-boundary-message">
        {error.message || "An unexpected error occurred while rendering this section."}
      </p>
      <details className="error-boundary-details">
        <summary>Technical details</summary>
        <pre>{error.stack}</pre>
      </details>
      <div className="error-boundary-actions">
        <button type="button" className="primary-action" onClick={onReset}>
          Try again
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
