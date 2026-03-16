import axios from 'axios';

const PRODUCTION_API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api';
const DEVELOPMENT_API_BASE_URL = 'http://localhost:3000/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL);

const isDevelopmentHost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (import.meta.env.DEV) {
  console.log('='.repeat(60));
  console.log('Frontend API Configuration');
  console.log('='.repeat(60));
  console.log('Environment:', import.meta.env.MODE);
  console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || '(not set)');
  console.log('NEXT_PUBLIC_API_URL:', import.meta.env.NEXT_PUBLIC_API_URL || '(not set)');
  console.log('Actual API Base URL:', API_BASE_URL);
  console.log('='.repeat(60));
}

if (!isDevelopmentHost && API_BASE_URL.includes('localhost')) {
  console.error('Production is using a localhost API URL. Check API environment variables.');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${API_BASE_URL}${config.url}`);
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('Request interceptor error:', error);
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`API Response: ${response.status} ${API_BASE_URL}${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (import.meta.env.DEV) {
      if (error.response) {
        console.error('API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: `${API_BASE_URL}${error.config?.url || ''}`,
          data: error.response.data,
        });
      } else if (error.request) {
        console.error('API Error - No Response:', {
          url: `${API_BASE_URL}${error.config?.url || ''}`,
          message: error.message,
          code: error.code,
        });
      } else {
        console.error('API Error:', error.message);
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/v1/auth/refresh-token`,
            { refreshToken },
            { withCredentials: true }
          );

          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
