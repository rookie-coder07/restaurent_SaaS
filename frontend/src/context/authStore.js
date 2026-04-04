import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearPortalSession, getValidPortalSession } from '../utils/authStorage';
import { getPortalKeyFromPathname, normalizePortalRole } from '../utils/portalRouting';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      restaurantId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      error: null,
      activePortal: null,

      setUser: (user) => set({
        user: user ? { ...user, role: normalizePortalRole(user.role) } : null,
        restaurantId: user?.restaurantId || null,
        isAuthenticated: !!user,
      }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: !!accessToken }),
      setPortalSession: (portal, session) =>
        set({
          user: session.user
            ? {
                ...session.user,
                role: normalizePortalRole(session.user.role),
              }
            : null,
          restaurantId: session.user?.restaurantId || null,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: Boolean(session.accessToken && session.user),
          activePortal: portal,
          isHydrated: true,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      initializeAuth: (pathname = '/') => {
        const portal = getPortalKeyFromPathname(pathname);
        const session = getValidPortalSession(portal);

        if (!session?.accessToken || !session?.user) {
          clearPortalSession(portal);
          set({
            user: null,
            restaurantId: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            activePortal: null,
            isHydrated: true,
          });
          return;
        }

        set({
          user: {
            ...session.user,
            role: normalizePortalRole(session.user?.role),
          },
          restaurantId: session.user?.restaurantId || null,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: true,
          activePortal: portal,
          isHydrated: true,
        });
      },

      hydratePortal: (portal) => {
        const session = getValidPortalSession(portal);

        if (!session?.accessToken || !session?.user) {
          clearPortalSession(portal);
          set({
            user: null,
            restaurantId: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            activePortal: portal,
            isHydrated: true,
          });
          return;
        }

        set({
          user: {
            ...session.user,
            role: normalizePortalRole(session.user?.role),
          },
          restaurantId: session.user?.restaurantId || null,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: true,
          activePortal: portal,
          isHydrated: true,
        });
      },

      logout: (portal) => {
        if (portal) {
          clearPortalSession(portal);
        }

        set({
          user: null,
          restaurantId: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          activePortal: portal || null,
          isHydrated: true,
        });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        restaurantId: state.restaurantId,
        isAuthenticated: state.isAuthenticated,
        activePortal: state.activePortal,
      }),
    }
  )
);
