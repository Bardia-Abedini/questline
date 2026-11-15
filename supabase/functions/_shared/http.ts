/**
 * CORS and JSON helpers for the edge functions. Pure (no Deno APIs) so tests can import it.
 *
 * ALLOWED_ORIGINS: comma-separated origins allowed to call the functions from a browser, e.g.
 * "https://questline.example.com,http://localhost:5173". A `*` may stand for the port
 * ("http://localhost:*"). Requests from other origins get no CORS headers (the browser
 * blocks them); requests without an Origin (cron, server) are unaffected.
 */

export function originAllowed(origin: string | null, allowed: string): boolean {
  if (!origin) return false;
  return allowed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern === origin) return true;
      if (pattern.endsWith(':*')) {
        const base = pattern.slice(0, -2);
        return origin === base || new RegExp(`^${escape(base)}:\\d+$`).test(origin);
      }
      return false;
    });
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function corsHeaders(origin: string | null, allowed: string): Record<string, string> {
  if (!originAllowed(origin, allowed)) return { vary: 'Origin' };
  return {
    'access-control-allow-origin': origin!,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/** The bearer token of a request, if any. */
export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]!.trim() : null;
}

/** Reads a JSON body of at most `maxBytes`. */
export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const raw = await req.text();
  if (raw.length > maxBytes) throw new Error('too_large');
  return raw ? JSON.parse(raw) : {};
}
