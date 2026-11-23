---
'@svgrid/enterprise': patch
---

SvGrid Base formulas: `DISTANCE(place, place)`, the metres between two places
given as coordinates ("42.6977, 23.3219"), as a phone's location saves them. It
also reads coordinates in a maps link or followed by "(±12 m)", and four numbers
(lat, lng, lat, lng). Empty when a place has no coordinates.
