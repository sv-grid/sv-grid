---
title: Building a Logistics / Fleet Tracking Grid in Svelte
description: A blueprint for a fleet operations grid - live vehicle status, ETAs, master-detail trip history, and exception highlighting.
date: 2026-08-09
category: Use cases
tags: logistics, fleet, realtime, use case, svelte data grid
author: Kamelia M
---

A fleet or logistics grid is mission control for vehicles in motion: where they are, their status, whether they are on time. It blends live updates, master-detail, and exception highlighting. Here is a blueprint with SvGrid.

![An operations dashboard in SvGrid](/blog-media/industrial-dashboard.png)
*An operations dashboard built with SvGrid.*

## The columns

- **Vehicle / driver** - identity, [pinned left](pinned-frozen-columns).
- **Status** - a [badge](status-badge-cells): Moving, Idle, Stopped, Offline.
- **Location / next stop** - current position summary.
- **ETA / delay** - the operational number; color by lateness.
- **Last update** - timestamp; flag stale GPS.

## Live status

Telemetry streams in; update each vehicle's row in place by id, batched to the frame - the same pattern as the [IoT dashboard](iot-sensor-dashboard) and [trading grid](real-time-trading-grid). A brief flash on status change helps dispatchers notice a vehicle going offline.

## Trip history as detail

Expand a vehicle to see its recent trips or stops in a [master-detail](master-detail-rows) panel, [lazy-loaded](lazy-loading-master-detail-content) so the main board stays light:

```svelte
{#snippet Trips(p: { row: Vehicle })}
  {#await loadTrips(p.row.id) then trips}
    <SvGrid data={trips} columns={tripColumns} />
  {/await}
{/snippet}
```

## Exception-first design

Dispatchers care about what is wrong: late deliveries, idle-too-long, offline units. Use [conditional row styling](conditional-row-styling) to surface exceptions, sort or filter to bring them to the top, and let dispatchers [filter](excel-style-filtering) by region, status, or delay. A "show only exceptions" toggle is the feature they will use most.

## Scale

A national fleet is large; run the grid [server-side](svelte-data-grid-rest-api) with filtering by depot/region, and push live updates to the visible set. Virtualization keeps even a few thousand active vehicles smooth.

## Frequently asked questions

### How do I build a live fleet tracking grid in Svelte?

Use SvGrid with live status updates (batched to the animation frame by vehicle id), master-detail panels for trip history, and conditional row styling to surface exceptions like late or offline vehicles. Run it server-side for large fleets.

### How do I show each vehicle's trip history?

Use master-detail rows: expand a vehicle to reveal its recent trips as a nested grid, lazy-loaded when the row opens so the main board stays fast even with a large fleet.
