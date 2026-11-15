#!/usr/bin/env node
// Fake external services for testing the edge functions without real keys:
//   - Anthropic Messages API (POST /v1/messages): answers from the requested JSON schema.
//     A task containing "RETRY-ME" gets an invalid first reply (tests the retry);
//     "BAD-OUTPUT" always gets an invalid reply (tests bad_output and the refund).
//   - Google OAuth and Calendar: consent page that redirects straight back with a code,
//     token endpoint (refresh token "revoked" -> invalid_grant), revoke, calendars, events.
//   - A web push service (POST /push/<id>) that decrypts what it receives (RFC 8291).
// Control: GET /__log, GET /__events, GET /__subscriber, POST /__reset.
//
// Usage: node supabase/tests/functions/fake-services.mjs   (port FAKE_PORT, default 54399)
import { createDecipheriv, createECDH, hkdfSync } from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.FAKE_PORT ?? 54399);
let log = [];
let events = new Map();
let calendars = new Set();
let aiCalls = 0;

// The subscriber side of push: a browser key pair and auth secret.
const subscriber = createECDH('prime256v1');
subscriber.generateKeys();
const authSecret = Buffer.from('0123456789abcdef');

function decryptPush(body) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const senderKey = body.subarray(21, 21 + idlen);
  const shared = subscriber.computeSecret(senderKey);
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    subscriber.getPublicKey(),
    senderKey,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, info, 32));
  const cek = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12),
  );
  const data = body.subarray(21 + idlen);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([
    decipher.update(data.subarray(0, data.length - 16)),
    decipher.final(),
  ]);
  if (plain[plain.length - 1] !== 2) throw new Error('bad padding delimiter');
  return plain.subarray(0, -1).toString();
}

/** A reply that fits the requested schema (or deliberately does not). */
function aiReply(request) {
  const schema = request.output_config?.format?.schema ?? {};
  const required = schema.required ?? [];
  const userText = JSON.stringify(request.messages[0]?.content ?? '');
  const retry = request.messages.length > 1;
  const invalid = userText.includes('BAD-OUTPUT') || (userText.includes('RETRY-ME') && !retry);
  const steps = [
    { title: 'Open what you need', guessMinutes: invalid ? 10 : 2, quick: true },
    { title: 'Do the first real part', guessMinutes: 15, quick: false },
    { title: 'Finish and put it away', guessMinutes: 10, quick: false },
  ];
  if (invalid) return { steps };
  if (required.includes('steps')) return { steps };
  if (required.includes('quests')) {
    const dump = /<dump>\n([\s\S]*?)\n<\/dump>/.exec(userText.replace(/\\n/g, '\n'))?.[1] ?? '';
    const titles = dump
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      quests: titles.map((title) => ({
        title,
        notes: '',
        priority: 'medium',
        difficulty: 'C',
        guessMinutes: 30,
        steps,
      })),
    };
  }
  if (required.includes('priority')) return { priority: 'high', difficulty: 'B', guessMinutes: 45 };
  if (required.includes('quick')) {
    const n = (userText.match(/\(\d+ steps\)/) || ['(1 steps)'])[0].match(/\d+/)[0];
    return { quick: Array.from({ length: Number(n) }, (_, i) => i === 0) };
  }
  if (required.includes('line')) return { line: 'A short, kind reason to start now.' };
  return {};
}

