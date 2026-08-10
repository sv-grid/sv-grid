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

import { GENERATED_UI_SURFACE } from './ui-components.generated.js'

export type UiPropType = 'string' | 'number' | 'boolean' | 'select' | 'color' | 'json' | 'date'

export type UiPropGroup = 'common' | 'appearance' | 'behavior' | 'advanced'

export type UiComponentProp = {
  key: string
  label: string
  type: UiPropType
  /** Choices for `type: 'select'`. */
  options?: string[]
  default?: unknown
  /** Guidance shown as the property panel tooltip - sourced from the component's
   *  own JSDoc via the extractor, so it stays true to the source. */
  description?: string
  /** Property-panel grouping (defaults to 'common'). */
  group?: UiPropGroup
  /** A function / code-only prop (e.g. loadChildren) - listed read-only, set in code. */
  code?: boolean
}

/** A wireable component event: `key` is the handle event name (`ctx.x.on<key>`),
 *  `prop` the component callback prop that fires it (e.g. `onChange`). */
export type UiComponentEvent = { key: string; label: string; prop?: string; description?: string }

/** Standard DOM / interaction events EVERY component block can wire (VS-style full
 *  event surface) - forwarded by the generated wrapper to the block's handle. `dom`
 *  is the DOM event the wrapper listens for; `key` is the handle event name. */
export const STANDARD_UI_EVENTS: ReadonlyArray<{ key: string; label: string; dom: string; description: string }> = [
  { key: 'click', label: 'Click', dom: 'click', description: 'The component (or a child) was clicked.' },
  { key: 'dblclick', label: 'Double click', dom: 'dblclick', description: 'The component was double-clicked.' },
  { key: 'change', label: 'Change', dom: 'change', description: 'A committed value change (fires on blur for inputs).' },
  { key: 'input', label: 'Input', dom: 'input', description: 'Fires on every keystroke / immediate value edit.' },
  { key: 'focus', label: 'Focus', dom: 'focusin', description: 'The component (or a child) gained focus.' },
  { key: 'blur', label: 'Blur', dom: 'focusout', description: 'The component (or a child) lost focus.' },
  { key: 'keydown', label: 'Key down', dom: 'keydown', description: 'A key was pressed while focused.' },
  { key: 'keyup', label: 'Key up', dom: 'keyup', description: 'A key was released while focused.' },
  { key: 'contextmenu', label: 'Context menu', dom: 'contextmenu', description: 'Right-click / context-menu request.' },
  { key: 'mouseenter', label: 'Mouse enter', dom: 'mouseenter', description: 'The pointer entered the component.' },
  { key: 'mouseleave', label: 'Mouse leave', dom: 'mouseleave', description: 'The pointer left the component.' },
]

export type UiComponentSpec = {
  /** Registry key - stored as `ComponentConfig.component`. */
  key: string
  label: string
  category: string
  /** Named export from `@svgrid/grid`. */
  importName: string
  /** Hand-curated prop entries. In the EXPORTED registry these are merged with
   *  the extracted full surface (ui-components.generated.ts): hand entries win
   *  by key (label/options/default), extraction supplies the rest + tooltips. */
  props: UiComponentProp[]
  /** Wireable events (merged with extracted function-prop events the same way). */
  events?: UiComponentEvent[]
  /** Extracted props to keep OUT of the property panel (edge cases). */
  hiddenProps?: string[]
  /** True if the component's real content is a `children` snippet - adds one
   *  literal-text field to the property panel, stored under `props._content`. */
  hasContent?: boolean
  contentLabel?: string
  contentDefault?: string
  /** Array / object props a scalar form can't express (a Timeline's `items`, a
   *  Sparkline's `data`). Each is emitted verbatim in codegen as `key={<expr>}`
   *  with a baked demo dataset the user then edits in Code view, and its `preview`
   *  value drives the live designer canvas. Not shown in the property panel. */
  fixed?: Array<{ key: string; expr: string; preview: unknown }>
}

