# Prisma schema

If you use [Prisma](https://www.prisma.io), Studio can scaffold screens straight
from your `schema.prisma` - no live database connection needed at generation
time. Your Prisma schema is the single source of truth, and the `--from` flag
auto-detects it (by the `.prisma` extension or a `model` block).

![At generation time the --from flag auto-detects your schema.prisma file - the single source of truth - and Studio scaffolds a CRUD screen from it, with no live database connection needed.](/docs-media/studio-prisma.svg)

## Scaffold from a schema file

```bash
npx @svgrid/studio add User --from prisma/schema.prisma
npm run dev            # open /User
```

Given a Prisma model:

```prisma
// prisma/schema.prisma
enum Role {
  ADMIN
  MEMBER
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())
}
```

Studio reads the fields, the `@id` key, and the `?` (optional) markers into an
`EntitySchema`, maps scalar types (`Int`/`String`/`Boolean`/`DateTime`/`Json`/...),
turns `enum` blocks into select fields, and generates the schema module, the API
route, and the screen.

If your schema defines several models, pick one:

```bash
npx @svgrid/studio add Post --from prisma/schema.prisma --table Post
```

## Scaffold the whole app

Pass `--all` to generate a screen for **every** model, plus a nav layout and a
home page linking them:

```bash
npx @svgrid/studio add --all --from prisma/schema.prisma
npm run dev            # open / and browse every model
```

Relations are followed across the file. A `@relation` navigation turns its
scalar foreign-key column into a **lookup** that shows the related row's label:

```prisma
model Post {
  id       Int    @id @default(autoincrement())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int    // -> a searchable lookup on User
}
```

The virtual `author` navigation field is skipped; the stored `authorId` column
becomes the relation field, and Studio resolves its display field from the
`User` model (a `name` or `title` column, if present).

## Connecting the data

By default the generated API route starts **in-memory** so the screen runs
immediately. When you are ready to hit the database, regenerate with a driver
(Prisma's Postgres, for example):

```bash
npx @svgrid/studio add User --from prisma/schema.prisma --db postgres
```

...or keep your `PrismaClient` and wire the generated `EntitySchema` to a data
source by hand - the schema + grid + form stay the same.

## Notes

- The Prisma reader is a best-effort text parse - review the generated
  `EntitySchema` (or open it in the [visual designer](../studio.md#three-ways-to-build))
  and adjust enums, relations, or types as needed.
- Composite keys (`@@id([a, b])`) are read: the screen keys off the **first**
  member, so an explicit join table scaffolds as a normal entity with a lookup
  for its other side. Prisma **implicit** many-to-many (`posts Post[]` / `tags
  Tag[]` with no join model) has no table to scaffold and is skipped - add a
  join model, or a multi-select in the designer.
- Re-running `add` after a schema change regenerates only the `svgrid:managed`
  regions; your edits are preserved.

## See also

- [Drizzle schema](./drizzle.md) - the same flow for a Drizzle `schema.ts`
- [Databases](./databases.md) - connect to a live database instead
- [Relations](./relations.md) · [In-memory](./in-memory.md)
