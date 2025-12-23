## watchd

watchd is a Next.js 16 app where friends and family can log the shows and movies they actually loved. It uses Google sign-in, stores entries in PostgreSQL via Prisma, and surfaces IMDb data via the OMDb API.

### Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- NextAuth + Google OAuth
- Prisma + PostgreSQL
- IMDb data via [OMDb](https://www.omdbapi.com/)
- Vitest + Testing Library for units, Playwright for E2E

### Environment

Create a `.env.local` (or update `.env`) with:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/watchd?schema=public"
NEXTAUTH_SECRET="generate-a-long-random-string"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
OMDB_API_KEY="your-omdb-key"
```

Google credentials can be obtained from https://console.cloud.google.com. For OMDb, request a free key at https://www.omdbapi.com/apikey.aspx. For PostgreSQL, create the `watchd` database locally (`createdb watchd`) and ensure the user/secret matches the `DATABASE_URL`.

### Scripts

```bash
npm run dev          # start Next.js locally
npm run build        # production build
npm run lint         # eslint
npm run test         # vitest (unit)
npm run test:watch   # vitest watch mode
npm run test:e2e     # Playwright (requires `npx playwright install` once)
npm run db:migrate   # apply Prisma migrations
npm run db:push      # push schema without migration
npm run db:studio    # open Prisma Studio
```

### Testing notes

- Vitest is configured with jsdom and Testing Library matchers (`vitest.setup.ts`).
- Playwright launches the Next dev server automatically; keep an `.env.local` handy for auth flows.

### Development tips

- When working on the IMDb search flow, the OMDb free tier allows 1,000 requests per day—cache results where possible.
- All Prisma calls live in server components or route handlers; keep client components data-fetch free and hit the provided APIs instead.
