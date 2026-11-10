/**
 * The base's endpoint: GET describes the database's tables as a base (fields,
 * links, choices, views); POST ?table=tasks reads and writes that table with
 * parameterized SQL. Only the tables it described are reachable.
 */
import { dev } from '$app/environment'
import { createBaseEndpoint } from '@svgrid/enterprise/base'
import { execute } from '$lib/server/db'

export const { GET, POST } = createBaseEndpoint({
  execute,
  // Every table in the database. Name the ones you serve once the app holds more
  // than this base: `tables: ['tasks', 'projects']`.
  allTables: true,
  // Open on your machine, closed once built. Before you deploy, say who may use
  // it: `!!event.locals.user` once your hooks fill it in.
  authorize: () => () => dev,
})
