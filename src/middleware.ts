import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Protect every page except the auth pages, API routes (they check the
  // session themselves) and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|fonts/|question-paper.schema.json|.*\\.(?:png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf)$).*)',
  ],
};
