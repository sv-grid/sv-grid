/**
 * createSupabaseRealtime - live updates for a Studio screen via Supabase
 * Realtime (Postgres change streams). Subscribe to a table's INSERT / UPDATE /
 * DELETE events and react - typically by refreshing the current page so the grid
 * stays in sync with the database, no polling.
 *
 *     const live = createSupabaseRealtime({
 *       client, table: 'customers',
 *       debounceMs: 200,
 *       onChange: () => controller.refresh(),  // re-fetch the current page
 *     })
 *     // later: live.unsubscribe()
 *
 * You bring the same `supabase-js` client used for reads (BYO, no dependency).
 * Because the server model is paged, the correct default is to `refresh()` on a
 * change - that respects the active sort / filter / page. Use `debounceMs` to
 * coalesce bursts into a single refetch. For per-row effects (e.g. flashing a
 * changed row) read the normalized event passed to `onChange`.
 */
import { nudgeEnterprise } from '../license'

/** A normalized change event. `new` is the row after the change (INSERT/UPDATE); `old` its prior identity (UPDATE/DELETE). */
export type RealtimeChange<TData> = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  new: TData | null
  old: Partial<TData> | null
}

/** The slice of a `supabase-js` client + channel this needs. */
export type RealtimeChannelLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(type: 'postgres_changes', filter: Record<string, unknown>, cb: (payload: any) => void): RealtimeChannelLike
  subscribe(cb?: (status: string) => void): RealtimeChannelLike
}
export type SupabaseRealtimeClientLike = {
  channel(name: string): RealtimeChannelLike
  removeChannel(channel: RealtimeChannelLike): void
}

export type SupabaseRealtimeConfig<TData> = {
  client: SupabaseRealtimeClientLike
  table: string
  /** Postgres schema. Default `'public'`. */
  schema?: string
  /** Only these events. Default `'*'` (all). */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  /** PostgREST-style row filter, e.g. `'tier=eq.pro'`. */
  filter?: string
  /** Unique channel name. Default `svgrid:{schema}:{table}`. */
  channelName?: string
  /** Coalesce bursts: call `onChange` at most once per this window (trailing). */
  debounceMs?: number
  /** Called for each change (or the last of a debounced burst). */
  onChange: (change: RealtimeChange<TData>) => void
  /** Subscription status callback (`SUBSCRIBED`, `CHANNEL_ERROR`, ...). */
  onStatus?: (status: string) => void
}

export type SupabaseRealtimeHandle = { unsubscribe(): void }

export function createSupabaseRealtime<TData = Record<string, unknown>>(
  config: SupabaseRealtimeConfig<TData>,
): SupabaseRealtimeHandle {
  nudgeEnterprise('Studio') // soft-gate; never blocks
  const schema = config.schema ?? 'public'
  const channelName = config.channelName ?? `svgrid:${schema}:${config.table}`

  let timer: ReturnType<typeof setTimeout> | undefined
  const emit = (change: RealtimeChange<TData>) => {
    if (!config.debounceMs) {
      config.onChange(change)
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => config.onChange(change), config.debounceMs)
  }

  const channel = config.client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: config.event ?? '*', schema, table: config.table, ...(config.filter ? { filter: config.filter } : {}) },
      (payload) => {
        emit({
          type: payload.eventType,
          new: (payload.new ?? null) as TData | null,
          old: (payload.old ?? null) as Partial<TData> | null,
        })
      },
    )
    .subscribe(config.onStatus)

  return {
    unsubscribe() {
      if (timer) clearTimeout(timer)
      config.client.removeChannel(channel)
    },
  }
}
