<script lang="ts">
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'

  enableBase()

  const STAGES = [
    { value: 'Idea', color: '#94a3b8' },
    { value: 'Drafting', color: '#2d7ff9' },
    { value: 'Published', color: '#20c933' },
  ]

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'posts',
      name: 'Posts',
      primaryField: 'title',
      data: [
        { id: 1, title: 'Why we rebuilt onboarding', stage: 'Published', words: 1200 },
        { id: 2, title: 'Keyboard shortcuts', stage: 'Drafting', words: 800 },
        { id: 3, title: 'Quarterly planning', stage: 'Idea', words: 0 },
      ],
      columns: [
        { field: 'title', header: 'Title', width: 260, fieldType: 'text' },
        { field: 'stage', header: 'Stage', width: 140, fieldType: 'singleSelect', fieldProps: { options: STAGES } },
        { field: 'words', header: 'Words', width: 100, fieldType: 'number' },
      ],
      views: [
        { id: 'all', name: 'All posts', type: 'grid' },
        { id: 'pipeline', name: 'Pipeline', type: 'kanban', stackBy: 'stage' },
      ],
    },
    {
      id: 'authors',
      name: 'Authors',
      primaryField: 'name',
      data: [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' },
      ],
      columns: [{ field: 'name', header: 'Name', width: 200, fieldType: 'text' }],
    },
  ])
</script>

<h1>base</h1>
<div style="height: 520px; display: flex; flex-direction: column">
  <SvBase bind:tables editable sortable containerHeight="100%" />
</div>
