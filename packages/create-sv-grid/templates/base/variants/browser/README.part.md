## Your data

The database is Postgres running in your browser (PGlite), saved in
IndexedDB. The first visit creates the tables in `db/schema.sql`; change that
file and clear the site's data to start over with your own tables.

Moving to a server later keeps the same tables: run `db/schema.sql` on your
Postgres and use the `postgres` setup (`npm create @svgrid@latest -- -t base
--data postgres`).
