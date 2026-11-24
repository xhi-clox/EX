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
