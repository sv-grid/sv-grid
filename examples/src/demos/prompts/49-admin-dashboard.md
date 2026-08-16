# Prompt: 49-admin-dashboard

Source: `examples/src/demos/49-admin-dashboard.svelte`
Live:   https://svgrid.com/demos/49-admin-dashboard/

## What this demo proves

49. Enterprise admin dashboard - users + permissions
-----------------------------------------------------
The CRUD-heavy back-office screen every internal tool ships
eventually: a users table with inline role + status + MFA
editing, bulk activate / deactivate / delete, an "Invite user"
dialog, and a live audit log that watches the admin's every
move.

  1. **Bulk action toolbar.** Tick checkboxes -> the toolbar
     reveals "Activate / Deactivate / Delete / Export". Mirrors
     Gmail and Linear UX.

  2. **Inline CRUD.** Role + status are list editors; MFA is a
     checkbox. Every edit hits the audit log on the right.

  3. **Invite user dialog.** Lightweight modal with name +
     email + role validation. New row enters with a pending
     tint so you can spot the latest entry.

  4. **Detail aside.** Click a row to see permissions broken
     out per resource and a per-user activity feed.

  5. **Live audit log.** All mutations append entries with
     who / what / when. The log itself is a small SvGrid
     driving the same render pipeline as the main table.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
