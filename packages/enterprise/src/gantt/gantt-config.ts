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
import type { GanttConfig, RowData, SchedulerResource, TableFeatures } from '@svgrid/grid'

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
   * Fold whole non-working days out of the axis: a weekend shrinks to a narrow
   * hatched gap instead of two empty columns, so a year of plan fits in the
   * width a season used to take. Bars that do run over a folded weekend still
   * draw across it.
   *
   * Only the day-granular presets (`day`, `week`) have weekend columns to fold;
   * at `month` and coarser a tick is never wholly non-working, so this is
   * ignored rather than shrinking a week by part of itself.
   */
  collapseWeekends?: boolean;
  /** Width (px) of one folded run's marker. Default 12; `0` removes it outright. */
  collapsedGapPx?: number;

  /**
   * Field naming the resource (person, crew, machine) a task is assigned to,
   * plus the ordered resource list. Shown in the tooltip and, with
   * `resourceHistogram`, summed into a load strip under the chart. Omit
   * `resources` and the strip's rows come from the data, in first-seen order.
   */
  resourceField?: keyof TData & string;
  resources?: ReadonlyArray<SchedulerResource>;
  /**
   * Show a per-resource load histogram below the chart: one row per resource,
   * one bar per axis column, counting the tasks that touch it, with anything
   * past capacity in red. `true` uses the defaults (capacity 1, 88px tall);
   * the object form names a field on each {@link SchedulerResource} holding its
   * capacity, and the strip's total height in px.
   */
  resourceHistogram?: boolean | { capacityField?: string; height?: number };
}
