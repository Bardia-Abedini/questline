/**
 * The real AI client: calls the `ai` edge function. Status comes from the auth state, the
 * network and the server's last answer (configured? limit reached?).
 */
import i18next from 'i18next';
import { aiUsageRepo, clock, type AiRequestKind } from '@/data';
import { AiUnavailableError, type AiClient, type AiStatus } from './aiTypes';
import { callFunction, FunctionError } from './functions';
import { setCloud, useCloud, type CloudState } from './store';

/** The client-visible status from the cloud state. */
export function aiStatusFrom(state: Pick<CloudState, 'auth' | 'online' | 'ai'>): AiStatus {
  if (state.auth !== 'signed_in') return 'guest';
  if (!state.online) return 'offline';
  if (state.ai.status === 'unconfigured') return 'unconfigured';
  if (state.ai.status === 'limit_reached') return 'limit_reached';
  return 'ready';
}

/** Asks the server whether AI is set up and how much of today's allowance is used. */
export async function refreshAiStatus(): Promise<void> {
  if (useCloud.getState().auth !== 'signed_in') return;
  try {
    const r = await callFunction<{ configured: boolean; used: number; limit: number }>('ai', {
      action: 'status',
    });
    setCloud({
      ai: {
        status: !r.configured ? 'unconfigured' : r.used >= r.limit ? 'limit_reached' : 'ready',
        used: r.used,
        limit: r.limit,
      },
    });
  } catch (error) {
    // The function itself is not deployed or unreachable: treat as not set up.
    if (error instanceof FunctionError && error.code === 'failed') {
      setCloud({ ai: { ...useCloud.getState().ai, status: 'unconfigured' } });
    }
  }
}

const KIND: Record<string, AiRequestKind> = {
  breakdown: 'breakdown',
  split: 'stuck',
  suggest_meta: 'suggest_fields',
  classify: 'classify',
  brain_dump: 'brain_dump',
  explain: 'what_now',
};

function record(action: string, status: 'ok' | 'error' | 'limited') {
  void aiUsageRepo
    .create({ kind: KIND[action]!, requested_at: clock.iso(), day: clock.today(), status })
    .catch(() => undefined);
}

async function call<T>(action: string, input: Record<string, unknown>): Promise<T> {
  const status = aiStatusFrom(useCloud.getState());
  if (status !== 'ready') throw new AiUnavailableError(status);
  const lang = i18next.language === 'fa' ? 'fa' : 'en';
  try {
    const r = await callFunction<{ result: T; used: number; limit: number }>('ai', {
      action,
      lang,
      ...input,
    });
    setCloud({
      ai: { status: r.used >= r.limit ? 'limit_reached' : 'ready', used: r.used, limit: r.limit },
    });
    record(action, 'ok');
    return r.result;
  } catch (error) {
    if (!(error instanceof FunctionError)) throw error;
    const ai = useCloud.getState().ai;
    switch (error.code) {
      case 'limit_reached':
        setCloud({
          ai: { ...ai, status: 'limit_reached', used: Number(error.detail.used ?? ai.used) },
        });
        record(action, 'limited');
        throw new AiUnavailableError('limit_reached');
      case 'not_configured':
        setCloud({ ai: { ...ai, status: 'unconfigured' } });
        throw new AiUnavailableError('unconfigured');
      case 'offline':
        throw new AiUnavailableError('offline');
      case 'not_signed_in':
        throw new AiUnavailableError('guest');
      default:
        record(action, 'error');
        throw new Error(`ai_${error.code}`);
    }
  }
}

export function createRealAiClient(status: AiStatus): AiClient {
  return {
    status,
    available: status === 'ready',
    breakDown: ({ title, notes }) => call('breakdown', { title, notes }),
    splitStep: ({ questTitle, stepTitle, guessMinutes }) =>
      call('split', { questTitle, stepTitle, guessMinutes }),
    suggestMeta: ({ title, notes }) => call('suggest_meta', { title, notes }),
    classifyQuick: ({ steps }) =>
      steps.length === 0 ? Promise.resolve([]) : call('classify', { steps }),
    brainDump: ({ text }) => call('brain_dump', { text }),
    explainPick: ({ questTitle, reasons }) => call('explain', { questTitle, reasons }),
  };
}
