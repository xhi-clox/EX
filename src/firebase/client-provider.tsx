// src/firebase/client-provider.tsx
'use client';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { PropsWithChildren, useEffect, useState } from 'react';
import { FirebaseProvider, initializeFirebase } from '.';

/**
 * Provides an initialized Firebase app, Firestore, and Auth instance to the client.
 *
 * This provider initializes Firebase on the client-side and ensures that it is only
 * initialized once. It is intended to be used in a client component that wraps the
 * application.
 *
 * @param {PropsWithChildren} props The component props.
 * @returns {JSX.Element | null} The Firebase provider with the initialized app, or null if not yet initialized.
 */
export function FirebaseClientProvider({ children }: PropsWithChildren) {
  const [firebase, setFirebase] = useState<{
    app: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
  } | null>(null);

  useEffect(() => {
    const app = initializeFirebase();
    setFirebase(app);
  }, []);

  if (!firebase) {
    // You can return a loading state here if you want.
    return null;
  }

  return (
    <FirebaseProvider
      app={firebase.app}
      firestore={firebase.firestore}
      auth={firebase.auth}
    >
      {children}
    </FirebaseProvider>
  );
}
