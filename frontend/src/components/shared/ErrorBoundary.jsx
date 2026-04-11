import React from 'react';
import { AlertCircle } from 'lucide-react';
import { DEFAULT_UI_ERROR, reportClientError } from '../../utils/errorHandling';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    reportClientError({ error, errorInfo }, 'Error caught by boundary');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Something went wrong
            </h1>
            <p className="text-gray-600 text-center mb-6">
              {DEFAULT_UI_ERROR}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
