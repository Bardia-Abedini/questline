// Serves every edge function on one port for the Docker-free local stack, the way the
// Supabase edge runtime does: `/functions/v1/<name>/...` reaches <name> with the path
// `/<name>/...`. Not used in production.
import { handler as ai } from '../../functions/ai/index.ts';
import { handler as calendar } from '../../functions/calendar/index.ts';
import { handler as push } from '../../functions/push/index.ts';

const FUNCTIONS: Record<string, (req: Request) => Promise<Response>> = { ai, calendar, push };

Deno.serve({ port: Number(Deno.env.get('PORT') ?? 54331), hostname: '127.0.0.1' }, (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1/, '');
  const name = path.split('/')[1] ?? '';
  const fn = FUNCTIONS[name];
  if (!fn) return new Response('ok', { status: name ? 404 : 200 });
  url.pathname = path;
  return fn(new Request(url, req));
});
