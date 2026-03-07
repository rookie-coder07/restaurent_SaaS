import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Debug: Log which API URL is being used
console.log('='.repeat(60));
console.log('🌐 Frontend API Configuration');
console.log('='.repeat(60));
console.log('Environment:', import.meta.env.MODE);
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || '(not set - using default)');
console.log('Actual API Base URL:', API_BASE_URL);
console.log('='.repeat(60));

// Check if running on Vercel vs localhost
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
console.log(`📍 Running in: ${isProduction ? 'PRODUCTION (Vercel)' : 'DEVELOPMENT (localhost)'}`);
console.log(`Current domain: ${window.location.hostname}`);

// WARN if using localhost in production
if (isProduction && API_BASE_URL.includes('localhost')) {
  console.error('❌ CRITICAL: Using localhost API URL in production!');
  console.error('API calls will fail. Check VITE_API_BASE_URL environment variable.');
}

console.log('='.repeat(60));

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000, // 10 second timeout to prevent hanging
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and log details
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`🔗 API Request: ${config.method?.toUpperCase()} ${API_BASE_URL}${config.url}`);
    if (config.data) {
      console.log('   Data:', config.data);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and errors
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${API_BASE_URL}${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Enhanced error logging
    if (error.response) {
      console.error('❌ API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: `${API_BASE_URL}${error.config.url}`,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('❌ API Error - No Response:', {
        url: `${API_BASE_URL}${error.config.url}`,
        message: error.message,
        code: error.code
      });
    } else {
      console.error('❌ API Error:', error.message);
    }

    // Token refresh logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          console.log('🔄 Attempting token refresh...');
          const response = await axios.post(
            `${API_BASE_URL}/v1/auth/refresh-token`,
            { refreshToken },
            { withCredentials: true }
          );

          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          console.log('✅ Token refreshed successfully');

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear auth and redirect to login
        console.error('❌ Token refresh failed:', refreshError);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    console.error('❌ API Error:', error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

export default api;
