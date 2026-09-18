/**
 * GanttProConfig - the Enterprise superset of the free grid {@link GanttConfig}.
 * The `gantt` prop and its base config type ship in `@svgrid/grid`; the Pro
 * renderer (SvGridGantt) reads these extra fields at runtime through a cast
 * (the renderer is registered untyped, so nothing in the free grid needs to
 * know about them). Consumers using Pro features type their config as
 * `GanttProConfig` - it is structurally assignable to the `gantt` prop.
 *
 * Mirrors `scheduler-config.ts`, which does the same for the calendar.
 */
import type { GanttConfig, GanttZoom, RowData, SchedulerResource, TableFeatures } from '@svgrid/grid'
import type { ZoomLevel } from '../scheduler-axis'

/**
 * How a task's dates are pinned, in the classic planning vocabulary:
 * `ASAP` (the default - schedule as early as links allow), `ALAP` (as late as
 * possible), `MSO` / `MFO` (must start / finish on the constraint date),
 * `SNET` / `SNLT` (start no earlier / later than), `FNET` / `FNLT` (finish no
 * earlier / later than).
 */
export type GanttConstraint =
  | 'ASAP'
  | 'ALAP'
  | 'MSO'
  | 'MFO'
  | 'SNET'
  | 'SNLT'
  | 'FNET'
  | 'FNLT'

export type GanttProConfig<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = GanttConfig<TFeatures, TData> & {
  /**
   * Highlight the critical path: the chain of linked tasks with no slack,
   * where any slip moves the project's finish. Needs `dependencies`.
   */
  criticalPath?: boolean;
  /** Fired with the critical task ids whenever the path is recomputed. */
  onCriticalPathChange?: (keys: string[]) => void;

  /**
   * Fields holding the BASELINE (originally agreed) dates, drawn as a ghost bar
   * under each task so drift from the plan is visible.
   */
  baselineStartField?: keyof TData & string;
  baselineEndField?: keyof TData & string;

  /**
   * Per-row scheduling constraint (see {@link GanttConstraint}) and the date it
   * refers to. A cascade that would violate one stops at the constraint and the
   * bar is flagged rather than moved past it.
   */
  constraintField?: keyof TData & string;
  constraintDateField?: keyof TData & string;

  /**
   * Continuous zoom. A {@link GanttZoom} preset keeps the day-granular axis; a
   * number (an index into `zoomLevels`) or an explicit {@link ZoomLevel}
   * switches to the pixel axis shared with the scheduler, which brings
   * hour-level ticks and non-working-time collapse.
   */
  zoom?: GanttZoom | number | ZoomLevel;
  zoomLevels?: ReadonlyArray<GanttZoom> | ReadonlyArray<ZoomLevel>;
  /** Compress whole non-working days out of the axis (weekends fold to a gap). */
  collapseWeekends?: boolean;
  /** Width (px) of a collapsed-gap marker. Default 12; `0` omits it entirely. */
  collapsedGapPx?: number;

  /**
   * Field naming the resource (person, crew, machine) a task is assigned to,
   * plus the ordered resource list. Shown in the tooltip and, with
   * `resourceHistogram`, summed into a load strip under the chart.
   */
  resourceField?: keyof TData & string;
  resources?: ReadonlyArray<SchedulerResource>;
  /**
   * Show a per-resource load histogram below the chart. `true` uses defaults;
   * the object form names the capacity field and the strip's height (px).
   */
  resourceHistogram?: boolean | { capacityField?: string; height?: number };
}
