/**
 * A curated catalogue of SvGrid UI-kit components a Studio screen can host as a
 * `'component'` block (see `ComponentConfig` in `project.ts`) - entity-agnostic,
 * usable on any screen including a freestanding one. Pure metadata: no Svelte
 * import here (this subtree stays Svelte-free), so the designer holds the live
 * component references and this module only describes what to configure and how
 * to generate.
 *
 * Only "chrome" props (scalar values a form can drive) are listed - every
 * component's real content is typically a Svelte `Snippet`, which this registry
 * can't represent. A component with `hasContent` gets one extra literal-text
 * field in the property panel (stored under the reserved `_content` props key)
 * that becomes its plain-text children in both the live preview and codegen.
 */

export type UiPropType = 'string' | 'number' | 'boolean' | 'select' | 'color'

export type UiComponentProp = {
  key: string
  label: string
  type: UiPropType
  /** Choices for `type: 'select'`. */
  options?: string[]
  default?: unknown
}

export type UiComponentSpec = {
  /** Registry key - stored as `ComponentConfig.component`. */
  key: string
  label: string
  category: string
  /** Named export from `@svgrid/grid`. */
  importName: string
  /** Scalar "chrome" props only - see module doc. */
  props: UiComponentProp[]
  /** True if the component's real content is a `children` snippet - adds one
   *  literal-text field to the property panel, stored under `props._content`. */
  hasContent?: boolean
  contentLabel?: string
  contentDefault?: string
}

export const UI_COMPONENT_REGISTRY: ReadonlyArray<UiComponentSpec> = [
  {
    key: 'button',
    label: 'Button',
    category: 'Actions',
    importName: 'SvButton',
    props: [
      { key: 'variant', label: 'Variant', type: 'select', options: ['primary', 'secondary', 'outline', 'ghost', 'danger'], default: 'primary' },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      { key: 'block', label: 'Full width', type: 'boolean', default: false },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
    hasContent: true,
    contentLabel: 'Label',
    contentDefault: 'Click me',
  },
  {
    key: 'badge',
    label: 'Badge',
    category: 'Feedback',
    importName: 'SvBadge',
    props: [
      { key: 'variant', label: 'Variant', type: 'select', options: ['neutral', 'accent', 'success', 'warning', 'danger', 'info'], default: 'neutral' },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md'], default: 'md' },
      { key: 'pill', label: 'Pill shape', type: 'boolean', default: true },
      { key: 'dot', label: 'Show dot', type: 'boolean', default: false },
    ],
    hasContent: true,
    contentLabel: 'Text',
    contentDefault: 'Badge',
  },
  {
    key: 'alert',
    label: 'Alert',
    category: 'Feedback',
    importName: 'SvAlert',
    props: [
      { key: 'variant', label: 'Variant', type: 'select', options: ['info', 'success', 'warning', 'danger', 'neutral'], default: 'info' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'dismissible', label: 'Dismissible', type: 'boolean', default: false },
      { key: 'soft', label: 'Soft (tinted) style', type: 'boolean', default: false },
    ],
    hasContent: true,
    contentLabel: 'Message',
    contentDefault: 'This is an alert message.',
  },
  {
    key: 'progress',
    label: 'Progress bar',
    category: 'Feedback',
    importName: 'SvProgress',
    props: [
      { key: 'value', label: 'Value', type: 'number', default: 60 },
      { key: 'max', label: 'Max', type: 'number', default: 100 },
      { key: 'color', label: 'Color', type: 'select', options: ['accent', 'success', 'warning', 'danger'], default: 'accent' },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      { key: 'showLabel', label: 'Show percentage', type: 'boolean', default: false },
      { key: 'striped', label: 'Striped', type: 'boolean', default: false },
    ],
  },
  {
    key: 'card',
    label: 'Card',
    category: 'Layout',
    importName: 'SvCard',
    props: [
      { key: 'title', label: 'Title', type: 'string', default: 'Card title' },
      { key: 'subtitle', label: 'Subtitle', type: 'string' },
      { key: 'hoverable', label: 'Hover elevation', type: 'boolean', default: false },
      { key: 'flush', label: 'Flush padding', type: 'boolean', default: false },
    ],
  },
  {
    key: 'divider',
    label: 'Divider',
    category: 'Layout',
    importName: 'SvDivider',
    props: [
      { key: 'orientation', label: 'Orientation', type: 'select', options: ['horizontal', 'vertical'], default: 'horizontal' },
      { key: 'label', label: 'Label', type: 'string' },
      { key: 'align', label: 'Label align', type: 'select', options: ['start', 'center', 'end'], default: 'center' },
      { key: 'dashed', label: 'Dashed', type: 'boolean', default: false },
    ],
  },
  {
    key: 'avatar',
    label: 'Avatar',
    category: 'Display',
    importName: 'SvAvatar',
    props: [
      { key: 'name', label: 'Name', type: 'string', default: 'Jordan Lee' },
      { key: 'src', label: 'Image URL', type: 'string' },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      { key: 'shape', label: 'Shape', type: 'select', options: ['circle', 'square'], default: 'circle' },
      { key: 'status', label: 'Status', type: 'select', options: ['', 'online', 'offline', 'busy', 'away'], default: '' },
      { key: 'color', label: 'Color override', type: 'color' },
    ],
  },
  {
    key: 'stat',
    label: 'Stat',
    category: 'Display',
    importName: 'SvStat',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Revenue' },
      { key: 'value', label: 'Value', type: 'string', default: '$48,200' },
      { key: 'delta', label: 'Delta', type: 'string' },
      { key: 'trend', label: 'Trend', type: 'select', options: ['', 'up', 'down', 'flat'], default: '' },
      { key: 'hint', label: 'Hint', type: 'string' },
      { key: 'invert', label: 'Invert trend colors', type: 'boolean', default: false },
    ],
  },
]

export function uiComponentSpec(key: string): UiComponentSpec | undefined {
  return UI_COMPONENT_REGISTRY.find((s) => s.key === key)
}