const read = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
const send = (res, status, obj) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(obj === undefined ? '' : JSON.stringify(obj));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const raw = await read(req);
    const path = url.pathname;

    if (path === '/__log') return send(res, 200, log);
    if (path === '/__events') return send(res, 200, [...events.values()]);
    if (path === '/__subscriber') {
      return send(res, 200, {
        p256dh: subscriber.getPublicKey().toString('base64url'),
        auth: authSecret.toString('base64url'),
      });
    }
    if (path === '/__reset') {
      log = [];
      events = new Map();
      calendars = new Set();
      return send(res, 200, { ok: true });
    }

    if (path === '/v1/messages') {
      const body = JSON.parse(raw.toString());
      aiCalls++;
      log.push({
        kind: 'ai',
        model: body.model,
        effort: body.output_config?.effort,
        schema: !!body.output_config?.format?.schema,
        retry: body.messages.length > 1,
        fallbacks: body.fallbacks ?? null,
        temperature: body.temperature ?? null,
      });
      return send(res, 200, {
        id: `msg_fake_${aiCalls}`,
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text: JSON.stringify(aiReply(body)) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      });
    }

    // Google consent screen: approve at once and go back with a code.
    if (path === '/o/oauth2/v2/auth') {
      log.push({ kind: 'consent', pkce: url.searchParams.get('code_challenge_method') });
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.searchParams.set('code', 'fake-code');
      back.searchParams.set('state', url.searchParams.get('state'));
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (path === '/token') {
      const p = new URLSearchParams(raw.toString());
      log.push({ kind: 'token', grant: p.get('grant_type'), verifier: !!p.get('code_verifier') });
      if (p.get('refresh_token') === 'revoked') return send(res, 400, { error: 'invalid_grant' });
      const idToken = `x.${Buffer.from(JSON.stringify({ email: 'player@gmail.test' })).toString('base64url')}.y`;
      return send(res, 200, {
        access_token: `at-${Date.now()}`,
        expires_in: 3600,
        refresh_token: 'rt-1',
        id_token: idToken,
        scope: 'calendar',
      });
    }
    if (path === '/revoke') {
      log.push({ kind: 'revoke' });
      return send(res, 200, {});
    }
    if (path === '/calendar/v3/calendars' && req.method === 'POST') {
      calendars.add('questline-cal');
      log.push({ kind: 'calendar_create' });
      return send(res, 200, { id: 'questline-cal' });
    }
    const eventPath = /^\/calendar\/v3\/calendars\/questline-cal\/events(?:\/([^/]+))?$/.exec(path);
    if (eventPath) {
      const id = eventPath[1];
      if (req.method === 'PUT') {
        if (!events.has(id)) return send(res, 404, {});
        events.set(id, JSON.parse(raw.toString()));
        log.push({ kind: 'event_update', id });
        return send(res, 200, { id, etag: '"2"' });
      }
      if (req.method === 'POST') {
        const event = JSON.parse(raw.toString());
        events.set(event.id, event);
        log.push({ kind: 'event_insert', id: event.id });
        return send(res, 200, { id: event.id, etag: '"1"' });
      }
      if (req.method === 'DELETE') {
        events.delete(id);
        log.push({ kind: 'event_delete', id });
        return send(res, 204);
      }
    }
    if (path === '/calendar/v3/calendars/questline-cal') {
      return calendars.has('questline-cal')
        ? send(res, 200, { id: 'questline-cal' })
        : send(res, 404, {});
    }
    if (path === '/calendar/v3/calendars/primary/events') {
      const day = (url.searchParams.get('timeMin') ?? '').slice(0, 10);
      return send(res, 200, {
        items: [
          {
            id: 'e1',
            summary: 'Dentist',
            start: { dateTime: `${day}T10:00:00Z` },
            end: { dateTime: `${day}T11:00:00Z` },
          },
        ],
      });
    }
    const push = /^\/push\/([\w-]+)$/.exec(path);
    if (push) {
      try {
        log.push({
          kind: 'push',
          vapid: /^vapid t=[^,]+, k=/.test(req.headers.authorization ?? ''),
          encoding: req.headers['content-encoding'],
          payload: JSON.parse(decryptPush(raw)),
        });
        return send(res, 201);
      } catch (e) {
        log.push({ kind: 'push_error', message: String(e) });
        return send(res, 400, {});
      }
    }
    log.push({ kind: 'unhandled', method: req.method, path });
    return send(res, 404, {});
  })
  .listen(PORT, '127.0.0.1', () => console.log(`fake services on http://127.0.0.1:${PORT}`));
