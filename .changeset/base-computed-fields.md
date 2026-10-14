---
"@svgrid/enterprise": minor
---

SvGrid Base: computed fields read each other.

- A formula that names a rollup, a count, a lookup or another formula reads
  its value (`{Monthly budget} - {Spent}`, `{Capacity} - {Registered}`),
  instead of the empty stored one.
- A lookup or rollup of a linked table's formula, lookup, rollup or count
  works it out there (an objective averaging its key results' Progress
  formula). Fields that refer to each other in a circle stop after a few
  steps instead of looping.
- A grouped view opens with its groups expanded.
- An automation hears of a change that reached its table through a link (a
  guest added from the Guests table changes the event), at the depth of the
  automation that caused it, so chains across tables still stop.
- A record added from a Kanban lane, a calendar day or "+ Add row" gets an
  id when the table's records carry one.
