import { describe, it, expect, beforeAll } from "bun:test";
import { gzipSync } from "node:zlib";
import { loadEnvLocal } from "../lib/load-env";
import { normalizeUrl } from "../lib/normalize";

/** Pack markdown the way the extension does: gzip → base64 (the wire shape). */
function packMarkdown(md: string): string {
  return gzipSync(Buffer.from(md, "utf-8")).toString("base64");
}

// Seam 1: drive the HTTP endpoints as black boxes.
//
// DB-touching tests are gated behind RUN_DB_TESTS because the `saved_items`
// migration is owned by the human and may not have run yet. Auth is checked
// before any DB access, so the auth tests run unconditionally.
loadEnvLocal();

const RUN_DB = !!process.env.RUN_DB_TESTS;
const dbit = RUN_DB ? it : it.skip;

// `lib/db.ts` throws at import time when DATABASE_URL is unset, and the handlers
// import it transitively. If .env.local is absent (no real connection string),
// seed a dummy so the no-DB auth tests can still import the handlers — they
// never reach the client, so the value is never used.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://u:p@unused.example/db";
}

// Lazy imports so the DATABASE_URL fallback above is set before lib/db loads.
let POST: (req: Request) => Promise<Response>;
let GET: (req: Request) => Promise<Response>;
let saveOPTIONS: (req: Request) => Promise<Response>;
let verifyGET: (req: Request) => Promise<Response>;
let verifyOPTIONS: (req: Request) => Promise<Response>;
let statusGET: (req: Request) => Promise<Response>;
let statusOPTIONS: (req: Request) => Promise<Response>;
let itemsGET: (req: Request) => Promise<Response>;
let sql: (typeof import("../lib/db"))["sql"];
let ensureSchema!: (typeof import("../lib/schema"))["ensureSchema"];
let resetSchemaMemoForTests!: (typeof import("../lib/schema"))["resetSchemaMemoForTests"];
let pickTokens!: (typeof import("../lib/config"))["pickTokens"];
let resetTokensMemoForTests!: (typeof import("../lib/config"))["resetTokensMemoForTests"];
let setupPOST: (req: Request) => Promise<Response>;
let setupGET: () => Promise<Response>;

beforeAll(async () => {
  POST = (await import("../api/save")).POST;
  GET = (await import("../api/feed")).GET;
  saveOPTIONS = (await import("../api/save")).OPTIONS;
  verifyGET = (await import("../api/verify")).GET;
  verifyOPTIONS = (await import("../api/verify")).OPTIONS;
  statusGET = (await import("../api/status")).GET;
  statusOPTIONS = (await import("../api/status")).OPTIONS;
  itemsGET = (await import("../api/items")).GET;
  sql = (await import("../lib/db")).sql;
  ensureSchema = (await import("../lib/schema")).ensureSchema;
  resetSchemaMemoForTests = (await import("../lib/schema")).resetSchemaMemoForTests;
  pickTokens = (await import("../lib/config")).pickTokens;
  resetTokensMemoForTests = (await import("../lib/config")).resetTokensMemoForTests;
  setupPOST = (await import("../api/setup")).POST;
  setupGET = (await import("../api/setup")).GET;
  ({ ensureSchema, resetSchemaMemoForTests } = await import("../lib/schema"));
});

function statusReq(token: string | undefined, url: string | undefined): Request {
  const qs = url === undefined ? "" : `?url=${encodeURIComponent(url)}`;
  const headers: Record<string, string> =
    token === undefined ? {} : { Authorization: `Bearer ${token}` };
  return new Request(`https://x/api/status${qs}`, { headers });
}

