// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  sendWebPush,
  vapidAuthorization,
} from '../../../supabase/functions/_shared/webpush.ts';

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
      key,
      length * 8,
    ),
  );
}

/** A browser's side: a subscription key pair and RFC 8291 decryption. */
async function receiver() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const p256dh = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  async function decrypt(body: Uint8Array): Promise<string> {
    const salt = body.slice(0, 16);
    const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
    const idlen = body[20]!;
    const asPublic = body.slice(21, 21 + idlen);
    expect(rs).toBe(4096);
    const asKey = await crypto.subtle.importKey(
      'raw',
      asPublic,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, keys.privateKey, 256),
    );
    const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...p256dh, ...asPublic]);
    const ikm = await hkdf(auth, shared, info, 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + idlen)),
    );
    expect(plain[plain.length - 1]).toBe(2);
    return new TextDecoder().decode(plain.slice(0, -1));
  }
  return { sub: { p256dh: b64urlEncode(p256dh), auth: b64urlEncode(auth) }, decrypt };
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    pair,
    keys: { publicKey: b64urlEncode(raw), privateKey: jwk.d!, subject: 'mailto:test@example.com' },
  };
}

describe('web push', () => {
  it('base64url round-trips', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    expect(b64urlDecode(b64urlEncode(bytes))).toEqual(bytes);
  });

  it('encrypts a payload the subscriber can decrypt (RFC 8291 aes128gcm)', async () => {
    const r = await receiver();
    const message = JSON.stringify({ title: 'Due soon', body: '«مقاله» منتظر توست' });
    const body = await encryptPayload(r.sub, enc.encode(message));
    expect(await r.decrypt(body)).toBe(message);
    const again = await encryptPayload(r.sub, enc.encode(message));
    expect(b64urlEncode(again)).not.toBe(b64urlEncode(body)); // fresh salt and key each time
  });

  it('signs a VAPID JWT for the push service origin', async () => {
    const { pair, keys } = await vapidKeys();
    const header = await vapidAuthorization('https://push.example.net/send/abc', keys, 1_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(m[4]).toBe(keys.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2]!)));
    expect(claims).toEqual({
      aud: 'https://push.example.net',
      exp: 1_000 + 12 * 3600,
      sub: 'mailto:test@example.com',
    });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      b64urlDecode(m[3]!),
      enc.encode(`${m[1]}.${m[2]}`),
    );
    expect(ok).toBe(true);
  });

  it('sends with the right headers and reports expired subscriptions', async () => {
    const r = await receiver();
    const { keys } = await vapidKeys();
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: calls.length === 1 ? 201 : 410 });
    }) as unknown as typeof fetch;
    const sub = { endpoint: 'https://push.example.net/send/abc', ...r.sub };
    const first = await sendWebPush(sub, { title: 'x' }, keys, { fetchFn, topic: 'due:q1' });
    expect(first).toEqual({ ok: true, status: 201, gone: false });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['content-encoding']).toBe('aes128gcm');
    expect(headers.topic).toBe('dueq1');
    expect(await r.decrypt(calls[0]!.init.body as Uint8Array)).toBe('{"title":"x"}');
    expect((await sendWebPush(sub, {}, keys, { fetchFn })).gone).toBe(true);
  });
});
