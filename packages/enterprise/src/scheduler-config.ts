/**
 * SchedulerProConfig - the Enterprise ("Scheduler Pro") superset of the free grid
 * {@link SchedulerConfig}. The base scheduler prop + its config type ship in
 * `@svgrid/grid`; the Pro renderer (SvGridScheduler) reads these extra fields at
 * runtime (the renderer is registered untyped, so nothing in the free grid needs
 * to know about them). Consumers using Pro features type their config as
 * `SchedulerProConfig` - it is structurally assignable to the `scheduler` prop.
 *
 * All three feature waves live here:
 *   - Wave A: event dependencies + auto-reschedule
 *   - Wave B: multi-assignment + resource histogram + column summary
 *   - Wave C: non-working-time collapse + continuous zoom
 */
import type {
  SchedulerConfig,
  SchedulerResource,
  TableFeatures,
  RowData,
} from '@svgrid/grid'
import type { SchedulerDependency } from './scheduler-dependencies'
import type { SchedulerAssignment } from './scheduler-assignments'
import type { ColumnReducer } from './scheduler-summary'
import type { ZoomLevel } from './scheduler-axis'
import type { SchedulerResourceGroup } from './scheduler-resource-tree'

export type SchedulerProConfig<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = SchedulerConfig<TFeatures, TData> & {
  // --- Wave A: dependencies + auto-reschedule --------------------------------
  /**
   * Event dependency links (predecessor -> successor). `from` / `to` are row ids
   * (the grid's `getRowId`). Draw arrows between linked events and, with
   * `autoReschedule`, push successors forward when a predecessor moves.
   */
  dependencies?: ReadonlyArray<SchedulerDependency>;
  /**
   * Per-row field holding this row's dependency links (as `SchedulerDependency[]`
   * or a `to`-key list). An alternative to the flat `dependencies` list.
   */
  dependencyField?: keyof TData & string;
  /**
   * Cascade successors forward on move / resize to keep every link legal.
   * Defaults to `true` when any dependency is present.
   */
  autoReschedule?: boolean;
  /** When cascading, skip non-working intervals (business hours / shifts). */
  dependencyRespectWorkingTime?: boolean;
  /** Fired with the cascaded shifts after a move / resize (never mutates rows). */
  onDependenciesChange?: (moves: Array<{ id: string; start: Date; end: Date }>) => void;
  /** Fired when the user draws a new link (drag from one event edge onto another). */
  onDependencyAdd?: (dep: SchedulerDependency) => void;
  /** Fired when the user removes a link (arrow context menu). */
  onDependencyRemove?: (id: string) => void;

  // --- Grouped / tree resources (timeline) -----------------------------------
  /**
   * Group the timeline's resource rows into a collapsible tree. `resourceGroups`
   * defines the group nodes (nest via `parentId`); `resourceGroupOf` maps each
   * resource to its group id. Resources with no / unknown group trail ungrouped.
   */
  resourceGroups?: ReadonlyArray<SchedulerResourceGroup>;
  resourceGroupOf?: (resource: SchedulerResource) => string | undefined;
  /** Allow collapsing group headers (default true when `resourceGroups` is set). */
  collapsibleGroups?: boolean;
  /** localStorage key to persist which groups are collapsed. */
  groupPersistKey?: string;

  // --- Eligibility / skill matching (a booking rule) --------------------------
  /**
   * Restrict which events may be placed on which resources (provider matching,
   * room type, technician skills). Return `false` and a drag / resize / create
   * onto that resource is rejected + a "Not eligible" flash. The most flexible
   * form; takes precedence over the declarative `requiresField` shortcut.
   */
  eligible?: (event: TData, resource: SchedulerResource) => boolean;
  /**
   * Declarative shortcut: a per-event field holding the required skill tag(s).
   * An event is eligible for a resource only if the resource's skills (via
   * `resourceSkillsOf`, or a `skills` array on the resource) include every tag.
   */
  requiresField?: keyof TData & string;
  /** Where a resource's skill tags come from (default: a `skills` array on it). */
  resourceSkillsOf?: (resource: SchedulerResource) => ReadonlyArray<string> | undefined;

  // --- Booking-rule depth (buffers / lead time / duration / travel) ----------
  /** Required clear minutes before / after each booking on a resource (a flat
   *  number, or a function of the event). A move / create that breaks it is rejected. */
  bufferBeforeMin?: number | ((event: TData) => number);
  bufferAfterMin?: number | ((event: TData) => number);
  /** Minimum notice: a booking must start at least this many minutes after "now". */
  minLeadMin?: number;
  /** Min / max booking duration in minutes. */
  minDurationMin?: number;
  maxDurationMin?: number;
  /** Travel time (minutes) required between two consecutive bookings on the same
   *  resource - widens the buffer by the trip between their locations. */
  travelTimeOf?: (from: TData, to: TData) => number;

  // --- Bookable slots / find-a-time (Calendly-style) --------------------------
  /**
   * Show the open, bookable slots of a fixed duration per resource in the Day
   * timeline - the free time left after existing bookings, buffers and lead time.
   * Clicking a slot books it (via `onSlotPick`, else `onEventAdd`).
   */
  bookable?: { durationMin: number; stepMin?: number };
  /** Fired when a bookable slot is clicked. Falls back to `onEventAdd`. */
  onSlotPick?: (start: Date, end: Date, resourceId?: string) => void;

  // --- Multi-calendar overlay -------------------------------------------------
  /**
   * Overlay several calendars, each colour-coded and toggleable from a legend.
   * Events map to a calendar via `calendarField`; a calendar's colour becomes the
   * event's default (unless `colorField` overrides), and hiding a calendar filters
   * its events out of every view.
   */
  calendars?: ReadonlyArray<{ id: string; title: string; color?: string; hidden?: boolean }>;
  calendarField?: keyof TData & string;

  // --- Free/busy availability (for find-a-time) -------------------------------
  /**
   * External busy intervals to shade on a resource's timeline row - times it is
   * unavailable that aren't events in this scheduler (its own calendar). Combine
   * with the exported `commonFree` helper to find a meeting time across attendees.
   */
  freeBusyOf?: (resource: SchedulerResource) => ReadonlyArray<{ start: Date; end: Date }>;

  // --- Wave B: multi-assignment + summaries ----------------------------------
  /**
   * Many-to-many event <-> resource assignments. When set, one event can appear
   * under several resources; drives the timeline / resource-column bucketing
   * instead of the single `resourceField`.
   */
  assignments?: ReadonlyArray<SchedulerAssignment>;
  /** Per-row field holding an array of resource ids (alt to the flat `assignments`). */
  assignmentField?: keyof TData & string;
  /**
   * Show a per-resource utilization histogram band (timeline views). `true` uses
   * defaults; the object form sets a capacity field + band height (px).
   */
  resourceHistogram?: boolean | { capacityField?: keyof SchedulerResource & string; height?: number };
  /**
   * Tint each resource row's BACKGROUND by load per time-bucket (a utilization
   * heatmap) - distinct from the histogram bar strip. `true` uses defaults; the
   * object form sets the capacity field (over that = a hot / red cell).
   */
  utilizationHeatmap?: boolean | { capacityField?: keyof SchedulerResource & string };
  /**
   * A per-time-column summary strip (counts / sums / a custom reducer) aligned to
   * the axis. `false` (default) hides it.
   */
  columnSummary?: false | {
    reducer: ColumnReducer<TData>;
    label?: string;
    position?: 'top' | 'bottom';
  };
  /** Fired when an event is dragged from one resource column to another (reassign). */
  onAssignmentChange?: (change: { eventId: string; from?: string; to?: string }) => void;

  // --- Wave C: axis collapse + zoom ------------------------------------------
  /** Compress non-working hours out of the time axis (nights collapse to a gap). */
  collapseNonWorking?: boolean;
  /** Compress `nonWorkingDays` (e.g. weekends) out of the timeline axis. */
  collapseWeekends?: boolean;
  /** Width (px) of a collapsed-gap marker. Default 12; `0` omits it entirely. */
  collapsedGapPx?: number;
  /**
   * Minimum width (px) of one timeline minor tick (a day in Week / Month). Widens
   * the timeline - and scrolls it horizontally - so narrow, sub-day events (e.g.
   * hour-scale shifts) have room for their label. Overrides the per-view default.
   */
  timelineTickMinWidth?: number;
  /** Continuous zoom preset - supersedes `slotSizes` when set (minute .. year). */
  zoom?: number | ZoomLevel;
  /** Custom zoom-preset ladder (replaces the built-in one). */
  zoomLevels?: ReadonlyArray<ZoomLevel>;
  /** Fired when the zoom level changes (slider / wheel). */
  onZoomChange?: (level: ZoomLevel) => void;
}
