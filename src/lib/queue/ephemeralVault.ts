/**
 * Ephemeral execution vault (Redis-shaped).
 *
 * Mirrors the `SETEX` / `GET` / `DEL` surface used against Redis so the store
 * can be swapped for a real client without touching callers. Entries are
 * short-TTL and purged the moment a task finishes, succeeds, or fails.
 */

import type { EncryptedEnvelope } from "@/lib/crypto";

interface Entry {
  envelope: EncryptedEnvelope;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

const store = new Map<string, Entry>();

const keyFor = (taskId: string) => `umi:vault:${taskId}`;

export function putEphemeralVault(
  taskId: string,
  envelope: EncryptedEnvelope,
  ttlSeconds: number,
): void {
  purgeEphemeralVault(taskId);
  const timer = setTimeout(() => store.delete(keyFor(taskId)), ttlSeconds * 1_000);
  store.set(keyFor(taskId), {
    envelope,
    expiresAt: Date.now() + ttlSeconds * 1_000,
    timer,
  });
}

export function getEphemeralVault(taskId: string): EncryptedEnvelope | null {
  const entry = store.get(keyFor(taskId));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    purgeEphemeralVault(taskId);
    return null;
  }
  return entry.envelope;
}

/** Idempotent — always safe to call in a `finally` block. */
export function purgeEphemeralVault(taskId: string): void {
  const entry = store.get(keyFor(taskId));
  if (!entry) return;
  clearTimeout(entry.timer);
  store.delete(keyFor(taskId));
}

export function ephemeralVaultSize(): number {
  return store.size;
}
