import { describe, it, expect, beforeAll } from "bun:test";
import { loadEnvLocal } from "../lib/load-env";

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
let sql: (typeof import("../lib/db"))["sql"];

beforeAll(async () => {
  POST = (await import("../api/save")).POST;
  GET = (await import("../api/feed")).GET;
  sql = (await import("../lib/db")).sql;
});

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
