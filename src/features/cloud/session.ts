/**
 * Accounts and sync lifecycle. Everything here is optional: without configuration the app
 * stays a guest app and none of this runs.
 *
 * Sign-out policy: the account's data is removed from this device and the device becomes a
 * fresh guest (language and appearance kept). The data stays in the account. Unsynced changes
 * are pushed first; if that is impossible the player is asked before anything is lost.
 */
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { readSnapshot, snapshotAsSettings } from '@/app/preferences/preferences';
import { db, setCurrentUserId } from '@/data';
import type { BootstrapOptions } from '@/data/bootstrap';
import {
  connectAccount,
  createSupabaseRemote,
  getDataOwner,
  resetToGuest,
  resolveAccountChoice,
  SyncEngine,
  type AccountChoice,
  type SyncRemote,
} from '@/data/sync';
import { i18next, isLanguage } from '@/i18n';
import { callFunction } from './functions';
import { setCloud, useCloud, type CloudUser } from './store';
import { getSupabase } from './supabaseClient';

let engine: SyncEngine | null = null;
let remote: SyncRemote | null = null;
let activeUserId: string | null = null;
let connecting: Promise<void> | null = null;

/** Language, time zone and appearance to keep when this device starts a fresh database. */
export function deviceBootstrap(): BootstrapOptions {
  const snapshot = readSnapshot();
  const language = isLanguage(snapshot.language)
    ? snapshot.language
    : isLanguage(i18next.language)
      ? i18next.language
      : 'en';
  return {
    language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    settings: snapshotAsSettings(snapshot),
  };
}

function toUser(session: Session): CloudUser {
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    provider: (session.user.app_metadata?.provider as string | undefined) ?? null,
  };
}

/** Reads `?error_description=` / `#error_description=` left by an auth redirect. */
function readLinkError(): string | null {
  if (typeof location === 'undefined') return null;
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('error_description') ?? hash.get('error_description');
}

/** Starts auth and, when signed in, sync. Called once from setup(). */
export async function startCloud(): Promise<() => void> {
  const client = await getSupabase();
  if (!client) {
    setCloud({ auth: 'unconfigured' });
    return () => undefined;
  }
  const linkError = readLinkError();
  if (linkError) setCloud({ linkError });

  const onOnline = () => {
    setCloud({ online: true });
    const user = useCloud.getState().user;
    if (user && !useCloud.getState().connected && useCloud.getState().choice === 'none') {
      void connect(client, user);
    }
  };
  const onOffline = () => setCloud({ online: false });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  const { data } = client.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
    // Supabase recommends not awaiting other calls inside this callback.
    setTimeout(() => void onAuthChange(client, event, session), 0);
  });
  return () => {
    data.subscription.unsubscribe();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    stopEngine();
  };
}

async function onAuthChange(
  client: SupabaseClient,
  event: AuthChangeEvent,
  session: Session | null,
) {
  if (event === 'PASSWORD_RECOVERY') setCloud({ recovery: true });
  if (!session) {
    if (activeUserId) {
      // Signed out elsewhere (session revoked): stop syncing, keep this device's data.
      stopEngine();
      activeUserId = null;
      setCurrentUserId(null);
    }
    setCloud({ auth: 'guest', user: null, connected: false, choice: 'none', sync: null });
    return;
  }
  const user = toUser(session);
  setCloud({ auth: 'signed_in', user });
  if (activeUserId !== user.id) await connect(client, user);
}

async function connect(client: SupabaseClient, user: CloudUser): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    stopEngine();
    activeUserId = user.id;
    remote = createSupabaseRemote(client, user.id);
    engine = new SyncEngine({ remote });
    engine.subscribe((sync) => setCloud({ sync }));
    try {
      const result = await connectAccount(user.id, remote, engine, deviceBootstrap());
      if (result === 'needs_choice') {
        setCloud({ choice: 'needed', connected: false });
        return;
      }
      setCloud({ choice: 'none', connected: true });
      engine.start();
    } catch (error) {
      console.warn('[cloud] could not link the account yet', (error as Error)?.message);
      setCloud({
        connected: false,
        sync: {
          state: navigator.onLine ? 'error' : 'offline',
          pending: await db.outbox.count(),
          failed: 0,
          lastSyncedAt: null,
          error: 'connect',
          live: false,
        },
      });
      // `syncNow` from the status badge or going online retries.
      activeUserId = null;
    }
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

function stopEngine() {
  engine?.stop();
  engine = null;
}

/** Retry button / app resume. Reconnects when the account was never linked. */
export async function syncNow(): Promise<void> {
  const state = useCloud.getState();
  if (state.auth !== 'signed_in' || !state.user) return;
  const client = await getSupabase();
  if (!client) return;
  if (!state.connected || !engine) {
    if (state.choice === 'none') await connect(client, state.user);
    return;
  }
  await engine.syncNow();
}

