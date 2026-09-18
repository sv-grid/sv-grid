/**
 * `@svgrid/enterprise/gantt` - the Gantt view, as its own entry point for apps
 * that want the project chart without pulling the rest of the Pro pack. Every
 * name here is also re-exported from the package root, so
 * `import { enableGanttView } from '@svgrid/enterprise'` works just as well.
 *
 * The `gantt` prop and its config types live in `@svgrid/grid`; this package
 * holds the renderer, the layout model and the planning helpers.
 */
export { enableGanttView, SvGridGantt } from './gantt'
export type { GanttProConfig, GanttConstraint } from './gantt-config'
export {
  // resolving rows into bars
  resolveTasks,
  parseDay,
  type GanttTaskSpec,
  type ResolvedTask,
  // the work-breakdown tree
  ganttTree,
  nodeIndex,
  visibleAnchor,
  type GanttNode,
  // the window and the axis
  projectRange,
  ganttAxis,
  ganttTickWidth,
  // working-time arithmetic
  makeCalendar,
  isWorkingDay,
  workingDays,
  addWorkingDays,
  snapToWorkingDay,
  type WorkingCalendar,
} from './gantt-model'
export {
  dependencyArrows,
  elbowPath,
  type Arrow,
  type ArrowLink,
  type BarRect,
} from './timeline-arrows'
