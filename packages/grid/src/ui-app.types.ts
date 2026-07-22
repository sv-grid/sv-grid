/**
 * Shared item shapes for the app-UI components that have no headless core
 * (SvBreadcrumb, SvStepper). Kept in a plain .ts so they can be exported from a
 * component's module script by re-export - a bare `export type` DECLARATION in a
 * `<script module>` trips the Svelte/Vite parser, but a re-export is fine.
 */

/** One crumb in a breadcrumb trail. `href` renders a link; `onClick` a button. */
export type BreadcrumbItem = {
  label: string
  href?: string
  onClick?: () => void
  /** Optional leading icon (any string: emoji, char, or a font-icon class glyph). */
  icon?: string
}

/** One step in a stepper. */
export type StepItem = {
  label: string
  description?: string
  /** Marks the step skippable (shown as "Optional"). */
  optional?: boolean
}

/** One option in a multi-select. */
export type MultiSelectOption = {
  value: string | number
  label: string
  disabled?: boolean
}

/** A node in a tree-select. */
export type TreeSelectNode = {
  value: string | number
  label: string
  children?: TreeSelectNode[]
  disabled?: boolean
}

/** A column shown in a grid-select dropdown. */
export type GridSelectColumn = {
  /** Key into each option row. */
  field: string
  header: string
  /** Any CSS grid track size (e.g. '1fr', '80px'). Default '1fr'. */
  width?: string
}

/** One action in a command palette (SvCommand). */
export type CommandItem = {
  id: string
  label: string
  /** Right-aligned hint / description. */
  hint?: string
  /** Section header this command groups under. */
  group?: string
  /** Leading glyph (emoji / char). */
  icon?: string
  /** Right-aligned keyboard shortcut hint, e.g. "⌘S". */
  shortcut?: string
  /** Extra searchable terms beyond the label. */
  keywords?: string
  disabled?: boolean
  /** Run when chosen. */
  onRun?: () => void
}

/** One step in a guided tour. */
export type TourStep = {
  /** Element to spotlight: a CSS selector or the element itself. Omit for a
   *  centered, target-less step (intro / outro). */
  target?: string | HTMLElement
  title?: string
  content: string
}

/** One entry in a timeline. */
export type TimelineItem = {
  id?: string | number
  title: string
  description?: string
  /** Right-aligned timestamp/label. */
  time?: string
  /** Marker colour (any CSS colour). Defaults to the accent. */
  color?: string
  /** Optional leading glyph inside the marker (emoji / char). */
  icon?: string
}
