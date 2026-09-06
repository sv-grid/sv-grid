import { error } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { listPeople, renamePerson, type Person } from '$lib/people'

// hooks.server.ts already refused this request if nobody is signed in, so the
// load can assume a user. It still reads `locals.user` rather than trusting a
// query parameter or a client-sent id.
export const load: PageServerLoad = ({ url, locals }) => {
  const sortBy = (url.searchParams.get('sort') ?? 'name') as keyof Person
  const desc = url.searchParams.get('dir') === 'desc'
  return { rows: listPeople(sortBy, desc), sortBy, desc, canEdit: locals.user?.role === 'admin' }
}

export const actions: Actions = {
  rename: async ({ request, locals }) => {
    // The check lives on the server. `canEdit` above only hides the UI, and
    // hiding a button stops nobody from posting the form by hand.
    if (locals.user?.role !== 'admin') {
      error(403, 'Only an admin can rename people.')
    }
    const data = await request.formData()
    renamePerson(Number(data.get('id')), String(data.get('name')))
    return { success: true }
  },
}
