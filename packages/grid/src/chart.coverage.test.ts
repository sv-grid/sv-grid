import { describe, expect, it } from "vitest";
import {
  buildChart,
  rowsToChartSpec,
  niceLogScale,
  niceScale,
  sampleGradient,
  pickContrastText,
  linearTrend,
  simpleMovingAverage,
  exponentialMovingAverage,
  computeOverlay,
  buildLinePath,
  type ChartSpec,
} from "./chart";

// ---------------------------------------------------------------------------
// Pure scale + color helpers
// ---------------------------------------------------------------------------

describe("niceLogScale", () => {
  it("snaps to decade boundaries spanning the data", () => {
    const s = niceLogScale(3, 4000);
    expect(s.min).toBe(1);
    expect(s.max).toBe(10000);
    expect(s.ticks).toEqual([1, 10, 100, 1000, 10000]);
  });
  it("repairs a non-positive / non-finite min", () => {
    const s = niceLogScale(0, 100);
    expect(s.min).toBe(1);
    expect(s.ticks[0]).toBe(1);
  });
  it("repairs a max that is <= min", () => {
    const s = niceLogScale(10, 5);
    // max forced to min*10 -> decade [10, 100]
    expect(s.max).toBeGreaterThanOrEqual(100);
  });
});

describe("niceScale edge handling", () => {
  it("non-finite inputs collapse to a [0,1] domain", () => {
    const s = niceScale(NaN, Infinity);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(1);
  });
  it("min === max === 0 widens to [0,1]", () => {
    const s = niceScale(0, 0);
    expect(s.min).toBe(0);
    expect(s.max).toBe(1);
  });
  it("min === max (non-zero positive) includes 0 as the floor", () => {
    const s = niceScale(5, 5);
    expect(s.min).toBeLessThanOrEqual(0);
    expect(s.max).toBeGreaterThanOrEqual(5);
  });
  it("min === max (non-zero negative) includes 0 as the ceiling", () => {
    const s = niceScale(-5, -5);
    expect(s.min).toBeLessThanOrEqual(-5);
    expect(s.max).toBeGreaterThanOrEqual(0);
  });
});

