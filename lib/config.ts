// Explicit .js extensions: deployed code under Node ESM on Vercel (see api/save.ts).
import { randomBytes } from "node:crypto";
import { sql } from "./db.js";
import { ensureSchema } from "./schema.js";

export interface Tokens {
  writeToken?: string;
  readToken?: string;
}

/**
 * Precedence (pure, unit-tested): an env var always wins; otherwise the
 * DB-stored value; otherwise undefined. This is what keeps env-configured
 * backends (incl. our prod and the test suite) behaving exactly as before while
 * env-less deploys fall through to the claimed `config` row.
 */
export function pickTokens(
  envWrite: string | undefined,
  envRead: string | undefined,
  dbRow: { write_token: string; read_token: string } | null,
): Tokens {
  return {
    writeToken: envWrite ?? dbRow?.write_token,
    readToken: envRead ?? dbRow?.read_token,
  };
}

// Per-instance memo of a *complete* token set. We never memoize an incomplete
// (unclaimed) result, so a claim that happens later is picked up on the next call.
let memo: Tokens | null = null;

/**
 * Resolve the backend's tokens. If both env vars are present we return them and
 * NEVER touch the datastore (so the no-DB auth tests stay no-DB). Only when an
 * env token is missing do we read the config row; a missing/unreachable config
 * yields `undefined` (→ auth rejects with 401), never a 500.
 */
export async function getTokens(): Promise<Tokens> {
  if (memo) return memo;

  const envWrite = process.env.WRITE_TOKEN;
  const envRead = process.env.READ_TOKEN;
  if (envWrite && envRead) {
    memo = { writeToken: envWrite, readToken: envRead };
    return memo;
  }

  let row: { write_token: string; read_token: string } | null = null;
  try {
    await ensureSchema();
    const rows = await sql`SELECT write_token, read_token FROM config WHERE id = 1`;
    row = (rows[0] as { write_token: string; read_token: string } | undefined) ?? null;
  } catch {
    row = null; // unreachable/missing config → treat as unconfigured (reject auth)
  }

  const resolved = pickTokens(envWrite, envRead, row);
  if (resolved.writeToken && resolved.readToken) memo = resolved; // stable once claimed
  return resolved;
}

/**
 * First-run claim. Atomically inserts the singleton config row with two fresh
 * random tokens; the `ON CONFLICT (id) DO NOTHING RETURNING` means exactly one
 * caller ever wins, even under concurrency. Returns the tokens to that caller,
 * or `null` if the row already existed (already claimed — do NOT reveal).
 */
export async function claimTokens(): Promise<Tokens | null> {
  await ensureSchema();
  const writeToken = randomBytes(32).toString("hex");
  const readToken = randomBytes(32).toString("hex");
  const rows = await sql`
    INSERT INTO config (id, write_token, read_token)
    VALUES (1, ${writeToken}, ${readToken})
    ON CONFLICT (id) DO NOTHING
    RETURNING write_token, read_token
  `;
  if (rows.length === 0) return null; // already claimed by someone else
  memo = { writeToken, readToken }; // this instance now serves the claimed tokens
  return { writeToken, readToken };
}

/** Test-only: clear the per-instance token memo. */
export function resetTokensMemoForTests(): void {
  memo = null;
}
