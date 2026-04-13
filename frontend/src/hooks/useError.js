/**
 * Custom React Hook for Error Handling
 * Provides consistent error handling and state management in React components
 */

import { useState, useCallback } from 'react';
import { 
  classifyError, 
  getUserFriendlyMessage, 
  formatError,
  shouldRetryRequest,
  getRetryDelay,
  ERROR_TYPES 
} from '../utils/errorClassifier';

/**
 * useError Hook
 * Manages error state and provides error handling utilities
 * 
 * @param {Function} onError - Optional callback when error occurs
 * @param {number} maxRetries - Maximum number of retries (default 3)
 * @returns {Object} Error state and handler functions
 * 
 * @example
 * const { error, loading, handleError, clearError, retry } = useError();
 * 
 * const fetchData = async () => {
 *   try {
 *     const response = await api.get('/endpoint');
 *     // handle success
 *   } catch (err) {
 *     handleError(err);
 *   }
 * };
 */
export const useError = (onError = null, maxRetries = 3) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState(null);

  const handleError = useCallback((err) => {
    const formattedError = formatError(err);
    setError(formattedError);
    setLastError(err);
    
    // Call optional callback
    if (onError) {
      onError(formattedError);
    }
  }, [onError]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setLastError(null);
  }, []);

  const retry = useCallback(async (retryFn) => {
    if (retryCount >= maxRetries) {
      return;
    }

    if (!lastError || !shouldRetryRequest(lastError, retryCount)) {
      return;
    }

    const delay = getRetryDelay(retryCount);
    setRetryCount(prev => prev + 1);
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));

    if (retryFn) {
      try {
        setLoading(true);
        await retryFn();
        clearError();
        setLoading(false);
      } catch (err) {
        handleError(err);
        setLoading(false);
      }
    }
  }, [retryCount, maxRetries, lastError, handleError, clearError]);

  return {
    error,
    loading,
    retryCount,
    handleError,
    clearError,
    retry,
    isNetworkError: error?.isNetworkError,
    isServerError: error?.isServerError,
    isClientError: error?.isClientError,
    errorType: error?.type,
  };
};

/**
 * useAsyncError Hook
 * Manages async operation with automatic error handling
 * 
 * @param {Function} fn - Async function to execute
 * @param {Array} dependencies - Dependency array for useEffect
 * @returns {Object} Loading state, data, and error
 * 
 * @example
 * const { data, loading, error } = useAsyncError(() => api.get('/users'), []);
 */
export const useAsyncError = (fn, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fn();
      setData(result);
    } catch (err) {
      const formattedError = formatError(err);
      setError(formattedError);
    } finally {
      setLoading(false);
    }
  }, [fn]);

  // Note: This would normally be a useEffect, but we'll provide execute function
  // to be called manually when needed
  return {
    data,
    loading,
    error,
    execute,
    retry: () => execute(),
  };
};

/**
 * useFormError Hook
 * Manages form-specific errors for individual fields
 * 
 * @returns {Object} Form error utilities
 * 
 * @example
 * const { errors, setFieldError, clearFieldError } = useFormError();
 * 
 * // Set error for specific field
 * setFieldError('email', 'Invalid email format');
 * 
 * // Check if field has error
 * if (errors.email) {
 *   errorDisplay = errors.email;
 * }
 */
export const useFormError = () => {
  const [errors, setErrors] = useState({});

  const setFieldError = useCallback((fieldName, message) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: message,
    }));
  }, []);

  const clearFieldError = useCallback((fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useCallback(() => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  const getFieldError = useCallback((fieldName) => {
    return errors[fieldName] || null;
  }, [errors]);

  return {
    errors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    hasErrors: hasErrors(),
    getFieldError,
  };
};

/**
 * withErrorBoundary HOC
 * Wraps component with error boundary functionality
 * 
 * @param {React.FC} Component - Component to wrap
 * @param {Object} options - Error boundary options
 * @returns {React.FC} Wrapped component
 * 
 * @example
 * export default withErrorBoundary(MyComponent, {
 *   FallbackComponent: ErrorFallback,
 *   onError: (error) => console.log(error),
 * });
 */
export const withErrorBoundary = (Component, options = {}) => {
  const { FallbackComponent = null, onError = null } = options;

  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error: formatError(error) };
    }

    componentDidCatch(error, errorInfo) {
      if (onError) {
        onError(error, errorInfo);
      }
    }

    render() {
      if (this.state.hasError) {
        if (FallbackComponent) {
          return (
            <FallbackComponent
              error={this.state.error}
              resetError={() => this.setState({ hasError: false, error: null })}
            />
          );
        }

        return (
          <div
            style={{
              padding: '20px',
              border: '1px solid #ff6b6b',
              borderRadius: '8px',
              backgroundColor: '#ffe0e0',
              color: '#c92a2a',
            }}
          >
            <h3>Something went wrong</h3>
            <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '8px 16px',
                backgroundColor: '#c92a2a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        );
      }

      return <Component {...this.props} />;
    }
  };
};

export default useError;
