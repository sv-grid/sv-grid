---
"@svgrid/enterprise": patch
---

SvGrid Base on a phone: fields are added and edited from the fields button.
The cards of a grid view have no column headers, so the fields panel (Hide
fields) now has "Add a field" at its foot and a pencil on each field, where
fields may be changed (`columnAdder`, off without `canEditSchema`). The view
bar hosts the field editor for views without a header, and the panel closes
when the editor opens. The fields button has a stable class, `sv-fvb-hide`.
