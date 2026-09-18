---
"@svgrid/enterprise": minor
---

Presence: where the other people are. The delta stream carried what
everyone types; this carries where everyone is, which is the half that
stops two people typing into the same cell.

`<SvSheet presence={others} />` draws each person on the active sheet as a
thin coloured box around their selection with their name on their cursor,
measured from the rendered cells so it follows every scroll. `onPresence`
fires whenever this user's own selection moves, with the sheet, the
rectangle and the active cell, which is what an application broadcasts.
`createDeltaStream` gained `sendPresence` and an `onPresence` option, and a
fifth delta kind that rides the same wire, so an application needs only one
transport.

Presence is never part of the document: not in `getState()`, not in the
.xlsx, and `applySheetDelta` ignores a presence delta. A person with no
colour is given a stable one from their id, and anyone unheard from for
fifteen seconds is dropped, since a closed tab says no goodbye.
`livePresence`, `presenceOnSheet`, `presenceColour` and `presenceInitials`
are exported for an application that wants its own list.
