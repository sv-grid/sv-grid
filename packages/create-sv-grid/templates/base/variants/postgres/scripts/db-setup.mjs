// Creates the tables in db/schema.sql on DATABASE_URL: `npm run db:setup`.
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL in .env first (see .env.example).')
  process.exit(1)
}
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  console.log('Tables created. Run npm run dev and open the app.')
} finally {
  await client.end()
}
