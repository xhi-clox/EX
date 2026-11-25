import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

/**
 * Edge-safe portion of the auth config. It is shared by the middleware and the
 * full server-side config in `src/auth.ts` (which adds Prisma and credentials).
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: googleConfigured ? [Google] : [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = ['/login', '/signup'].some((path) =>
        nextUrl.pathname.startsWith(path)
      );

      if (isAuthPage) {
        // Already signed in? Send them to the dashboard.
        return isLoggedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
