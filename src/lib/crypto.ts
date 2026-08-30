/**
 * Umi Cryptographic Vault
 * ------------------------------------------------------------------
 * Two-tier key architecture, all built on Web Crypto (SubtleCrypto) so the
 * exact same module runs in the browser and in the server runtime.
 *
 * Tier 1 — Sync Vault (client-only):
 *   wallet signature -> PBKDF2-SHA256 -> AES-256-GCM vault key
 *   Private keys are encrypted in the browser. Ciphertext + iv + salt are the
 *   only things that ever leave the device.
 *
 * Tier 2 — Ephemeral Execution Vault:
 *   Keys needed for one scheduled task are re-encrypted under a per-task
 *   secret (AES-256-GCM), handed to the worker, and zeroed after execution.
 *
 * Invariants:
 *   - Never log, persist, or return plaintext private keys from this module
 *     except through explicit decrypt* calls.
 *   - Every ciphertext is authenticated (GCM tag); tampering throws.
 */

export const VAULT_SIGN_MESSAGE = "Sign to decrypt your Umi Key Vault";

const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH_BITS = 256;
const IV_BYTES = 12;
const SALT_BYTES = 16;

/** Envelope stored in the DB / Redis. All fields are base64. */
export interface EncryptedEnvelope {
  ciphertext: string;
  iv: string;
  salt: string;
  v: 1;
}

/* ------------------------------------------------------------------ */
/* encoding helpers                                                    */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/** Best-effort memory hygiene: overwrite a byte buffer we are done with. */
export function zeroize(bytes: Uint8Array): void {
  bytes.fill(0);
}

/* ------------------------------------------------------------------ */
/* key derivation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Derive the vault key from the user's wallet signature over
 * VAULT_SIGN_MESSAGE. The signature never leaves the client.
 */
export async function deriveVaultKey(signature: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!signature || signature.length < 32) {
    throw new Error("deriveVaultKey: signature looks invalid");
  }

  const material = await crypto.subtle.importKey(
    "raw",
    bufferSource(encoder.encode(signature)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Generate a fresh 256-bit task secret for the ephemeral execution vault. */
export function generateTaskSecret(): string {
  return toBase64(randomBytes(32));
}

/** Import a raw base64 256-bit secret as an AES-GCM key. */
export async function importRawKey(secretBase64: string): Promise<CryptoKey> {
  const raw = fromBase64(secretBase64);
  if (raw.length !== 32) {
    throw new Error("importRawKey: expected a 32-byte (256-bit) secret");
  }
  return crypto.subtle.importKey(
    "raw",
    bufferSource(raw),
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

/* ------------------------------------------------------------------ */
/* primitive encrypt / decrypt                                         */
/* ------------------------------------------------------------------ */

export async function encryptWithKey(
  key: CryptoKey,
  plaintext: string,
  salt: Uint8Array = new Uint8Array(0),
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bufferSource(iv), tagLength: 128 },
    key,
    bufferSource(encoder.encode(plaintext)),
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    v: 1,
  };
}

export async function decryptWithKey(key: CryptoKey, envelope: EncryptedEnvelope): Promise<string> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bufferSource(fromBase64(envelope.iv)), tagLength: 128 },
      key,
      bufferSource(fromBase64(envelope.ciphertext)),
    );
    return decoder.decode(plaintext);
  } catch {
    // Do not leak which part failed — wrong key and tampered ciphertext look alike.
    throw new Error("Decryption failed: wrong key or corrupted payload");
  }
}

/* ------------------------------------------------------------------ */
/* tier 1 — sync vault                                                 */
/* ------------------------------------------------------------------ */

export interface VaultEntry {
  address: string;
  privateKey: string;
  label?: string;
}

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export function isValidPrivateKey(value: string): boolean {
  return PRIVATE_KEY_RE.test(value.trim());
}

export function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!isValidPrivateKey(prefixed)) {
    throw new Error("Invalid EVM private key (expected 32 bytes hex)");
  }
  return prefixed.toLowerCase();
}

/**
 * Encrypt the whole wallet set as a single authenticated blob.
 * Returns the envelope to persist in `Vault` plus the key count.
 */
export async function encryptVault(
  entries: VaultEntry[],
  signature: string,
): Promise<{ envelope: EncryptedEnvelope; keyCount: number }> {
  const salt = generateSalt();
  const key = await deriveVaultKey(signature, salt);
  const envelope = await encryptWithKey(key, JSON.stringify(entries), salt);
  return { envelope, keyCount: entries.length };
}

export async function decryptVault(
  envelope: EncryptedEnvelope,
  signature: string,
): Promise<VaultEntry[]> {
  const key = await deriveVaultKey(signature, fromBase64(envelope.salt));
  const json = await decryptWithKey(key, envelope);
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("Vault payload is malformed");
  return parsed as VaultEntry[];
}

/* ------------------------------------------------------------------ */
/* tier 2 — ephemeral execution vault                                  */
/* ------------------------------------------------------------------ */

export interface ExecutionBundle {
  taskId: string;
  /** base64 AES-256 secret — handed to the worker out-of-band, never stored. */
  taskSecret: string;
  envelope: EncryptedEnvelope;
  /** Seconds the cache entry may live before purge. */
  ttlSeconds: number;
}

/**
 * Re-encrypt only the keys a task needs under a fresh per-task secret.
 * The bundle envelope is what goes into the short-TTL cache; the secret
 * travels with the job payload and is discarded on completion.
 */
export async function sealForExecution(
  taskId: string,
  entries: VaultEntry[],
  ttlSeconds = 300,
): Promise<ExecutionBundle> {
  if (entries.length === 0) throw new Error("sealForExecution: no wallets selected");
  const taskSecret = generateTaskSecret();
  const key = await importRawKey(taskSecret);
  const envelope = await encryptWithKey(key, JSON.stringify(entries));
  return { taskId, taskSecret, envelope, ttlSeconds };
}

/** Worker side: open the bundle, use the keys, then zeroize. */
export async function openExecutionBundle(
  bundle: Pick<ExecutionBundle, "taskSecret" | "envelope">,
): Promise<VaultEntry[]> {
  const key = await importRawKey(bundle.taskSecret);
  const json = await decryptWithKey(key, bundle.envelope);
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("Execution bundle is malformed");
  return parsed as VaultEntry[];
}

/**
 * Run `fn` with decrypted keys and guarantee they are scrubbed afterwards,
 * on both the success and failure paths.
 */
export async function withEphemeralKeys<T>(
  bundle: Pick<ExecutionBundle, "taskSecret" | "envelope">,
  fn: (entries: VaultEntry[]) => Promise<T>,
): Promise<T> {
  const entries = await openExecutionBundle(bundle);
  try {
    return await fn(entries);
  } finally {
    for (const entry of entries) {
      const buf = encoder.encode(entry.privateKey);
      zeroize(buf);
      entry.privateKey = "";
    }
    entries.length = 0;
  }
}

/** Redact anything key-shaped before it reaches a log sink. */
export function redact(message: string): string {
  return message.replace(/0x[0-9a-fA-F]{64}/g, "0x***redacted***");
}
