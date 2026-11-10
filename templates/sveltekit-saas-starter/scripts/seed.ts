// `npm run db:seed`: fill an empty Postgres (DATABASE_URL) with sample data.
// The local PGlite database seeds itself on first run; delete .data/ to redo it.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema.ts';
import { DEMO_ACCOUNTS, seed } from '../src/lib/server/db/seed.ts';

const url = process.env.DATABASE_URL;
if (!url) {
	console.log('DATABASE_URL is empty, so the app uses the local database, which seeds itself on first run.');
	console.log('To start over: stop the dev server, delete the .data folder, start it again.');
	process.exit(0);
}
const client = postgres(url, { max: 1 });
const added = await seed(drizzle(client, { schema }));
console.log(added ? 'Sample data added.' : 'The database already has users; nothing changed.');
if (added) for (const a of DEMO_ACCOUNTS) console.log(`  ${a.email} / ${a.password}  (${a.role})`);
await client.end();
