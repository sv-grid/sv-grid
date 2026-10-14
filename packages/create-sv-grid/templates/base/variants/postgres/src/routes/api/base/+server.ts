/**
 * The base's endpoint: GET describes the database's tables as a base (fields,
 * links, choices, views); POST ?table=tasks reads and writes that table with
 * parameterized SQL. Only the tables it described are reachable.
 *
 * Who may do what goes here too: `authorize: (table) => (ctx) => ctx.action === 'read' || !!ctx.event.locals?.user`.
 */
import { createBaseEndpoint } from '@svgrid/enterprise/base'
import { execute } from '$lib/server/db'

export const { GET, POST } = createBaseEndpoint({ execute })
