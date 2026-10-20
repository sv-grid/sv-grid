// Creates the tables in db/schema.sql on DATABASE_URL: `npm run db:setup`.
import { readFile } from 'node:fs/promises'
import pg from 'pg'

// .env is optional here: DATABASE_URL may come from the shell instead.
// process.loadEnvFile needs Node 20.12+; older Node lands in the catch too.
try {
  process.loadEnvFile()
} catch {
  // no .env
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL in .env first: cp .env.example .env')
  process.exit(1)
}
const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
} catch (e) {
  console.error(`Could not reach DATABASE_URL (${e.code ?? e.message}). Is the database running, and is the URL in .env right?`)
  process.exit(1)
}
try {
  await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  console.log('Tables created. Run npm run dev and open the app.')
} finally {
  await client.end()
}
