import { DATABASE_URL } from '$app/env/private';
import { building } from '$app/env';
import * as schema from './schema.ts';
import type { Database } from './types.ts';

export type { Database };

// With DATABASE_URL set, connect to that Postgres. Without it, run an embedded
// Postgres (PGlite) stored in .data/pglite, apply the migrations in ./drizzle,
// and fill a new database with sample data, so `npm run dev` works on a fresh
// clone with nothing installed.
async function connect(): Promise<Database> {
	if (DATABASE_URL) {
		const { drizzle } = await import('drizzle-orm/postgres-js');
		const { default: postgres } = await import('postgres');
		return drizzle(postgres(DATABASE_URL), { schema });
	}
	const { existsSync, mkdirSync } = await import('node:fs');
	const { PGlite } = await import('@electric-sql/pglite');
	const { drizzle } = await import('drizzle-orm/pglite');
	const { migrate } = await import('drizzle-orm/pglite/migrator');
	const fresh = !existsSync('./.data/pglite');
	if (fresh) {
		console.log('Creating the local database in .data/pglite (first run only; set DATABASE_URL to use your own Postgres)');
	}
	mkdirSync('./.data', { recursive: true });
	const db = drizzle(new PGlite('./.data/pglite'), { schema });
	await migrate(db, { migrationsFolder: './drizzle' });
	if (fresh) {
		const { seed, DEMO_ACCOUNTS } = await import('./seed.ts');
		if (await seed(db)) {
			console.log('Sample data added. Sign in with:');
			for (const a of DEMO_ACCOUNTS) console.log(`  ${a.email} / ${a.password}  (${a.role})`);
		}
	}
	return db;
}

// One instance per process. Vite re-runs this module on edits during dev, and a
// second PGlite on the same folder would fight the first over the files.
// `vite build` imports server modules to analyse them; it gets no connection.
const store = globalThis as unknown as { __db?: Promise<Database> };
export const db: Database = building ? (null as unknown as Database) : await (store.__db ??= connect());
