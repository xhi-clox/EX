'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useAuth } from '../provider';

/**
 * A hook that provides the current authenticated user.
 *
 * This hook listens for changes in the authentication state and provides the current
 * user object. It also provides a loading state to indicate that the authentication
 * state is being determined.
 *
 * @returns {{ user: User | null; loading: boolean }} An object containing the user and loading state.
 */
export function useUser(): { user: User | null; loading: boolean } {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // If auth is not ready, we are still loading.
      // The provider will re-render when auth is available.
      setLoading(true); 
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setLoading(false);
      },
      (error) => {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
