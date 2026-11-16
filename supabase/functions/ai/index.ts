// Edge function `ai`: every method of the app's AI client (src/features/cloud/aiTypes.ts),
// through the Claude Messages API with structured JSON output, validated before returning.
//
// Secrets / env: ANTHROPIC_API_KEY (required for AI), ANTHROPIC_MODEL (default
// claude-haiku-5-5, see _shared/ai.ts), ANTHROPIC_EFFORT (low),
// AI_DAILY_LIMIT (requests per user per UTC day, default 50), ALLOWED_ORIGINS.
// Privacy: task text is never logged; logs carry only the action, outcome and timing.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import {
  buildPrompt,
  extractJson,
  messageParams,
  parseRequest,
  validateOutput,
  type AiRequest,
  type AiResult,
} from '../_shared/ai.ts';
import { corsHeaders, json, readJson } from '../_shared/http.ts';
import { adminClient, allowedOrigins, env, requireUser } from '../_shared/supabase.ts';

const today = () => new Date().toISOString().slice(0, 10);
const dailyLimit = () => Math.max(1, Number(env('AI_DAILY_LIMIT', '50')) || 50);

function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'ai', ...fields }));
}

async function usage(userId: string): Promise<number> {
  const { data } = await adminClient()
    .from('ai_quota')
    .select('used')
    .eq('user_id', userId)
    .eq('day', today())
    .maybeSingle();
  return (data?.used as number | undefined) ?? 0;
}

class BadOutput extends Error {}

/** One Messages API call with structured output; one retry with the validation error. */
async function ask(req: AiRequest): Promise<AiResult> {
  const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 1 });
  const prompt = buildPrompt(req);
  const params = messageParams(prompt, {
    model: env('ANTHROPIC_MODEL'),
    effort: env('ANTHROPIC_EFFORT'),
    fallbacks: env('ANTHROPIC_FALLBACKS'),
  });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt.user }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.beta.messages.create({ ...params, messages });
    if (response.stop_reason === 'refusal') throw new BadOutput('refusal');
    const textReply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const checked = validateOutput(req, extractJson(textReply));
    if (checked.ok) return checked.value;
    if (attempt === 0) {
      messages.push(
        { role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] },
        {
          role: 'user',
          content: `That reply does not fit the rules: ${checked.error}. Reply again with corrected JSON.`,
        },
      );
    }
  }
  throw new BadOutput('invalid');
}

export async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req.headers.get('origin'), allowedOrigins());
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'failed' }, 405, cors);

  const user = await requireUser(req);
  if (!user) return json({ error: 'not_signed_in' }, 401, cors);

  let body: unknown;
  try {
    body = await readJson(req, 32_000);
  } catch {
    return json({ error: 'bad_input' }, 400, cors);
  }
  const configured = env('ANTHROPIC_API_KEY') !== '';
  const limit = dailyLimit();

  if ((body as { action?: unknown })?.action === 'status') {
    return json({ configured, used: await usage(user.id), limit }, 200, cors);
  }
  if (!configured) return json({ error: 'not_configured' }, 503, cors);

  const parsed = parseRequest(body);
  if (!parsed.ok) return json({ error: 'bad_input', field: parsed.error }, 400, cors);

  const day = today();
  const { data: quota, error: quotaError } = await adminClient().rpc('ai_consume', {
    p_user: user.id,
    p_day: day,
    p_limit: limit,
  });
  if (quotaError) {
    log({ action: parsed.value.action, outcome: 'quota_error' });
    return json({ error: 'failed' }, 500, cors);
  }
  if (!quota.allowed) {
    log({ action: parsed.value.action, outcome: 'limit_reached' });
    return json({ error: 'limit_reached', used: quota.used, limit }, 429, cors);
  }

  const started = Date.now();
  try {
    const result = await ask(parsed.value);
    log({ action: parsed.value.action, outcome: 'ok', ms: Date.now() - started });
    return json({ result, used: quota.used, limit }, 200, cors);
  } catch (error) {
    // Not the player's fault: give the request back.
    await adminClient().rpc('ai_refund', { p_user: user.id, p_day: day });
    const bad = error instanceof BadOutput;
    log({
      action: parsed.value.action,
      outcome: bad ? 'bad_output' : 'upstream_error',
      status: error instanceof Anthropic.APIError ? error.status : undefined,
      ms: Date.now() - started,
    });
    return json({ error: bad ? 'bad_output' : 'failed' }, 502, cors);
  }
}

if (import.meta.main) Deno.serve(handler);
