import { useAuthStore } from '../context/authStore.js';
import { authAPI } from '../services/apiEndpoints.js';
import { useNavigate } from 'react-router-dom';
import { canAccessPortal, normalizePortalRole, PORTAL_LOGIN, resolvePortalHome } from '../utils/portalRouting.js';
import { clearAllPortalSessions, clearPortalSession, savePortalSession } from '../utils/authStorage.js';
import { reportClientError, showToast } from '../utils/errorHandling.js';

const AUTH_RETRYABLE_ERROR_CODES = new Set(['ECONNABORTED', 'ERR_NETWORK']);

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const persistPrimarySession = (token, restaurantId = null) => {
  if (!token) {
    return;
  }

  localStorage.setItem('token', token);
  localStorage.setItem('accessToken', token);

  if (restaurantId) {
    localStorage.setItem('restaurantId', String(restaurantId));
  }
};

export const useAuth = () => {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const normalizeLogoutPortal = (portal) => (portal === 'manager' ? 'admin' : portal);
  const resolveLogoutPath = (portal) => {
    if (portal === 'manager') {
      return '/manager/login';
    }

    const normalizedPortal = normalizeLogoutPortal(portal);
    return normalizedPortal === 'admin' ? PORTAL_LOGIN.admin : PORTAL_LOGIN[normalizedPortal] || PORTAL_LOGIN.admin;
  };

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

  const login = async (email, password, selectedMode = '', portal = 'admin') => {
    try {
      authStore.setLoading(true);
      authStore.setError(null);

      // Determine login portal based on selected mode
      // owner/manager/developer modes need to send the correct portal to the backend
      let loginPortal = portal;
      if (selectedMode === 'developer') {
        loginPortal = 'developer';
      } else if (selectedMode === 'manager') {
        loginPortal = 'manager';
      } else if (selectedMode === 'staff') {
        loginPortal = 'pos';
      }

      // Use unified login endpoint for all users
      let response;
      try {
        response = await authAPI.login(email, password, loginPortal);
      } catch (error) {
        const shouldRetry = !error.response && AUTH_RETRYABLE_ERROR_CODES.has(error.code);

        if (!shouldRetry) {
          throw error;
        }

        authStore.setError('Retrying login...');
        await delay(2000);
        response = await authAPI.login(email, password, loginPortal);
      }

      const { accessToken, refreshToken, restaurant, user } = response.data.data;
      
      // Determine portal based on response role and redirectTo hint
      const responseUser = user || restaurant;
      const redirectTo = responseUser?.redirectTo;
      const userRole = responseUser?.role || '';
      
      console.log('[LOGIN] Response from backend:', {
        userRole,
        redirectTo,
        portal,
        loginPortal,
        user: user ? { id: user.id, role: user.role } : null,
        restaurant: restaurant ? { id: restaurant.id, role: restaurant.role } : null,
      });
      
      // Auto-detect portal from response, but respect current portal context
      // Start with the portal the user is on; only override if backend explicitly says POS
      let targetPortal = portal || 'admin';
      if (redirectTo === 'pos') {
        targetPortal = 'pos';
      } else if (portal === 'pos' && normalizePortalRole(userRole) === 'staff') {
        targetPortal = 'pos';
      }

      // Prevent silent success when the role is routed to a different portal than the current page
      if (targetPortal !== portal) {
        authStore.setError(
          `This account belongs to the ${targetPortal.toUpperCase()} portal. Please sign in at the correct portal.`
        );
        return false;
      }
      
      const session = {
        accessToken,
        refreshToken,
        user: normalizeUser(restaurant, user, targetPortal === 'pos'),
      };

      console.log('[LOGIN] Session to save:', {
        portal: targetPortal,
        userRole: session.user?.role,
        userId: session.user?.id,
        accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : null,
      });

      if (!canAccessPortal(session.user?.role, targetPortal)) {
        clearPortalSession(targetPortal);
        authStore.logout(targetPortal);
        authStore.setError(`This account does not have access to the ${targetPortal.toUpperCase()} portal.`);
        return false;
      }

      savePortalSession(targetPortal, session);
      persistPrimarySession(session.accessToken, session.user?.restaurantId);
      authStore.setPortalSession(targetPortal, session);
      authStore.setError(null);

      console.log('[LOGIN] \u2705 Login successful for role:', session.user?.role);

      return true;
    } catch (error) {
      const serverMessage = error.response?.data?.message || error.response?.data?.error;

      let errorMessage = 'Login failed';
      if (!error.response && AUTH_RETRYABLE_ERROR_CODES.has(error.code)) {
        errorMessage = 'Unable to reach the server right now. Please try again.';
      } else if (error.response?.status === 401) {
        errorMessage = serverMessage || 'Invalid email or password';
      } else if (error.response?.status === 403) {
        errorMessage =
          serverMessage ||
          'This account does not have access to this portal. Use the correct portal for your role (e.g., POS for staff).';
      } else if (serverMessage) {
        errorMessage = serverMessage;
      }

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
      persistPrimarySession(session.accessToken, session.user?.restaurantId);
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
      reportClientError(error, 'Logout error');
      showToast('We could not complete logout cleanly, but your session is being cleared.', 'warning');
    } finally {
      if (allPortals) {
        clearAllPortalSessions();
        authStore.logout();
        navigate('/');
        return;
      }

      authStore.logout(normalizeLogoutPortal(portal));
      navigate(resolveLogoutPath(portal));
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