describe("sampleGradient", () => {
  it("returns a placeholder for an empty stop list", () => {
    expect(sampleGradient([], 0.5)).toBe("#888");
  });
  it("a single stop ignores t", () => {
    expect(sampleGradient(["#ff0000"], 0.3)).toBe("#ff0000");
  });
  it("clamps t below 0 to the first stop and above 1 to the last", () => {
    expect(sampleGradient(["#000000", "#ffffff"], -2)).toBe("#000000");
    expect(sampleGradient(["#000000", "#ffffff"], 5)).toBe("#ffffff");
  });
  it("interpolates linearly in RGB at the midpoint", () => {
    // halfway between black and white -> grey ~#7f7f7f / #808080
    const mid = sampleGradient(["#000000", "#ffffff"], 0.5);
    expect(mid).toMatch(/^#(7f7f7f|808080)$/);
  });
  it("falls back gracefully when a stop is not parseable hex", () => {
    // 'red' is not #rrggbb -> hexToRgb null -> returns the i-th stop
    const out = sampleGradient(["red", "#ffffff"], 0.25);
    expect(out).toBe("red");
  });
});

describe("pickContrastText", () => {
  it("returns dark text on a light background", () => {
    expect(pickContrastText("#ffffff")).toBe("#0f172a");
  });
  it("returns light text on a dark background", () => {
    expect(pickContrastText("#000000")).toBe("#ffffff");
  });
  it("falls back to dark text for an unparseable color", () => {
    expect(pickContrastText("not-a-color")).toBe("#0f172a");
  });
});

// ---------------------------------------------------------------------------
// Overlay math (trend / moving averages)
// ---------------------------------------------------------------------------

describe("linearTrend", () => {
  it("fits a straight line through perfectly linear data", () => {
    const out = linearTrend([0, 2, 4, 6]);
    expect(out).toEqual([0, 2, 4, 6]);
  });
  it("returns NaNs when fewer than 2 finite points exist", () => {
    expect(linearTrend([5]).every(Number.isNaN)).toBe(true);
    expect(linearTrend([NaN, NaN]).every(Number.isNaN)).toBe(true);
  });
  it("returns the mean when the x-variance is degenerate", () => {
    // Two identical-index points can't happen here, but a flat series with a
    // single repeated value still fits a horizontal line at the mean.
    const out = linearTrend([3, 3, 3]);
    for (const v of out) expect(v).toBeCloseTo(3);
  });
  it("ignores non-finite points when fitting", () => {
    const out = linearTrend([0, NaN, 4]);
    expect(out[0]).toBeCloseTo(0);
    expect(out[2]).toBeCloseTo(4);
  });
});

describe("simpleMovingAverage", () => {
  it("period < 1 returns a copy of the input", () => {
    const input = [1, 2, 3];
    const out = simpleMovingAverage(input, 0);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
  it("trails NaN until the window is full, then averages", () => {
    const out = simpleMovingAverage([2, 4, 6, 8], 2);
    expect(Number.isNaN(out[0]!)).toBe(true);
    expect(out[1]).toBeCloseTo(3);
    expect(out[2]).toBeCloseTo(5);
    expect(out[3]).toBeCloseTo(7);
  });
  it("skips non-finite values inside the window", () => {
    const out = simpleMovingAverage([2, NaN, 6, 8], 2);
    expect(out.length).toBe(4);
  });
});

describe("exponentialMovingAverage", () => {
  it("seeds on the first finite value then smooths", () => {
    const out = exponentialMovingAverage([10, 20], 1);
    expect(out[0]).toBeCloseTo(10);
    expect(out[1]).toBeGreaterThan(10);
  });
  it("carries the previous value across a non-finite point", () => {
    const out = exponentialMovingAverage([10, NaN, 20], 3);
    expect(out[1]).toBeCloseTo(out[0]!);
  });
  it("yields NaN before the first finite value", () => {
    const out = exponentialMovingAverage([NaN, 5], 2);
    expect(Number.isNaN(out[0]!)).toBe(true);
    expect(out[1]).toBeCloseTo(5);
  });
});

describe("computeOverlay", () => {
  it("dispatches 'linear' to the regression fit", () => {
    expect(computeOverlay([0, 2, 4], "linear")).toEqual([0, 2, 4]);
  });
  it("dispatches sma:N to the simple moving average", () => {
    const out = computeOverlay([2, 4, 6], "sma:2");
    expect(Number.isNaN(out[0]!)).toBe(true);
    expect(out[1]).toBeCloseTo(3);
  });
  it("dispatches ema:N to the exponential moving average", () => {
    const out = computeOverlay([10, 20, 30], "ema:2");
    expect(out[0]).toBeCloseTo(10);
  });
  it("returns all-NaN for an unrecognised overlay spec", () => {
    const out = computeOverlay([1, 2, 3], "bogus:7" as any);
    expect(out.every(Number.isNaN)).toBe(true);
  });
});

describe("buildLinePath", () => {
  it("breaks the polyline at undefined gaps (multiple M commands)", () => {
    const path = buildLinePath(
      [
        { x: 0, y: 0, defined: true },
        { x: 1, y: 1, defined: false },
        { x: 2, y: 2, defined: true },
      ],
      false,
    );
    expect((path.match(/M/g) ?? []).length).toBe(2);
  });
  it("smooth mode emits cubic bezier (C) segments", () => {
    const path = buildLinePath(
      [
        { x: 0, y: 0, defined: true },
        { x: 1, y: 2, defined: true },
        { x: 2, y: 1, defined: true },
      ],
      true,
    );
    expect(path).toContain("C");
  });
  it("smooth two-point run is a straight line", () => {
    const path = buildLinePath(
      [
        { x: 0, y: 0, defined: true },
        { x: 1, y: 1, defined: true },
      ],
      true,
    );
    expect(path).toContain("L");
  });
});

// ---------------------------------------------------------------------------
// buildChart: log scales, time vs category, overlays, annotations, patterns
// ---------------------------------------------------------------------------

describe("buildChart: log y-scale", () => {
  it("plots bars from the axis floor up; ticks are decade boundaries", () => {
    const g = buildChart({
      type: "bar",
      yScale: "log",
      categories: ["A", "B", "C"],
      series: [{ label: "s", values: [10, 1000, 100000] }],
    });
    // decade ticks
    expect(g.yTicks.some((t) => t.value === 10)).toBe(true);
    expect(g.yTicks.some((t) => t.value === 100000)).toBe(true);
    expect(g.bars).toHaveLength(3);
  });
  it("drops non-positive bar values on a log axis", () => {
    const g = buildChart({
      type: "bar",
      yScale: "log",
      categories: ["A", "B"],
      series: [{ label: "s", values: [0, 100] }],
    });
    // the zero-value bar is omitted (invalid in log space)
    expect(g.bars).toHaveLength(1);
    expect(g.bars[0]!.value).toBe(100);
  });
  it("a dual-axis chart can log-scale the right axis independently", () => {
    const g = buildChart({
      type: "bar",
      y2Scale: "log",
      categories: ["A", "B"],
      series: [
        { label: "rev", values: [10, 20], axis: "left" },
        { label: "hits", values: [100, 100000], axis: "right", type: "line" },
      ],
    });
    expect(g.hasRightAxis).toBe(true);
    expect(g.y2Ticks.length).toBeGreaterThan(1);
  });
});

describe("buildChart: time axis edge cases", () => {
  it("falls back to category spacing when no date parses", () => {
    const g = buildChart({
      type: "line",
      xType: "time",
      categories: ["not-a-date", "also-bad"],
      series: [{ label: "s", values: [1, 2] }],
    });
    // unparseable -> uniform category positions, labels are the raw strings
    expect(g.xTicks.map((t) => t.label)).toEqual(["not-a-date", "also-bad"]);
  });
});

describe("buildChart: overlays", () => {
  it("adds a dashed trend overlay line parallel to the series", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B", "C", "D"],
      series: [{ label: "s", values: [1, 3, 2, 5], overlay: "linear" }],
    });
    expect(g.overlays).toHaveLength(1);
    expect(g.overlays[0]!.label).toContain("linear");
    expect(g.overlays[0]!.path.startsWith("M")).toBe(true);
  });
  it("honours overlayColor when provided", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B"],
      series: [
        {
          label: "s",
          values: [1, 2],
          overlay: "sma:2",
          overlayColor: "#123456",
        },
      ],
    });
    expect(g.overlays[0]!.color).toBe("#123456");
  });
});

