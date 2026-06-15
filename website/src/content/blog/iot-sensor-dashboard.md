---
title: Building an IoT Sensor Dashboard in Svelte
description: A blueprint for an IoT/telemetry grid - live sensor readings, sparkline trends, threshold alerts, and high-frequency updates that stay smooth.
date: 2026-08-06
category: Use cases
tags: iot, sensors, realtime, use case, svelte data grid
author: Victor Vidolov
---

An IoT dashboard is a wall of live numbers: temperatures, pressures, battery levels, all updating constantly. It is a data grid plus a real-time feed plus visual alerting. Here is a blueprint built with SvGrid.

![A live dashboard grid in SvGrid](/blog-media/live-dashboard.png)
*A live, updating dashboard grid in SvGrid.*

## The columns

- **Device / sensor** - identity, often [pinned left](pinned-frozen-columns).
- **Current value** - the live reading, formatted with units.
- **Trend** - a [sparkline cell](sparkline-cells) of the last N readings.
- **Status** - a [badge](status-badge-cells): OK / Warning / Critical.
- **Last seen** - a timestamp; flag stale devices.

## High-frequency updates

Sensors can report many times a second. Update rows in place by device id and batch to the animation frame so rendering never outpaces the screen:

```ts
const index = new Map<string, number>()
const pending = new Map<string, Reading>()
function onReading(r: Reading) {
  pending.set(r.id, r)
  scheduleFlush() // requestAnimationFrame
}
```

See [throttling live updates](throttle-live-updates-animation-frames) and the [trading grid](real-time-trading-grid), which use the same engine.

## Threshold alerts

The point of the dashboard is catching problems. Drive [conditional row styling](conditional-row-styling) from each reading against its thresholds - tint warning rows amber, critical red - and pair color with a status badge so alerts are not color-only. Sort critical to the top so the worst is always visible.

## Stale-device detection

A sensor that stops reporting is itself an alert. Compare each device's last-seen timestamp to now and flag the gap - a stale device is often more urgent than a high reading.

## Scale

Thousands of sensors stay smooth: virtualization bounds the DOM, and updating only changed cells keeps each frame cheap. For very large fleets, page or group by site/zone server-side, and keep live updates on the visible page.

## Frequently asked questions

### Can a Svelte data grid show live IoT sensor data?

Yes. Update rows in place by device id, batch high-frequency readings to the animation frame so rendering stays at ~60fps, and use sparklines and threshold-based row coloring to surface trends and alerts. Virtualization keeps thousands of sensors smooth.

### How do I highlight sensors that exceed thresholds?

Use conditional row styling driven by each reading against its limits - amber for warning, red for critical - paired with a status badge so it is not color-only, and sort critical rows to the top so problems stay visible.
