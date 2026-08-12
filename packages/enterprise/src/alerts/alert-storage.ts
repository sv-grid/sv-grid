/**
 * Alert-rule persistence + sharing. Mirrors the grid's `named-views` storage
 * shape: a pluggable `AlertRulesStorage` (in-memory or localStorage), wrapped by
 * a small CRUD manager. `export()` / `import()` make a rule set shareable as
 * JSON, so a team lead can hand round a set of alerts.
 */
import type { AlertRule } from './alert-types'

export type AlertRulesStorage = {
  read(): AlertRule[]
  write(rules: AlertRule[]): void
}

/** In-memory storage (default). State lives only as long as the manager. */
export function memoryAlertRules(initial: AlertRule[] = []): AlertRulesStorage {
  let rules = [...initial]
  return {
    read: () => rules,
    write: (next) => {
      rules = next
    },
  }
}

/** localStorage-backed storage. Safe to construct under SSR (no-ops there). */
export function localStorageAlertRules(key: string): AlertRulesStorage {
  const available = typeof localStorage !== 'undefined'
  return {
    read() {
      if (!available) return []
      try {
        const raw = localStorage.getItem(key)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? (parsed as AlertRule[]) : []
      } catch {
        return []
      }
    },
    write(rules) {
      if (!available) return
      try {
        localStorage.setItem(key, JSON.stringify(rules))
      } catch {
        // quota / private-mode - persistence is best-effort
      }
    },
  }
}

export type AlertRulesManager = {
  list(): AlertRule[]
  get(id: string): AlertRule | undefined
  /** Insert or replace a rule (matched by id). Returns the saved rule. */
  save(rule: AlertRule): AlertRule
  remove(id: string): boolean
  rename(id: string, name: string): boolean
  /** Flip a rule's `enabled` flag. Returns the new value (or undefined). */
  toggle(id: string): boolean | undefined
  /** Serialise the whole rule set to shareable JSON. */
  export(): string
  /** Replace the rule set from JSON produced by `export()`. */
  import(json: string): AlertRule[]
}

/** CRUD manager over a storage adapter (defaults to in-memory). */
export function createAlertRules(
  storage: AlertRulesStorage = memoryAlertRules(),
): AlertRulesManager {
  const load = () => storage.read()
  const commit = (rules: AlertRule[]) => storage.write(rules)

  return {
    list: () => load(),
    get: (id) => load().find((r) => r.id === id),
    save(rule) {
      const rules = load()
      const i = rules.findIndex((r) => r.id === rule.id)
      if (i >= 0) rules[i] = rule
      else rules.push(rule)
      commit(rules)
      return rule
    },
    remove(id) {
      const rules = load()
      const next = rules.filter((r) => r.id !== id)
      if (next.length === rules.length) return false
      commit(next)
      return true
    },
    rename(id, name) {
      const rules = load()
      const rule = rules.find((r) => r.id === id)
      if (!rule) return false
      rule.name = name
      commit(rules)
      return true
    },
    toggle(id) {
      const rules = load()
      const rule = rules.find((r) => r.id === id)
      if (!rule) return undefined
      rule.enabled = !rule.enabled
      commit(rules)
      return rule.enabled
    },
    export() {
      return JSON.stringify(load(), null, 2)
    },
    import(json) {
      const parsed = JSON.parse(json)
      const rules = Array.isArray(parsed) ? (parsed as AlertRule[]) : []
      commit(rules)
      return rules
    },
  }
}
