import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema.ts';

/** Either driver (postgres.js or PGlite) behind one type. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
