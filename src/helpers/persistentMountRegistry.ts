export type MountEntry = { bucketId: string; fileName: string }
export type MountScope = { nodeUri?: string; chainId?: number }

type Listener = (scopeKey: string) => void

function scopeKey(scope: MountScope): string {
  return `${scope.nodeUri ?? ''}|${scope.chainId ?? ''}`
}

function entryKey(e: MountEntry): string {
  return `${e.bucketId}/${e.fileName}`
}

const store = new Map<string, Map<string, MountEntry>>()
const listeners = new Set<Listener>()

function notify(key: string) {
  for (const l of listeners) {
    try {
      l(key)
    } catch {}
  }
}

function bucket(scope: MountScope): Map<string, MountEntry> {
  const key = scopeKey(scope)
  let b = store.get(key)
  if (!b) {
    b = new Map()
    store.set(key, b)
  }
  return b
}

export function isScopeReady(scope: MountScope): boolean {
  return !!scope.nodeUri && typeof scope.chainId === 'number'
}

export function toggle(scope: MountScope, entry: MountEntry, mounted: boolean): void {
  if (!isScopeReady(scope)) return
  const b = bucket(scope)
  const k = entryKey(entry)
  if (mounted) b.set(k, entry)
  else b.delete(k)
  notify(scopeKey(scope))
}

export function isMounted(scope: MountScope, entry: MountEntry): boolean {
  if (!isScopeReady(scope)) return false
  return bucket(scope).has(entryKey(entry))
}

export function getAll(scope: MountScope): MountEntry[] {
  if (!isScopeReady(scope)) return []
  return Array.from(bucket(scope).values())
}

export function removeMany(scope: MountScope, entries: MountEntry[]): void {
  if (!isScopeReady(scope) || entries.length === 0) return
  const b = bucket(scope)
  for (const e of entries) b.delete(entryKey(e))
  notify(scopeKey(scope))
}

export function onChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