describe("buildChart: annotations", () => {
  it("anchors a category annotation to a named series value", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B", "C"],
      series: [{ label: "rev", values: [10, 20, 30] }],
      annotations: [{ at: { category: "B", series: "rev" }, label: "Spike" }],
    });
    expect(g.annotations).toHaveLength(1);
    expect(g.annotations[0]!.label).toBe("Spike");
    expect(Number.isFinite(g.annotations[0]!.x)).toBe(true);
    expect(g.annotations[0]!.placement).toBe("top");
  });
  it("skips annotations whose category is not present", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B"],
      series: [{ label: "s", values: [1, 2] }],
      annotations: [{ at: { category: "Z" }, label: "Nope" }],
    });
    expect(g.annotations).toHaveLength(0);
  });
  it("resolves a raw x/y data-space annotation against the left axis", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B"],
      series: [{ label: "s", values: [10, 20] }],
      annotations: [
        { at: { x: 0, y: 15 }, label: "Mid", color: "#abcdef", placement: "bottom" },
      ],
    });
    expect(g.annotations).toHaveLength(1);
    expect(g.annotations[0]!.color).toBe("#abcdef");
    expect(g.annotations[0]!.placement).toBe("bottom");
  });
});

describe("buildChart: confidence band", () => {
  it("builds a band path when upper+lower envelopes are supplied", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B", "C"],
      series: [
        {
          label: "s",
          values: [10, 20, 30],
          upperValues: [12, 23, 34],
          lowerValues: [8, 17, 26],
        },
      ],
    });
    expect(g.lines[0]!.bandPath).toBeTruthy();
    expect(g.lines[0]!.bandPath!.endsWith("Z")).toBe(true);
  });
  it("omits the band when the envelope lengths don't align", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B"],
      series: [
        { label: "s", values: [1, 2], upperValues: [3], lowerValues: [0] },
      ],
    });
    expect(g.lines[0]!.bandPath).toBe("");
  });
});