const BASE_REGISTRY: ReadonlyArray<UiComponentSpec> = [
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

  // --- Actions -------------------------------------------------------------
  {
    key: 'toggle-button',
    label: 'Toggle button',
    category: 'Actions',
    importName: 'SvToggleButton',
    props: [
      { key: 'pressed', label: 'Pressed', type: 'boolean', default: false },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
    hasContent: true,
    contentLabel: 'Label',
    contentDefault: 'Toggle',
  },
  {
    key: 'switch',
    label: 'Switch',
    category: 'Actions',
    importName: 'SvSwitchButton',
    props: [
      { key: 'checked', label: 'On', type: 'boolean', default: true },
      { key: 'label', label: 'Field label', type: 'string' },
      { key: 'onLabel', label: 'On label', type: 'string', default: 'On' },
      { key: 'offLabel', label: 'Off label', type: 'string', default: 'Off' },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
  },

  // --- Inputs --------------------------------------------------------------
  {
    key: 'text-input',
    label: 'Text input',
    category: 'Inputs',
    importName: 'SvTextInput',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Name' },
      { key: 'placeholder', label: 'Placeholder', type: 'string', default: 'Type here…' },
      { key: 'type', label: 'Type', type: 'select', options: ['text', 'email', 'url', 'tel', 'search'], default: 'text' },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      { key: 'clearable', label: 'Clearable', type: 'boolean', default: false },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
      { key: 'readonly', label: 'Read only', type: 'boolean', default: false },
    ],
  },
  {
    key: 'textarea',
    label: 'Text area',
    category: 'Inputs',
    importName: 'SvTextArea',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Notes' },
      { key: 'placeholder', label: 'Placeholder', type: 'string', default: 'Write something…' },
      { key: 'rows', label: 'Rows', type: 'number', default: 3 },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
  },
  {
    key: 'number-input',
    label: 'Number input',
    category: 'Inputs',
    importName: 'SvNumberInput',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Amount' },
      { key: 'placeholder', label: 'Placeholder', type: 'string' },
      { key: 'min', label: 'Min', type: 'number' },
      { key: 'max', label: 'Max', type: 'number' },
      { key: 'step', label: 'Step', type: 'number', default: 1 },
      { key: 'prefix', label: 'Prefix', type: 'string' },
      { key: 'suffix', label: 'Suffix', type: 'string' },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
  },
  {
    key: 'password-input',
    label: 'Password input',
    category: 'Inputs',
    importName: 'SvPasswordInput',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Password' },
      { key: 'placeholder', label: 'Placeholder', type: 'string', default: '••••••••' },
      { key: 'revealable', label: 'Reveal toggle', type: 'boolean', default: true },
      { key: 'showStrength', label: 'Strength meter', type: 'boolean', default: false },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
  },
  {
    key: 'color-input',
    label: 'Color input',
    category: 'Inputs',
    importName: 'SvColorInput',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Brand color' },
      { key: 'value', label: 'Value', type: 'color', default: '#6366f1' },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
  },
  {
    key: 'checkbox',
    label: 'Checkbox',
    category: 'Inputs',
    importName: 'SvCheckBox',
    props: [
      { key: 'checked', label: 'Checked', type: 'boolean', default: true },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
    hasContent: true,
    contentLabel: 'Label',
    contentDefault: 'I agree to the terms',
  },
  {
    key: 'rating',
    label: 'Rating',
    category: 'Inputs',
    importName: 'SvRating',
    props: [
      { key: 'value', label: 'Value', type: 'number', default: 3 },
      { key: 'max', label: 'Stars', type: 'number', default: 5 },
      { key: 'allowHalf', label: 'Allow half', type: 'boolean', default: false },
      { key: 'readOnly', label: 'Read only', type: 'boolean', default: false },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
    ],
  },
  {
    key: 'slider',
    label: 'Slider',
    category: 'Inputs',
    importName: 'SvSlider',
    props: [
      { key: 'value', label: 'Value', type: 'number', default: 50 },
      { key: 'min', label: 'Min', type: 'number', default: 0 },
      { key: 'max', label: 'Max', type: 'number', default: 100 },
      { key: 'step', label: 'Step', type: 'number', default: 1 },
      { key: 'showValue', label: 'Show value', type: 'boolean', default: false },
      { key: 'labels', label: 'Tick labels', type: 'select', options: ['none', 'endpoints', 'all'], default: 'none' },
    ],
  },
  {
    key: 'otp-input',
    label: 'OTP input',
    category: 'Inputs',
    importName: 'SvOtpInput',
    props: [
      { key: 'label', label: 'Label', type: 'string', default: 'Verification code' },
      { key: 'length', label: 'Digits', type: 'number', default: 6 },
      { key: 'mask', label: 'Mask input', type: 'boolean', default: false },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
  },

  // --- Feedback ------------------------------------------------------------
  {
    key: 'circular-progress',
    label: 'Circular progress',
    category: 'Feedback',
    importName: 'SvCircularProgress',
    props: [
      { key: 'value', label: 'Value', type: 'number', default: 66 },
      { key: 'max', label: 'Max', type: 'number', default: 100 },
      { key: 'size', label: 'Diameter (px)', type: 'number', default: 52 },
      { key: 'thickness', label: 'Thickness', type: 'number', default: 4 },
      { key: 'color', label: 'Color', type: 'select', options: ['accent', 'success', 'warning', 'danger'], default: 'accent' },
      { key: 'showLabel', label: 'Show percentage', type: 'boolean', default: true },
      { key: 'indeterminate', label: 'Indeterminate', type: 'boolean', default: false },
    ],
  },
  {
    key: 'skeleton',
    label: 'Skeleton',
    category: 'Feedback',
    importName: 'SvSkeleton',
    props: [
      { key: 'variant', label: 'Variant', type: 'select', options: ['text', 'rect', 'circle'], default: 'text' },
      { key: 'lines', label: 'Lines (text)', type: 'number', default: 3 },
      { key: 'width', label: 'Width (CSS)', type: 'string' },
      { key: 'height', label: 'Height (CSS)', type: 'string' },
      { key: 'animated', label: 'Animated', type: 'boolean', default: true },
    ],
  },

  // --- Display -------------------------------------------------------------
  {
    key: 'chip',
    label: 'Chip',
    category: 'Display',
    importName: 'SvChip',
    props: [
      { key: 'variant', label: 'Variant', type: 'select', options: ['neutral', 'accent', 'success', 'warning', 'danger', 'info'], default: 'neutral' },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md'], default: 'md' },
      { key: 'solid', label: 'Solid', type: 'boolean', default: false },
      { key: 'removable', label: 'Removable', type: 'boolean', default: false },
      { key: 'disabled', label: 'Disabled', type: 'boolean', default: false },
    ],
    hasContent: true,
    contentLabel: 'Text',
    contentDefault: 'Chip',
  },
  {
    key: 'empty-state',
    label: 'Empty state',
    category: 'Display',
    importName: 'SvEmptyState',
    props: [
      { key: 'title', label: 'Title', type: 'string', default: 'No results yet' },
      { key: 'description', label: 'Description', type: 'string', default: 'Try adjusting your filters or add a new record.' },
      { key: 'compact', label: 'Compact', type: 'boolean', default: false },
    ],
  },
  {
    key: 'timeline',
    label: 'Timeline',
    category: 'Display',
    importName: 'SvTimeline',
    props: [],
    fixed: [
      {
        key: 'items',
        expr: `[{ title: 'Order placed', time: '09:12', color: '#16a34a' }, { title: 'Packed', time: '11:30', description: 'Ready to ship' }, { title: 'Shipped', time: '14:40', color: '#6366f1' }, { title: 'Delivered', time: '17:05' }]`,
        preview: [
          { title: 'Order placed', time: '09:12', color: '#16a34a' },
          { title: 'Packed', time: '11:30', description: 'Ready to ship' },
          { title: 'Shipped', time: '14:40', color: '#6366f1' },
          { title: 'Delivered', time: '17:05' },
        ],
      },
    ],
  },
  {
    key: 'sparkline',
    label: 'Sparkline',
    category: 'Display',
    importName: 'SvSparkline',
    props: [
      { key: 'type', label: 'Type', type: 'select', options: ['line', 'area', 'bar', 'winloss'], default: 'area' },
      { key: 'color', label: 'Color', type: 'color', default: '#6366f1' },
      { key: 'width', label: 'Width (px)', type: 'number', default: 120 },
      { key: 'height', label: 'Height (px)', type: 'number', default: 32 },
    ],
    fixed: [
      { key: 'data', expr: `[4, 8, 5, 9, 7, 11, 8, 13, 10, 15]`, preview: [4, 8, 5, 9, 7, 11, 8, 13, 10, 15] },
    ],
  },
  {
    key: 'avatar-group',
    label: 'Avatar group',
    category: 'Display',
    importName: 'SvAvatarGroup',
    props: [
      { key: 'max', label: 'Max shown', type: 'number', default: 4 },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
    ],
    fixed: [
      {
        key: 'avatars',
        expr: `[{ name: 'Jordan Lee' }, { name: 'Sam Rivera' }, { name: 'Alex Kim' }, { name: 'Priya Patel' }, { name: 'Chris Diaz' }]`,
        preview: [{ name: 'Jordan Lee' }, { name: 'Sam Rivera' }, { name: 'Alex Kim' }, { name: 'Priya Patel' }, { name: 'Chris Diaz' }],
      },
    ],
  },

  // --- Navigation ----------------------------------------------------------
  {
    key: 'pagination',
    label: 'Pagination',
    category: 'Navigation',
    importName: 'SvPagination',
    props: [
      { key: 'page', label: 'Current page', type: 'number', default: 1 },
      { key: 'pageCount', label: 'Page count', type: 'number', default: 5 },
      { key: 'size', label: 'Size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      { key: 'showFirstLast', label: 'First / last', type: 'boolean', default: true },
      { key: 'showPrevNext', label: 'Prev / next', type: 'boolean', default: true },
      { key: 'siblingCount', label: 'Sibling count', type: 'number', default: 1 },
    ],
  },
  {
    key: 'breadcrumb',
    label: 'Breadcrumb',
    category: 'Navigation',
    importName: 'SvBreadcrumb',
    props: [],
    fixed: [
      {
        key: 'items',
        expr: `[{ label: 'Home', href: '/' }, { label: 'Orders', href: '/orders' }, { label: '#1024' }]`,
        preview: [{ label: 'Home', href: '/' }, { label: 'Orders', href: '/orders' }, { label: '#1024' }],
      },
    ],
  },
  {
    key: 'stepper',
    label: 'Stepper',
    category: 'Navigation',
    importName: 'SvStepper',
    props: [
      { key: 'current', label: 'Current step', type: 'number', default: 1 },
      { key: 'orientation', label: 'Orientation', type: 'select', options: ['horizontal', 'vertical'], default: 'horizontal' },
      { key: 'linear', label: 'Linear', type: 'boolean', default: true },
    ],
    fixed: [
      {
        key: 'steps',
        expr: `[{ label: 'Cart' }, { label: 'Shipping' }, { label: 'Payment' }, { label: 'Review' }]`,
        preview: [{ label: 'Cart' }, { label: 'Shipping' }, { label: 'Payment' }, { label: 'Review' }],
      },
    ],
  },
  // --- wave 1: full-kit registration (props/events come from the extractor) ---
  { key: 'masked-input', label: 'Masked input', category: 'Inputs', importName: 'SvMaskedInput', props: [] },
  { key: 'phone-input', label: 'Phone input', category: 'Inputs', importName: 'SvPhoneInput', props: [] },
  {
    key: 'tags-input', label: 'Tags input', category: 'Inputs', importName: 'SvTagsInput',
    props: [{ key: 'value', label: 'Tags', type: 'json', default: ['svelte', 'grid'] }],
  },
  { key: 'duration-input', label: 'Duration input', category: 'Inputs', importName: 'SvDurationInput', props: [] },
  {
    key: 'radio-group', label: 'Radio group', category: 'Inputs', importName: 'SvRadioGroup',
    props: [{ key: 'options', label: 'Options', type: 'json', default: [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }, { value: 'c', label: 'Option C' }] }],
  },
  {
    key: 'button-group', label: 'Button group', category: 'Actions', importName: 'SvButtonGroup',
    props: [{ key: 'items', label: 'Items', type: 'json', default: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }] }],
  },
  {
    key: 'list-box', label: 'List box', category: 'Inputs', importName: 'SvListBox',
    props: [{ key: 'options', label: 'Options', type: 'json', default: [{ value: '1', label: 'First' }, { value: '2', label: 'Second' }, { value: '3', label: 'Third' }] }],
  },
  {
    key: 'dropdown-list', label: 'Dropdown list', category: 'Inputs', importName: 'SvDropDownList',
    props: [{ key: 'options', label: 'Options', type: 'json', default: [{ value: '1', label: 'First' }, { value: '2', label: 'Second' }, { value: '3', label: 'Third' }] }],
  },
  {
    key: 'combo-box', label: 'Combo box', category: 'Inputs', importName: 'SvComboBox',
    props: [{ key: 'options', label: 'Options', type: 'json', default: [{ value: '1', label: 'First' }, { value: '2', label: 'Second' }, { value: '3', label: 'Third' }] }],
  },
  {
    key: 'auto-complete', label: 'Auto complete', category: 'Inputs', importName: 'SvAutoComplete',
    props: [{ key: 'options', label: 'Options', type: 'json', default: [{ value: 'red', label: 'Red' }, { value: 'green', label: 'Green' }, { value: 'blue', label: 'Blue' }] }],
  },
  {
    key: 'multi-select', label: 'Multi select', category: 'Inputs', importName: 'SvMultiSelect',
    props: [{ key: 'options', label: 'Options', type: 'json', default: [{ value: '1', label: 'First' }, { value: '2', label: 'Second' }, { value: '3', label: 'Third' }] }],
  },
  { key: 'repeat-button', label: 'Repeat button', category: 'Actions', importName: 'SvRepeatButton', props: [], hasContent: true, contentLabel: 'Label', contentDefault: 'Hold me' },
  { key: 'rich-text', label: 'Rich text editor', category: 'Inputs', importName: 'SvRichText', props: [] },
  {
    key: 'tree', label: 'Tree', category: 'Display', importName: 'SvTree',
    props: [{ key: 'nodes', label: 'Nodes', type: 'json', default: [{ id: '1', label: 'Documents', children: [{ id: '1-1', label: 'Reports' }, { id: '1-2', label: 'Invoices' }] }, { id: '2', label: 'Pictures' }] }],
  },
  { key: 'country-input', label: 'Country input', category: 'Inputs', importName: 'SvCountryInput', props: [] },
]

// ---------------------------------------------------------------------------
// Merge: the exported registry = hand-curated spec + the component's FULL
// extracted surface (ui-components.generated.ts). Hand entries win by key;
// extraction contributes every remaining prop with its JSDoc tooltip, plus
// the event list. Consumers see one complete `props`/`events` per component.
// ---------------------------------------------------------------------------

const GROUP_ORDER: Record<UiPropGroup, number> = { common: 0, appearance: 1, behavior: 2, advanced: 3 }

function mergeSpec(spec: UiComponentSpec): UiComponentSpec {
  const generated = GENERATED_UI_SURFACE[spec.importName]
  if (!generated) return spec
  const skip = new Set<string>([...(spec.hiddenProps ?? []), ...(spec.fixed ?? []).map((f) => f.key), '_content'])
  const genByKey = new Map(generated.props.map((p) => [p.key, p]))
  // Hand-curated entries first (their order is intentional), enriched with the
  // extracted description/group when the hand entry doesn't set them.
  const curated = spec.props
    .filter((p) => !skip.has(p.key))
    .map((p) => {
      const g = genByKey.get(p.key)
      return g ? { ...g, ...p, description: p.description ?? g.description, group: p.group ?? g.group } : p
    })
  const curatedKeys = new Set(curated.map((p) => p.key))
  const rest = generated.props
    .filter((p) => !skip.has(p.key) && !curatedKeys.has(p.key))
    .map((p) => ({ ...p }) as UiComponentProp)
    .sort((a, b) => GROUP_ORDER[a.group ?? 'common'] - GROUP_ORDER[b.group ?? 'common'])
  // Events: extracted list as the base, hand entries override by key.
  const handEvents = new Map((spec.events ?? []).map((e) => [e.key, e]))
  const events: UiComponentEvent[] = [
    ...generated.events.map((e) => ({ ...e, ...(handEvents.get(e.key) ?? {}) })),
    ...(spec.events ?? []).filter((e) => !generated.events.some((g) => g.key === e.key)),
  ]
  return { ...spec, props: [...curated, ...rest], events }
}

export const UI_COMPONENT_REGISTRY: ReadonlyArray<UiComponentSpec> = BASE_REGISTRY.map(mergeSpec)

export function uiComponentSpec(key: string): UiComponentSpec | undefined {
  return UI_COMPONENT_REGISTRY.find((s) => s.key === key)
}

// --- Grid: the "All properties" surface ------------------------------------
// The grid block has rich CURATED controls (column/form builders, grouping, paging,
// ...). These are the SvGrid props those controls already drive - excluded from the
// grid's "All properties" panel so nothing shows twice. Everything else in the
// extracted SvGrid surface is offered as a raw, editable override (config.props).
export const GRID_CURATED_PROPS: ReadonlySet<string> = new Set<string>([
  'data', 'columns', 'board', 'scheduler', 'loading', 'loadingOverlay', 'emptyMessage',
  'fitColumns', 'sortable', 'externalSort', 'filterable', 'externalFilter', 'filterMode',
  'showGlobalFilter', 'showColumnFilters', 'showFilterRow', 'showFilterMenu', 'showGroupingControls',
  'groupable', 'showRowSelection', 'selectionMode', 'enableCellSelection', 'enableRowSummaries',
  'zebraRows', 'showPagination', 'pageable', 'externalPagination', 'rowCount', 'pageIndex',
  'pageSize', 'pageSizeOptions', 'paginationPosition', 'rowHeight', 'containerHeight',
  'columnVirtualization', 'initialColumnPinning', 'conditionalFormats', 'features', 'editable',
  'enableInlineEditing',
])

/** The Grid's raw prop surface for the "All properties" panel: every extracted SvGrid
 *  prop the curated controls do NOT already manage. Sorted by group then label. */
export function gridPropSurface(): UiComponentProp[] {
  const g = GENERATED_UI_SURFACE['SvGrid']
  if (!g) return []
  const order: Record<string, number> = { common: 0, appearance: 1, behavior: 2, advanced: 3 }
  return g.props
    .filter((p) => !GRID_CURATED_PROPS.has(p.key))
    .map((p) => ({ ...p }) as UiComponentProp)
    .sort((a, b) => (order[a.group ?? 'common']! - order[b.group ?? 'common']!) || a.label.localeCompare(b.label))
}

// Props NOT offered on `ctx.grid` as runtime-settable options: structural data,
// controller-owned plumbing, and seed-once `initial*` props (the grid reads those at
// mount, so `setOption` on them is a no-op - excluding them keeps intellisense honest).
const GRID_API_UNSETTABLE: ReadonlySet<string> = new Set<string>([
  'data', 'columns', 'features', 'loading', 'onApiReady',
  'externalSort', 'externalFilter', 'externalPagination', 'rowCount', 'pageIndex',
  'initialSorting', 'initialColumnPinning', 'initialHiddenColumns', 'columnOrder',
])

/** The Grid props settable at runtime through `ctx.grid.<prop> = value` (backed by
 *  `api.setOption`): the full extracted SvGrid surface minus controller-owned /
 *  seed-once props and function/snippet props. Drives the `ctx.grid` type + the code
 *  view autocomplete. Sorted alphabetically. */
export function gridApiSettableProps(): UiComponentProp[] {
  const g = GENERATED_UI_SURFACE['SvGrid']
  if (!g) return []
  return g.props
    .filter((p) => !GRID_API_UNSETTABLE.has(p.key) && !p.code && !/^on[A-Z]/.test(p.key))
    .map((p) => ({ ...p }) as UiComponentProp)
    .sort((a, b) => a.key.localeCompare(b.key))
}
