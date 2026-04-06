import { useAuthStore } from '../context/authStore';
import { readPortalSession, savePortalSession } from './authStorage';

export function syncPortalSessionUser(portal, nextUser) {
  if (!portal || !nextUser) {
    return;
  }

  const existingSession = readPortalSession(portal);
  if (!existingSession?.user) {
    return;
  }

  const nextSession = {
    ...existingSession,
    user: {
      ...existingSession.user,
      ...nextUser,
    },
  };

  savePortalSession(portal, nextSession);
  useAuthStore.getState().setPortalSession(portal, nextSession);
}
