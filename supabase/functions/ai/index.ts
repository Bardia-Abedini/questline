export function handler(_req: Request): Promise<Response> {
  return Promise.resolve(new Response('todo', { status: 501 }));
}

if (import.meta.main) Deno.serve(handler);
