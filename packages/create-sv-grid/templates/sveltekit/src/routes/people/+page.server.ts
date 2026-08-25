import type { Actions, PageServerLoad } from './$types'
import { listPeople, renamePerson, type Person } from '$lib/people'

export const load: PageServerLoad = ({ url }) => {
  const sortBy = (url.searchParams.get('sort') ?? 'name') as keyof Person
  const desc = url.searchParams.get('dir') === 'desc'
  return { rows: listPeople(sortBy, desc), sortBy, desc }
}

export const actions: Actions = {
  rename: async ({ request }) => {
    const data = await request.formData()
    renamePerson(Number(data.get('id')), String(data.get('name')))
    return { success: true }
  },
}
