/**
 * @svgrid/enterprise/base - SvGrid Base: a table database in the browser, the
 * way a team runs a project tracker, a CRM or a content calendar. Fields of
 * many types, saved views (grid, Kanban, calendar, gallery, form), filters,
 * groups, colors, linked records and expanded records with comments.
 *
 * ```svelte
 * <script lang="ts">
 *   import { SvBase, enableBase } from '@svgrid/enterprise/base'
 *   enableBase()
 * </script>
 *
 * <SvBase {data} {columns} primaryField="name" bind:views editable />
 * ```
 *
 * A Suite product. It is the fields module (`@svgrid/enterprise/fields`) with
 * the product's own entry: everything that module exports is here too.
 */
export * from '../fields/index'
export { enableFields as enableBase } from '../fields/index'
