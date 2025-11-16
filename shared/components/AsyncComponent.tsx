// ========================================
// Async Component Pattern
// ========================================
// Standard pattern for loading/error/empty states

import React, { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

// ========================================
// LOADING SKELETON
// ========================================

export const CardSkeleton: React.FC = () => {
  return (
    <Card className="bg-gray-900 border-gray-800 animate-pulse">
      <CardContent className="p-6">
        <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-800 rounded"></div>
          <div className="h-4 bg-gray-800 rounded w-5/6"></div>
          <div className="h-4 bg-gray-800 rounded w-4/6"></div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ListItemSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg animate-pulse">
      <div className="w-12 h-12 bg-gray-800 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-800 rounded w-1/4"></div>
        <div className="h-3 bg-gray-800 rounded w-1/2"></div>
      </div>
      <div className="h-8 w-20 bg-gray-800 rounded"></div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 bg-gray-900 border border-gray-800 rounded animate-pulse">
          <div className="h-4 bg-gray-800 rounded flex-1"></div>
          <div className="h-4 bg-gray-800 rounded w-24"></div>
          <div className="h-4 bg-gray-800 rounded w-32"></div>
        </div>
      ))}
    </div>
  );
};

// ========================================
// LOADING COMPONENT
// ========================================

export const LoadingState: React.FC<{
  message?: string;
  fullScreen?: boolean;
}> = ({ message = 'Loading...', fullScreen = false }) => {
  const content = (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
      <p className="text-gray-400">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="bg-gray-900 border-gray-800 p-8">
          <CardContent>{content}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      {content}
    </div>
  );
};

// ========================================
// ERROR STATE
// ========================================

export const ErrorState: React.FC<{
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
  fullScreen?: boolean;
}> = ({
  message = 'An error occurred',
  error,
  onRetry,
  fullScreen = false,
}) => {
  const errorMessage = typeof error === 'string' ? error : error?.message;

  const content = (
    <Alert className="bg-red-900/20 border-red-500">
      <AlertCircle className="h-5 w-5 text-red-400" />
      <AlertDescription className="text-gray-300">
        <strong className="block mb-2">{message}</strong>
        {errorMessage && (
          <p className="text-sm text-gray-400 mb-4">{errorMessage}</p>
        )}
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="bg-gray-900 border-gray-800 max-w-md">
          <CardContent className="p-8">{content}</CardContent>
        </Card>
      </div>
    );
  }

  return <div className="p-4">{content}</div>;
};

// ========================================
// EMPTY STATE
// ========================================

export const EmptyState: React.FC<{
  message?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  fullScreen?: boolean;
}> = ({
  message = 'No data found',
  description,
  icon,
  action,
  fullScreen = false,
}) => {
  const content = (
    <div className="flex flex-col items-center gap-4 text-center">
      {icon || <Inbox className="w-16 h-16 text-gray-600" />}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{message}</h3>
        {description && <p className="text-sm text-gray-400">{description}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick} className="bg-green-600 hover:bg-green-700">
          {action.label}
        </Button>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="bg-gray-900 border-gray-800 p-8">
          <CardContent>{content}</CardContent>
        </Card>
      </div>
    );
  }

  return <div className="p-12">{content}</div>;
};

// ========================================
// ASYNC COMPONENT WRAPPER
// ========================================

export interface AsyncComponentProps<T> {
  /** Loading state */
  isLoading: boolean;
  /** Error object */
  error?: Error | string | null;
  /** Data */
  data?: T | null;
  /** Children render function */
  children: (data: T) => ReactNode;
  /** Custom loading component */
  LoadingComponent?: React.ComponentType;
  /** Custom error component */
  ErrorComponent?: React.ComponentType<{ error: Error | string; onRetry?: () => void }>;
  /** Custom empty component */
  EmptyComponent?: React.ComponentType;
  /** Retry callback */
  onRetry?: () => void;
  /** Loading message */
  loadingMessage?: string;
  /** Error message */
  errorMessage?: string;
  /** Empty message */
  emptyMessage?: string;
  /** Full screen mode */
  fullScreen?: boolean;
}

/**
 * Standard async component pattern
 * Handles loading, error, empty, and success states
 *
 * @example
 * <AsyncComponent
 *   isLoading={loading}
 *   error={error}
 *   data={courses}
 *   onRetry={refetch}
 * >
 *   {(courses) => <CourseList courses={courses} />}
 * </AsyncComponent>
 */
export function AsyncComponent<T>({
  isLoading,
  error,
  data,
  children,
  LoadingComponent,
  ErrorComponent,
  EmptyComponent,
  onRetry,
  loadingMessage = 'Loading...',
  errorMessage = 'Failed to load data',
  emptyMessage = 'No data available',
  fullScreen = false,
}: AsyncComponentProps<T>): JSX.Element {
  // Loading state
  if (isLoading) {
    if (LoadingComponent) {
      return <LoadingComponent />;
    }
    return <LoadingState message={loadingMessage} fullScreen={fullScreen} />;
  }

  // Error state
  if (error) {
    if (ErrorComponent) {
      return <ErrorComponent error={error} onRetry={onRetry} />;
    }
    return (
      <ErrorState
        message={errorMessage}
        error={error}
        onRetry={onRetry}
        fullScreen={fullScreen}
      />
    );
  }

  // Empty state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    if (EmptyComponent) {
      return <EmptyComponent />;
    }
    return <EmptyState message={emptyMessage} fullScreen={fullScreen} />;
  }

  // Success state - render children with data
  return <>{children(data)}</>;
}
