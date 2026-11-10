import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` needs no database. `db:migrate` and `db:push` go to
// DATABASE_URL when it is set, else to the embedded PGlite folder the app uses.
const url = process.env.DATABASE_URL;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	...(url ? { dbCredentials: { url } } : { driver: 'pglite', dbCredentials: { url: './.data/pglite' } }),
	verbose: true,
	strict: true
});
