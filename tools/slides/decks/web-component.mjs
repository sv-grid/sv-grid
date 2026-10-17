/**
 * "One Svelte grid in React, Vue, Angular or plain HTML" - the web component.
 * Targets "web component data grid", "svelte grid in react".
 *
 * Code: the Quick look block in docs/help/web-components.md (long lines
 * wrapped), and the React and Vue examples from web-components/react.md and
 * vue.md, verbatim. The screenshot is packages/grid-wc/demo.html, the
 * package's own plain-HTML page, with its own sample rows; the slide says so.
 */
export default {
  id: 'web-component',
  caption:
    'A Svelte 5 data grid you can use from React, Vue, Angular or a plain HTML page: @svgrid/grid-wc ships it as the <sv-grid> custom element, with a generated wrapper per framework. Arrays and objects go in as properties, primitives as attributes. Docs: svgrid.com/docs/help/web-components',
  hashtags: ['webcomponents', 'svelte', 'react', 'vuejs', 'angular', 'javascript', 'webdev', 'frontend'],
  slides: [
    {
      kind: 'title',
      title: 'One Svelte grid. ==React, Vue, Angular==, or plain HTML.',
      body: 'It also ships as a custom element: `<sv-grid>`.',
      shot: {
        server: 'wc',
        path: '/demo.html',
        viewport: { width: 640, height: 640 },
        waitFor: 'sv-grid [data-svgrid-row]',
        selector: 'sv-grid',
        trim: true,
      },
    },
    {
      kind: 'code',
      title: 'A script tag and a tag.',
      file: 'index.html',
      code: [
        '<script type="module"',
        '  src="https://unpkg.com/@svgrid/grid-wc"></script>',
        '',
        '<sv-grid id="grid" sortable filterable pageable',
        '  page-size="25"',
        '  style="display:block;height:420px"></sv-grid>',
        '',
        '<script type="module">',
        "  const grid = document.getElementById('grid')",
        '  // Arrays and objects are properties;',
        '  // primitives can be attributes.',
        '  grid.columns = [',
        "    { field: 'name', header: 'Name' },",
        "    { field: 'role', header: 'Role' },",
        '  ]',
        '  grid.data = [',
        "    { name: 'Ada', role: 'Engineering' },",
        "    { name: 'Alan', role: 'Research' },",
        '  ]',
        "  grid.addEventListener('cellvaluechange',",
        '    (e) => console.log(e.detail))',
        '</script>',
      ].join('\n'),
    },
    {
      kind: 'shot',
      title: 'No framework on the page.',
      body: 'This is the package demo page: plain HTML, one module script, sorting and filtering on.',
      shot: {
        server: 'wc',
        path: '/demo.html',
        viewport: { width: 640, height: 760 },
        waitFor: 'sv-grid [data-svgrid-row]',
        selector: 'body',
      },
    },
    {
      kind: 'code',
      title: 'React.',
      file: 'Screen.tsx',
      code: [
        "import { SvGrid } from '@svgrid/grid-wc/react'",
        '',
        'export default function Screen() {',
        '  return (',
        '    <div style={{ height: 480 }}>',
        '      <SvGrid',
        '        data={rows}',
        '        columns={columns}',
        '        sortable',
        '        filterable',
        '        editable',
        '        onCellValueChange={(e) => save(e)}',
        '      />',
        '    </div>',
        '  )',
        '}',
      ].join('\n'),
      after: 'React 18 and earlier stringify object props onto attributes. The wrapper sets them as properties, so this works on 17, 18 and 19.',
    },
    {
      kind: 'code',
      title: 'Vue.',
      file: 'Screen.vue',
      code: [
        '<script setup>',
        "import { SvGrid } from '@svgrid/grid-wc/vue'",
        '</script>',
        '',
        '<template>',
        '  <SvGrid',
        '    :data="rows"',
        '    :columns="columns"',
        '    sortable',
        '    filterable',
        '    editable',
        '    style="height: 480px"',
        '    @cellvaluechange="save"',
        '  />',
        '</template>',
      ].join('\n'),
      after: 'No `isCustomElement` config and no `.prop` modifiers. Angular gets a standalone `SvGridComponent`.',
    },
    {
      kind: 'shot',
      title: 'Why it is the whole grid.',
      body: 'Svelte compiles to standard custom elements. The element and the three wrappers are generated from `<SvGrid>`\'s own prop types, and CI fails if they drift apart.',
    },
    {
      kind: 'end',
      title: 'svgrid.com/docs',
      lines: ['`npm install @svgrid/grid-wc`', 'Help, then Web Components'],
    },
  ],
}
