import { useAuthStore } from '../context/authStore.js';
import { authAPI } from '../services/apiEndpoints.js';
import { useNavigate } from 'react-router-dom';
import { canAccessPortal, normalizePortalRole, PORTAL_LOGIN, resolvePortalHome } from '../utils/portalRouting.js';
import { clearAllPortalSessions, clearPortalSession, savePortalSession } from '../utils/authStorage.js';

const AUTH_RETRYABLE_ERROR_CODES = new Set(['ECONNABORTED', 'ERR_NETWORK']);

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const useAuth = () => {
  const navigate = useNavigate();
  const authStore = useAuthStore();

  const normalizeUser = (restaurant, user, isStaff) => {
    if (user) {
      return {
        ...user,
        role: normalizePortalRole(user.role),
        restaurantId: user.restaurantId || restaurant?.id || restaurant?.restaurantId || null,
      };
    }

    if (restaurant) {
      return {
        ...restaurant,
        role: normalizePortalRole(restaurant.role || (isStaff ? 'staff' : 'owner')),
        restaurantId: restaurant.restaurantId || restaurant.id || null,
      };
    }

    return null;
  };

  const login = async (email, password, isStaff = false, portal = 'admin') => {
    try {
      authStore.setLoading(true);
      authStore.setError(null);

      const loginRequest = () => (
        isStaff ? authAPI.staffLogin(email, password) : authAPI.login(email, password)
      );

      let response;

      try {
        response = await loginRequest();
      } catch (error) {
        const shouldRetry = !error.response && AUTH_RETRYABLE_ERROR_CODES.has(error.code);

        if (!shouldRetry) {
          throw error;
        }

        authStore.setError('Backend is waking up. Retrying login...');
        await delay(2000);
        response = await loginRequest();
      }

      const { accessToken, refreshToken, restaurant, user } = response.data.data;
      const session = {
        accessToken,
        refreshToken,
        user: normalizeUser(restaurant, user, isStaff),
      };

      if (!canAccessPortal(session.user?.role, portal)) {
        clearPortalSession(portal);
        authStore.logout(portal);
        authStore.setError(`This account does not have access to the ${portal.toUpperCase()} portal.`);
        return false;
      }

      savePortalSession(portal, session);
      authStore.setPortalSession(portal, session);
      authStore.setError(null);

      return true;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        (!error.response && AUTH_RETRYABLE_ERROR_CODES.has(error.code)
          ? 'Backend is taking too long to respond. Please try again in a few seconds.'
          : 'Login failed');
      authStore.setError(errorMessage);
      return false;
    } finally {
      authStore.setLoading(false);
    }
  };

  const register = async (data) => {
    try {
      authStore.setLoading(true);
      authStore.setError(null);
      const response = await authAPI.register(data);

      const { accessToken, refreshToken, restaurant } = response.data.data;
      const session = {
        accessToken,
        refreshToken,
        user: normalizeUser(restaurant, null, false),
      };

      savePortalSession('admin', session);
      authStore.setPortalSession('admin', session);
      authStore.setError(null);

      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      authStore.setError(errorMessage);
      return false;
    } finally {
      authStore.setLoading(false);
    }
  };

  const logout = async (portal = authStore.activePortal || 'admin', { allPortals = false } = {}) => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      if (allPortals) {
        clearAllPortalSessions();
        authStore.logout();
        navigate('/');
        return;
      }

      authStore.logout(portal);
      navigate(
        portal === 'admin' ? PORTAL_LOGIN.admin : PORTAL_LOGIN[portal] || PORTAL_LOGIN.admin
      );
    }
  };

  return {
    user: authStore.user,
    restaurantId: authStore.restaurantId,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    error: authStore.error,
    login,
    register,
    logout,
    resolvePortalHome,
  };
};
