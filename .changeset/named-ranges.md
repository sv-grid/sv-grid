---
"@svgrid/enterprise": patch
---

Fix defined names: a name that refers to a range is that range, and an edit behind a name propagates.

Two bugs, found while building the named-ranges demo, both of which made
`wb.names` unusable for the thing names are for.

`=SUM(Sales)` with `Sales` defined as `Orders!$I$2:$I$25` returned the first
cell. The evaluator resolved a name to one value, so a range collapsed to its
top-left cell before `SUM` ever saw it. `EvalContext` now has
`resolveNameNode`, which hands back the parsed reference; the evaluator
substitutes it for the name before the shape check, so a range name expands
inside `SUM`, `COUNTIF`, `VLOOKUP` and the rest exactly as a typed range
does. In scalar position it still collapses to its top-left cell, as a range
does in Excel. `resolveName` stays for callers that only have a value.

`=Subtotal*TaxRate` kept its first result after the cell behind `TaxRate`
changed. `precedentsOf` skipped name nodes, so the formula recorded no
dependency on the cell at all. It now follows the name to its reference
(and a name defined as another name to the end of the chain, cut after a
few hops so a circular definition reads `#NAME?` rather than hanging).

Redefining or removing a name through `wb.names` drops every cached value,
so the next read recomputes against the new definition; nothing to call
afterwards.

`INDEX(B4:D4, 2)` over a one-row range returned `#REF!`; with one number
it now indexes by column, as Excel does.