/** The player's answer to Merge / Keep account / Keep device. */
export async function chooseAccountData(choice: AccountChoice): Promise<void> {
  const user = useCloud.getState().user;
  if (!user || !remote || !engine) return;
  setCloud({ choice: 'working' });
  try {
    await resolveAccountChoice(choice, user.id, remote, engine, deviceBootstrap());
    setCloud({ choice: 'none', connected: true });
    engine.start();
  } catch (error) {
    setCloud({ choice: 'needed' });
    throw error;
  }
}

/** "Not now": stay signed in without linking this device yet (asked again next time). */
export async function postponeAccountChoice(): Promise<void> {
  await signOut({ keepLocalData: true });
}

/* ------------------------------------------------------------------- auth calls */

export type AuthErrorKey =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'offline'
  | 'unconfigured'
  | 'unknown';

export function authErrorKey(error: {
  code?: string;
  message?: string;
  status?: number;
}): AuthErrorKey {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || message.includes('invalid login'))
    return 'invalid_credentials';
  if (code === 'email_not_confirmed' || message.includes('not confirmed'))
    return 'email_not_confirmed';
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered')
  )
    return 'user_exists';
  if (code === 'weak_password' || message.includes('password should')) return 'weak_password';
  if (code.startsWith('over_') || error.status === 429) return 'rate_limited';
  if (message.includes('fetch') || message.includes('network')) return 'offline';
  return 'unknown';
}

type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: AuthErrorKey };

async function withClient(fn: (c: SupabaseClient) => Promise<AuthResult>): Promise<AuthResult> {
  const client = await getSupabase();
  if (!client) return { ok: false, error: 'unconfigured' };
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  try {
    return await fn(client);
  } catch (e) {
    return { ok: false, error: authErrorKey(e as Error) };
  }
}

const accountUrl = () => `${location.origin}/account`;

export function signUp(email: string, password: string): Promise<AuthResult> {
  return withClient(async (c) => {
    const { data, error } = await c.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: accountUrl() },
    });
    if (error) return { ok: false, error: authErrorKey(error) };
    // With email confirmation on, no session until the link is opened. An existing address
    // also comes back without a session (no identities) so nobody can probe for accounts.
    return { ok: true, needsConfirmation: !data.session };
  });
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return withClient(async (c) => {
    const { error } = await c.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
  });
}

export function signInWithGoogle(): Promise<AuthResult> {
  return withClient(async (c) => {
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: accountUrl() },
    });
    return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
  });
}

export function sendPasswordReset(email: string): Promise<AuthResult> {
  return withClient(async (c) => {
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: accountUrl() });
    return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
  });
}

export function updatePassword(password: string): Promise<AuthResult> {
  return withClient(async (c) => {
    const { error } = await c.auth.updateUser({ password });
    if (error) return { ok: false, error: authErrorKey(error) };
    setCloud({ recovery: false });
    return { ok: true };
  });
}

export function resendConfirmation(email: string): Promise<AuthResult> {
  return withClient(async (c) => {
    const { error } = await c.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: accountUrl() },
    });
    return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
  });
}

export interface SignOutResult {
  done: boolean;
  /** Changes that could not be uploaded (only when `force` was not set). */
  pending: number;
}

/**
 * Signs out. Unsynced changes are pushed first; if some remain and `force` is not set,
 * nothing happens and the count is returned so the UI can ask.
 */
export async function signOut(
  options: { force?: boolean; keepLocalData?: boolean } = {},
): Promise<SignOutResult> {
  const client = await getSupabase();
  if (!client) return { done: true, pending: 0 };
  const owner = await getDataOwner();
  if (engine && owner && !options.keepLocalData) {
    await engine.syncNow();
    const pending = await db.outbox.count();
    if (pending > 0 && !options.force) return { done: false, pending };
  }
  stopEngine();
  activeUserId = null;
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  if (owner && !options.keepLocalData) await resetToGuest(deviceBootstrap());
  setCurrentUserId(null);
  setCloud({ auth: 'guest', user: null, connected: false, choice: 'none', sync: null });
  return { done: true, pending: 0 };
}

/** Deletes the account and all its data on the server, then resets this device. */
export async function deleteAccount(): Promise<{ ok: boolean }> {
  const client = await getSupabase();
  if (!client) return { ok: false };
  // Best effort: revoke Google access and stop push first (their rows go with the account).
  await callFunction('calendar', { action: 'disconnect' }).catch(() => undefined);
  await callFunction('push', { action: 'unsubscribe_all' }).catch(() => undefined);
  const { error } = await client.rpc('delete_my_account');
  if (error) return { ok: false };
  stopEngine();
  activeUserId = null;
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  await resetToGuest(deviceBootstrap());
  setCloud({ auth: 'guest', user: null, connected: false, choice: 'none', sync: null });
  return { ok: true };
}
