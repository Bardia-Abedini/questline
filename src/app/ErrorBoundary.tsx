import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRouteError } from 'react-router';
import { Button, EmptyState } from '@/ui';

function ErrorFallback({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation('common');
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="py-10">
      <EmptyState
        icon="lantern"
        title={t('error.title')}
        action={
          <>
            {onRetry && (
              <Button variant="primary" icon="refresh" onClick={onRetry}>
                {t('error.retry')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('error.reload')}
            </Button>
          </>
        }
      >
        <p>{t('error.body')}</p>
        {import.meta.env.DEV && (
          <details className="mt-3 text-start text-xs">
            <summary className="cursor-pointer">{t('error.details')}</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap">{message}</pre>
          </details>
        )}
      </EmptyState>
    </div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  /** Changing this value clears the error (e.g. the current path). */
  resetKey?: unknown;
}

interface BoundaryState {
  error: unknown;
  resetKey: unknown;
}

/** Catches render errors in a subtree and shows a calm fallback with a retry. */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <ErrorFallback error={this.state.error} onRetry={() => this.setState({ error: null })} />
      );
    }
    return this.props.children;
  }
}

/** Error boundary that resets when the route changes, so navigating away recovers. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

/** `errorElement` for the router (loader/action errors and errors outside the boundaries). */
export function RouteErrorElement() {
  const error = useRouteError();
  return (
    <main id="main" className="p-6">
      <ErrorFallback error={error} />
    </main>
  );
}
