---
"@svgrid/grid": patch
---

The context menu stays inside the viewport whatever its height. It was
placed on a guessed 280px (flipped above the click when that would not
fit), so a consumer menu with more entries ran off the bottom of the
window; the menu is measured once it exists and pulled back up or left.
