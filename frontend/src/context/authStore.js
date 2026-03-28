import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearPortalSession, readPortalSession } from '../utils/authStorage';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      activePortal: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: !!accessToken }),
      setPortalSession: (portal, session) =>
        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: Boolean(session.accessToken && session.user),
          activePortal: portal,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      hydratePortal: (portal) => {
        const session = readPortalSession(portal);

        if (!session?.accessToken || !session?.user) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            activePortal: portal,
          });
          return;
        }

        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          isAuthenticated: true,
          activePortal: portal,
        });
      },

      logout: (portal) => {
        if (portal) {
          clearPortalSession(portal);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          activePortal: portal || null,
        });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        activePortal: state.activePortal,
      }),
    }
  )
);
