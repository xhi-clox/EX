# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Local development

The app uses PostgreSQL through Prisma. For local development, this repo can
start a bundled PostgreSQL server with `embedded-postgres` (no system install
needed).

```bash
npm install
npm run db:local   # starts PostgreSQL on localhost:5433 (keep this terminal open)
npm run db:push    # creates/syncs the tables (first run only)
npm run dev        # starts Next.js on http://localhost:3000
```

Create a `.env` file (see `.env.example`) with:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/exam_maker
DIRECT_URL=postgresql://postgres:postgres@localhost:5433/exam_maker
```

The database files are stored in `.local-db/` and are git-ignored. AI features
additionally need `GEMINI_API_KEY`; the editor itself works without it.

### Using Neon (hosted PostgreSQL)

The app also runs against [Neon](https://neon.tech). Copy both connection
strings from the Neon dashboard into `.env` — use the **pooled** host for
`DATABASE_URL` and the **direct** host for `DIRECT_URL`:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

Then create the tables with `npm run db:push` and start the app with
`npm run dev` (the bundled local database is not needed). For deployments,
set the same variables in your hosting provider's environment settings.

## Authentication

Sign up, sign in (email + password) and Google sign-in are handled by
[Auth.js](https://authjs.dev) (NextAuth v5). Sessions are JWT-based and every
project belongs to the signed-in user.

Add these values to `.env`:

```env
# Generate one with: npx auth secret
AUTH_SECRET=...

# Optional: leave empty to hide the "Continue with Google" button
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

For Google sign-in, create an OAuth 2.0 Client ID in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) and
add this authorized redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

Use your production URL (for example
`https://your-app.web.app/api/auth/callback/google`) as an additional redirect
URI when deploying.

After changing the Prisma schema, sync the new tables with:

```bash
npm run db:push
```

> Projects created before authentication was added have no owner and will not
> appear in any account. New projects are automatically scoped to the user who
> created them.