describe("buildChart: smooth line", () => {
  it("smooth produces a curved (C) path", () => {
    const g = buildChart({
      type: "line",
      categories: ["A", "B", "C"],
      series: [{ label: "s", values: [1, 3, 2], smooth: true }],
    });
    expect(g.lines[0]!.path).toContain("C");
  });
  it("smooth area builds a closed filled path", () => {
    const g = buildChart({
      type: "area",
      categories: ["A", "B", "C"],
      series: [{ label: "s", values: [1, 3, 2], smooth: "monotone" }],
    });
    expect(g.lines[0]!.areaPath.endsWith("Z")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildChart: specialty chart types
// ---------------------------------------------------------------------------

describe("buildChart: waterfall", () => {
  it("running totals + connectors + total bars", () => {
    const g = buildChart({
      type: "waterfall",
      categories: ["Start", "Up", "Down", "End"],
      series: [{ label: "s", values: [100, 50, -30, 0] }],
      waterfallTotals: [false, false, false, true],
    });
    expect(g.bars).toHaveLength(4);
    // total bar (index 3) spans from 0 to the running cumulative (120)
    expect(g.bars[3]!.value).toBeCloseTo(120);
    // a connector line exists between bar tops
    expect(g.lines[0]!.path).toContain("M");
  });
  it("colors positive/negative/total via waterfallColors overrides", () => {
    const g = buildChart({
      type: "waterfall",
      categories: ["A", "B", "T"],
      series: [{ label: "s", values: [10, -5, 0] }],
      waterfallTotals: [false, false, true],
      waterfallColors: { positive: "#0f0", negative: "#f00", total: "#00f" },
    });
    expect(g.bars[0]!.color).toBe("#0f0");
    expect(g.bars[1]!.color).toBe("#f00");
    expect(g.bars[2]!.color).toBe("#00f");
  });
  it("returns the empty geometry when there is no series", () => {
    const g = buildChart({ type: "waterfall", categories: ["A"], series: [] });
    expect(g.bars).toHaveLength(0);
  });
});

describe("buildChart: funnel", () => {
  it("trapezoids with conversion + dropoff metrics", () => {
    const g = buildChart({
      type: "funnel",
      categories: ["Visits", "Signups", "Paid"],
      series: [{ label: "s", values: [1000, 400, 100] }],
    });
    expect(g.funnelSegments).toHaveLength(3);
    expect(g.funnelSegments[0]!.conversion).toBeCloseTo(1);
    expect(g.funnelSegments[2]!.conversion).toBeCloseTo(0.1);
    // dropoff from 1000 -> 400 is 60%
    expect(g.funnelSegments[1]!.dropoff).toBeCloseTo(0.6);
    expect(g.funnelSegments[0]!.path).toContain("Z");
  });
  it("returns empty geometry for an empty series", () => {
    const g = buildChart({ type: "funnel", categories: [], series: [{ label: "s", values: [] }] });
    expect(g.funnelSegments).toHaveLength(0);
  });
});

describe("buildChart: radar", () => {
  it("one polygon per series + axis spokes + rings", () => {
    const g = buildChart({
      type: "radar",
      categories: ["Speed", "Power", "Range", "Cost"],
      series: [
        { label: "X", values: [3, 5, 2, 4] },
        { label: "Y", values: [5, 1, 4, 3] },
      ],
    });
    expect(g.radarAxes).toHaveLength(4);
    expect(g.radarSeries).toHaveLength(2);
    expect(g.radarRings).toHaveLength(5);
    expect(g.radarSeries[0]!.path.endsWith("Z")).toBe(true);
    expect(g.radarCenter).not.toBeNull();
  });
  it("returns empty geometry with no series or categories", () => {
    expect(buildChart({ type: "radar", categories: [], series: [] }).radarSeries).toHaveLength(0);
    expect(
      buildChart({ type: "radar", categories: ["A"], series: [] }).radarAxes,
    ).toHaveLength(0);
  });
  it("guards against an all-zero max (vMax defaults to 1)", () => {
    const g = buildChart({
      type: "radar",
      categories: ["A", "B"],
      series: [{ label: "z", values: [0, 0] }],
    });
    expect(g.radarSeries[0]!.path).toBeTruthy();
  });
});

describe("buildChart: calendar heatmap", () => {
  it("emits one cell per day with month ticks + a legend", () => {
    const g = buildChart({
      type: "calendar",
      categories: [],
      series: [],
      calendarValues: [
        { date: "2026-01-05", value: 3 },
        { date: "2026-01-06", value: 9 },
        { date: "2026-02-02", value: 5 },
      ],
    });
    expect(g.calendarCells.length).toBeGreaterThan(7);
    expect(g.calendarLegend).toHaveLength(5);
    // a defined day carries its value + a non-transparent color
    const defined = g.calendarCells.find((c) => c.date === "2026-01-05");
    expect(defined!.defined).toBe(true);
    expect(defined!.value).toBe(3);
    expect(defined!.color).not.toBe("transparent");
    // an undefined day in the range is blank
    const blank = g.calendarCells.find((c) => !c.defined);
    expect(blank!.color).toBe("transparent");
    expect(g.calendarMonthTicks.length).toBeGreaterThanOrEqual(1);
  });
  it("honours explicit calendarStart even with no values", () => {
    const g = buildChart({
      type: "calendar",
      categories: [],
      series: [],
      calendarStart: "2026-03-01",
      calendarEnd: "2026-03-14",
    });
    expect(g.calendarCells.length).toBeGreaterThan(0);
  });
  it("returns empty geometry with neither values nor a start", () => {
    const g = buildChart({ type: "calendar", categories: [], series: [] });
    expect(g.calendarCells).toHaveLength(0);
  });
});

describe("buildChart: gauge", () => {
  it("track + value arcs, ticks, needle, clamped value", () => {
    const g = buildChart({
      type: "gauge",
      categories: [],
      series: [],
      gaugeValue: 150, // clamped to max
      gaugeMin: 0,
      gaugeMax: 100,
      gaugeTarget: 80,
      gaugeRanges: [
        { from: 0, to: 50, color: "#f00" },
        { from: 50, to: 100, color: "#0f0" },
      ],
      gaugeUnit: "%",
    });
    expect(g.gauge).not.toBeNull();
    expect(g.gauge!.value).toBe(100); // clamped
    expect(g.gauge!.unit).toBe("%");
    expect(g.gauge!.trackPath).toContain("A");
    expect(g.gauge!.valuePath).toContain("A");
    expect(g.gauge!.ticks.length).toBeGreaterThan(0);
    expect(g.gauge!.target).not.toBeNull();
    // value 100 sits in the second band
    expect(g.gauge!.valueColor).toBe("#0f0");
    expect(g.gauge!.needle.path).toContain("Z");
  });
  it("no target marker when gaugeTarget is unset", () => {
    const g = buildChart({
      type: "gauge",
      categories: [],
      series: [],
      gaugeValue: 40,
    });
    expect(g.gauge!.target).toBeNull();
    expect(g.gauge!.valueColor).toBeNull();
  });
});

describe("buildChart: treemap", () => {
  it("lays out leaf + branch cells with depth", () => {
    const g = buildChart({
      type: "treemap",
      categories: [],
      series: [],
      width: 400,
      height: 300,
      treemap: {
        name: "root",
        children: [
          {
            name: "A",
            children: [
              { name: "A1", value: 30 },
              { name: "A2", value: 20 },
            ],
          },
          { name: "B", value: 50 },
        ],
      },
    });
    expect(g.treemapCells.length).toBeGreaterThan(0);
    // both leaves + a parent cell present; depths >= 0
    const names = g.treemapCells.map((c) => c.name);
    expect(names).toContain("B");
    expect(g.treemapCells.every((c) => c.depth >= 0)).toBe(true);
  });
  it("returns empty geometry with no root", () => {
    const g = buildChart({ type: "treemap", categories: [], series: [] });
    expect(g.treemapCells).toHaveLength(0);
  });
});

describe("buildChart: sankey", () => {
  it("places nodes in columns and builds curved ribbon links", () => {
    const g = buildChart({
      type: "sankey",
      categories: [],
      series: [],
      sankeyNodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      sankeyLinks: [
        { source: "a", target: "b", value: 10 },
        { source: "b", target: "c", value: 6 },
        { source: "a", target: "c", value: 4 },
      ],
    });
    expect(g.sankeyNodes.length).toBe(3);
    expect(g.sankeyLinks.length).toBe(3);
    // columns increase along the flow
    const colOf = (id: string) => g.sankeyNodes.find((n) => n.id === id)!.column;
    expect(colOf("a")).toBeLessThan(colOf("c"));
    expect(g.sankeyLinks[0]!.path).toContain("C");
  });
  it("returns empty geometry when nodes or links are missing", () => {
    expect(
      buildChart({ type: "sankey", categories: [], series: [], sankeyNodes: [], sankeyLinks: [] })
        .sankeyNodes,
    ).toHaveLength(0);
  });
});

describe("buildChart: heatmap", () => {
  it("one cell per (row,col), legend + axis ticks, contrast text", () => {
    const g = buildChart({
      type: "heatmap",
      categories: ["Q1", "Q2", "Q3"],
      series: [
        { label: "North", values: [1, 5, 9] },
        { label: "South", values: [2, 6, 8] },
      ],
    });
    expect(g.heatmapCells).toHaveLength(6);
    expect(g.heatmapRowTicks.map((t) => t.label)).toEqual(["North", "South"]);
    expect(g.heatmapColTicks.map((t) => t.label)).toEqual(["Q1", "Q2", "Q3"]);
    expect(g.heatmapLegend).toHaveLength(5);
    for (const c of g.heatmapCells) {
      expect(["#0f172a", "#ffffff"]).toContain(c.textColor);
    }
  });
  it("diverging scale is auto-picked for signed data", () => {
    const g = buildChart({
      type: "heatmap",
      categories: ["A", "B"],
      series: [{ label: "r", values: [-5, 5] }],
    });
    expect(g.heatmapCells).toHaveLength(2);
  });
  it("a custom color-scale array is honoured", () => {
    const g = buildChart({
      type: "heatmap",
      categories: ["A", "B"],
      series: [{ label: "r", values: [0, 10] }],
      colorScale: ["#000000", "#ffffff"],
    });
    expect(g.heatmapCells).toHaveLength(2);
  });
  it("returns empty geometry with no series", () => {
    const g = buildChart({ type: "heatmap", categories: ["A"], series: [] });
    expect(g.heatmapCells).toHaveLength(0);
  });
  it("dark theme uses the dark ramps without error", () => {
    const g = buildChart(
      {
        type: "heatmap",
        categories: ["A"],
        series: [{ label: "r", values: [3] }],
      },
      "dark",
    );
    expect(g.heatmapCells).toHaveLength(1);
  });
});

describe("buildChart: stacked horizontal + dual-axis stacks", () => {
  it("stacked horizontal bars share a category band", () => {
    const g = buildChart({
      type: "bar",
      orientation: "horizontal",
      stacked: true,
      categories: ["A"],
      series: [
        { label: "x", values: [10] },
        { label: "y", values: [20] },
      ],
    });
    expect(g.orientation).toBe("horizontal");
    expect(g.bars).toHaveLength(2);
    // stacked: second segment starts where the first ended
    expect(g.bars[1]!.x).toBeGreaterThanOrEqual(g.bars[0]!.x);
  });
  it("stacked100 horizontal renders percent value ticks", () => {
    const g = buildChart({
      type: "bar",
      orientation: "horizontal",
      stacked100: true,
      categories: ["A"],
      series: [
        { label: "x", values: [1] },
        { label: "y", values: [3] },
      ],
    });
    expect(g.valueTicks.some((t) => t.label.includes("%"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rowsToChartSpec: remaining branches
// ---------------------------------------------------------------------------

describe("rowsToChartSpec: sort + idField + topN rowIds", () => {
  const rows = [
    { id: "r1", region: "EMEA", revenue: 100 },
    { id: "r2", region: "APAC", revenue: 200 },
    { id: "r3", region: "AMER", revenue: 50 },
    { id: "r4", region: "EMEA", revenue: 80 },
  ];

  it("sort 'value-asc' orders categories by ascending total", () => {
    const spec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      sort: "value-asc",
    });
    // totals: EMEA=180, APAC=200, AMER=50 -> asc: AMER, EMEA, APAC
    expect(spec.categories).toEqual(["AMER", "EMEA", "APAC"]);
  });

  it("sort 'category' orders categories alphabetically", () => {
    const spec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      sort: "category",
    });
    expect(spec.categories).toEqual(["AMER", "APAC", "EMEA"]);
  });

  it("idField populates rowIds parallel to values", () => {
    const spec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      idField: "id",
    });
    const emea = spec.categories.indexOf("EMEA");
    expect(spec.series[0]!.rowIds![emea]).toEqual(["r1", "r4"]);
  });

  it("topN with idField buckets remainder rowIds into 'Other'", () => {
    const spec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      idField: "id",
      topN: 1,
      otherLabel: "Rest",
    });
    // top category by total is APAC (200); the rest collapse into "Rest"
    expect(spec.categories).toEqual(["APAC", "Rest"]);
    const otherIds = spec.series[0]!.rowIds![1]!;
    // EMEA (r1,r4) + AMER (r3) bucketed together
    expect(otherIds.sort()).toEqual(["r1", "r3", "r4"]);
  });

  it("seriesLabel renames the single value series", () => {
    const spec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      seriesLabel: "Sales",
    });
    expect(spec.series[0]!.label).toBe("Sales");
  });

  it("pivot via the series field with idField tracks ids per series", () => {
    const spec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      series: "region",
      idField: "id",
    });
    expect(spec.series.length).toBeGreaterThan(0);
    expect(spec.series[0]!.rowIds).toBeTruthy();
  });

  it("non-numeric value cells are skipped from the aggregate", () => {
    const dirty = [
      { region: "A", revenue: 10 },
      { region: "A", revenue: "n/a" as any },
      { region: "A", revenue: 20 },
    ];
    const spec = rowsToChartSpec(dirty, {
      type: "bar",
      category: "region",
      value: "revenue",
      reduce: "count",
    });
    // only 2 finite numbers counted
    expect(spec.series[0]!.values).toEqual([2]);
  });

  it("passes width/height/stacked/palette through to the spec", () => {
    const spec: ChartSpec = rowsToChartSpec(rows, {
      type: "bar",
      category: "region",
      value: "revenue",
      width: 600,
      height: 400,
      stacked: true,
      palette: ["#111", "#222"],
    });
    expect(spec.width).toBe(600);
    expect(spec.height).toBe(400);
    expect(spec.stacked).toBe(true);
    expect(spec.palette).toEqual(["#111", "#222"]);
  });
});