function saveReq(headers: Record<string, string>, body: unknown): Request {
  return new Request("https://x/api/save", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/save — auth (no DB)", () => {
  it("401s with no Authorization header", async () => {
    const res = await POST(saveReq({}, { url: "https://e.com", title: "t" }));
    expect(res.status).toBe(401);
  });

  it("401s with a wrong bearer token", async () => {
    const res = await POST(
      saveReq({ Authorization: "Bearer wrong" }, { url: "https://e.com", title: "t" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("CORS preflight (no DB)", () => {
  it("save OPTIONS returns 204 with permissive CORS allowing Authorization", async () => {
    const res = await saveOPTIONS(new Request("https://x/api/save", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("save error responses still carry the CORS origin header", async () => {
    const res = await POST(saveReq({}, { url: "https://e.com", title: "t" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("POST /api/save — validation (no DB)", () => {
  const auth = { Authorization: `Bearer ${process.env.WRITE_TOKEN}` };

  it("rejects a non-http(s) URL with 400", async () => {
    const res = await POST(saveReq(auth, { url: "chrome://settings", title: "x" }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed URL with 400", async () => {
    const res = await POST(saveReq(auth, { url: "not a url", title: "x" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/feed — auth (no DB)", () => {
  it("401s with no token", async () => {
    const res = await GET(new Request("https://x/api/feed"));
    expect(res.status).toBe(401);
  });

  it("401s with a wrong token", async () => {
    const res = await GET(new Request("https://x/api/feed?token=wrong"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/verify — auth & CORS (no DB)", () => {
  it("401s with no Authorization header, body { ok: false }", async () => {
    const res = await verifyGET(new Request("https://x/api/verify"));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });

  it("401s with a wrong bearer token", async () => {
    const res = await verifyGET(
      new Request("https://x/api/verify", { headers: { Authorization: "Bearer wrong" } }),
    );
    expect(res.status).toBe(401);
  });

  it("verify OPTIONS returns 204 with permissive CORS origin", async () => {
    const res = await verifyOPTIONS(new Request("https://x/api/verify", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("GET /api/verify — success (DB-gated)", () => {
  dbit("with a valid write token returns 200, ok: true, and the read feed URL", async () => {
    const res = await verifyGET(
      new Request("https://x/api/verify", {
        headers: { Authorization: `Bearer ${process.env.WRITE_TOKEN}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; feedUrl: string };
    expect(body.ok).toBe(true);
    expect(body.feedUrl).toContain("/api/feed?token=");
  });
});

describe("GET /api/status — auth, validation & CORS (no DB)", () => {
  it("401s with no Authorization header, body { saved: false }", async () => {
    const res = await statusGET(statusReq(undefined, "https://e.com"));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { saved: boolean }).saved).toBe(false);
  });

  it("401s with a wrong bearer token", async () => {
    const res = await statusGET(statusReq("wrong", "https://e.com"));
    expect(res.status).toBe(401);
  });

  it("400s when the url query param is missing", async () => {
    const res = await statusGET(statusReq(process.env.WRITE_TOKEN, undefined));
    expect(res.status).toBe(400);
  });

  it("400s for a non-http(s) url", async () => {
    const res = await statusGET(statusReq(process.env.WRITE_TOKEN, "chrome://settings"));
    expect(res.status).toBe(400);
  });

  it("status OPTIONS returns 204 with permissive CORS allowing Authorization", async () => {
    const res = await statusOPTIONS(new Request("https://x/api/status", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});

describe("GET /api/status — saved lookup (DB-gated)", () => {
  const auth = process.env.WRITE_TOKEN;
  const marker = `https://linktrail-status.example/${Date.now()}`;

  dbit("reports saved: false for a url that was never saved", async () => {
    const res = await statusGET(statusReq(auth, `${marker}/never`));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { saved: boolean }).saved).toBe(false);
  });

  dbit("reports saved: true after the url is saved, matching normalized identity", async () => {
    // Save the canonical form, then query a normalized-equivalent variant
    // (www. + tracking param + fragment) — both share one identity.
    await POST(
      saveReq(
        { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        { url: marker, title: "Status Marker" },
      ),
    );

    const variant = marker.replace("https://", "https://www.") + "/?utm_source=z#frag";
    const res = await statusGET(statusReq(auth, variant));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { saved: boolean; id?: string };
    expect(body.saved).toBe(true);
    expect(typeof body.id).toBe("string");

    await sql`DELETE FROM saved_items WHERE normalized_url = ${normalizeUrl(marker)}`;
  });
});

describe("GET /api/items — auth (no DB)", () => {
  it("401s with no token", async () => {
    const res = await itemsGET(new Request("https://x/api/items"));
    expect(res.status).toBe(401);
  });

  it("401s with a wrong token", async () => {
    const res = await itemsGET(new Request("https://x/api/items?token=wrong"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/items — full history (DB-gated)", () => {
  const marker = `https://linktrail-items.example/${Date.now()}`;

  dbit("returns saved items as JSON, newest-first, with the app shape", async () => {
    const older = `${marker}/older`;
    const newer = `${marker}/newer`;
    const auth = {
      Authorization: `Bearer ${process.env.WRITE_TOKEN}`,
      "Content-Type": "application/json",
    };
    await POST(saveReq(auth, { url: older, title: "Older Item" }));
    await POST(saveReq(auth, { url: newer, title: "Newer Item" }));

    const res = await itemsGET(
      new Request(`https://x/api/items?token=${process.env.READ_TOKEN}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");

    const items = (await res.json()) as Array<{
      id: string;
      url: string;
      title: string;
      capturedAt: string;
    }>;
    const ours = items.filter((i) => i.url === older || i.url === newer);
    expect(ours.map((i) => i.url)).toEqual([newer, older]); // newest-first
    expect(ours[0].title).toBe("Newer Item");
    expect(typeof ours[0].id).toBe("string");
    // capturedAt is a parseable ISO timestamp.
    expect(Number.isNaN(Date.parse(ours[0].capturedAt))).toBe(false);

    await sql`DELETE FROM saved_items WHERE original_url IN (${older}, ${newer})`;
  });
});

describe("pickTokens — env precedence (no DB)", () => {
  it("env tokens win over the DB row", () => {
    expect(pickTokens("ew", "er", { write_token: "dw", read_token: "dr" })).toEqual({
      writeToken: "ew",
      readToken: "er",
    });
  });
  it("falls back to the DB row when env is absent", () => {
    expect(pickTokens(undefined, undefined, { write_token: "dw", read_token: "dr" })).toEqual({
      writeToken: "dw",
      readToken: "dr",
    });
  });
  it("is undefined when neither env nor DB provides a token", () => {
    expect(pickTokens(undefined, undefined, null)).toEqual({
      writeToken: undefined,
      readToken: undefined,
    });
  });
});

describe("GET /api/setup (no DB)", () => {
  it("serves an HTML setup page", async () => {
    const res = await setupGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

describe("POST /api/setup — first-run claim (DB-gated)", () => {
  dbit("claims tokens once on an env-less backend, then refuses", async () => {
    // Force the env-less path and a clean, unclaimed config row.
    const w = process.env.WRITE_TOKEN;
    const r = process.env.READ_TOKEN;
    delete process.env.WRITE_TOKEN;
    delete process.env.READ_TOKEN;
    resetTokensMemoForTests();
    await sql`DELETE FROM config WHERE id = 1`;

    try {
      const res = await setupPOST(new Request("https://x/api/setup", { method: "POST" }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { writeToken: string; feedUrl: string };
      expect(typeof body.writeToken).toBe("string");
      expect(body.writeToken.length).toBeGreaterThan(20);
      expect(body.feedUrl).toContain("/api/feed?token=");

      // A second claim must NOT reveal tokens (already claimed).
      const res2 = await setupPOST(new Request("https://x/api/setup", { method: "POST" }));
      expect(res2.status).toBe(409);
      expect((await res2.json()) as { error: string }).toEqual({ error: "already-claimed" });
    } finally {
      // Restore env + memo so the rest of the suite uses the env tokens again.
      await sql`DELETE FROM config WHERE id = 1`;
      resetTokensMemoForTests();
      if (w !== undefined) process.env.WRITE_TOKEN = w;
      if (r !== undefined) process.env.READ_TOKEN = r;
    }
  });
});

describe("save + feed round-trip (DB-gated)", () => {
  // A unique marker URL so the test cleans up exactly its own rows and stays
  // repeatable across runs.
  const marker = `https://linktrail-test.example/${Date.now()}`;

  dbit("save with a valid token inserts and returns { outcome: 'saved', id }", async () => {
    const res = await POST(
      saveReq(
        { Authorization: `Bearer ${process.env.WRITE_TOKEN}`, "Content-Type": "application/json" },
        { url: marker, title: "Marker Item" },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { outcome: string; id: string };
    expect(body.outcome).toBe("saved");
    expect(typeof body.id).toBe("string");

    await sql`DELETE FROM saved_items WHERE original_url = ${marker}`;
  });

  dbit("feed with a valid token returns 200 RSS containing the saved item, newest-first", async () => {
    // Insert two markers; the second must appear before the first (newest-first).
    const older = `${marker}/older`;
    const newer = `${marker}/newer`;
    const auth = {
      Authorization: `Bearer ${process.env.WRITE_TOKEN}`,
      "Content-Type": "application/json",
    };
    await POST(saveReq(auth, { url: older, title: "Older" }));
    await POST(saveReq(auth, { url: newer, title: "Newer" }));

    const res = await GET(new Request(`https://x/api/feed?token=${process.env.READ_TOKEN}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");

    const xml = await res.text();
    expect(xml).toContain(`<link>${older}</link>`);
    expect(xml).toContain(`<link>${newer}</link>`);
    expect(xml.indexOf(newer)).toBeLessThan(xml.indexOf(older));

    await sql`DELETE FROM saved_items WHERE original_url IN (${older}, ${newer})`;
  });
});

describe("normalization, dedupe & title fallback (DB-gated)", () => {
  const auth = {
    Authorization: `Bearer ${process.env.WRITE_TOKEN}`,
    "Content-Type": "application/json",
  };
  const base = `https://linktrail-dedupe.example/a-${Date.now()}`;

  dbit("re-saving a normalized-equivalent URL returns duplicate and adds no row", async () => {
    // These two differ only by www., a trailing slash, a tracking param, and a
    // fragment — all collapsed by normalization to the same identity.
    const first = `${base}?v=1`;
    const second = `https://www.linktrail-dedupe.example/a-${base.split("a-")[1]}/?v=1&utm_source=z#x`;

    const r1 = await POST(saveReq(auth, { url: first, title: "First" }));
    expect(((await r1.json()) as { outcome: string }).outcome).toBe("saved");

    const r2 = await POST(saveReq(auth, { url: second, title: "Second" }));
    expect(((await r2.json()) as { outcome: string }).outcome).toBe("duplicate");

    const normalized = normalizeUrl(first);
    const rows = await sql`SELECT id FROM saved_items WHERE normalized_url = ${normalized}`;
    expect(rows.length).toBe(1);

    await sql`DELETE FROM saved_items WHERE normalized_url = ${normalized}`;
  });

  dbit("an empty title is stored as the normalized host", async () => {
    const url = `${base}/titleless`;
    const res = await POST(saveReq(auth, { url, title: "   " }));
    expect(res.status).toBe(200);

    const rows = await sql`SELECT title FROM saved_items WHERE original_url = ${url}`;
    expect(rows[0].title).toBe("linktrail-dedupe.example");

    await sql`DELETE FROM saved_items WHERE original_url = ${url}`;
  });
});

describe("markdown archive on save (DB-gated)", () => {
  const auth = {
    Authorization: `Bearer ${process.env.WRITE_TOKEN}`,
    "Content-Type": "application/json",
  };

  dbit("stores markdown on a fresh insert and exposes it via format=md", async () => {
    const url = `https://linktrail-md.example/insert-${Date.now()}`;
    const md = "# Hello\n\nArchived body.";
    const res = await POST(saveReq(auth, { url, title: "MD Insert", markdownGz: packMarkdown(md) }));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };

    const dl = await itemsGET(
      new Request(`https://x/api/items?token=${process.env.READ_TOKEN}&id=${id}&format=md`),
    );
    expect(dl.status).toBe(200);
    expect(dl.headers.get("Content-Type")).toContain("text/markdown");
    expect(dl.headers.get("Content-Disposition")).toContain("attachment");
    expect(dl.headers.get("Content-Disposition")).toContain(".md");
    expect(await dl.text()).toBe(md);

    await sql`DELETE FROM saved_items WHERE original_url = ${url}`;
  });

  dbit("list exposes hasMarkdown for archived vs. plain rows", async () => {
    const withMd = `https://linktrail-md.example/has-${Date.now()}`;
    const without = `https://linktrail-md.example/none-${Date.now()}`;
    await POST(saveReq(auth, { url: withMd, title: "Has", markdownGz: packMarkdown("# x") }));
    await POST(saveReq(auth, { url: without, title: "None" }));

    const res = await itemsGET(new Request(`https://x/api/items?token=${process.env.READ_TOKEN}`));
    const items = (await res.json()) as Array<{ url: string; hasMarkdown: boolean }>;
    expect(items.find((i) => i.url === withMd)?.hasMarkdown).toBe(true);
    expect(items.find((i) => i.url === without)?.hasMarkdown).toBe(false);

    await sql`DELETE FROM saved_items WHERE original_url IN (${withMd}, ${without})`;
  });

  dbit("duplicate backfills markdown when the existing row has none", async () => {
    const url = `https://linktrail-md.example/backfill-${Date.now()}`;
    // First save: no markdown.
    await POST(saveReq(auth, { url, title: "Backfill" }));
    // Re-save (same normalized URL) WITH markdown → duplicate, but backfilled.
    const md = "# Backfilled";
    const r2 = await POST(saveReq(auth, { url, title: "Backfill", markdownGz: packMarkdown(md) }));
    expect(((await r2.json()) as { outcome: string }).outcome).toBe("duplicate");

    const rows = await sql`SELECT markdown FROM saved_items WHERE normalized_url = ${normalizeUrl(url)}`;
    expect(rows[0].markdown).toBe(md);

    await sql`DELETE FROM saved_items WHERE normalized_url = ${normalizeUrl(url)}`;
  });

  dbit("re-save refreshes an existing markdown archive with the new content", async () => {
    const url = `https://linktrail-md.example/refresh-${Date.now()}`;
    await POST(saveReq(auth, { url, title: "Keep", markdownGz: packMarkdown("# First archive") }));
    // Re-save with different markdown → duplicate, but the archive is refreshed.
    const second = "# Second archive";
    const r2 = await POST(saveReq(auth, { url, title: "Keep", markdownGz: packMarkdown(second) }));
    expect(((await r2.json()) as { outcome: string }).outcome).toBe("duplicate");

    const rows = await sql`SELECT markdown FROM saved_items WHERE normalized_url = ${normalizeUrl(url)}`;
    expect(rows[0].markdown).toBe(second);

    await sql`DELETE FROM saved_items WHERE normalized_url = ${normalizeUrl(url)}`;
  });

  dbit("a re-save WITHOUT markdown never wipes an existing archive", async () => {
    const url = `https://linktrail-md.example/nowipe-${Date.now()}`;
    const archived = "# Keep me";
    await POST(saveReq(auth, { url, title: "Keep", markdownGz: packMarkdown(archived) }));
    // Re-save with no markdown (e.g. extraction failed / offline queue) → preserved.
    const r2 = await POST(saveReq(auth, { url, title: "Keep" }));
    expect(((await r2.json()) as { outcome: string }).outcome).toBe("duplicate");

    const rows = await sql`SELECT markdown FROM saved_items WHERE normalized_url = ${normalizeUrl(url)}`;
    expect(rows[0].markdown).toBe(archived);

    await sql`DELETE FROM saved_items WHERE normalized_url = ${normalizeUrl(url)}`;
  });

  dbit("format=md returns 404 when the row has no markdown", async () => {
    const url = `https://linktrail-md.example/plain-${Date.now()}`;
    const res = await POST(saveReq(auth, { url, title: "Plain" }));
    const { id } = (await res.json()) as { id: string };

    const dl = await itemsGET(
      new Request(`https://x/api/items?token=${process.env.READ_TOKEN}&id=${id}&format=md`),
    );
    expect(dl.status).toBe(404);

    await sql`DELETE FROM saved_items WHERE original_url = ${url}`;
  });

  dbit("a bad/undecodable markdownGz still saves url+title (no 500)", async () => {
    const url = `https://linktrail-md.example/badgz-${Date.now()}`;
    const res = await POST(saveReq(auth, { url, title: "BadGz", markdownGz: "!!!not-base64-gzip!!!" }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { outcome: string }).outcome).toBe("saved");

    const rows = await sql`SELECT markdown FROM saved_items WHERE original_url = ${url}`;
    expect(rows[0].markdown).toBeNull();

    await sql`DELETE FROM saved_items WHERE original_url = ${url}`;
  });
});

describe("GET /api/items — content search ?q= (DB-gated)", () => {
  const dbit = RUN_DB ? it : it.skip;
  const auth = {
    Authorization: `Bearer ${process.env.WRITE_TOKEN}`,
    "Content-Type": "application/json",
  };
  const stamp = Date.now();
  const list = async (q: string) =>
    (await (
      await itemsGET(
        new Request(
          `https://x/api/items?token=${process.env.READ_TOKEN}&q=${encodeURIComponent(q)}`,
        ),
      )
    ).json()) as Array<{ url: string }>;

  dbit("matches a term found only in the archived Markdown body", async () => {
    const url = `https://linktrail-q.example/body-${stamp}`;
    const needle = `zylophonecapybara${stamp}`; // appears in body only, not title/url
    await POST(saveReq(auth, { url, title: "Plain Title", markdownGz: packMarkdown(`# Doc\n\n${needle} inside.`) }));

    expect((await list(needle)).map((i) => i.url)).toContain(url);
    await sql`DELETE FROM saved_items WHERE original_url = ${url}`;
  });

  dbit("matches title and URL too, case-insensitively", async () => {
    const url = `https://linktrail-q.example/titlematch-${stamp}`;
    const tag = `Quokka${stamp}`;
    await POST(saveReq(auth, { url, title: `${tag} notes` }));

    expect((await list(tag.toLowerCase())).map((i) => i.url)).toContain(url); // title, lowercased
    expect((await list(`titlematch-${stamp}`)).map((i) => i.url)).toContain(url); // url
    await sql`DELETE FROM saved_items WHERE original_url = ${url}`;
  });

  dbit("treats % literally (no wildcard footgun)", async () => {
    const plain = `https://linktrail-q.example/plain-${stamp}`;
    const pct = `https://linktrail-q.example/pct-${stamp}`;
    await POST(saveReq(auth, { url: plain, title: `NoPercentHere${stamp}` }));
    await POST(saveReq(auth, { url: pct, title: `Has${stamp}%Percent` }));

    const hits = (await list("%")).map((i) => i.url);
    expect(hits).toContain(pct); // the literal '%' row
    expect(hits).not.toContain(plain); // '%' must not match everything
    await sql`DELETE FROM saved_items WHERE original_url IN (${plain}, ${pct})`;
  });
});

describe("ensureSchema — memoization (no DB)", () => {
  it("invokes the injected runner exactly once across concurrent + repeat calls", async () => {
    resetSchemaMemoForTests();
    let calls = 0;
    const runner = async () => {
      calls++;
    };

    // Fire several concurrently, then a couple more after they settle.
    await Promise.all([ensureSchema(runner), ensureSchema(runner), ensureSchema(runner)]);
    await ensureSchema(runner);
    await ensureSchema(runner);

    expect(calls).toBe(1);
  });

  it("retries on the next call after the runner rejects (memo cleared on failure)", async () => {
    resetSchemaMemoForTests();
    let calls = 0;
    const failing = async () => {
      calls++;
      throw new Error("boom");
    };

    await expect(ensureSchema(failing)).rejects.toThrow("boom");
    await expect(ensureSchema(failing)).rejects.toThrow("boom");
    expect(calls).toBe(2); // a transient failure does not poison the instance
  });
});

describe("ensureSchema — real DDL (DB-gated)", () => {
  dbit("creates saved_items and is idempotent on a second call", async () => {
    resetSchemaMemoForTests();
    await ensureSchema();
    const exists = await sql`SELECT to_regclass('saved_items') AS reg`;
    expect(exists[0].reg).not.toBeNull();

    // A second call must not throw (CREATE ... IF NOT EXISTS + memoization).
    await ensureSchema();
  });
});
