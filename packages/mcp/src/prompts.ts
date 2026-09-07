/**
 * Slash-command style starters, exposed as MCP prompts.
 *
 * These are the tasks people actually arrive with, and a prompt is how a client
 * surfaces one before the user has thought of a tool call. Each is written to
 * make the model USE this server rather than recall SvGrid from training data,
 * which is where the wrong-API answers come from - and every one of them ends
 * at `svgrid_check_code`, because a grid that does not compile is the failure
 * mode this whole server exists to prevent.
 */
export type Prompt = {
  name: string
  title: string
  description: string
  arguments: { name: string; description: string; required: boolean }[]
}

export const PROMPTS: Prompt[] = [
  {
    name: 'build_grid',
    title: 'Build a SvGrid',
    description:
      'Scaffold a SvGrid for a described dataset, grounded in the real API and verified before you see it.',
    arguments: [
      { name: 'description', description: 'The data and behaviour you want, in plain language.', required: true },
    ],
  },
  {
    name: 'explain_api',
    title: 'Explain a SvGrid API',
    description: 'Explain a prop, column option or method using the shipped docs rather than recall.',
    arguments: [{ name: 'symbol', description: 'A prop, column option or method name.', required: true }],
  },
  {
    name: 'review_grid_code',
    title: 'Review SvGrid code',
    description: 'Check existing SvGrid code against the real API surface and report what is wrong.',
    arguments: [{ name: 'source', description: 'The component source to review.', required: true }],
  },
]

const messages = (body: string) => ({
  messages: [{ role: 'user' as const, content: { type: 'text' as const, text: body } }],
})

export function getPrompt(name: string, args: Record<string, unknown>) {
  const arg = (key: string) => String(args[key] ?? '').trim()

  if (name === 'build_grid') {
    return {
      description: 'Build a verified SvGrid',
      ...messages(
        `Build a SvGrid for: ${arg('description')}\n\n` +
          'Work in this order, and do not skip a step:\n' +
          '1. Call `svgrid_search` for the features this needs. Do not rely on memory of ' +
          'SvGrid\'s API - it changes, and a wrong prop name fails silently.\n' +
          '2. Call `svgrid_get` on the closest demo id and follow its structure.\n' +
          '3. Write the component.\n' +
          '4. Call `svgrid_check_code` on what you wrote. Use the `fixed` source it ' +
          'returns rather than re-deriving the edits, and repeat until it is clean - ' +
          'BEFORE showing me the code.\n' +
          '5. Call `svgrid_preview` with the same columns and a few rows, so I can see ' +
          'and touch the grid rather than just read it.',
      ),
    }
  }

  if (name === 'explain_api') {
    return {
      description: 'Explain a SvGrid API from the shipped docs',
      ...messages(
        `Explain the SvGrid API \`${arg('symbol')}\`.\n\n` +
          'Call `svgrid_search` with it first and answer only from what comes back. If it ' +
          'is not in the results, say so plainly rather than guessing - a plausible ' +
          'invented prop is worse than "not found".',
      ),
    }
  }

  if (name === 'review_grid_code') {
    return {
      description: 'Review SvGrid code against the real API',
      ...messages(
        'Review this SvGrid code:\n\n```svelte\n' +
          arg('source') +
          '\n```\n\n' +
          'Call `svgrid_check_code` on it first. Explain each finding and how to fix it, ' +
          'and if it returned a `fixed` source, show me that rather than describing the ' +
          'edits. Use `svgrid_search` to back up any claim about what an API does.',
      ),
    }
  }

  return undefined
}
