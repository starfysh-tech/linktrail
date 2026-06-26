// Explicit .js extensions: deployed code under Node ESM on Vercel (see api/save.ts).
import { claimTokens } from "../lib/config.js";

/**
 * First-run setup for zero-input (env-less) deploys.
 *
 *   GET  → a small self-contained page. If the backend is env-configured it says
 *          so (nothing to claim). Otherwise it offers a "Generate my tokens"
 *          button that POSTs here.
 *   POST → atomically claims the singleton config row and reveals the tokens
 *          ONCE (trust-on-first-use). A second claim returns 409 with no tokens.
 *
 * Claiming is POST-only so prefetchers/bots can't trigger it by loading the URL.
 * If WRITE_TOKEN + READ_TOKEN are set in env, this backend is already configured
 * and setup is a no-op (env always wins — see lib/config.ts).
 */
function envConfigured(): boolean {
  return Boolean(process.env.WRITE_TOKEN && process.env.READ_TOKEN);
}

export async function POST(req: Request): Promise<Response> {
  if (envConfigured()) {
    return json({ error: "env-configured" }, 409);
  }
  const claimed = await claimTokens();
  if (!claimed) {
    return json({ error: "already-claimed" }, 409);
  }
  const origin = new URL(req.url).origin;
  return json(
    {
      writeToken: claimed.writeToken,
      feedUrl: `${origin}/api/feed?token=${claimed.readToken}`,
    },
    200,
  );
}

export async function GET(): Promise<Response> {
  const body = envConfigured() ? PAGE_ENV : PAGE_CLAIM;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const STYLE = `
  :root{--grA:#45454b;--grB:#1f1f22;--on:#fff;--on2:rgba(255,255,255,.82);--on3:rgba(255,255,255,.56);
    --glass:rgba(255,255,255,.16);--line:rgba(255,255,255,.34);--a1:#ffc062;--a2:#ff9f0a;--ink:#2a1c02;
    --f:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;color:var(--on);font-family:var(--f);font-size:15px;line-height:1.5;
    -webkit-font-smoothing:antialiased;display:grid;place-items:center;padding:32px;
    background:radial-gradient(70% 50% at 12% -8%,rgba(255,244,230,.10),transparent 55%),linear-gradient(168deg,var(--grA),var(--grB) 70%) fixed;}
  .card{max-width:520px;width:100%;background:rgba(255,255,255,.05);border:.5px solid var(--line);border-radius:16px;padding:26px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 30px 70px -30px rgba(0,0,0,.7);backdrop-filter:blur(14px)}
  h1{font-size:22px;letter-spacing:-.02em;margin:0 0 10px}p{color:var(--on2);margin:0 0 16px}
  .muted{color:var(--on3);font-size:13px}
  button{font:inherit;font-weight:700;color:var(--ink);border:none;border-radius:12px;padding:12px 18px;cursor:pointer;
    background:linear-gradient(180deg,var(--a1),var(--a2));box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
  code,.field{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-all}
  .field{display:block;background:rgba(0,0,0,.25);border:.5px solid var(--line);border-radius:10px;padding:10px 12px;margin:6px 0 16px;color:var(--on)}
  .label{font-size:12px;color:var(--on3);text-transform:uppercase;letter-spacing:.06em;margin-top:14px}
  .warn{color:#ffb84d}
`;

const PAGE_CLAIM = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Linktrail — set up</title>
<style>${STYLE}</style></head><body><div class="card">
  <h1>Set up your Linktrail backend</h1>
  <p>Generate your tokens now. <span class="warn">Do this immediately after deploying</span> — the first person to claim this backend owns it.</p>
  <button id="go" type="button">Generate my tokens</button>
  <div id="out" hidden>
    <div class="label">Backend URL</div><code class="field" id="backend"></code>
    <div class="label">Write token <span class="muted">(paste into the extension's options)</span></div><code class="field" id="wt"></code>
    <div class="label">Feed URL <span class="muted">(read token embedded — appears automatically after Test connection)</span></div><code class="field" id="feed"></code>
    <p class="muted">Open the Linktrail extension's options, enter the Backend URL and Write token, and click <b>Test connection</b>. Keep these secret — this page won't show them again.</p>
  </div>
  <p id="err" class="warn" hidden></p>
</div>
<script>
  document.getElementById('go').addEventListener('click', async () => {
    const r = await fetch('/api/setup', { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = document.getElementById('err'); e.hidden = false;
      e.textContent = data.error === 'already-claimed'
        ? 'This backend is already set up. Tokens are only shown once.'
        : 'Setup is not available (this backend may be configured via environment variables).';
      document.getElementById('go').disabled = true;
      return;
    }
    document.getElementById('backend').textContent = location.origin;
    document.getElementById('wt').textContent = data.writeToken;
    document.getElementById('feed').textContent = data.feedUrl;
    document.getElementById('out').hidden = false;
    document.getElementById('go').disabled = true;
  });
</script></body></html>`;

const PAGE_ENV = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Linktrail — set up</title>
<style>${STYLE}</style></head><body><div class="card">
  <h1>Already configured</h1>
  <p>This backend is configured with environment-variable tokens. Use the <code>WRITE_TOKEN</code> you set in your Vercel project as the extension's write token; your feed URL appears after <b>Test connection</b>.</p>
  <p class="muted">There is nothing to generate here.</p>
</div></body></html>`;
