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
  /** Array / object props a scalar form can't express (a Timeline's `items`, a
   *  Sparkline's `data`). Each is emitted verbatim in codegen as `key={<expr>}`
   *  with a baked demo dataset the user then edits in Code view, and its `preview`
   *  value drives the live designer canvas. Not shown in the property panel. */
  fixed?: Array<{ key: string; expr: string; preview: unknown }>
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
]

export function uiComponentSpec(key: string): UiComponentSpec | undefined {
  return UI_COMPONENT_REGISTRY.find((s) => s.key === key)
}
